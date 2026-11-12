'use strict';

// Joomla administrator step definitions for content: the list views (search,
// filter, select a row, the state of a row), the lifecycle of articles,
// categories, menu items and site modules (create, publish, unpublish, feature,
// archive, trash, delete), menus, the form controls of the administrator (the
// editor, the fancy selects, the switchers, the tabs) and the Media Manager.
//
// The steps for the lists name the thing they act on ("the article "Welcome""):
// each one opens the list of that kind filtered by the title, so it does not
// depend on the page the scenario was on, nor on the filters a previous session
// left in the list state.
//
// Every assertion waits on its locator (the assertion is the wait), and every
// failure is a friendly error with a hint instead of a raw Playwright timeout
// stack.

const fs = require('fs');
const path = require('path');
const { Given, When, Then } = require('@cucumber/cucumber');
const { smartSettle, friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  supplied,
  exactly,
  escapeRegExp,
  adminUrl,
  open,
  actOrExplain,
  assertPresence,
  adminQuery,
  openAdminPage,
  requireAdminSession,
  clickToolbarButton,
  acceptConfirmation,
  awaitOutcome,
  labelPattern,
  controlByLabel,
  revealField,
  openTab,
  chooseFancy,
  setSwitcher,
  setEditor,
  getEditor,
} = require('./joomla-helpers');

// ---------------------------------------------------------------------------
// The kinds of items a list shows
// ---------------------------------------------------------------------------

// For each kind: the named administrator page of its list, the filter of its
// state, and the value that shows every state (the default list hides the
// archived and the trashed items).
const KINDS = {
  'article': { page: 'Articles', stateFilter: 'filter[published]', all: '*', trashed: '-2' },
  'category': { page: 'Categories', stateFilter: 'filter[published]', all: '*', trashed: '-2' },
  'menu item': { page: 'Menu Items', stateFilter: 'filter[published]', all: '*', trashed: '-2' },
  'module': { page: 'Site Modules', stateFilter: 'filter[state]', all: '*', trashed: '-2' },
  'menu': { page: 'Menus', stateFilter: null },
  'plugin': { page: 'Plugins', stateFilter: null },
  'extension': { page: 'Extensions', stateFilter: null },
  'user': { page: 'Users', stateFilter: null },
  'group': { page: 'Groups', stateFilter: null },
  'access level': { page: 'Access Levels', stateFilter: null },
  'content language': { page: 'Content Languages', stateFilter: 'filter[published]', all: '*', trashed: '-2' },
};

/**
 * Open the list of a kind of item, filtered by a search text and by a state, so
 * the result does not depend on the filters the session remembers.
 *
 * @param {object} world
 * @param {string} kind
 * @param {{search?: string, state?: string}} [filters] - `state` is a value of the state filter; "all" and "trashed" are the kind's own values.
 */
async function openList(world, kind, { search = '', state = 'all' } = {}) {
  const definition = KINDS[kind];
  let query = adminQuery(definition.page);
  query += (query ? '&' : '') + 'filter%5Bsearch%5D=' + encodeURIComponent(search);
  if (definition.stateFilter) {
    const value = state === 'all' ? definition.all : state === 'trashed' ? definition.trashed : state;
    query += '&' + definition.stateFilter.replace('[', '%5B').replace(']', '%5D') + '=' + encodeURIComponent(value);
  }
  await open(world, adminUrl(world, query));
  await requireAdminSession(world, `the ${kind} list`);
  await world.page.locator('#adminForm').first().waitFor({ state: 'attached', timeout: budget(world) }).catch((err) => {
    throw friendly({ message: `The list of ${kind}s did not load.`, cause: err, hint: 'Check that the account may open the list (Super Users and Managers do).' });
  });
}

/**
 * Read the rows of the list on the page: the texts of their cells (the title
 * is the first line of the row header), the state icons and whether the row is
 * checked out.
 *
 * @param {object} world
 * @returns {Promise<Array<{index: number, names: string[], states: string[], featured: string|null, locked: boolean}>>}
 */
async function readRows(world) {
  return world.page.locator('#adminForm table tbody tr').evaluateAll((rows) => rows.map((tr, index) => {
    // The text of an element without the parts that are only for screen readers
    // ("Edit Menu", "Select Typography"): the title the user sees.
    const visibleText = (el) => {
      const copy = el.cloneNode(true);
      copy.querySelectorAll('.visually-hidden, .sr-only').forEach((hidden) => hidden.remove());
      return (copy.textContent || '').replace(/\s+/g, ' ').trim();
    };
    const names = [];
    tr.querySelectorAll('th a').forEach((el) => names.push(visibleText(el)));
    tr.querySelectorAll('th').forEach((el) => names.push(((el.innerText || '').trim().split('\n')[0] || '').trim()));
    tr.querySelectorAll('td').forEach((el) => names.push(visibleText(el).split(/\s{2,}/)[0]));
    const classes = [];
    tr.querySelectorAll('.tbody-icon, .tbody-icon span').forEach((el) => classes.push(...String(el.className).split(/\s+/)));
    const states = [];
    if (classes.includes('icon-publish')) states.push('published');
    if (classes.includes('icon-unpublish')) states.push('unpublished');
    if (classes.includes('icon-trash')) states.push('trashed');
    if (classes.includes('icon-archive')) states.push('archived');
    let featured = null;
    if (classes.some((name) => name === 'icon-featured' || name === 'icon-star' || name === 'icon-color-featured')) featured = 'featured';
    else if (classes.includes('icon-unfeatured')) featured = 'unfeatured';
    const locked = !!tr.querySelector('.icon-lock, .icon-checkedout, [class*="checkedout"], .tbody-icon.checked-out, button[data-checkedout]');
    return { index, names: names.filter(Boolean), states, featured, locked };
  }));
}

/**
 * The row of the list with the given title: the exact title wins over a title
 * that only contains the text.
 *
 * @param {Array} rows
 * @param {string} name
 * @returns {object|null}
 */
function pickRow(rows, name) {
  const wanted = name.trim();
  return rows.find((row) => row.names.includes(wanted))
    || rows.find((row) => row.names[0] && row.names[0].includes(wanted))
    || null;
}

/**
 * Open the list of a kind filtered by the title and return the row of the item,
 * or null when the list has no such row.
 *
 * @param {object} world
 * @param {string} kind
 * @param {string} name
 * @param {string} [state]
 * @returns {Promise<{row: object|null, rows: Array}>}
 */
async function findItem(world, kind, name, state = 'all') {
  await openList(world, kind, { search: name, state });
  const rows = await readRows(world);
  return { row: pickRow(rows, name), rows };
}

function itemRow(world, row) {
  return world.page.locator('#adminForm table tbody tr').nth(row.index);
}

/**
 * Open the list, find the item, select its row and return the row locator.
 * Fails with the titles the list does show when the item is not there.
 */
async function selectItem(world, kind, name, state = 'all') {
  const { row, rows } = await findItem(world, kind, name, state);
  if (!row) {
    throw friendly({
      message: `The ${kind} list has no "${name}"${rows.length ? `; its rows are: ${rows.map((entry) => entry.names[0]).join(', ')}` : ' (the list is empty)'}.`,
      hint: `Check the title (it is matched exactly, then as part of a title) and that the ${kind} exists${state === 'trashed' ? ' in the trash' : ''}.`,
    });
  }
  const locator = itemRow(world, row);
  await locator.locator('input[name="cid[]"]').first().check();
  return locator;
}

// ---------------------------------------------------------------------------
// Generic list steps
// ---------------------------------------------------------------------------

/**
 * Search the list on the page with the search box of the list tools
 * (`#filter_search`), then wait for the list to reload.
 *
 * Example #1: When I search the list for "Welcome"
 * Example #2: When I search the list for "Typography"
 * Example #3: When we search the list for "member"
 * Example #4: And I search the list for "Blog"
 * Example #5: When search the list for "Main Menu"
 *
 */
When(/^(I |we )*search the list for "([^"]*)?"$/, async function (pronounCase, text) {
  const box = this.page.locator('#filter_search');
  await actOrExplain('search the list for', text, async () => {
    await box.waitFor({ state: 'visible', timeout: budget(this) });
    await box.fill(text);
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      box.press('Enter'),
    ]);
  }, 'Open an administrator list first; the search box is the one of the list tools above the table.');
  await smartSettle(this.page, (this.minWaitTime && this.minWaitTime.page) || 3000);
});

/**
 * Filter the list on the page by one of its filters ("Select Status", "Select
 * Category", "Select Access", ...): open the filter options and choose the
 * option, then wait for the list to reload.
 *
 * Example #1: When I filter the list by "Select Status" with "Trashed"
 * Example #2: When I filter the list by "Select Status" with "All"
 * Example #3: When we filter the list by "Select Access" with "Public"
 * Example #4: And I filter the list by "Select Featured" with "Featured"
 * Example #5: When filter the list by "Select Status" with "Published"
 *
 */
When(/^(I |we )*filter the list by "([^"]*)?" with "([^"]*)?"$/, async function (pronounCase, filter, option) {
  await actOrExplain('filter the list by', filter, async () => {
    const toggle = this.page.locator('.js-stools-btn-filter');
    const select = this.page.locator('.js-stools-container-filter, .js-stools-container-filters').locator('select').filter({ has: this.page.locator('option', { hasText: option }) }).first();
    const labelled = this.page.getByLabel(filter, { exact: true }).first();
    const target = (await labelled.count()) ? labelled : select;
    if (!(await target.isVisible()) && (await toggle.count())) await toggle.first().click();
    await target.waitFor({ state: 'visible', timeout: budget(this) });
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      target.selectOption({ label: option }),
    ]);
  }, 'Open an administrator list first; the filter name and the option are the texts the filter shows (open "Filter Options" to read them).');
  await smartSettle(this.page, (this.minWaitTime && this.minWaitTime.page) || 3000);
});

/**
 * Select the row of the list on the page with the given title (its checkbox),
 * so a toolbar action applies to it. The exact title wins over a title that
 * only contains the text.
 *
 * Example #1: When I select the row "Welcome to your blog"
 * Example #2: When I select the row "Typography"
 * Example #3: When we select the row "Main Menu"
 * Example #4: And I select the row "member"
 * Example #5: When select the row "Blog"
 *
 */
When(/^(I |we )*select the row "([^"]*)?"$/, async function (pronounCase, name) {
  const rows = await readRows(this);
  const row = pickRow(rows, name);
  if (!row) {
    throw friendly({
      message: `The list has no row "${name}"${rows.length ? `; its rows are: ${rows.map((entry) => entry.names[0]).join(', ')}` : ' (the list is empty)'}.`,
      hint: 'Open the list first, and search it for the title when the list has more than one page.',
    });
  }
  await itemRow(this, row).locator('input[name="cid[]"]').first().check();
});

/**
 * Select every row of the list on the page (the checkbox in the table head).
 *
 * Example #1: When I select all rows
 * Example #2: When we select all rows
 * Example #3: And I select all rows
 * Example #4: When select all rows
 * Example #5: And we select all rows
 *
 */
When(/^(I |we )*select all rows$/, async function (pronounCase) {
  await actOrExplain('select all rows', 'the list', async () => {
    await this.page.locator('#adminForm input[name="checkall-toggle"]').first().check();
  }, 'Open an administrator list with at least one row first.');
});

/**
 * Assert the list on the page has (or has not) a row with the given title.
 *
 * Example #1: Then I should see the row "Typography" in the list
 * Example #2: Then I should see the row "Main Menu" in the list
 * Example #3: Then we should not see the row "Spreadsheets" in the list
 * Example #4: And I should see the row "member" in the list
 * Example #5: Then should see the row "Blog" in the list
 *
 */
Then(/^(I |we )*should( not)* see the row "([^"]*)?" in the list$/, async function (pronounCase, notCase, name) {
  const deadline = Date.now() + budget(this);
  let present = !!pickRow(await readRows(this), name);
  while (present === !!notCase && Date.now() < deadline) {
    await this.page.waitForTimeout(300);
    present = !!pickRow(await readRows(this), name);
  }
  if (present === !!notCase) {
    const rows = await readRows(this);
    throw friendly({
      message: notCase ? `Expected the list not to have a row "${name}", but it does.` : `Expected the list to have a row "${name}"; its rows are: ${rows.map((entry) => entry.names[0]).join(', ') || '(none)'}.`,
      hint: 'Open the list first, and search it for the title when the list has more than one page; the list hides archived and trashed items by default.',
    });
  }
});

/**
 * Assert the list on the page is empty: Joomla shows its "No Matching Results"
 * notice instead of rows (or, with "not", that the list has rows).
 *
 * Example #1: Then I should see an empty list
 * Example #2: Then I should not see an empty list
 * Example #3: Then we should see an empty list
 * Example #4: And I should not see an empty list
 * Example #5: Then should see an empty list
 *
 */
Then(/^(I |we )*should( not)* see an empty list$/, async function (pronounCase, notCase) {
  const deadline = Date.now() + budget(this);
  let empty = (await readRows(this)).length === 0;
  while (empty === !!notCase && Date.now() < deadline) {
    await this.page.waitForTimeout(300);
    empty = (await readRows(this)).length === 0;
  }
  if (empty === !!notCase) {
    throw friendly({
      message: notCase ? 'Expected the list to have rows, but it is empty.' : `Expected an empty list, but it has ${(await readRows(this)).length} row(s).`,
      hint: 'Check the search text and the filters of the list.',
    });
  }
});

// ---------------------------------------------------------------------------
// The lifecycle of an item
// ---------------------------------------------------------------------------

// The toolbar button of each action, and the kinds it applies to.
const ACTIONS = {
  'publish': { button: 'Publish', kinds: ['article', 'category', 'menu item', 'module'] },
  'unpublish': { button: 'Unpublish', kinds: ['article', 'category', 'menu item', 'module'] },
  'archive': { button: 'Archive', kinds: ['article', 'category'] },
  'trash': { button: 'Trash', kinds: ['article', 'category', 'menu item', 'module'] },
  'feature': { button: 'Feature', kinds: ['article'] },
  'unfeature': { button: 'Unfeature', kinds: ['article'] },
  'check in': { button: 'Check-in', kinds: ['article', 'category', 'menu item', 'module', 'plugin'] },
  'enable': { button: 'Enable', kinds: ['plugin', 'extension'] },
  'disable': { button: 'Disable', kinds: ['plugin', 'extension'] },
  'activate': { button: 'Activate', kinds: ['user'] },
  'block': { button: 'Block', kinds: ['user'] },
  'unblock': { button: 'Unblock', kinds: ['user'] },
};

/**
 * Apply a state action to an item: open the list of its kind filtered by its
 * title, select its row and press the toolbar button. Fails with the message
 * Joomla answers when the action is refused.
 *
 * Example #1: When I publish the article "Review article"
 * Example #2: When I unpublish the module "Review module"
 * Example #3: When we trash the category "Review category"
 * Example #4: And I feature the article "Review article"
 * Example #5: When I enable the plugin "System - Page Cache"
 *
 */
When(/^(I |we )*(publish|unpublish|archive|trash|feature|unfeature|check in|enable|disable|activate|block|unblock) the (article|category|menu item|module|plugin|extension|user) "([^"]*)?"$/, async function (pronounCase, action, kind, name) {
  const definition = ACTIONS[action];
  if (!definition.kinds.includes(kind)) {
    throw friendly({ message: `A ${kind} cannot be ${action}ed.`, hint: `"${action}" applies to: ${definition.kinds.join(', ')}.` });
  }
  await selectItem(this, kind, name);
  await clickToolbarButton(this, definition.button);
  await awaitOutcome(this, `${action} the ${kind} "${name}"`);
});

/**
 * Delete an item that is in the trash for good: open the trashed items of its
 * kind, select the item, press "Delete" and confirm.
 *
 * Example #1: When I delete the article "Review article" permanently
 * Example #2: When I delete the category "Review category" permanently
 * Example #3: When we delete the module "Review module" permanently
 * Example #4: And I delete the menu item "Review menu item" permanently
 * Example #5: When I delete the article "Another article" permanently
 *
 */
When(/^(I |we )*delete the (article|category|menu item|module) "([^"]*)?" permanently$/, async function (pronounCase, kind, name) {
  await selectItem(this, kind, name, 'trashed');
  await clickToolbarButton(this, ['Delete', 'Empty Trash']);
  await awaitOutcome(this, `delete the ${kind} "${name}"`);
});

/**
 * Open the form of an item to edit it: open the list of its kind filtered by
 * the title and follow the title link. The item stays checked out until the
 * form is saved or closed.
 *
 * Example #1: When I open the article "Typography" for editing
 * Example #2: When I open the category "Blog" for editing
 * Example #3: When we open the module "Login Form" for editing
 * Example #4: And I open the menu item "Typography" for editing
 * Example #5: When I open the plugin "System - Page Cache" for editing
 *
 */
When(/^(I |we )*open the (article|category|menu item|module|plugin|extension|user) "([^"]*)?" for editing$/, async function (pronounCase, kind, name) {
  const { row, rows } = await findItem(this, kind, name);
  if (!row) {
    throw friendly({ message: `The ${kind} list has no "${name}"${rows.length ? `; its rows are: ${rows.map((entry) => entry.names[0]).join(', ')}` : ''}.`, hint: 'Check the title; it is matched exactly, then as part of a title.' });
  }
  const link = itemRow(this, row).locator('th a, td a').filter({ hasText: exactly(row.names[0]) }).first();
  await actOrExplain('open for editing', name, async () => {
    await Promise.all([this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}), link.click()]);
  }, 'The title of the row must be a link to the form; an item that another user has checked out cannot be edited.');
  await smartSettle(this.page, (this.minWaitTime && this.minWaitTime.page) || 3000);
});

/**
 * Assert an item exists (or does not) in the list of its kind, in any state
 * (the archived and trashed items count). The kinds are articles, categories,
 * menu items, modules, plugins, extensions, users, menus, groups and access
 * levels.
 *
 * Example #1: Then the article "Typography" should exist
 * Example #2: Then the category "Blog" should exist
 * Example #3: Then the article "Review article" should not exist
 * Example #4: And the module "Login Form" should exist
 * Example #5: Then the user "member" should exist
 * Example #6: Then the menu "Main Menu Blog" should exist
 * Example #7: Then the group "Manager" should exist
 * Example #8: And the access level "Registered" should exist
 *
 */
Then(/^the (article|category|menu item|module|plugin|extension|user|menu|group|access level|content language) "([^"]*)?" should( not)* exist$/, async function (kind, name, notCase) {
  const { row, rows } = await findItem(this, kind, name);
  if (!!row === !!notCase) {
    throw friendly({
      message: notCase ? `Expected no ${kind} "${name}", but the list has it.` : `Expected the ${kind} "${name}" to exist${rows.length ? `; the list shows: ${rows.map((entry) => entry.names[0]).join(', ')}` : ' (the list is empty)'}.`,
      hint: 'The title is matched exactly, then as part of a title.',
    });
  }
});

/**
 * Make sure an item is gone, whatever state it is in: when the list has it, it
 * is trashed and deleted permanently; when it does not, nothing happens. Put it
 * at the top of a scenario that creates the item, so the scenario can run again
 * after a failed run left the item behind.
 *
 * Example #1: Given the article "Review article" is removed
 * Example #2: Given the category "Review category" is removed
 * Example #3: Given we have the module "Review module" removed
 * Example #4: And the menu item "Review item" is removed
 * Example #5: Given the menu "Review menu" is removed
 *
 */
Given(/^(?:the |we have the )(article|category|menu item|module|menu|content language) "([^"]*)?"(?: is removed| removed)$/, async function (kind, name) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const { rows } = await findItem(this, kind, name);
    const exact = rows.find((row) => row.names.includes(name.trim()));
    if (!exact) return;
    if (kind === 'menu') {
      await selectItem(this, kind, name);
      await clickToolbarButton(this, 'Delete');
      await awaitOutcome(this, `delete the menu "${name}"`);
      continue;
    }
    if (exact.states[0] !== 'trashed') {
      await selectItem(this, kind, name);
      await clickToolbarButton(this, 'Trash');
      await awaitOutcome(this, `trash the ${kind} "${name}"`);
    }
    await selectItem(this, kind, name, 'trashed');
    await clickToolbarButton(this, ['Delete', 'Empty Trash']);
    await awaitOutcome(this, `delete the ${kind} "${name}"`);
  }
  throw friendly({ message: `The ${kind} "${name}" could not be removed after ten tries.`, hint: 'Check the list for items with this title that another user has checked out.' });
});

// The states a row can be in, and the word the steps use for each.
const STATE_WORDS = {
  'published': { of: 'state', value: 'published' },
  'enabled': { of: 'state', value: 'published' },
  'unpublished': { of: 'state', value: 'unpublished' },
  'disabled': { of: 'state', value: 'unpublished' },
  'blocked': { of: 'state', value: 'unpublished' },
  'archived': { of: 'state', value: 'archived' },
  'trashed': { of: 'state', value: 'trashed' },
  'featured': { of: 'featured', value: 'featured' },
  'unfeatured': { of: 'featured', value: 'unfeatured' },
  'checked out': { of: 'locked', value: true },
};

/**
 * Assert the state of an item: published, unpublished, archived, trashed,
 * featured, unfeatured, enabled (a plugin, an extension or a user), disabled,
 * blocked (a user) or checked out. The step opens the list of the kind filtered
 * by the title, with every state shown, and reads the status icons of the row.
 *
 * Example #1: Then the article "Review article" should be published
 * Example #2: Then the article "Review article" should not be published
 * Example #3: Then the module "Review module" should be unpublished
 * Example #4: And the article "Review article" should be featured
 * Example #5: Then the plugin "System - Page Cache" should be disabled
 *
 */
Then(/^the (article|category|menu item|module|plugin|extension|user) "([^"]*)?" should( not)* be (published|unpublished|archived|trashed|featured|unfeatured|enabled|disabled|blocked|checked out)$/, async function (kind, name, notCase, word) {
  const { row, rows } = await findItem(this, kind, name);
  if (!row) {
    throw friendly({ message: `The ${kind} list has no "${name}"${rows.length ? `; its rows are: ${rows.map((entry) => entry.names[0]).join(', ')}` : ' (the list is empty)'}.`, hint: 'Check the title; it is matched exactly, then as part of a title.' });
  }
  const wanted = STATE_WORDS[word];
  const actual = wanted.of === 'locked' ? row.locked : wanted.of === 'featured' ? row.featured : row.states[0];
  const matches = wanted.of === 'locked' ? row.locked : actual === wanted.value;
  if (matches === !!notCase) {
    throw friendly({
      message: notCase ? `Expected the ${kind} "${name}" not to be ${word}, but it is.` : `Expected the ${kind} "${name}" to be ${word}, but it is ${wanted.of === 'locked' ? 'not checked out' : actual || 'in a state the list does not show'}.`,
      hint: 'The state is read from the status icons of the row in the list; check the title and that the action before this step succeeded.',
    });
  }
});

// ---------------------------------------------------------------------------
// Creating items
// ---------------------------------------------------------------------------

/** Press "Save & Close" and wait for Joomla's confirmation. */
async function saveAndClose(world, what) {
  await clickToolbarButton(world, 'Save & Close');
  return awaitOutcome(world, what);
}

/** Fill the title of the form on the page. */
async function fillTitle(world, title) {
  const field = world.page.locator('#jform_title');
  await field.waitFor({ state: 'visible', timeout: budget(world) });
  await field.fill(title);
}

/**
 * Create an article through the administrator form: open the new article form,
 * choose the category when one is given, fill the title and the text, set the
 * status or the featured flag, then Save & Close. The default status is the one
 * of Joomla, Published.
 *
 * Example #1: When I create an article titled "Review article"
 * Example #2: When I create an article titled "Review article" in the "Blog" category
 * Example #3: When I create a featured article titled "Review featured" in the "Blog" category with the text "Featured on the home page."
 * Example #4: When we create an unpublished article titled "Review draft" with the text "Not yet."
 * Example #5: When I create an article titled "Review text" with the text "Some text."
 *
 */
When(/^(I |we )*create (?:an? )?(featured |unpublished )?article titled "([^"]*)?"(?: in the "([^"]*)?" category)?(?: with the text "([^"]*)?")?$/, async function (pronounCase, kindCase, title, category, text) {
  await open(this, adminUrl(this, 'option=com_content&task=article.add'));
  await requireAdminSession(this, 'the new article form');
  // The category goes first: a change of category can reload the form (custom
  // fields), and the reload keeps what was typed but the order is safer.
  if (supplied(category)) await chooseFancy(this, 'Category', category);
  await fillTitle(this, title);
  if (supplied(text)) await setEditor(this, 'jform_articletext', `<p>${text}</p>`);
  if (kindCase && kindCase.trim() === 'unpublished') await this.page.locator('#jform_state').selectOption({ label: 'Unpublished' });
  if (kindCase && kindCase.trim() === 'featured') await setSwitcher(this, 'Featured', 'Yes');
  await saveAndClose(this, `save the article "${title}"`);
});

/**
 * Create a category of the articles through the administrator form, then Save &
 * Close.
 *
 * Example #1: When I create a category titled "Review category"
 * Example #2: When we create a category titled "Review reports"
 * Example #3: And I create a category titled "Review archive"
 * Example #4: When create a category titled "Review news"
 * Example #5: And we create a category titled "Review drafts"
 *
 */
When(/^(I |we )*create a category titled "([^"]*)?"$/, async function (pronounCase, title) {
  await open(this, adminUrl(this, 'option=com_categories&task=category.add&extension=com_content'));
  await requireAdminSession(this, 'the new category form');
  await fillTitle(this, title);
  await saveAndClose(this, `save the category "${title}"`);
});

/**
 * Create a menu through the administrator form, then Save & Close. The menu
 * type (its internal name) is made from the title.
 *
 * Example #1: When I create a menu titled "Review menu"
 * Example #2: When we create a menu titled "Review footer"
 * Example #3: And I create a menu titled "Review links"
 * Example #4: When create a menu titled "Review top"
 * Example #5: And we create a menu titled "Review side"
 *
 */
When(/^(I |we )*create a menu titled "([^"]*)?"$/, async function (pronounCase, title) {
  await open(this, adminUrl(this, 'option=com_menus&task=menu.add'));
  await requireAdminSession(this, 'the new menu form');
  await fillTitle(this, title);
  await this.page.locator('#jform_menutype').fill(title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  await saveAndClose(this, `save the menu "${title}"`);
});

/**
 * Delete a menu (with its menu items), from the Menus list: select the menu,
 * press "Delete" and confirm.
 *
 * Example #1: When I delete the menu "Review menu"
 * Example #2: When we delete the menu "Review footer"
 * Example #3: And I delete the menu "Review links"
 * Example #4: When delete the menu "Review top"
 * Example #5: And we delete the menu "Review side"
 *
 */
When(/^(I |we )*delete the menu "([^"]*)?"$/, async function (pronounCase, name) {
  await selectItem(this, 'menu', name);
  await clickToolbarButton(this, 'Delete');
  await awaitOutcome(this, `delete the menu "${name}"`);
});

/**
 * Create a menu item through the administrator form: open the new menu item
 * form of the menu, choose the menu item type (a path of the type dialog, such
 * as "Articles > Featured Articles"), fill the title, then Save & Close.
 *
 * Example #1: When I create a menu item titled "Review item" in the "Main Menu Blog" menu of the type "Articles > Featured Articles"
 * Example #2: When we create a menu item titled "Review blog" in the "Main Menu Blog" menu of the type "Articles > Featured Articles"
 * Example #3: And I create a menu item titled "Review link" in the "Special Menu" menu of the type "Articles > Featured Articles"
 * Example #4: When create a menu item titled "Review home" in the "Bottom Menu" menu of the type "Articles > Featured Articles"
 * Example #5: And we create a menu item titled "Review start" in the "Main Menu Blog" menu of the type "Articles > Featured Articles"
 *
 */
When(/^(I |we )*create a menu item titled "([^"]*)?" in the "([^"]*)?" menu of the type "([^"]*)?"$/, async function (pronounCase, title, menu, type) {
  const { row } = await findItem(this, 'menu', menu);
  if (!row) throw friendly({ message: `There is no menu "${menu}".`, hint: 'Use the title of a menu of the Menus list ("Main Menu Blog", "Bottom Menu").' });
  const menutype = await itemRow(this, row).locator('a[href*="view=items"]').first().getAttribute('href').then((href) => new URL(href, 'http://x').searchParams.get('menutype'));
  await open(this, adminUrl(this, `option=com_menus&task=item.add&menutype=${encodeURIComponent(menutype)}`));
  await requireAdminSession(this, 'the new menu item form');
  const segments = type.split('>').map((part) => part.trim());
  await actOrExplain('choose the menu item type', type, async () => {
    await this.page.locator('button', { hasText: /^\s*Select\s*$/ }).first().click();
    const frame = this.page.frameLocator('dialog[open] iframe').first();
    await frame.locator('.accordion-button', { hasText: exactly(segments[0]) }).click({ timeout: budget(this) });
    await frame.locator('a.choose_type').filter({ has: this.page.locator('xpath=.//div[normalize-space()=' + JSON.stringify(segments[1]) + ']') }).first().click({ timeout: budget(this) });
    await this.page.waitForFunction((name) => (document.querySelector('#jform_type') || {}).value === name, segments[1], { timeout: budget(this) });
  }, 'The type is a path of the type dialog: the group, then the type ("Articles > Featured Articles", "System Links > URL").');
  await smartSettle(this.page, (this.minWaitTime && this.minWaitTime.page) || 3000);
  await fillTitle(this, title);
  await saveAndClose(this, `save the menu item "${title}"`);
});

/**
 * Create a site module through the administrator form: pick the module type
 * from the list of types, fill the title, the text of the editor (for a Custom
 * module) and the position, then Save & Close. A new module is published on all
 * pages.
 *
 * Example #1: When I create a "Custom" site module titled "Review module" with the text "Review text." in the "sidebar-right" position
 * Example #2: When we create a "Custom" site module titled "Review notice" with the text "A notice." in the "sidebar-right" position
 * Example #3: And I create a "Custom" site module titled "Review banner" with the text "A banner." in the "bottom-b" position
 * Example #4: When create a "Custom" site module titled "Review panel" with the text "A panel." in the "sidebar-right" position
 * Example #5: And we create a "Custom" site module titled "Review box" with the text "A box." in the "sidebar-right" position
 *
 */
When(/^(I |we )*create an? "([^"]*)?" site module titled "([^"]*)?"(?: with the text "([^"]*)?")?(?: in the "([^"]*)?" position)?$/, async function (pronounCase, type, title, text, position) {
  await open(this, adminUrl(this, 'option=com_modules&view=select&client_id=0'));
  await requireAdminSession(this, 'the module types');
  await actOrExplain('choose the module type', type, async () => {
    const link = this.page.locator('a.comModulesSelectCard').filter({ has: this.page.locator('.new-module-title', { hasText: exactly(type) }) }).first();
    await link.waitFor({ state: 'visible', timeout: budget(this) });
    await Promise.all([this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}), link.click()]);
  }, 'The type is the name the "Select a Module Type" page shows ("Custom", "Menu", "Articles - Latest").');
  await smartSettle(this.page, (this.minWaitTime && this.minWaitTime.page) || 3000);
  await fillTitle(this, title);
  if (supplied(text)) await setEditor(this, undefined, `<p>${text}</p>`);
  if (supplied(position)) await chooseFancy(this, 'Position', position);
  await saveAndClose(this, `save the module "${title}"`);
});

// ---------------------------------------------------------------------------
// Form controls of the administrator
// ---------------------------------------------------------------------------

/**
 * Write the content of an editor of the form (TinyMCE, CodeMirror or the plain
 * editor) through Joomla's editor API, so the same step fits every editor. With
 * no field named, the only editor of the page is used.
 *
 * Example #1: When I fill in the rich text editor with "<p>Hello</p>"
 * Example #2: When I fill in the rich text editor field "Article Text" with "<p>Hello</p>"
 * Example #3: When we fill in the rich text editor field "jform_articletext" with "Some text"
 * Example #4: And I fill in the rich text editor field "Content" with "<p>Notice</p>"
 * Example #5: When fill in the rich text editor with "Text"
 *
 */
When(/^(I |we )*fill in the rich text editor(?: field "([^"]*)?")? with "([^"]*)?"$/, async function (pronounCase, field, value) {
  await setEditor(this, field, value);
});

/**
 * Assert the content of an editor of the form contains (or does not contain)
 * some text.
 *
 * Example #1: Then the rich text editor should contain "Hello"
 * Example #2: Then the rich text editor field "Article Text" should contain "Hello"
 * Example #3: Then the rich text editor field "jform_articletext" should not contain "Goodbye"
 * Example #4: And the rich text editor should not contain "Draft"
 * Example #5: Then the rich text editor field "Content" should contain "Notice"
 *
 */
Then(/^the rich text editor(?: field "([^"]*)?")? should( not)* contain "([^"]*)?"$/, async function (field, notCase, expected) {
  const value = await getEditor(this, field);
  if (value.includes(expected) === !!notCase) {
    throw friendly({
      message: notCase ? `Expected the editor not to contain "${expected}", but it does.` : `Expected the editor to contain "${expected}", but it holds "${value.replace(/\s+/g, ' ').slice(0, 200)}".`,
      hint: 'The step reads the HTML the editor holds, tags included.',
    });
  }
});

/**
 * Choose an option in a select of the form, including the fancy selects Joomla
 * shows as a search box (Category, Position, Tags): the step uses the widget the
 * user sees, so the form reacts as it does for a person.
 *
 * Example #1: When I choose "Blog" in the "Category" field
 * Example #2: When I choose "Unpublished" in the "Status" field
 * Example #3: When we choose "Registered" in the "Access" field
 * Example #4: And I choose "sidebar-right" in the "Position" field
 * Example #5: When choose "Help" in the "Category" field
 *
 */
When(/^(I |we )*choose "([^"]*)?" in the "([^"]*)?" field$/, async function (pronounCase, option, label) {
  await chooseFancy(this, label, option);
});

/**
 * Set a switcher (Featured: No/Yes, Site Offline: No/Yes) or a radio group of
 * the form to an option, by clicking the option the user sees.
 *
 * Example #1: When I switch "Featured" to "Yes"
 * Example #2: When I switch "Site Offline" to "No"
 * Example #3: When we switch "Featured" to "No"
 * Example #4: And I switch "Show Title" to "Hide"
 * Example #5: When switch "Featured" to "Yes"
 *
 */
When(/^(I |we )*switch "([^"]*)?" to "([^"]*)?"$/, async function (pronounCase, label, option) {
  await setSwitcher(this, label, option);
});

/**
 * Open a tab of the form on the page ("Publishing", "Options", "Images and
 * Links", "Permissions").
 *
 * Example #1: When I open the "Publishing" tab
 * Example #2: When I open the "Options" tab
 * Example #3: When we open the "Images and Links" tab
 * Example #4: And I open the "Permissions" tab
 * Example #5: When open the "Publishing" tab
 *
 */
When(/^(I |we )*open the "([^"]*)?" tab$/, async function (pronounCase, name) {
  await openTab(this, name);
});

/**
 * The value of a form field as the user sees it, found by its label (or id): the
 * text of an input or a textarea, the selected option of a select, the checked
 * option of a switcher or a radio group (found by its legend).
 *
 * @param {object} world
 * @param {string} label
 * @returns {Promise<string[]>} The value and, for a select, the value of the selected option.
 */
async function readField(world, label) {
  const group = world.page.locator('fieldset').filter({ has: world.page.locator('legend', { hasText: labelPattern(label) }) }).filter({ has: world.page.locator('input[type="radio"]') }).first();
  if (await group.count()) {
    const chosen = await group.evaluate((el) => {
      const input = el.querySelector('input[type="radio"]:checked');
      const text = input && el.querySelector(`label[for="${input.id}"]`);
      return input ? [text ? text.innerText.trim() : input.value, input.value] : [];
    });
    return chosen;
  }
  const control = await controlByLabel(world, label);
  return control.evaluate((el) => (el.tagName === 'SELECT' ? [(el.selectedOptions[0] || {}).text || el.value, el.value] : [el.value]));
}

/**
 * Assert the field with the given label has (or does not have) a value. The
 * field can be on a tab that is not open: the value is read from the form. A
 * select is compared by the text of its selected option or by its value; a
 * switcher by the label of its checked option.
 *
 * Example #1: Then the field labelled "Title" should have the value "Typography"
 * Example #2: Then the field labelled "Alias" should have the value "typography"
 * Example #3: Then the field labelled "Site Name" should not have the value "Other"
 * Example #4: And the field labelled "jform_title" should have the value "Typography"
 * Example #5: Then the field labelled "Site Offline" should have the value "No"
 *
 */
Then(/^the field labelled "([^"]*)?" should( not)* have the value "([^"]*)?"$/, async function (label, notCase, expected) {
  const values = await readField(this, label);
  const matches = values.includes(expected);
  if (matches === !!notCase) {
    throw friendly({
      message: notCase ? `Expected the field "${label}" not to have the value "${expected}", but it does.` : `Expected the field "${label}" to have the value "${expected}", but it has "${values[0] === undefined ? '' : values[0]}".`,
      hint: 'A select is compared by the text of its selected option or by its value; a switcher by the label of its checked option.',
    });
  }
});

/**
 * Set a field of the form by its label (or id): fill a text input or a textarea,
 * choose the option of a select (the fancy selects included), or set a switcher
 * (found by its legend) to an option. The field can be on a tab that is not
 * open. Save the form afterwards with the toolbar.
 *
 * Example #1: When I set the field labelled "Site Name" to "Joomla Review"
 * Example #2: When I set the field labelled "Site Offline" to "Yes"
 * Example #3: When we set the field labelled "Default List Limit" to "25"
 * Example #4: And I set the field labelled "Title" to "A new title"
 * Example #5: When set the field labelled "Site Meta Description" to "A short description"
 *
 */
When(/^(I |we )*set the field labelled "([^"]*)?" to "([^"]*)?"$/, async function (pronounCase, label, value) {
  const group = this.page.locator('fieldset').filter({ has: this.page.locator('legend', { hasText: labelPattern(label) }) }).filter({ has: this.page.locator('input[type="radio"]') }).first();
  value = value === null || value === undefined ? '' : value;
  if (await group.count()) {
    await setSwitcher(this, label, value);
    return;
  }
  value = value === null || value === undefined ? '' : value;
  const control = await controlByLabel(this, label);
  const kind = await control.evaluate((el) => el.tagName.toLowerCase());
  if (kind === 'select') {
    await chooseFancy(this, label, value);
  } else {
    await revealField(this, control);
    await control.fill(value);
  }
});

// ---------------------------------------------------------------------------
// Media Manager
// ---------------------------------------------------------------------------

/**
 * Upload a file in the Media Manager folder that is open: give the file to the
 * upload input of the manager (the same input the Upload button opens). The path
 * is relative to the folder the suite runs in, or absolute.
 *
 * Example #1: When I upload the file "tests/fixtures/pixel.png" to the media manager
 * Example #2: When we upload the file "tests/fixtures/pixel.png" to the media manager
 * Example #3: And I upload the file "tests/fixtures/pixel.png" to the media manager
 * Example #4: When upload the file "tests/fixtures/pixel.png" to the media manager
 * Example #5: And we upload the file "/tmp/photo.jpg" to the media manager
 *
 */
When(/^(I |we )*upload the file "([^"]*)?" to the media manager$/, async function (pronounCase, file) {
  const resolved = path.resolve(process.cwd(), file);
  if (!fs.existsSync(resolved)) {
    throw friendly({ message: `The file "${file}" does not exist (looked for ${resolved}).`, hint: 'Give a path relative to the folder the suite runs in, or an absolute path.' });
  }
  await actOrExplain('upload the file', file, async () => {
    await this.page.locator('.media-browser, #com-media').first().waitFor({ state: 'attached', timeout: budget(this) });
    await this.page.locator('input[type="file"]').first().setInputFiles(resolved);
    await this.page.locator('.media-browser-item').filter({ has: this.page.locator(`[title="${path.basename(resolved)}"]`) }).first().waitFor({ state: 'visible', timeout: budget(this) });
  }, 'Open the Media Manager first ("Given I am on the administrator "Media" page"); the file type must be one the manager accepts (images, documents, audio, video).');
});

/**
 * Assert the Media Manager folder that is open has (or does not have) a file or
 * a folder with the given name.
 *
 * Example #1: Then I should see the media file "pixel.png"
 * Example #2: Then I should not see the media file "pixel.png"
 * Example #3: Then we should see the media file "joomla_black.png"
 * Example #4: And I should see the media file "banners"
 * Example #5: Then should not see the media file "missing.png"
 *
 */
Then(/^(I |we )*should( not)* see the media file "([^"]*)?"$/, async function (pronounCase, notCase, name) {
  await assertPresence(this.page.locator('.media-browser-item').filter({ has: this.page.locator(`.media-browser-item-info[title="${name}"], .media-browser-item-preview[title="${name}"], [title="${name}"]`) }), notCase, {
    label: `the media file "${name}"`,
    hint: 'Open the Media Manager folder that holds the file first; the name is matched exactly.',
    timeout: budget(this),
  });
});

/**
 * Delete a file of the Media Manager folder that is open: select it, press
 * "Delete" and confirm in the dialog.
 *
 * Example #1: When I delete the media file "pixel.png"
 * Example #2: When we delete the media file "pixel.png"
 * Example #3: And I delete the media file "photo.jpg"
 * Example #4: When delete the media file "pixel.png"
 * Example #5: And we delete the media file "old.png"
 *
 */
When(/^(I |we )*delete the media file "([^"]*)?"$/, async function (pronounCase, name) {
  const item = this.page.locator('.media-browser-item').filter({ has: this.page.locator(`[title="${name}"]`) }).first();
  await actOrExplain('delete the media file', name, async () => {
    await item.waitFor({ state: 'visible', timeout: budget(this) });
    await item.click();
    await this.page.locator('#toolbar button', { hasText: /^\s*Delete\s*$/ }).first().click();
    await acceptConfirmation(this);
    await item.waitFor({ state: 'detached', timeout: budget(this) });
  }, 'Open the Media Manager folder that holds the file first; the name is matched exactly.');
});
