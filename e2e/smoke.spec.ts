import { expect, test } from '@playwright/test';
import { ROLES } from './roles';

test.describe('access control', () => {
  test('signed-out visitors are sent to login', async ({ page }) => {
    await page.goto('/patients');
    await expect(page).toHaveURL(/\/login/);
  });

  test('wrong password is rejected', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#username', 'reception');
    await page.fill('#password', 'not-the-password');
    await page.click('button:has-text("Sign in")');
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('reception cannot open clinical pages', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ROLES.reception });
    const page = await ctx.newPage();
    await page.goto('/labs');
    await expect(page).toHaveURL(/\/forbidden/);
    await ctx.close();
  });
});

test.describe('front desk to billing', () => {
  test.use({ storageState: ROLES.reception });

  test('register a patient, check in, and see them in the waiting room', async ({ page }) => {
    await page.goto('/patients/new');
    await page.getByLabel('First name *').fill('E2E');
    await page.getByLabel('Surname *').fill(`Tester${Date.now() % 100000}`);
    await page.getByLabel('Mobile').fill('0772 987 654');
    await page.getByRole('button', { name: 'Register patient' }).click();
    await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
    await page.getByRole('button', { name: 'Check in' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Check in' }).click();
    await expect(page).toHaveURL(/\/queue/);
    await expect(page.getByText(/Tester\d+, E2E/)).toBeVisible();
  });
});

test.describe('clinical', () => {
  test.use({ storageState: ROLES.doctor });

  test('doctor can open the waiting room and the visits API', async ({ page, request }) => {
    await page.goto('/queue');
    await expect(page.getByRole('heading', { name: 'Waiting room' })).toBeVisible();
    expect((await request.get('/api/visits')).ok()).toBe(true);
  });
  // TODO (Phase 8): AC C4 — printing a prescription is blocked when the prescriber has no HPZ number
});

test.describe('offline', () => {
  test.use({ storageState: ROLES.reception });

  test('the queue board shows the offline banner and keeps working', async ({ page, context }) => {
    await page.goto('/queue');
    await expect(page.getByRole('heading', { name: 'Waiting room' })).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByText(/Offline/).first()).toBeVisible();
    await context.setOffline(false);
  });
});
