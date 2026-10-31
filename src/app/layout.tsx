import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'ZimMedPractice', template: '%s · ZimMedPractice' },
  description: 'Electronic health records and practice management',
  applicationName: 'ZimMedPractice',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#0b5cad', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request CSP nonces (src/proxy.ts) only work on dynamically rendered pages
  await connection();
  return (
    <html lang="en-ZW">
      <body>{children}</body>
    </html>
  );
}
