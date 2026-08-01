'use strict';

// Joomla administrator step definitions: logging into and out of the
// /administrator control panel, and asserting the outcome (dashboard vs.
// invalid-credentials message). Complements the front-office coverage in
// joomla.steps.js — see README.md "When to add a step".
//
// All locator interactions are wrapped in a friendly try/catch so a missing
// selector reports a clear Joomla-flavoured hint instead of a raw
// Playwright timeout stack.

const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');
const { smartSettle, gotoUrl, waitForPageLoad } = require('webship-js/tests/step-definitions/webship');

/**
 * Run a locator action and rethrow with a short, friendly explanation on
 * failure instead of Playwright's raw timeout stack — keeps failures
 * readable when a Joomla admin template change moves a selector.
 */
async function actOrExplain(label, target, fn) {
  try {
    return await fn();
  } catch (err) {
    throw new Error(`Could not ${label} "${target}": ${err.message.split('\n')[0]}`);
  }
}

// ---------------------------------------------------------------------------
// Login / logout
// ---------------------------------------------------------------------------

/**
 * Open the Joomla administrator login page (`/administrator`) as an
 * anonymous visitor.
 *
 * Example #1: Given I am on the administrator login page
 * Example #2: Given we are on the administrator login page
 * Example #3: Given I am on the admin login page
 * Example #4: Given on the administrator login page
 * Example #5: Given we are on the admin login page
 *
 */
Given(/^(I am |we are )*on the admin(?:istrator)* login page$/, async function (pronounCase) {
  const defaultTime = this.minWaitTime.page || 3000;
  await gotoUrl(this.page, this.launchUrl + '/administrator');
  await this.page.waitForSelector('#form-login', { state: 'visible', timeout: 10000 });
  await waitForPageLoad(this.page, defaultTime);
});

/**
 * Fill in and submit the Joomla administrator login form
 * (`#form-login`) with the given username/password, then wait for the
 * page to settle on either the dashboard or the login error message.
 *
 * Example #1: When I log in to the administrator panel as "admin" with password "admin"
 * Example #2: When I log into the administrator panel as "admin" with password "admin"
 * Example #3: When we log in to the administrator panel as "editor" with password "Secr3t!23"
 * Example #4: And I log in to the administrator panel as "admin" with password "wrong-password"
 * Example #5: When I log into the administrator panel as "admin" with password "WrongPass1!"
 *
 */
When(/^(I |we )*log in(?:to| to) the administrator panel as "([^"]*)?" with password "([^"]*)?"$/, { timeout: 120000 }, async function (pronounCase, username, password) {
  const usernameField = this.page.locator('#mod-login-username');
  const passwordField = this.page.locator('#mod-login-password');
  const submitButton = this.page.locator('#btn-login-submit');
  await actOrExplain('log in to the administrator panel as', username, async () => {
    await usernameField.waitFor({ state: 'visible', timeout: 10000 });
    await usernameField.fill(username);
    await passwordField.fill(password);
    await submitButton.click({ timeout: 10000 });
  });

  // Wait directly for one of the two possible outcomes instead of a fixed
  // "settle" delay: a *correct* first admin login after a fresh install
  // can take far longer than usual (cold PHP setup on a freshly
  // provisioned CI site) — smartSettle's own internal timeout budget can
  // run out before that finishes, and Playwright treats a `timeout: 0`
  // wait (its "no timeout" value, which is what a used-up budget produces)
  // as infinite rather than immediate, so it can hang well past what its
  // caller intended.
  const dashboard = this.page.locator('#cpanel-modules, body.com_cpanel').first();
  const loginError = this.page.locator('joomla-alert[type="warning"], joomla-alert[type="danger"]').first();
  await Promise.race([
    dashboard.waitFor({ state: 'visible', timeout: 90000 }),
    loginError.waitFor({ state: 'visible', timeout: 90000 }),
  ]).catch(() => {});

  // Joomla shows a one-time "Welcome to Joomla!" guided-tour modal the
  // first time a session logs in to the dashboard. It overlays the whole
  // page (including the User Menu dropdown), so dismiss it now rather than
  // let it block whatever the next step tries to click.
  const tourCancel = this.page.getByRole('button', { name: 'Cancel' });
  if (await tourCancel.count()) {
    await tourCancel.click().catch(() => {});
  }
});

/**
 * Click the "Log out" link in the administrator panel's user menu and wait
 * for the login form to reappear.
 *
 * Example #1: When I log out of the administrator panel
 * Example #2: When we log out of the administrator panel
 * Example #3: And I log out of the administrator panel
 * Example #4: When I log out of the admin panel
 * Example #5: And we log out of the admin panel
 *
 */
When(/^(I |we )*log out of the admin(?:istrator)* panel$/, async function (pronounCase) {
  const userMenuToggle = this.page.getByRole('button', { name: 'User Menu' });
  const logoutLink = this.page.locator('a[href*="task=logout"]').first();
  await actOrExplain('log out of', 'the administrator panel', async () => {
    // The "Log out" link only becomes visible once the header's "User
    // Menu" dropdown is opened.
    await userMenuToggle.waitFor({ state: 'visible', timeout: 10000 });
    await userMenuToggle.click();
    await logoutLink.waitFor({ state: 'visible', timeout: 10000 });
    await logoutLink.click();
  });
  await smartSettle(this.page, 1500);
});

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

/**
 * Assert the administrator Dashboard (`com_cpanel`) has loaded, identified
 * by its `#cpanel-modules` container. The page `<title>` isn't used for
 * this check — whether it's prefixed with "Home Dashboard" varies by
 * Joomla version/configuration, but the Dashboard's own markup doesn't.
 *
 * Example #1: Then I should see the administrator dashboard
 * Example #2: And I should see the admin dashboard
 * Example #3: Then we should see the administrator dashboard
 * Example #4: And should see the admin dashboard
 * Example #5: Then I should be on the administrator dashboard
 *
 */
Then(/^(I |we )*should (?:see|be on) the admin(?:istrator)* dashboard$/, { timeout: 40000 }, async function (pronounCase) {
  const dashboard = this.page.locator('#cpanel-modules, body.com_cpanel').first();
  try {
    await dashboard.waitFor({ state: 'visible', timeout: 30000 });
  } catch {
    assert.fail(`Expected the administrator dashboard, but the page title was "${await this.page.title()}".`);
  }
});

/**
 * Assert the administrator login form rejected the credentials with
 * Joomla's standard "Username and password do not match" message.
 *
 * Example #1: Then I should see an invalid login error in the administrator panel
 * Example #2: And I should see an invalid login error in the admin panel
 * Example #3: Then we should see an invalid login error in the administrator panel
 * Example #4: And should see an invalid login error in the admin panel
 * Example #5: Then I should see an invalid login error in the admin panel
 *
 */
Then(/^(I |we )*should see an invalid login error in the admin(?:istrator)* panel$/, async function (pronounCase) {
  // The alert renders as a <joomla-alert> custom element; a matching
  // `.alert-warning`/`.alert-danger` markup exists too, but only inside a
  // <noscript> fallback that a real browser never displays.
  const message = this.page.locator('joomla-alert[type="warning"], joomla-alert[type="danger"]').first();
  await message.waitFor({ state: 'visible', timeout: 10000 });
  const text = (await message.innerText()).trim();
  assert.ok(
    /username and password do not match/i.test(text),
    `Expected an invalid-login message, but got: "${text}"`
  );
});

/**
 * Assert the administrator login form (`#form-login`) is showing, i.e. no
 * one is currently logged in to the control panel.
 *
 * Example #1: Then I should be on the administrator login page
 * Example #2: And I should be on the admin login page
 * Example #3: Then we should be on the administrator login page
 * Example #4: And should be on the admin login page
 * Example #5: Then I should be on the administrator login page again
 *
 */
Then(/^(I |we )*should be on the admin(?:istrator)* login page(?: again)*$/, async function (pronounCase) {
  await this.page.waitForSelector('#form-login', { state: 'visible', timeout: 10000 });
});
