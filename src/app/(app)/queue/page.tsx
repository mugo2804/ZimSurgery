import { requirePage } from '@/server/session';
import { QueueBoard } from './board';

export const metadata = { title: 'Waiting room' };

export default async function QueuePage() {
  const user = await requirePage('queue:read');
  return <QueueBoard role={user.role} userId={user.id} />;
}
