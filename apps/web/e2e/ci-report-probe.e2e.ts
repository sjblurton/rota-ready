import { expect, test } from '@playwright/test';

test('fails on purpose so the CI report shows its screenshots link on a failing run', () => {
  expect(true).toBe(false);
});
