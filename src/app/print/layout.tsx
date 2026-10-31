import { requirePage } from '@/server/session';
import { PrintButton } from './print-button';

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requirePage();
  return (
    <div className="min-h-screen bg-canvas py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 px-4"><PrintButton /></div>
      <div className="mx-auto max-w-[210mm] bg-white p-10 shadow print:p-0 print:shadow-none">{children}</div>
    </div>
  );
}
