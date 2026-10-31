import type { getConsultation } from '@/server/services/clinical';
import type { Allergy } from '@/server/db/schema';

type Raw = Awaited<ReturnType<typeof getConsultation>>;
// Server data after JSON serialisation: Date → string
type Jsonify<T> = T extends Date ? string : T extends (infer U)[] ? Jsonify<U>[] : T extends object ? { [K in keyof T]: Jsonify<T[K]> } : T;
export type ConsultData = Jsonify<Raw>;
export type Dx = { code: string; description: string; isPrimary: boolean };
export type PatientLite = {
  id: string; firstName: string; lastName: string; dob: string | null; sex: string | null;
  allergies: Allergy[]; allergyStatus: string; address: string | null; city: string | null;
};
