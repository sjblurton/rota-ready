import { expect, test, type Page } from '@playwright/test';

const email = `e2e-${Date.now()}@example.com`;
const password = 'correct-horse-battery-staple';
const venueName = 'The Crown';
const renamedVenue = 'The Rose & Crown';

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

  test('sends a new User with no Venue to onboarding', async () => {
    await expect(page.getByRole('heading', { name: 'Set up your venue' })).toBeVisible();
  });

  test('defaults the Venue timezone to Europe/London', async () => {
    await expect(page.getByLabel('Timezone')).toHaveValue('Europe/London');
  });

  test('marks the Venue name as required, with the limit from the shared schema', async () => {
    await expect(page.getByLabel('Venue name')).toHaveJSProperty('required', true);
    await expect(page.getByLabel('Venue name')).toHaveAttribute('maxlength', '100');
  });

  test('describes an empty Venue name with a translated error', async () => {
    await page.getByRole('button', { name: 'Create venue' }).click();
    await expect(page.getByLabel('Venue name')).toHaveAccessibleDescription(
      'This field is required.',
    );
  });

  test('creates the Venue and shows its name', async () => {
    await page.getByLabel('Venue name').fill(venueName);
    await page.getByRole('button', { name: 'Create venue' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(venueName);
    await expect(page.getByText('Timezone: Europe/London')).toBeVisible();
  });

  test('renames the Venue', async () => {
    await page.getByLabel('Venue name').fill(renamedVenue);
    await page.getByRole('button', { name: 'Save name' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(renamedVenue);
  });

  test('keeps a User with a Venue out of onboarding', async () => {
    await page.goto('/onboarding');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(renamedVenue);
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

  test('lands on the renamed Venue after logging back in', async () => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(renamedVenue);
  });

  test('shows a loading screen while the API is slow to answer', async () => {
    await page.route('**/api/me', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      await route.continue();
    });
    await page.goto('/');
    await expect(page.getByText('Loading…')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(renamedVenue);
    await page.unroute('**/api/me');
  });

  test('shows every string as pseudo-text with ?lng=pseudo, apart from the email address and Venue name', async () => {
    await page.goto('/?lng=pseudo');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(renamedVenue);
    await expect(page.getByRole('status')).toHaveText(/^\[.*\]$/);
    expect(await textLeftInPlainEnglish(page)).toEqual([email, renamedVenue]);
  });

  test('shows the login page as pseudo-text after logging out with ?lng=pseudo', async () => {
    await page.getByRole('banner').getByRole('button').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\[.*\]$/);
    expect(await textLeftInPlainEnglish(page)).toEqual([]);
  });
});
