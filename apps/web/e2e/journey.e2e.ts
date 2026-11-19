import { expect, test, type Page } from '@playwright/test';

const email = `e2e-${Date.now()}@example.com`;
const password = 'correct-horse-battery-staple';
const venueName = 'The Crown';
const renamedVenue = 'The Rose & Crown';
const staffMembers = [
  { name: 'Sam Jones', role: 'Kitchen', email: 'sam@example.com', phone: '07700 900123' },
  { name: 'Jo Bloggs', role: 'Floor', email: 'jo@example.com', phone: '07700 900456' },
  { name: 'Alex Smith', role: 'Bar', email: 'alex@example.com', phone: '' },
];

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

  function staffList() {
    return page.getByRole('list', { name: 'Staff' });
  }

  function staffForm(submitLabel: string) {
    return page.locator('form').filter({ has: page.getByRole('button', { name: submitLabel }) });
  }

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

  test('describes an empty Venue name with a translated error', async () => {
    await page.getByRole('button', { name: 'Create venue' }).click();
    await expect(page.getByLabel('Venue name')).toHaveAccessibleDescription(
      'This field is required.',
    );
  });

  test('describes a Venue name over the limit with the limit from the shared schema', async () => {
    await page.getByLabel('Venue name').fill('x'.repeat(101));
    await page.getByRole('button', { name: 'Create venue' }).click();
    await expect(page.getByLabel('Venue name')).toHaveAccessibleDescription(
      'Use 100 characters or fewer.',
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

  test('opens the Staff page with no Staff Members yet', async () => {
    await page.getByRole('link', { name: 'Staff' }).click();
    await expect(page.getByText('No Staff Members yet. Add the first one below.')).toBeVisible();
  });

  test('rejects a Staff Member with no email address', async () => {
    const addForm = staffForm('Add staff member');
    await addForm.getByLabel('Name').fill('Alex Smith');
    await addForm.getByLabel('Role').fill('Bar');
    await addForm.getByRole('button', { name: 'Add staff member' }).click();
    await expect(addForm.getByLabel('Email')).toHaveAccessibleDescription(
      'This field is required.',
    );
  });

  test('adds three Staff Members and lists them by name', async () => {
    const addForm = staffForm('Add staff member');
    for (const { name, role, email, phone } of staffMembers) {
      await addForm.getByLabel('Name').fill(name);
      await addForm.getByLabel('Role').fill(role);
      await addForm.getByLabel('Email').fill(email);
      await addForm.getByLabel('Phone').fill(phone);
      await addForm.getByRole('button', { name: 'Add staff member' }).click();
      await expect(staffList().getByText(name)).toBeVisible();
      await expect(addForm.getByLabel('Name')).toHaveValue('');
    }
    await expect(staffList().getByRole('listitem')).toHaveCount(3);
    await expect(staffList().getByRole('listitem').first()).toContainText('Alex Smith');
  });

  test('edits a Staff Member', async () => {
    await page.getByRole('button', { name: 'Edit Sam Jones' }).click();
    const editForm = staffForm('Save changes');
    await editForm.getByLabel('Role').fill('Floor');
    await editForm.getByRole('button', { name: 'Save changes' }).click();
    await expect(
      staffList().getByRole('listitem').filter({ hasText: 'Sam Jones' }),
    ).toContainText('Floor');
  });

  test('asks for confirmation before archiving a Staff Member', async () => {
    await page.getByRole('button', { name: 'Archive Jo Bloggs' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Archive Jo Bloggs?');
  });

  test('archives a Staff Member and hides them from the list', async () => {
    await page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(staffList().getByRole('listitem')).toHaveCount(2);
    await expect(staffList()).not.toContainText('Jo Bloggs');
  });

  test('keeps the archived Staff Member hidden after a reload', async () => {
    await page.reload();
    await expect(staffList().getByRole('listitem')).toHaveText([/Alex Smith/, /Sam Jones/]);
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
