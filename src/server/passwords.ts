import 'server-only';
import { HttpError } from './errors';

// Small local deny-list (no external call). Extend with the practice's own banned words.
const COMMON = new Set([
  'password', 'password1', 'password123', 'passw0rd', '1234567890', '0123456789', 'qwertyuiop', 'iloveyou',
  'letmein123', 'welcome123', 'admin12345', 'changeme123', 'zimbabwe123', 'harare1234', 'bulawayo123',
  'doctor1234', 'nurse12345', 'medical123', 'hospital123', 'clinic1234', '11111111111', 'abcdefghij',
]);

export function assertStrongPassword(pw: string) {
  if (pw.length < 10) throw new HttpError(400, 'Password must be at least 10 characters');
  if (pw.length > 128) throw new HttpError(400, 'Password is too long');
  if (COMMON.has(pw.toLowerCase())) throw new HttpError(400, 'That password is too common');
  if (new Set(pw).size < 5) throw new HttpError(400, 'Password needs more variety of characters');
}
