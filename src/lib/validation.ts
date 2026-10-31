// Shared input normalisation for Zimbabwean identifiers (server and client).

// 0772123456 / +263 77 212 3456 / 772123456 → 263772123456. Returns null if not a valid mobile/landline.
export function normalizeZimPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '263' + d.slice(1);
  else if (!d.startsWith('263') && d.length === 9) d = '263' + d;
  if (!d.startsWith('263')) return d.length >= 10 && d.length <= 15 ? d : null; // foreign number in full international form
  const local = d.slice(3);
  return /^7[1378]\d{7}$/.test(local) || /^[2-6]\d{6,8}$/.test(local) ? d : null;
}

export const formatZimPhone = (e164: string | null | undefined) => {
  if (!e164) return '';
  const m = /^263(7\d)(\d{3})(\d{4})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : `+${e164}`;
};

// Zimbabwe national ID: district (2) + serial (6-7) + check letter + district (2), e.g. 63-123456 F 42
const NID = /^(\d{2})[-\s]?(\d{6,7})[-\s]?([A-Z])[-\s]?(\d{2})$/;

export function normalizeNationalId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = NID.exec(raw.trim().toUpperCase());
  return m ? `${m[1]}-${m[2]} ${m[3]} ${m[4]}` : null;
}

export function ageFrom(dob: string | Date | null | undefined, ref = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  let age = ref.getFullYear() - d.getFullYear();
  const m = ref.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) age--;
  return age;
}

export function bmi(weightKg?: number | null, heightCm?: number | null): number | null {
  if (!weightKg || !heightCm) return null;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}
