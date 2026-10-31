import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';

// SMTP via any provider (Brevo free tier suggested — docs/THIRD_PARTY.md). Used for claim batches only.
let transport: Transporter | null = null;

export const emailConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_FROM);

function getTransport() {
  if (transport) return transport;
  const port = Number(process.env.SMTP_PORT ?? 587);
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465, // never send claim data over an unencrypted connection
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

export async function sendEmail(msg: { to: string; subject: string; text: string; attachments?: { filename: string; content: string; contentType: string }[] }) {
  await getTransport().sendMail({ from: process.env.SMTP_FROM, ...msg });
}
