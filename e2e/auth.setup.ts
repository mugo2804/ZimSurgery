import { test as setup } from '@playwright/test';
import { ROLES, USERS } from './roles';

// Signs in once per role through the real login API and saves the session
const PASSWORD = process.env.SEED_PASSWORD ?? 'Zimmed-Demo-2026!'; // the seed script's demo password

for (const [role, username] of Object.entries(USERS)) {
  setup(`sign in as ${role}`, async ({ request, baseURL }) => {
    const res = await request.post('/api/auth/sign-in/username', { data: { username, password: PASSWORD }, headers: { Origin: baseURL! } });
    if (!res.ok()) throw new Error(`Sign-in as ${username} failed: ${res.status()}`);
    await request.storageState({ path: ROLES[role as keyof typeof ROLES] });
  });
}
