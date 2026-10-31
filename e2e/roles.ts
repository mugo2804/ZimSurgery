// Saved sign-in sessions per role, created by auth.setup.ts.
// Use in a test file: test.use({ storageState: ROLES.doctor })
export const ROLES = {
  admin: 'e2e/.auth/admin.json',
  doctor: 'e2e/.auth/doctor.json',
  nurse: 'e2e/.auth/nurse.json',
  reception: 'e2e/.auth/reception.json',
} as const;

export const USERS = { admin: 'manager', doctor: 'dr.moyo', nurse: 'sr.dube', reception: 'reception' } as const;
