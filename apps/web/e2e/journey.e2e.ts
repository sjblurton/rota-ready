import { expect, test, type Page } from '@playwright/test';

const email = `e2e-${Date.now()}@example.com`;
const password = 'correct-horse-battery-staple';

async function textLeftInPlainEnglish(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const texts: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      if (text) texts.push(text);
    }
    return texts.filter((text) => !/^\[.*\]$/s.test(text));
  });
}

test.describe.serial('MVP journey', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('sends a logged-out visitor to the login page', async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  });

  test('signs up and shows the new email address in the header', async () => {
    await page.getByRole('link', { name: 'Create an account' }).click();
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('banner')).toContainText(email);
  });

  test('shows the live API status once logged in', async () => {
    await expect(page.getByRole('status')).toHaveText('API ok · DB ok');
  });

  test('logs out and lands on the login page', async () => {
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  });

  test('keeps a logged-out visitor out of the app', async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  });

  test('rejects a wrong password with a translated message', async () => {
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      "That email and password don't match an account.",
    );
  });

  test('logs back in and shows the email address in the header', async () => {
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('banner')).toContainText(email);
  });

  test('shows every string as pseudo-text with ?lng=pseudo, apart from the email address', async () => {
    await page.goto('/?lng=pseudo');
    await expect(page.getByRole('banner')).toContainText(email);
    await expect(page.getByRole('status')).toHaveText(/^\[.*\]$/);
    expect(await textLeftInPlainEnglish(page)).toEqual([email]);
  });

  test('shows the login page as pseudo-text after logging out with ?lng=pseudo', async () => {
    await page.getByRole('button', { name: /^\[/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\[.*\]$/);
    expect(await textLeftInPlainEnglish(page)).toEqual([]);
  });
});
