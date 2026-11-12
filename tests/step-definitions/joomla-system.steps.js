'use strict';

// Joomla administrator step definitions for the system: the users and their
// groups, the access levels, the cache and the global check-in. (The system
// pages of the other kinds are covered with the lists of joomla-content.steps.js:
// extensions and plugins are enabled, disabled and asserted like any other
// item, the Global Configuration is a form read and set by field labels.)
//
// Every assertion waits on its locator (the assertion is the wait), and every
// failure is a friendly error with a hint instead of a raw Playwright timeout
// stack.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  openAdminPage,
  clickToolbarButton,
  awaitOutcome,
} = require('./joomla-helpers');

/**
 * The lines of a cell of a list row, found by the text its column header starts
 * with ("User Groups", "User Groups With Viewing Access").
 *
 * @param {object} world
 * @param {string} rowTitle - The text of the row (the title, or the username).
 * @param {string} header
 * @param {boolean} [stripButtons] - Leave out the buttons of the cell (the "Permissions" button of a user group).
 * @returns {Promise<{found: boolean, lines: string[], rows: string[]}>}
 */
async function cellOfRow(world, rowTitle, header, stripButtons = true) {
  return world.page.evaluate(({ title, head, strip }) => {
    const table = document.querySelector('#adminForm table');
    if (!table) return { found: false, lines: [], rows: [] };
    const headers = [...table.querySelectorAll('thead tr:last-child > *')].map((th) => (th.innerText || '').trim().replace(/\s+/g, ' '));
    const column = headers.findIndex((text) => text.toLowerCase().startsWith(head.toLowerCase()));
    const rows = [...table.querySelectorAll('tbody tr')];
    const names = rows.map((tr) => [...tr.querySelectorAll('th, td')].map((cell) => (cell.innerText || '').replace(/\s+/g, ' ').trim()));
    const index = rows.findIndex((tr) => [...tr.querySelectorAll('th a, td')].some((el) => {
      const copy = el.cloneNode(true);
      copy.querySelectorAll('.visually-hidden').forEach((hidden) => hidden.remove());
      return (copy.textContent || '').replace(/\s+/g, ' ').trim() === title;
    }));
    if (index < 0 || column < 0) return { found: false, lines: [], rows: names.map((cells) => cells[1] || cells[0]) };
    // The cell without its buttons ("Permissions") and with one line per group.
    const copy = rows[index].querySelectorAll('th, td')[column].cloneNode(true);
    copy.querySelectorAll(strip ? '.btn, .visually-hidden' : '.visually-hidden').forEach((el) => el.remove());
    copy.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    return { found: true, lines: (copy.textContent || '').split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean), rows: [] };
  }, { title: rowTitle, head: header, strip: stripButtons });
}

/**
 * Assert a user is (or is not) a member of a user group, read from the "User
 * Groups" column of the Users list.
 *
 * Example #1: Then the user "member" should be in the "Registered" group
 * Example #2: Then the user "admin" should be in the "Super Users" group
 * Example #3: Then the user "manager" should be in the "Manager" group
 * Example #4: And the user "member" should not be in the "Super Users" group
 * Example #5: Then the user "editor" should be in the "Editor" group
 *
 */
Then(/^the user "([^"]*)?" should( not)* be in the "([^"]*)?" group$/, async function (username, notCase, group) {
  await openAdminPage(this, 'Users', 'filter%5Bsearch%5D=' + encodeURIComponent(username));
  const cell = await cellOfRow(this, username, 'User Groups');
  if (!cell.found) {
    throw friendly({ message: `The Users list has no user "${username}" (searched by username).`, hint: 'Use the username of the account, as the Username column shows it; the account is created with the Joomla CLI.' });
  }
  const member = cell.lines.some((line) => line === group || line.replace(/^[–\-⋮\s]+/, '') === group);
  if (member === !!notCase) {
    throw friendly({
      message: notCase ? `Expected "${username}" not to be in the "${group}" group, but the list shows it there.` : `Expected "${username}" to be in the "${group}" group, but its groups are: ${cell.lines.join(', ') || '(none)'}.`,
      hint: 'The groups are read from the "User Groups" column of the Users list.',
    });
  }
});

/**
 * Assert the viewing access level includes (or does not include) a user group,
 * read from the "User Groups With Viewing Access" column of the Viewing Access
 * Levels list.
 *
 * Example #1: Then the access level "Registered" should include the "Registered" group
 * Example #2: Then the access level "Public" should include the "Public" group
 * Example #3: Then the access level "Special" should include the "Manager" group
 * Example #4: And the access level "Registered" should not include the "Guest" group
 * Example #5: Then the access level "Guest" should include the "Guest" group
 *
 */
Then(/^the access level "([^"]*)?" should( not)* include the "([^"]*)?" group$/, async function (level, notCase, group) {
  await openAdminPage(this, 'Access Levels');
  const cell = await cellOfRow(this, level, 'User Groups With Viewing Access');
  if (!cell.found) {
    throw friendly({ message: `The Viewing Access Levels list has no level "${level}"; it has: ${cell.rows.join(', ') || '(none)'}.`, hint: 'Use the level name as the list shows it ("Public", "Registered", "Special", "Guest", "Super Users").' });
  }
  const included = cell.lines.join(' ').split(',').map((part) => part.trim()).includes(group);
  if (included === !!notCase) {
    throw friendly({
      message: notCase ? `Expected the access level "${level}" not to include the "${group}" group, but it does.` : `Expected the access level "${level}" to include the "${group}" group, but it has: ${cell.lines.join(', ') || '(none)'}.`,
      hint: 'The groups are read from the "User Groups With Viewing Access" column of the Viewing Access Levels list.',
    });
  }
});

/**
 * Assert a user group has a number of enabled users, read from the "Enabled
 * Users" column of the Groups list.
 *
 * Example #1: Then the group "Registered" should have 1 enabled user
 * Example #2: Then the group "Super Users" should have 1 enabled user
 * Example #3: Then the group "Manager" should have 1 enabled user
 * Example #4: And the group "Guest" should have 0 enabled users
 * Example #5: Then the group "Editor" should have 1 enabled user
 *
 */
Then(/^the group "([^"]*)?" should have (\d+) enabled users?$/, async function (group, count) {
  await openAdminPage(this, 'Groups');
  const cell = await cellOfRow(this, group, 'Enabled Users', false);
  if (!cell.found) {
    throw friendly({ message: `The Groups list has no group "${group}"; it has: ${cell.rows.join(', ') || '(none)'}.`, hint: 'Use the group title as the list shows it ("Registered", "Manager", "Super Users").' });
  }
  const actual = parseInt((cell.lines[0] || '').replace(/\D/g, ''), 10);
  if (actual !== parseInt(count, 10)) {
    throw friendly({ message: `Expected the group "${group}" to have ${count} enabled user(s), but it has ${Number.isNaN(actual) ? 'no count' : actual}.`, hint: 'The count is the "Enabled Users" column of the Groups list: the users who belong to the group directly.' });
  }
});

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/**
 * Clear every cache group of the site: open "Maintenance: Clear Cache", press
 * "Delete All" and wait for Joomla's confirmation.
 *
 * Example #1: When I clear all caches
 * Example #2: When we clear all caches
 * Example #3: And I clear all caches
 * Example #4: When clear all caches
 * Example #5: And we clear all caches
 *
 */
When(/^(I |we )*clear all caches$/, async function (pronounCase) {
  await openAdminPage(this, 'Clear Cache');
  await clickToolbarButton(this, 'Delete All');
  await awaitOutcome(this, 'clear all caches');
});

/**
 * Clear the expired cache entries only: open "Maintenance: Clear Cache", press
 * "Clear Expired Cache" and wait for Joomla's confirmation.
 *
 * Example #1: When I clear the expired cache
 * Example #2: When we clear the expired cache
 * Example #3: And I clear the expired cache
 * Example #4: When clear the expired cache
 * Example #5: And we clear the expired cache
 *
 */
When(/^(I |we )*clear the expired cache$/, async function (pronounCase) {
  await openAdminPage(this, 'Clear Cache');
  await clickToolbarButton(this, 'Clear Expired Cache');
  await awaitOutcome(this, 'clear the expired cache');
});

// ---------------------------------------------------------------------------
// Global check-in
// ---------------------------------------------------------------------------

/**
 * Check in every item that is checked out: open "Maintenance: Global Check-in",
 * select all the tables and press "Check-in". Fails when nothing is checked
 * out, so a scenario that expects a locked item notices when it is not locked.
 *
 * Example #1: When I check in all items
 * Example #2: When we check in all items
 * Example #3: And I check in all items
 * Example #4: When check in all items
 * Example #5: And we check in all items
 *
 */
When(/^(I |we )*check in all items$/, async function (pronounCase) {
  await openAdminPage(this, 'Global Check-in');
  if (!(await this.page.locator('#adminForm tbody tr').count())) {
    throw friendly({ message: 'Nothing is checked out: the Global Check-in list is empty.', hint: 'An item is checked out while a form of it is open: open the form (for example "When I open the article "Typography" for editing") and leave it without closing.' });
  }
  await this.page.locator('#adminForm input[name="checkall-toggle"]').first().check();
  await clickToolbarButton(this, 'Check-in');
  await awaitOutcome(this, 'check in all items');
});

/**
 * Assert the site has (or has no) checked out items, read from the Global
 * Check-in page, which lists the tables that hold locked items.
 *
 * Example #1: Then there should be checked out items
 * Example #2: Then there should not be checked out items
 * Example #3: And there should not be checked out items
 * Example #4: Then there should be checked out items
 * Example #5: And there should be checked out items
 *
 */
Then(/^there should( not)* be checked out items$/, async function (notCase) {
  await openAdminPage(this, 'Global Check-in');
  const locked = (await this.page.locator('#adminForm tbody tr').count()) > 0;
  if (locked === !!notCase) {
    const tables = await this.page.locator('#adminForm tbody tr').evaluateAll((rows) => rows.map((row) => (row.innerText || '').replace(/\s+/g, ' ').trim()));
    throw friendly({
      message: notCase ? `Expected no checked out items, but the Global Check-in lists: ${tables.join('; ')}.` : 'Expected checked out items, but the Global Check-in list is empty.',
      hint: 'An item is checked out while a form of it is open; "When I check in all items" releases them.',
    });
  }
});
