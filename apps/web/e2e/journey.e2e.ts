import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { addDays, daysBetween, formatLocalDate } from '@rota-ready/shared';

const email = `e2e-${Date.now()}@example.com`;
const password = 'correct-horse-battery-staple';
const mailpitUrl = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const venueName = 'The Crown';
const renamedVenue = 'The Rose & Crown';
const rotaWeekUrl = /\/rota\/\d{4}-\d{2}-\d{2}$/;
const staffMembers = [
  { name: 'Sam Jones', role: 'Kitchen', email: 'sam@example.com', phone: '07700 900123' },
  { name: 'Jo Bloggs', role: 'Floor', email: 'jo@example.com', phone: '07700 900456' },
  { name: 'Alex Smith', role: 'Bar', email: 'alex@example.com', phone: '' },
];

interface MailpitMessage {
  ID: string;
  Created: string;
}

async function latestEmailTextTo(address: string, since: Date): Promise<string | undefined> {
  const search = await fetch(
    `${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}&limit=1`,
  );
  const { messages } = (await search.json()) as { messages: MailpitMessage[] };
  const latest = messages[0];
  if (!latest || new Date(latest.Created) < since) return undefined;
  const message = await fetch(`${mailpitUrl}/api/v1/message/${latest.ID}`);
  return ((await message.json()) as { Text: string }).Text;
}

async function emailTextsTo(address: string, since: Date): Promise<string[]> {
  const search = await fetch(
    `${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}&limit=10`,
  );
  const { messages } = (await search.json()) as { messages: MailpitMessage[] };
  const recent = messages.filter((message) => new Date(message.Created) >= since);
  return Promise.all(
    recent.map(async ({ ID }) => {
      const message = await fetch(`${mailpitUrl}/api/v1/message/${ID}`);
      return ((await message.json()) as { Text: string }).Text;
    }),
  );
}

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
  let thisWeek: string;
  let plannedWeek: string;
  let nextWeek: string;
  let samsLink: string;
  let samsEmailedLink: string;
  let publishedWeekAt: Date;
  let samsNewLink: string;
  let josLink: string;
  let updatesSentAt: Date;
  let privateWindow: BrowserContext;
  let staffLinkPage: Page;

  function staffTable() {
    return page.getByRole('table', { name: 'Staff' });
  }

  function weekHeading(weekStart: string) {
    return page.getByRole('heading', {
      name: `Week of ${formatLocalDate(weekStart, { withYear: true })}`,
    });
  }

  async function openRota(weekStart: string) {
    await page.getByRole('tab', { name: 'Rota' }).click();
    await page.waitForURL(rotaWeekUrl);
    const shownWeek = page.url().slice(-10);
    const weeksAway = daysBetween(shownWeek, weekStart) / 7;
    const link = weeksAway > 0 ? 'Next Week' : 'Previous Week';
    for (let step = 1; step <= Math.abs(weeksAway); step++) {
      await page.getByRole('link', { name: link }).click();
      await expect(weekHeading(addDays(shownWeek, 7 * Math.sign(weeksAway) * step))).toBeVisible();
    }
    await expect(weekHeading(weekStart)).toBeVisible();
  }

  function toast() {
    return page.locator('[data-sonner-toast]');
  }

  async function dismissToasts() {
    await page.clock.fastForward(10_000);
    await expect(toast()).toHaveCount(0);
  }

  async function invalidateSessionToken() {
    await page.evaluate(() => {
      const key = Object.keys(localStorage).find((name) => /^sb-.+-auth-token$/.test(name));
      if (!key) throw new Error('No Supabase session in localStorage');
      const session = JSON.parse(localStorage.getItem(key) ?? '') as { access_token: string };
      const [header, payload] = session.access_token.split('.');
      session.access_token = `${header}.${payload}.not-the-signature`;
      localStorage.setItem(key, JSON.stringify(session));
    });
  }

  async function logBackInToRenamedVenue() {
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(renamedVenue);
  }

  async function failRenameRequests() {
    await page.route('**/api/venues/*', (route) =>
      route.request().method() === 'PATCH' ? route.abort('internetdisconnected') : route.continue(),
    );
  }

  function rotaGrid() {
    return page.getByRole('table', { name: 'Rota' });
  }

  function rotaCell(staffMemberName: string, day: string, weekStart = plannedWeek) {
    return rotaGrid()
      .getByRole('row', { name: staffMemberName })
      .getByRole('cell')
      .nth(1 + daysBetween(weekStart, day));
  }

  function editShiftButton(staffMemberName: string, day: string, times = '09:00–17:00') {
    return page.getByRole('button', {
      name: `Edit ${staffMemberName}'s Shift on ${formatLocalDate(day)}, ${times}`,
    });
  }

  function staffLinkShift(day: string) {
    return staffLinkPage.getByRole('listitem').filter({ hasText: formatLocalDate(day) });
  }

  function staffRows() {
    return staffTable().getByRole('row').filter({ has: page.getByRole('cell') });
  }

  function staffForm(submitLabel: string) {
    return page.locator('form').filter({ has: page.getByRole('button', { name: submitLabel }) });
  }

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.clock.install();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.afterEach(async ({ browserName }, testInfo) => {
    const dir = process.env.E2E_SCREENSHOTS;
    if (!dir) return;
    const step = String(testInfo.line).padStart(4, '0');
    const slug = testInfo.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    await page.screenshot({ path: `${dir}/${step}-${browserName}-${slug}.png`, fullPage: true });
  });

  test('shows a logged-out visitor the landing page, with a Free plan and Pro coming soon', async () => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Weekly staff rotas for UK bars and restaurants' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Free' })).toBeVisible();
    const proPlan = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByRole('heading', { name: 'Pro' }) });
    await expect(proPlan.getByText('Coming soon')).toBeVisible();
    await expect(proPlan.getByText('An email Reminder the day before each Shift')).toBeVisible();
    await expect(proPlan.getByRole('link')).toHaveCount(0);
  });

  test('starts the Free plan at sign-up', async () => {
    await expect(page.getByRole('link', { name: 'Start free' })).toHaveCount(2);
    await page.getByRole('link', { name: 'Start free' }).last().click();
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await page.goBack();
  });

  test("opens sign-up from the landing page's header", async () => {
    await page.getByRole('banner').getByRole('link', { name: 'Sign up' }).click();
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await page.goBack();
  });

  test('stacks the plans on a phone, Free above Pro', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const free = await page.getByRole('heading', { name: 'Free' }).boundingBox();
    const pro = await page.getByRole('heading', { name: 'Pro' }).boundingBox();
    expect(pro?.y).toBeGreaterThan((free?.y ?? 0) + (free?.height ?? 0));
  });

  test("opens the login page from the landing page's header", async () => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole('banner').getByRole('link', { name: 'Log in' }).click();
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

  test('opens Upgrade to Pro from the header, showing Pro coming soon with no price or purchase', async () => {
    await page.getByRole('banner').getByRole('button', { name: 'Upgrade to Pro' }).click();
    const dialog = page.getByRole('dialog', { name: 'Upgrade to Pro' });
    await expect(dialog.getByRole('heading', { name: 'Pro', exact: true })).toBeVisible();
    await expect(dialog.getByText('Coming soon', { exact: true })).toBeVisible();
    await expect(dialog.getByText('An email Reminder the day before each Shift')).toBeVisible();
    await expect(dialog).not.toContainText('£');
    await expect(dialog.getByRole('link')).toHaveCount(0);
    await expect(dialog.getByRole('button')).toHaveText(['Close']);
  });

  test('closes the Pro dialog with Close', async () => {
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('keeps the header on one line on a phone, shortening the button to Pro', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const upgrade = page.getByRole('banner').getByRole('button', { name: 'Upgrade to Pro' });
    await expect(upgrade).toHaveText('Pro', { useInnerText: true });
    const banner = page.getByRole('banner');
    const appName = await banner.getByText('Rota Ready').boundingBox();
    const logOut = await banner.getByRole('button', { name: 'Log out' }).boundingBox();
    expect(logOut?.y).toBeLessThan((appName?.y ?? 0) + (appName?.height ?? 0));
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth).toBeLessThanOrEqual(390);
  });

  test('opens the Pro dialog on a phone', async () => {
    await page.getByRole('banner').getByRole('button', { name: 'Upgrade to Pro' }).click();
    const dialog = page.getByRole('dialog', { name: 'Upgrade to Pro' });
    await expect(dialog.getByText('Coming soon', { exact: true })).toBeVisible();
    await dialog.evaluate((element) =>
      Promise.all(element.getAnimations().map((animation) => animation.finished)),
    );
  });

  test('closes the Pro dialog with Escape', async () => {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('renames the Venue', async () => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByLabel('Venue name').fill(renamedVenue);
    await page.getByRole('button', { name: 'Save name' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(renamedVenue);
  });

  test('shows a toast, not a form error, when saving the name fails before reaching the API', async () => {
    await failRenameRequests();
    await page.getByRole('button', { name: 'Save name' }).click();
    await expect(toast()).toHaveText('Something went wrong. Please try again.');
    await expect(page.locator('form').getByRole('alert')).toHaveCount(0);
    await page.unroute('**/api/venues/*');
    await dismissToasts();
  });

  test('opens the Staff page with no Staff Members yet', async () => {
    await page.getByRole('tab', { name: 'Staff' }).click();
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

  test('adds three Staff Members with Enter, returning focus to Name, and lists them by name', async () => {
    const addForm = staffForm('Add staff member');
    for (const { name, role, email, phone } of staffMembers) {
      await addForm.getByLabel('Name').fill(name);
      await addForm.getByLabel('Role').fill(role);
      await addForm.getByLabel('Phone').fill(phone);
      await addForm.getByLabel('Email').fill(email);
      await addForm.getByLabel('Email').press('Enter');
      await expect(staffTable().getByText(name)).toBeVisible();
      await expect(addForm.getByLabel('Name')).toHaveValue('');
      await expect(addForm.getByLabel('Name')).toBeFocused();
    }
    await expect(staffRows()).toHaveCount(3);
    await expect(staffRows().first()).toContainText('Alex Smith');
  });

  test('rejects a Staff Member whose email another Staff Member already uses', async () => {
    const addForm = staffForm('Add staff member');
    await addForm.getByLabel('Name').fill('Jo Again');
    await addForm.getByLabel('Role').fill('Bar');
    await addForm.getByLabel('Email').fill('JO@example.com');
    await addForm.getByRole('button', { name: 'Add staff member' }).click();
    await expect(addForm.getByLabel('Email')).toHaveAccessibleDescription(
      'Another Staff Member already uses this email.',
    );
  });

  test('edits a Staff Member', async () => {
    await page.getByRole('button', { name: 'Edit Sam Jones' }).click();
    const editForm = staffForm('Save changes');
    await editForm.getByLabel('Role').fill('Floor');
    await editForm.getByRole('button', { name: 'Save changes' }).click();
    await expect(
      staffRows().filter({ hasText: 'Sam Jones' }),
    ).toContainText('Floor');
  });

  test('asks for confirmation before archiving a Staff Member', async () => {
    await page.getByRole('button', { name: 'Archive Jo Bloggs' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Archive Jo Bloggs?');
  });

  test('shows an announced toast and keeps the dialog open when archiving fails before reaching the API', async () => {
    await page.route('**/archive', (route) => route.abort('internetdisconnected'));
    await page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click();
    await expect(toast()).toHaveText('Something went wrong. Please try again.');
    await expect(page.getByRole('alertdialog')).toBeVisible();
    expect(
      await toast().evaluate((element) => element.closest('[aria-hidden="true"], [inert]') === null),
    ).toBe(true);
    await page.unroute('**/archive');
    await dismissToasts();
  });

  test('archives a Staff Member and hides them from the list', async () => {
    await page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(staffRows()).toHaveCount(2);
    await expect(staffTable()).not.toContainText('Jo Bloggs');
  });

  test('keeps the archived Staff Member hidden after a reload', async () => {
    await page.reload();
    await expect(staffRows()).toHaveText([/Alex Smith/, /Sam Jones/]);
  });

  test('shows a translated message with Try again in place of the Staff page when it fails to load', async () => {
    await page.route('**/api/venues/*/staff-members', (route) =>
      route.abort('internetdisconnected'),
    );
    await page.reload();
    await expect(page.getByRole('tabpanel').getByRole('alert')).toHaveText(
      'Something went wrong. Please try again.',
    );
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test("keeps the Venue's heading and tabs above the Staff page's error", async () => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(renamedVenue);
    await expect(page.getByRole('tab', { name: 'Staff' })).toBeVisible();
  });

  test('loads the Staff page with Try again once the API recovers', async () => {
    await page.unroute('**/api/venues/*/staff-members');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(staffRows()).toHaveText([/Alex Smith/, /Sam Jones/]);
  });

  test("opens this Week's Draft Rota with a row per active Staff Member", async () => {
    await page.getByRole('tab', { name: 'Rota' }).click();
    await page.waitForURL(rotaWeekUrl);
    thisWeek = page.url().slice(-10);
    plannedWeek = addDays(thisWeek, 14);
    nextWeek = addDays(plannedWeek, 7);
    await expect(weekHeading(thisWeek)).toBeVisible();
    await expect(page.getByRole('tabpanel').getByText('Draft', { exact: true })).toBeVisible();
    await expect(
      rotaGrid().getByRole('row').filter({ has: page.getByRole('cell') }),
    ).toHaveText([/Alex Smith/, /Sam Jones/]);
  });

  test('shows Monday to Sunday as the Rota columns', async () => {
    await expect(rotaGrid().getByRole('columnheader')).toHaveText([
      'Staff Member',
      ...[0, 1, 2, 3, 4, 5, 6].map((day) => formatLocalDate(addDays(thisWeek, day))),
    ]);
  });

  test('moves to the next Week', async () => {
    await page.getByRole('link', { name: 'Next Week' }).click();
    await expect(weekHeading(addDays(thisWeek, 7))).toBeVisible();
  });

  test('moves back to the previous Week', async () => {
    await page.getByRole('link', { name: 'Previous Week' }).click();
    await expect(weekHeading(thisWeek)).toBeVisible();
  });

  test('offers a way back to this Week from a Week address that is not a Monday', async () => {
    await page.goto(page.url().replace(thisWeek, addDays(thisWeek, 1)));
    await expect(page.getByRole('alert')).toHaveText(
      "We couldn't find what you were looking for.",
    );
    await page.getByRole('link', { name: 'Go to this Week' }).click();
    await expect(weekHeading(thisWeek)).toBeVisible();
  });

  test('adds an Overnight Shift two Weeks ahead and shows it on the day it starts, marked (+1)', async () => {
    const sunday = addDays(plannedWeek, 6);
    await openRota(plannedWeek);
    await page.getByLabel('Staff Member').selectOption({ label: 'Sam Jones' });
    await page.getByLabel('Day').selectOption({ label: formatLocalDate(sunday) });
    await page.getByLabel('Start').selectOption('20:00');
    await expect(page.getByLabel('End')).toHaveValue('20:00');
    await page.getByLabel('End').selectOption('02:00');
    await page.getByRole('button', { name: 'Add Shift' }).click();
    await expect(rotaCell('Sam Jones', sunday)).toHaveText('20:00–02:00 (+1)');
  });

  test('keeps the Shift after a reload', async () => {
    await page.reload();
    await expect(rotaCell('Sam Jones', addDays(plannedWeek, 6))).toHaveText('20:00–02:00 (+1)');
  });

  test('rejects a 17-hour Shift with the error under the end time', async () => {
    await page.getByLabel('Staff Member').selectOption({ label: 'Alex Smith' });
    await page.getByLabel('Day').selectOption({ label: formatLocalDate(plannedWeek) });
    await page.getByLabel('Start').selectOption('06:00');
    await page.getByLabel('End').selectOption('23:00');
    await page.getByRole('button', { name: 'Add Shift' }).click();
    await expect(page.getByLabel('End')).toHaveAccessibleDescription(
      'Shifts can be at most 16 hours.',
    );
    await expect(rotaCell('Alex Smith', plannedWeek)).toHaveText('');
  });

  test("adds a Shift on the next Week's Monday without choosing the day again", async () => {
    await page.getByRole('link', { name: 'Next Week' }).click();
    await expect(weekHeading(nextWeek)).toBeVisible();
    await page.getByLabel('Staff Member').selectOption({ label: 'Sam Jones' });
    await page.getByLabel('Start').selectOption('09:00');
    await page.getByLabel('End').selectOption('17:00');
    await page.getByRole('button', { name: 'Add Shift' }).click();
    await expect(rotaCell('Sam Jones', nextWeek, nextWeek)).toHaveText('09:00–17:00');
  });

  test('keeps the details after adding a Shift, with focus back on Staff Member', async () => {
    await expect(page.getByLabel('Staff Member')).toBeFocused();
    await expect(page.getByLabel('Start')).toHaveValue('09:00');
    await expect(page.getByLabel('End')).toHaveValue('17:00');
  });

  test('rejects a Shift that overlaps one the Staff Member already has', async () => {
    await page.getByRole('button', { name: 'Add Shift' }).click();
    await expect(page.getByText('This Staff Member already has a Shift at that time.')).toBeVisible();
    await expect(rotaCell('Sam Jones', nextWeek, nextWeek)).toHaveText(
      '09:00–17:00',
    );
  });

  test('adds the same times for another Staff Member by changing only the person', async () => {
    await page.getByLabel('Staff Member').selectOption({ label: 'Alex Smith' });
    await page.getByRole('button', { name: 'Add Shift' }).click();
    await expect(rotaCell('Alex Smith', nextWeek, nextWeek)).toHaveText('09:00–17:00');
  });

  test('offers Start times on the 24-hour clock in quarter-hour steps', async () => {
    const options = page.getByLabel('Start').getByRole('option');
    await expect(options).toHaveCount(97);
    await expect(options.nth(1)).toHaveText('00:00');
    await expect(options.nth(2)).toHaveText('00:15');
    await expect(options.nth(53)).toHaveText('13:00');
    await expect(options.last()).toHaveText('23:45');
  });

  test("rejects a Shift that overlaps last Week's Overnight Shift running into Monday", async () => {
    await page.getByLabel('Staff Member').selectOption({ label: 'Sam Jones' });
    await page.getByLabel('Start').selectOption('01:00');
    await page.getByLabel('End').selectOption('05:00');
    await page.getByRole('button', { name: 'Add Shift' }).click();
    await expect(page.getByText('This Staff Member already has a Shift at that time.')).toBeVisible();
  });

  test('clears the overlap message once the Staff Member changes', async () => {
    await page.getByLabel('Staff Member').selectOption({ label: 'Alex Smith' });
    await expect(page.getByText('This Staff Member already has a Shift at that time.')).toBeHidden();
  });

  test("opens a Shift's details from the grid", async () => {
    await editShiftButton('Sam Jones', nextWeek).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Staff Member').locator('option:checked')).toHaveText(
      'Sam Jones',
    );
    await expect(dialog.getByLabel('Day')).toHaveValue(nextWeek);
    await expect(dialog.getByLabel('Start')).toHaveValue('09:00');
    await expect(dialog.getByLabel('End')).toHaveValue('17:00');
  });

  test('refuses to move a Shift onto a time its new Staff Member is already working', async () => {
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Staff Member').selectOption({ label: 'Alex Smith' });
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(
      dialog.getByText('This Staff Member already has a Shift at that time.'),
    ).toBeVisible();
  });

  test('moves the Shift to another Staff Member and another day', async () => {
    const tuesday = addDays(nextWeek, 1);
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Day').selectOption({ label: formatLocalDate(tuesday) });
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();
    await expect(rotaCell('Alex Smith', tuesday, nextWeek)).toHaveText('09:00–17:00');
    await expect(rotaCell('Sam Jones', nextWeek, nextWeek)).toHaveText('');
  });

  test('keeps the moved Shift after a reload', async () => {
    const tuesday = addDays(nextWeek, 1);
    await page.reload();
    await expect(rotaCell('Alex Smith', tuesday, nextWeek)).toHaveText('09:00–17:00');
    await expect(rotaCell('Sam Jones', nextWeek, nextWeek)).toHaveText('');
  });

  test('asks for confirmation before deleting a Shift', async () => {
    const tuesday = addDays(plannedWeek, 8);
    await editShiftButton('Alex Smith', tuesday).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete Shift' }).click();
    await expect(page.getByRole('alertdialog')).toContainText(
      `Alex Smith, ${formatLocalDate(tuesday)}, 09:00–17:00. This can't be undone.`,
    );
  });

  test('deletes the Shift and takes it off the grid', async () => {
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(rotaCell('Alex Smith', addDays(nextWeek, 1), nextWeek)).toHaveText('');
  });

  test('keeps the Shift deleted after a reload', async () => {
    await page.reload();
    await expect(rotaCell('Alex Smith', nextWeek, nextWeek)).toHaveText('09:00–17:00');
    await expect(rotaCell('Alex Smith', addDays(nextWeek, 1), nextWeek)).toHaveText('');
  });

  test('refuses to archive a Staff Member with an upcoming Shift, and says why', async () => {
    await page.getByRole('tab', { name: 'Staff' }).click();
    await page.getByRole('button', { name: 'Archive Alex Smith' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click();
    await expect(toast()).toHaveText(
      'They still have upcoming Shifts. Delete those Shifts from the Rota first, then archive them.',
    );
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(staffRows()).toHaveText([/Alex Smith/, /Sam Jones/]);
    await dismissToasts();
  });

  test('archives the Staff Member once their upcoming Shift is deleted from the Rota', async () => {
    await openRota(nextWeek);
    await editShiftButton('Alex Smith', nextWeek).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete Shift' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(rotaCell('Alex Smith', nextWeek, nextWeek)).toHaveText('');
    await page.getByRole('tab', { name: 'Staff' }).click();
    await page.getByRole('button', { name: 'Archive Alex Smith' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(staffRows()).toHaveText([/Sam Jones/]);
  });

  test('adds a Shift with a Role and notes and shows them on the grid', async () => {
    const thursday = addDays(nextWeek, 3);
    await openRota(nextWeek);
    await page.getByLabel('Staff Member').selectOption({ label: 'Sam Jones' });
    await expect(page.getByLabel('Role (optional)')).toHaveAttribute('placeholder', 'Floor');
    await page.getByLabel('Day').selectOption({ label: formatLocalDate(thursday) });
    await page.getByLabel('Start').selectOption('18:00');
    await page.getByLabel('End').selectOption('23:00');
    await page.getByLabel('Role (optional)').fill('Bar');
    await page.getByLabel('Notes (optional)').fill('Cash up at close');
    await page.getByRole('button', { name: 'Add Shift' }).click();
    await expect(rotaCell('Sam Jones', thursday, nextWeek)).toHaveText(
      '18:00–23:00BarCash up at close',
    );
    await expect(
      rotaGrid().getByRole('row', { name: 'Sam Jones' }).getByRole('cell').first(),
    ).toHaveText('Sam JonesFloor');
  });

  test('edits the Role and notes and shows the change on the grid', async () => {
    const thursday = addDays(nextWeek, 3);
    await editShiftButton('Sam Jones', thursday, '18:00–23:00').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Role (optional)')).toHaveValue('Bar');
    await dialog.getByLabel('Role (optional)').fill('Floor');
    await dialog.getByLabel('Notes (optional)').fill('Open up at 17:45');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();
    await expect(rotaCell('Sam Jones', thursday, nextWeek)).toHaveText(
      '18:00–23:00FloorOpen up at 17:45',
    );
  });

  test('asks for confirmation before Publishing the Week', async () => {
    await openRota(plannedWeek);
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByRole('alertdialog')).toContainText(
      `Publish the Week of ${formatLocalDate(plannedWeek, { withYear: true })}?`,
    );
  });

  test('Publishes the Week and shows who was emailed their Staff Link', async () => {
    publishedWeekAt = new Date(Date.now() - 1_000);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Publish' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(
      `Published the Week of ${formatLocalDate(plannedWeek, { withYear: true })}`,
    );
    await expect(
      dialog.getByRole('list', { name: 'Staff Link emails' }).getByRole('listitem'),
    ).toHaveText(['Sam JonesSent']);
  });

  test('closes the results and shows the Published badge in place of the Publish button', async () => {
    await page.getByRole('alertdialog').getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(page.getByRole('tabpanel').getByText('Published', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish' })).toHaveCount(0);
  });

  test("emails Sam their Staff Link, which opens Sam's page", async ({ browser }) => {
    await expect
      .poll(() => latestEmailTextTo('sam@example.com', publishedWeekAt))
      .toMatch(/\/s\/[\w-]{43}/);
    const text = await latestEmailTextTo('sam@example.com', publishedWeekAt);
    samsEmailedLink = text?.match(/https?:\/\/\S+\/s\/[\w-]{43}/)?.[0] ?? '';
    const emailWindow = await browser.newContext();
    const emailPage = await emailWindow.newPage();
    await emailPage.goto(samsEmailedLink);
    await expect(emailPage.getByRole('heading', { level: 1 })).toHaveText('Hi Sam');
    await emailWindow.close();
  });

  test('keeps the Week Published after a reload', async () => {
    await page.reload();
    await expect(page.getByRole('tabpanel').getByText('Published', { exact: true })).toBeVisible();
    await expect(rotaCell('Sam Jones', addDays(plannedWeek, 6))).toContainText('20:00–02:00 (+1)');
  });

  test('shows each Shift in the Published Rota as Pending', async () => {
    await expect(rotaCell('Sam Jones', addDays(plannedWeek, 6))).toContainText('Pending');
  });

  test('keeps the next Week a Draft with a Publish button', async () => {
    await page.getByRole('link', { name: 'Next Week' }).click();
    await expect(weekHeading(nextWeek)).toBeVisible();
    await expect(page.getByRole('tabpanel').getByText('Draft', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();
  });

  test("shows Sam's Staff Link from the Staff page", async () => {
    await page.getByRole('tab', { name: 'Staff' }).click();
    await page.getByRole('button', { name: 'Staff Link for Sam Jones' }).click();
    await expect(page.getByRole('dialog')).toContainText("Sam Jones's Staff Link");
    await expect(page.getByRole('dialog').getByLabel('Link')).toHaveValue(/\/s\/[\w-]{43}$/);
    samsLink = await page.getByRole('dialog').getByLabel('Link').inputValue();
    expect(samsLink).toBe(samsEmailedLink);
  });

  test("copies Sam's Staff Link", async () => {
    await page.getByRole('dialog').getByRole('button', { name: 'Copy link' }).click();
    await expect(toast()).toHaveText('Link copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(samsLink);
    await dismissToasts();
  });

  test("opens Sam's page from the Staff Link in a private window, without logging in", async ({
    browser,
  }) => {
    privateWindow = await browser.newContext();
    const privatePage = await privateWindow.newPage();
    await privatePage.goto(samsLink);
    await expect(privatePage.getByRole('heading', { level: 1 })).toHaveText('Hi Sam');
    await expect(privatePage.getByText('This is your Staff Link for The Rose & Crown.')).toBeVisible();
    await expect(privatePage.getByRole('banner')).toHaveCount(0);
  });

  test('asks for confirmation before regenerating the Staff Link', async () => {
    await page.getByRole('dialog').getByRole('button', { name: 'Regenerate' }).click();
    await expect(page.getByRole('alertdialog')).toContainText("Regenerate Sam's Staff Link?");
  });

  test('regenerates the Staff Link and shows the new one', async () => {
    await page.getByRole('alertdialog').getByRole('button', { name: 'Regenerate' }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(page.getByRole('dialog').getByLabel('Link')).not.toHaveValue(samsLink);
    await expect(page.getByRole('dialog').getByLabel('Link')).toHaveValue(/\/s\/[\w-]{43}$/);
  });

  test("says the old Staff Link isn't valid once it's regenerated", async () => {
    const privatePage = await privateWindow.newPage();
    await privatePage.goto(samsLink);
    await expect(privatePage.getByRole('heading', { level: 1 })).toHaveText(
      "This link isn't valid",
    );
    await expect(privatePage.getByText('Ask your manager for a new link.')).toBeVisible();
  });

  test("opens Sam's page from the new Staff Link", async () => {
    samsNewLink = await page.getByRole('dialog').getByLabel('Link').inputValue();
    staffLinkPage = await privateWindow.newPage();
    await staffLinkPage.goto(samsNewLink);
    await expect(staffLinkPage.getByRole('heading', { level: 1 })).toHaveText('Hi Sam');
  });

  test("shows only Sam's upcoming Published Shift, not next Week's Draft ones", async () => {
    await expect(
      staffLinkPage.getByRole('list', { name: 'Your upcoming Shifts' }).getByRole('listitem'),
    ).toContainText([`${formatLocalDate(addDays(plannedWeek, 6))}20:00–02:00 (+1)`]);
    await privateWindow.close();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('Publishes next Week with a Wednesday Shift for Sam', async () => {
    await openRota(nextWeek);
    await page.getByLabel('Staff Member').selectOption({ label: 'Sam Jones' });
    await page.getByLabel('Day').selectOption({ label: formatLocalDate(addDays(nextWeek, 2)) });
    await page.getByLabel('Start').selectOption('12:00');
    await page.getByLabel('End').selectOption('18:00');
    await page.getByRole('button', { name: 'Add Shift' }).click();
    await expect(rotaCell('Sam Jones', addDays(nextWeek, 2), nextWeek)).toHaveText('12:00–18:00');
    await page.getByRole('button', { name: 'Publish' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Publish' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('tabpanel').getByText('Published', { exact: true })).toBeVisible();
  });

  test("Confirms Sunday's Shift from Sam's Staff Link page", async ({ browser }) => {
    const sunday = addDays(plannedWeek, 6);
    privateWindow = await browser.newContext();
    staffLinkPage = await privateWindow.newPage();
    await staffLinkPage.goto(samsNewLink);
    await staffLinkPage
      .getByRole('button', { name: `Confirm your Shift on ${formatLocalDate(sunday)}` })
      .click();
    await expect(staffLinkShift(sunday)).toContainText('Confirmed');
    await expect(staffLinkShift(sunday).getByRole('button', { name: /^Confirm/ })).toHaveCount(0);
  });

  test("Declines next Wednesday's Shift with a Decline Reason", async () => {
    const wednesday = addDays(plannedWeek, 9);
    await staffLinkPage
      .getByRole('button', { name: `Decline your Shift on ${formatLocalDate(wednesday)}` })
      .click();
    const dialog = staffLinkPage.getByRole('dialog');
    await expect(dialog).toContainText(`Decline your Shift on ${formatLocalDate(wednesday)}?`);
    await dialog.getByLabel('Reason (optional)').fill('Dentist appointment');
    await dialog.getByRole('button', { name: 'Decline Shift' }).click();
    await expect(dialog).toBeHidden();
    await expect(staffLinkShift(wednesday)).toContainText('Declined');
    await expect(staffLinkShift(wednesday)).toContainText('Dentist appointment');
  });

  test("keeps Sam's answers after a reload", async () => {
    await staffLinkPage.reload();
    await expect(staffLinkShift(addDays(plannedWeek, 6))).toContainText('Confirmed');
    await expect(staffLinkShift(addDays(plannedWeek, 9))).toContainText('Declined');
    await privateWindow.close();
  });

  test("shows the Decline and its reason on the Owner's grid within 30 seconds, without a reload", async () => {
    await page.clock.fastForward(30_000);
    const wednesday = rotaCell('Sam Jones', addDays(nextWeek, 2), nextWeek);
    await wednesday.getByRole('button', { name: 'Declined: see the Decline Reason' }).click();
    await expect(page.getByRole('dialog')).toHaveText('Dentist appointment');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test("shows the Confirm on the Owner's grid after the next refresh", async () => {
    await page.getByRole('link', { name: 'Previous Week' }).click();
    await expect(weekHeading(plannedWeek)).toBeVisible();
    await page.clock.fastForward(30_000);
    await expect(rotaCell('Sam Jones', addDays(plannedWeek, 6))).toContainText('Confirmed');
  });

  test('keeps a Confirmed Shift Confirmed and unmarked when only its notes change', async () => {
    const sunday = addDays(plannedWeek, 6);
    await editShiftButton('Sam Jones', sunday, '20:00–02:00 (+1)').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Notes (optional)').fill('Lock up');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();
    await expect(rotaCell('Sam Jones', sunday)).toHaveText('20:00–02:00 (+1)Lock upConfirmed');
  });

  test("sends a Confirmed Shift back to Pending, marked Changed, when its time changes", async () => {
    const sunday = addDays(plannedWeek, 6);
    await editShiftButton('Sam Jones', sunday, '20:00–02:00 (+1)').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Start').selectOption('21:00');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();
    await expect(rotaCell('Sam Jones', sunday)).toHaveText('21:00–02:00 (+1)Lock upPendingChanged');
  });

  test('reassigns a published Shift, marking it Changed for the new Staff Member and Removed for Sam', async () => {
    const thursday = addDays(nextWeek, 3);
    await page.getByRole('tab', { name: 'Staff' }).click();
    const addForm = staffForm('Add staff member');
    await addForm.getByLabel('Name').fill('Jo Bloggs');
    await addForm.getByLabel('Role').fill('Floor');
    await addForm.getByLabel('Email').fill('jo@example.com');
    await addForm.getByRole('button', { name: 'Add staff member' }).click();
    await expect(staffTable().getByText('Jo Bloggs')).toBeVisible();
    await openRota(nextWeek);
    await editShiftButton('Sam Jones', thursday, '18:00–23:00').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Staff Member').selectOption({ label: 'Jo Bloggs' });
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();
    await expect(rotaCell('Sam Jones', thursday, nextWeek)).toHaveText('18:00–23:00Removed');
    await expect(rotaCell('Jo Bloggs', thursday, nextWeek)).toHaveText(
      '18:00–23:00FloorOpen up at 17:45PendingChanged',
    );
  });

  test("shows the reassigned Shift as Removed on Sam's Staff Link page", async ({ browser }) => {
    const thursday = addDays(plannedWeek, 10);
    privateWindow = await browser.newContext();
    staffLinkPage = await privateWindow.newPage();
    await staffLinkPage.goto(samsNewLink);
    await expect(
      staffLinkPage.getByRole('list', { name: 'Removed Shifts' }).getByRole('listitem'),
    ).toHaveText([`${formatLocalDate(thursday)}18:00–23:00Removed`]);
    await expect(
      staffLinkPage.getByRole('list', { name: 'Your upcoming Shifts' }),
    ).not.toContainText(formatLocalDate(thursday));
  });

  test("shows the reassigned Shift as Pending on Jo's Staff Link page", async () => {
    const thursday = addDays(plannedWeek, 10);
    await page.getByRole('tab', { name: 'Staff' }).click();
    await page.getByRole('button', { name: 'Staff Link for Jo Bloggs' }).click();
    await expect(page.getByRole('dialog').getByLabel('Link')).toHaveValue(/\/s\/[\w-]{43}$/);
    josLink = await page.getByRole('dialog').getByLabel('Link').inputValue();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await staffLinkPage.goto(josLink);
    await expect(staffLinkShift(thursday)).toContainText('18:00–23:00');
    await expect(staffLinkShift(thursday)).toContainText('Pending');
    await expect(staffLinkPage.getByRole('list', { name: 'Removed Shifts' })).toHaveCount(0);
    await privateWindow.close();
  });

  test("marks Sam's Declined Wednesday Shift Changed and Pending when its time changes", async () => {
    const wednesday = addDays(nextWeek, 2);
    await openRota(nextWeek);
    await editShiftButton('Sam Jones', wednesday, '12:00–18:00').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Start').selectOption('13:00');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();
    await expect(rotaCell('Sam Jones', wednesday, nextWeek)).toHaveText('13:00–18:00PendingChanged');
  });

  test('asks for confirmation before sending updates', async () => {
    await page.getByRole('button', { name: 'Send Updates' }).click();
    await expect(page.getByRole('alertdialog')).toContainText(
      `Send updates for the Week of ${formatLocalDate(nextWeek, { withYear: true })}?`,
    );
  });

  test('Sends Updates and shows that Jo and Sam were emailed', async () => {
    updatesSentAt = new Date(Date.now() - 1_000);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Send Updates' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(
      `Sent updates for the Week of ${formatLocalDate(nextWeek, { withYear: true })}`,
    );
    await expect(
      dialog.getByRole('list', { name: 'Staff Link emails' }).getByRole('listitem'),
    ).toHaveText(['Jo BloggsSent', 'Sam JonesSent']);
  });

  test('clears the Changed and Removed markers and the Send Updates button once sent', async () => {
    const wednesday = addDays(nextWeek, 2);
    const thursday = addDays(nextWeek, 3);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(rotaCell('Sam Jones', wednesday, nextWeek)).toHaveText('13:00–18:00Pending');
    await expect(rotaCell('Sam Jones', thursday, nextWeek)).toHaveText('');
    await expect(rotaCell('Jo Bloggs', thursday, nextWeek)).toHaveText(
      '18:00–23:00FloorOpen up at 17:45Pending',
    );
    await expect(page.getByRole('button', { name: 'Send Updates' })).toHaveCount(0);
  });

  test('emails Sam and Jo one update each, saying what changed', async () => {
    await expect.poll(() => emailTextsTo('sam@example.com', updatesSentAt)).toHaveLength(1);
    const [samsUpdate] = await emailTextsTo('sam@example.com', updatesSentAt);
    const [josUpdate] = await emailTextsTo('jo@example.com', updatesSentAt);
    expect(samsUpdate).toContain(`${formatLocalDate(addDays(nextWeek, 2))}, 13:00–18:00: was 12:00–18:00`);
    expect(samsUpdate).toContain(`${formatLocalDate(addDays(nextWeek, 3))}, 18:00–23:00: removed`);
    expect(josUpdate).toContain(`${formatLocalDate(addDays(nextWeek, 3))}, 18:00–23:00: new`);
    expect(await emailTextsTo('jo@example.com', updatesSentAt)).toHaveLength(1);
  });

  test("shows the Wednesday Shift's old times on Sam's Staff Link page, and keeps the Removed Shift", async ({
    browser,
  }) => {
    const wednesday = addDays(nextWeek, 2);
    privateWindow = await browser.newContext();
    staffLinkPage = await privateWindow.newPage();
    await staffLinkPage.goto(samsNewLink);
    await expect(staffLinkShift(wednesday)).toContainText('13:00–18:00');
    await expect(staffLinkShift(wednesday)).toContainText('was 12:00–18:00');
    await expect(
      staffLinkPage.getByRole('list', { name: 'Removed Shifts' }).getByRole('listitem'),
    ).toHaveText([`${formatLocalDate(addDays(nextWeek, 3))}18:00–23:00Removed`]);
  });

  test("shows Jo the reassigned Shift without old times, since Jo was never notified of them", async () => {
    const thursday = addDays(nextWeek, 3);
    await staffLinkPage.goto(josLink);
    await expect(staffLinkShift(thursday)).toContainText('18:00–23:00');
    await expect(staffLinkShift(thursday)).not.toContainText('was');
    await privateWindow.close();
  });

  test("fills the empty Week after next with Copy Last Week, keeping times, Role and notes", async () => {
    const weekAfter = addDays(nextWeek, 7);
    await openRota(weekAfter);
    await page.getByRole('button', { name: 'Copy Last Week' }).click();
    await expect(rotaCell('Sam Jones', addDays(weekAfter, 2), weekAfter)).toHaveText('13:00–18:00');
    await expect(rotaCell('Jo Bloggs', addDays(weekAfter, 3), weekAfter)).toHaveText(
      '18:00–23:00FloorOpen up at 17:45',
    );
    await expect(page.getByRole('tabpanel').getByText('Draft', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy Last Week' })).toHaveCount(0);
  });

  test('keeps the copied Shifts after a reload', async () => {
    const weekAfter = addDays(nextWeek, 7);
    await page.reload();
    await expect(rotaCell('Sam Jones', addDays(weekAfter, 2), weekAfter)).toHaveText('13:00–18:00');
    await expect(rotaCell('Jo Bloggs', addDays(weekAfter, 3), weekAfter)).toHaveText(
      '18:00–23:00FloorOpen up at 17:45',
    );
  });

  test('shows a Pending Shift that has already started as No reply', async () => {
    const lastWeek = addDays(thisWeek, -7);
    await openRota(lastWeek);
    await page.getByLabel('Staff Member').selectOption({ label: 'Sam Jones' });
    await page.getByLabel('Start').selectOption('09:00');
    await page.getByLabel('End').selectOption('17:00');
    await page.getByRole('button', { name: 'Add Shift' }).click();
    await expect(rotaCell('Sam Jones', lastWeek, lastWeek)).toHaveText('09:00–17:00');
    await page.getByRole('button', { name: 'Publish' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Publish' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Done' }).click();
    await expect(rotaCell('Sam Jones', lastWeek, lastWeek)).toHaveText('09:00–17:00No reply');
  });

  test('keeps a User with a Venue out of onboarding', async () => {
    await page.goto('/onboarding');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(renamedVenue);
  });

  test("shows another Owner's Venue as not found, with no Try again", async ({ browser }) => {
    const otherOwner = await browser.newContext();
    const otherOwnerPage = await otherOwner.newPage();
    await otherOwnerPage.goto('/signup');
    await otherOwnerPage.getByLabel('Email').fill(`other-${email}`);
    await otherOwnerPage.getByLabel('Password').fill(password);
    await otherOwnerPage.getByRole('button', { name: 'Create account' }).click();
    await otherOwnerPage.getByLabel('Venue name').fill('The Anchor');
    await otherOwnerPage.getByRole('button', { name: 'Create venue' }).click();
    await expect(otherOwnerPage.getByRole('heading', { level: 1 })).toHaveText('The Anchor');
    const otherVenuePath = new URL(otherOwnerPage.url()).pathname;
    await otherOwner.close();
    await page.goto(otherVenuePath);
    await expect(page.getByRole('alert')).toHaveText(
      "We couldn't find what you were looking for.",
    );
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  });

  test('shows the live API status once logged in', async () => {
    await expect(page.getByRole('status')).toHaveText('API ok · DB ok');
  });

  test('logs out and lands on the login page', async () => {
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  });

  test('keeps a logged-out visitor out of the app', async () => {
    await page.goto('/onboarding');
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

  test('sends a User whose session the API rejects on a page load to log in again', async () => {
    await invalidateSessionToken();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
    await expect(page.getByRole('status')).toHaveText(
      'Your session has ended. Please log in again.',
    );
  });

  test('sends a User whose session the API rejects on a form submit to log in again', async () => {
    await logBackInToRenamedVenue();
    await invalidateSessionToken();
    await page.getByRole('button', { name: 'Save name' }).click();
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
    await expect(page.getByRole('status')).toHaveText(
      'Your session has ended. Please log in again.',
    );
  });

  test('logs back in after the session ended', async () => {
    await logBackInToRenamedVenue();
    await expect(page.getByRole('banner')).toContainText(email);
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

  test('shows the Pro dialog as pseudo-text with ?lng=pseudo', async () => {
    await page.getByRole('banner').getByRole('button').first().click();
    await expect(page.getByRole('dialog').getByRole('heading', { level: 2 })).toHaveText(/^\[.*\]$/);
    expect(await textLeftInPlainEnglish(page)).toEqual([email, renamedVenue]);
  });

  test('closes the pseudo-text Pro dialog with Escape', async () => {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('shows toasts as pseudo-text with ?lng=pseudo', async () => {
    await failRenameRequests();
    await page.locator('form').getByRole('button').click();
    await expect(toast()).toHaveText(/^\[.*\]$/);
    await page.unroute('**/api/venues/*');
    await dismissToasts();
  });

  test('shows the login page as pseudo-text after logging out with ?lng=pseudo', async () => {
    await page.getByRole('banner').getByRole('button').last().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\[.*\]$/);
    expect(await textLeftInPlainEnglish(page)).toEqual([]);
  });

  test('shows the landing page as pseudo-text with ?lng=pseudo', async () => {
    await page.goto('/?lng=pseudo');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\[.*\]$/);
    expect(await textLeftInPlainEnglish(page)).toEqual([]);
  });
});
