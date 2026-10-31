import { route } from '@/server/api';
import { bus, type AppEvent } from '@/server/events';

export const dynamic = 'force-dynamic';

// Server-Sent Events for live boards (FEATURES B1). Payloads are IDs only — no patient data.
export const GET = route({ perm: 'queue:read' }, async ({ req }) => {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => { try { controller.enqueue(encoder.encode(chunk)); } catch { cleanup(); } };
      const onEvent = (ev: AppEvent) => send(`event: ${ev.type}\ndata: ${JSON.stringify({ id: ev.id ?? null })}\n\n`);
      const heartbeat = setInterval(() => send(': ping\n\n'), 25_000);
      bus.on('event', onEvent);
      cleanup = () => { clearInterval(heartbeat); bus.off('event', onEvent); try { controller.close(); } catch { /* closed */ } };
      req.signal.addEventListener('abort', cleanup);
      send('retry: 5000\n\n');
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
  });
});
