'use strict';

// Shared helpers for the Joomla step files.
//
// Not a step file: it registers no step definitions and no hooks. It holds the
// plumbing the Joomla steps use and that downstream packs can require instead of
// copying: the wait budget, presence assertions with friendly errors, URL
// building, the users registry, the system messages (`joomla-alert`), the
// administrator list views and the administrator toolbar.
//
// Everything here builds on webship-js's own helpers (`gotoUrl`, `smartSettle`,
// `friendly`) so the steps behave like the core webship-js steps.

const { gotoUrl, smartSettle, waitForPageLoad, friendly } = require('webship-js/tests/step-definitions/webship');

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least
 * 10 seconds, so a slow page does not fail an assertion that would pass a moment
 * later. Kept below webship-js's 45 second step timeout.
 *
 * @param {object} world
 * @returns {number}
 */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

/**
 * Whether an optional step argument was supplied. A regex group that did not
 * take part in the match reaches the step as `undefined` (or `null` after a
 * transform), so optional arguments are tested through this.
 *
 * @param {*} value
 * @returns {boolean}
 */
function supplied(value) {
  return value !== undefined && value !== null;
}

/**
 * Escape a literal string for use in a RegExp.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A case-sensitive RegExp that matches the literal text anywhere.
 *
 * @param {string} text
 * @returns {RegExp}
 */
function literal(text) {
  return new RegExp(escapeRegExp(text));
}

/**
 * A RegExp that matches the whole text (ignoring surrounding space), for exact
 * titles and labels.
 *
 * @param {string} text
 * @returns {RegExp}
 */
function exactly(text) {
  return new RegExp('^\\s*' + escapeRegExp(text) + '\\s*$');
}

/**
 * The site root without a trailing slash.
 *
 * @param {object} world
 * @returns {string}
 */
function siteRoot(world) {
  return String(world.launchUrl).replace(/\/+$/, '');
}

/**
 * Join the site root and a path with exactly one slash. Absolute URLs pass
 * through.
 *
 * @param {object} world
 * @param {string} url
 * @returns {string}
 */
function siteUrl(world, url) {
  if (!url) return siteRoot(world);
  if (/^https?:\/\//i.test(url)) return url;
  return siteRoot(world) + '/' + String(url).replace(/^\/+/, '');
}

/**
 * The URL of an administrator page from its query string
 * (`option=com_content&view=articles`).
 *
 * @param {object} world
 * @param {string} query
 * @returns {string}
 */
function adminUrl(world, query) {
  return siteRoot(world) + '/administrator/index.php' + (query ? '?' + String(query).replace(/^\?/, '') : '');
}

/**
 * Open a URL and wait for the page to settle.
 *
 * @param {object} world
 * @param {string} url
 */
async function open(world, url) {
  await gotoUrl(world.page, url);
  await world.page.waitForSelector('body', { state: 'attached', timeout: budget(world) });
  await waitForPageLoad(world.page, (world.minWaitTime && world.minWaitTime.page) || 3000);
}

/**
 * Run an action and rethrow its failure as a friendly error (action, target,
 * cause and a hint) instead of Playwright's raw timeout stack.
 *
 * @param {string} label
 * @param {string} target
 * @param {Function} fn
 * @param {string} hint
 */
async function actOrExplain(label, target, fn, hint) {
  try {
    return await fn();
  } catch (err) {
    if (err && err.stack === err.message && /Hint:/.test(err.message)) throw err;
    throw friendly({ action: label, target, cause: err, hint });
  }
}

/**
 * Wait until a locator has (or, with `notCase`, no longer has) a visible match
 * and fail with a friendly error otherwise: the wait and the assertion are one
 * call, so content that arrives a moment late still passes.
 *
 * @param {import('playwright').Locator} locator
 * @param {string|null|undefined} notCase
 * @param {{label: string, hint: string, timeout: number, state?: string}} options
 */
async function assertPresence(locator, notCase, { label, hint, timeout, state = 'visible' }) {
  try {
    await locator.first().waitFor({ state: notCase ? 'hidden' : state, timeout });
  } catch {
    throw friendly({
      message: notCase ? `Expected not to see ${label}, but it is still on the page.` : `Expected to see ${label}, but it did not appear within ${timeout} ms.`,
      hint,
    });
  }
}

/**
 * A user of the `users` registry in cucumber.js (`worldParameters.users`).
 *
 * @param {object} world
 * @param {string} handle
 * @returns {{username: string, password: string}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The user "${handle}" is not in the users registry. Known users: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { username: '...', password: process.env.JOOMLA_${handle.toUpperCase()}_PASSWORD } }. The account itself is created once with the Joomla CLI (php cli/joomla.php user:add), never by a feature.`,
    });
  }
  const username = entry.username || handle;
  const password = typeof entry === 'string' ? entry : entry.password;
  if (!password) {
    throw friendly({
      message: `The user "${handle}" has no password in the users registry.`,
      hint: `Set worldParameters.users.${handle}.password in cucumber.js, from an environment variable.`,
    });
  }
  return { username, password };
}

// ---------------------------------------------------------------------------
// System messages (joomla-alert)
// ---------------------------------------------------------------------------

// Joomla renders its messages as <joomla-alert type="..."> inside
// #system-message-container (the same on the site and in the administrator).
// The message types of the PHP side map to the alert types of the page:
// message -> success, notice -> info, warning -> warning, error -> danger.
const ALERT_TYPES = { success: 'success', info: 'info', notice: 'info', warning: 'warning', error: 'danger', danger: 'danger' };

/**
 * The visible `joomla-alert` elements of the page, optionally of one type and
 * containing some text.
 *
 * @param {object} world
 * @param {string} [type] success, info, notice, warning or error
 * @param {string} [text]
 * @returns {import('playwright').Locator}
 */
function alerts(world, type, text) {
  const alertType = type ? ALERT_TYPES[String(type).toLowerCase()] : null;
  let locator = world.page.locator(alertType ? `#system-message-container joomla-alert[type="${alertType}"]` : '#system-message-container joomla-alert');
  if (supplied(text) && text !== '') locator = locator.filter({ hasText: literal(text) });
  return locator;
}

// ---------------------------------------------------------------------------
// Administrator pages
// ---------------------------------------------------------------------------

// The named administrator pages, by the title a tester knows them by. The value
// is the query string after /administrator/index.php.
const ADMIN_PAGES = {
  'dashboard': '',
  'home dashboard': '',
  'articles': 'option=com_content&view=articles',
  'featured articles': 'option=com_content&view=featured',
  'article categories': 'option=com_categories&view=categories&extension=com_content',
  'categories': 'option=com_categories&view=categories&extension=com_content',
  'media': 'option=com_media',
  'site modules': 'option=com_modules&view=modules&client_id=0',
  'modules': 'option=com_modules&view=modules&client_id=0',
  'administrator modules': 'option=com_modules&view=modules&client_id=1',
  'menus': 'option=com_menus&view=menus',
  'menu items': 'option=com_menus&view=items&menutype=',
  'users': 'option=com_users&view=users',
  'groups': 'option=com_users&view=groups',
  'access levels': 'option=com_users&view=levels',
  'user notes': 'option=com_users&view=notes',
  'extensions': 'option=com_installer&view=manage',
  'manage extensions': 'option=com_installer&view=manage',
  'plugins': 'option=com_plugins&view=plugins',
  'site templates': 'option=com_templates&view=styles&client_id=0',
  'site template styles': 'option=com_templates&view=styles&client_id=0',
  'installed languages': 'option=com_languages&view=installed',
  'content languages': 'option=com_languages&view=languages',
  'global configuration': 'option=com_config',
  'system information': 'option=com_admin&view=sysinfo',
  'clear cache': 'option=com_cache',
  'global check-in': 'option=com_checkin',
  'smart search index': 'option=com_finder&view=index',
  'smart search': 'option=com_finder&view=index',
  'tags': 'option=com_tags&view=tags',
  'banners': 'option=com_banners&view=banners',
  'contacts': 'option=com_contact&view=contacts',
  'redirects': 'option=com_redirect&view=links',
  'user actions log': 'option=com_actionlogs&view=actionlogs',
  'messages': 'option=com_messages&view=messages',
};

/**
 * The query string of a named administrator page. A name that is not in the
 * table but looks like a query string (`option=com_tags&view=tags`) is used
 * as it is.
 *
 * @param {string} name
 * @returns {string}
 */
function adminQuery(name) {
  const key = String(name).trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ADMIN_PAGES, key)) return ADMIN_PAGES[key];
  if (/^option=com_/.test(String(name).trim())) return String(name).trim();
  throw friendly({
    message: `"${name}" is not a known administrator page.`,
    hint: `Use one of: ${Object.keys(ADMIN_PAGES).join(', ')}; or a query string such as "option=com_tags&view=tags".`,
  });
}

/**
 * Open a named administrator page and make sure the session is signed in. A
 * list is opened with an empty search text (the session would remember the last
 * one).
 *
 * @param {object} world
 * @param {string} name
 * @param {string} [extraQuery]
 */
async function openAdminPage(world, name, extraQuery) {
  let query = adminQuery(name);
  // A list remembers its search text in the session: a page opened by name starts
  // with an empty search, so it shows what the page shows to a person who just
  // opened it.
  if (!extraQuery && /(^|&)view=/.test(query)) extraQuery = 'filter%5Bsearch%5D=';
  if (extraQuery) query += (query ? '&' : '') + extraQuery;
  await open(world, adminUrl(world, query));
  await requireAdminSession(world, name);
}

/**
 * Fail with a hint when the administrator login form shows instead of a page.
 *
 * @param {object} world
 * @param {string} what
 */
async function requireAdminSession(world, what) {
  if (await world.page.locator('#form-login').count()) {
    throw friendly({
      message: `The administrator login form is showing instead of "${what}": nobody is logged in to the administrator panel.`,
      hint: 'Add "Given I am a logged in user with the "admin" user" before this step.',
    });
  }
}

// ---------------------------------------------------------------------------
// Administrator toolbar
// ---------------------------------------------------------------------------

/**
 * Click a button of the administrator toolbar by its text. Buttons inside the
 * "Actions" dropdown (Publish, Unpublish, Trash, Check-in, ...) are reached by
 * opening the dropdown first. A disabled button (a list action with no row
 * selected) is reported with a hint instead of a timeout. A button that asks
 * for confirmation (Delete, Clear Expired Cache) is confirmed with "Yes".
 *
 * @param {object} world
 * @param {string|string[]} name - One button text, or alternatives (the first one that exists is used).
 */
async function clickToolbarButton(world, name) {
  const page = world.page;
  const alternatives = (Array.isArray(name) ? name : [name]).map((text) => String(text).trim().toLowerCase());
  const buttons = page.locator('#toolbar joomla-toolbar-button button, #toolbar joomla-toolbar-button a, #toolbar > .btn-wrapper > a');
  const found = await buttons.evaluateAll((els) => els.map((el, index) => ({
    index,
    text: (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').toLowerCase(),
    disabled: el.classList.contains('disabled') || el.disabled === true || el.getAttribute('aria-disabled') === 'true',
    inMenu: !!el.closest('.dropdown-menu'),
  })));
  const matches = found.filter((entry) => alternatives.includes(entry.text));
  name = alternatives.join('" or "');
  if (!matches.length) {
    throw friendly({
      message: `There is no "${name}" button in the toolbar. The toolbar has: ${found.map((entry) => entry.text).filter(Boolean).join(', ') || '(no buttons)'}.`,
      hint: 'Open the page that carries the button first; the button text is the one the toolbar shows (for example "Save & Close", "Publish", "Trash").',
    });
  }
  const match = matches.find((entry) => !entry.disabled) || matches[0];
  if (match.disabled) {
    throw friendly({
      message: `The "${name}" toolbar button is disabled.`,
      hint: 'A list action needs a row selected first ("When I select the row ..."); a form action may need a change first.',
    });
  }
  const button = buttons.nth(match.index);
  if (match.inMenu) {
    const toggle = button.locator("xpath=ancestor::div[contains(@class,'dropdown-menu')][1]/..").locator('.dropdown-toggle, .dropdown-toggle-split').first();
    await actOrExplain('open the toolbar actions menu', name, async () => {
      await toggle.click();
      await button.waitFor({ state: 'visible', timeout: budget(world) });
    }, 'The action is inside the "Actions" dropdown of the toolbar.');
  }
  // A button with a `confirm-message` (Delete, Clear Expired Cache) asks before
  // it acts; the step answers "Yes".
  const asksConfirmation = await button.evaluate((el) => !!(el.closest('joomla-toolbar-button') || el).getAttribute('confirm-message'));
  await actOrExplain('click the toolbar button', name, () => button.click(), 'Check the button text and that the page is the one that carries it.');
  if (asksConfirmation) await acceptConfirmation(world);
  await smartSettle(page, (world.minWaitTime && world.minWaitTime.page) || 3000);
}

/**
 * Answer the confirmation Joomla asks before a permanent delete: the `<dialog>`
 * with the "Yes" button (`data-button-ok`), or the Media Manager's modal with its
 * "Delete" button. Fails when no confirmation shows.
 *
 * @param {object} world
 */
async function acceptConfirmation(world) {
  const ok = world.page.locator('dialog[open] [data-button-ok], .modal .modal-dialog .btn-danger').first();
  try {
    await ok.waitFor({ state: 'visible', timeout: budget(world) });
  } catch (err) {
    throw friendly({ message: 'Expected a confirmation dialog before the delete, but none appeared.', cause: err, hint: 'The delete may need a row selected first, or the toolbar button did not respond.' });
  }
  await ok.click();
  await smartSettle(world.page, (world.minWaitTime && world.minWaitTime.page) || 3000);
}

/**
 * Wait for the outcome of an action that ends in a system message: return the
 * text of the first success message, or throw with the text of the first error
 * or warning. The stock "Help us make Joomla! better!" notice is an info
 * message and is ignored.
 *
 * @param {object} world
 * @param {string} what - What was done, for the error ("save the article").
 * @returns {Promise<string>}
 */
async function awaitOutcome(world, what) {
  const container = world.page.locator('#system-message-container joomla-alert[type="success"], #system-message-container joomla-alert[type="danger"], #system-message-container joomla-alert[type="warning"]');
  try {
    await container.first().waitFor({ state: 'visible', timeout: budget(world) });
  } catch (err) {
    throw friendly({
      message: `Could not ${what}: the page showed no confirmation message.`,
      cause: err,
      hint: 'Joomla confirms an action with a success message; if the page shows a validation hint on a field, the form was not submitted.',
    });
  }
  // An action can answer with a success and a warning together ("Article saved."
  // and "Alias already existed so a number was added"): the success wins; an
  // error never does.
  const messages = await container.evaluateAll((els) => els.map((el) => ({ type: el.getAttribute('type'), text: (el.innerText || '').replace(/\s+/g, ' ').trim() })));
  const failure = messages.find((entry) => entry.type === 'danger') || (messages.some((entry) => entry.type === 'success') ? null : messages[0]);
  if (failure) {
    throw friendly({ message: `Could not ${what}: Joomla answered "${failure.text}".`, hint: 'Fix the cause named in the message; the data of the scenario may be missing or already in use.' });
  }
  return messages.find((entry) => entry.type === 'success').text;
}


// ---------------------------------------------------------------------------
// Forms: tabs, labels, fancy selects, switchers, the editor
// ---------------------------------------------------------------------------

/**
 * A RegExp for a field label: the text, with the star of a required field
 * allowed after it.
 *
 * @param {string} text
 * @returns {RegExp}
 */
function labelPattern(text) {
  return new RegExp('^\\s*' + escapeRegExp(text) + '(\\s*\\*)?\\s*$', 'i');
}

/**
 * The form control a label points at, found by the label text (or by the id of
 * the control itself). The control can be hidden: Joomla hides the select of a
 * fancy select behind its own widget, and a tab hides its fields.
 *
 * @param {object} world
 * @param {string} label
 * @returns {Promise<import('playwright').Locator>}
 */
async function controlByLabel(world, label) {
  const page = world.page;
  const byId = page.locator(`[id="${label}"]`);
  if (await byId.count()) return byId.first();
  const labels = page.locator('label').filter({ hasText: labelPattern(label) });
  const count = await labels.count();
  for (let index = 0; index < count; index++) {
    const id = await labels.nth(index).getAttribute('for');
    if (id && (await page.locator(`[id="${id}"]`).count())) return page.locator(`[id="${id}"]`).first();
  }
  throw friendly({
    message: `There is no field labelled "${label}" on the page.`,
    hint: 'Use the label the form shows (for example "Title", "Category", "Site Name"), or the id of the field ("jform_title"); open the form first.',
  });
}

/**
 * Open the tab that holds a field, when the field is hidden by a tab of the
 * form (`joomla-tab`).
 *
 * @param {object} world
 * @param {import('playwright').Locator} locator
 */
async function revealField(world, locator) {
  if (await locator.first().isVisible()) return;
  const tabId = await locator.first().evaluate((el) => {
    const panel = el.closest('joomla-tab-element');
    return panel ? panel.id : null;
  });
  if (tabId) {
    await world.page.locator(`joomla-tab button[aria-controls="${tabId}"]`).first().click();
    await locator.first().waitFor({ state: 'visible', timeout: budget(world) }).catch(() => {});
  }
}

/**
 * Open a tab of a form by its text ("Publishing", "Options", "Images and
 * Links").
 *
 * @param {object} world
 * @param {string} name
 */
async function openTab(world, name) {
  const tab = world.page.locator('joomla-tab button[role="tab"]').filter({ hasText: exactly(name) }).first();
  try {
    await tab.waitFor({ state: 'visible', timeout: budget(world) });
    await tab.click();
    await world.page.locator('joomla-tab button[role="tab"][aria-selected="true"]').filter({ hasText: exactly(name) }).first().waitFor({ state: 'attached', timeout: budget(world) });
  } catch (err) {
    const names = await world.page.locator('joomla-tab button[role="tab"]').allInnerTexts().catch(() => []);
    throw friendly({ message: `There is no "${name}" tab on the page. The tabs are: ${names.map((text) => text.trim()).filter(Boolean).join(', ') || '(none)'}.`, cause: err, hint: 'Open a form with tabs first (an article, a menu item, the Global Configuration).' });
  }
}

/**
 * Choose an option in a fancy select (`joomla-field-fancy-select`, the searchable
 * select of Category, Position, Tags, ...), through its own widget so the
 * change events of the form run.
 *
 * @param {object} world
 * @param {string} label
 * @param {string} option - The text of the option, or its value.
 */
async function chooseFancy(world, label, option) {
  const control = await controlByLabel(world, label);
  const widget = world.page.locator('joomla-field-fancy-select').filter({ has: world.page.locator(`[id="${await control.getAttribute('id')}"]`) }).first();
  if (!(await widget.count())) {
    await revealField(world, control);
    await control.selectOption(/^\d+$/.test(option) || (await control.locator(`option[value="${option}"]`).count()) ? { value: option } : { label: option });
    return;
  }
  await revealField(world, widget);
  await widget.locator('.choices__inner').click();
  await widget.locator('input.choices__input--cloned, input[type="search"]').first().fill(option).catch(() => {});
  const choices = widget.locator('.choices__list--dropdown .choices__item--choice');
  const exact = choices.filter({ hasText: exactly(option) });
  const byValue = widget.locator(`.choices__list--dropdown .choices__item--choice[data-value="${option}"]`);
  const target = (await byValue.count()) ? byValue.first() : (await exact.count()) ? exact.first() : choices.filter({ hasText: option }).first();
  try {
    await target.waitFor({ state: 'visible', timeout: budget(world) });
  } catch (err) {
    const available = await choices.allInnerTexts().catch(() => []);
    throw friendly({ message: `The "${label}" field has no option "${option}". It offers: ${available.map((text) => text.trim()).filter(Boolean).join(', ') || '(nothing)'}.`, cause: err, hint: 'Use the text of an option as the field shows it.' });
  }
  await target.click();
  await smartSettle(world.page, (world.minWaitTime && world.minWaitTime.page) || 3000);
}

/**
 * Set a switcher (`fieldset` with a `.switcher` of two or more radio buttons,
 * such as Featured: No/Yes) or a radio button group to an option.
 *
 * @param {object} world
 * @param {string} label
 * @param {string} option
 */
async function setSwitcher(world, label, option) {
  const group = world.page.locator('fieldset').filter({ has: world.page.locator('legend', { hasText: labelPattern(label) }) }).filter({ has: world.page.locator('input[type="radio"]') }).first();
  if (!(await group.count())) {
    throw friendly({ message: `There is no switcher or radio group labelled "${label}" on the page.`, hint: 'Use the label the form shows (the legend of the field, for example "Featured", "Site Offline").' });
  }
  await revealField(world, group);
  const choice = group.locator('label').filter({ hasText: exactly(option) }).first();
  if (!(await choice.count())) {
    const options = await group.locator('label').allInnerTexts();
    throw friendly({ message: `The "${label}" switcher has no option "${option}". It offers: ${options.map((text) => text.trim()).join(', ')}.`, hint: 'Use the text of an option as the switcher shows it (for example "Yes" or "No").' });
  }
  await choice.click();
}

/**
 * The editor instance a field label (or id) points at, or the only editor of
 * the page. Joomla registers every editor (TinyMCE, CodeMirror, the plain
 * textarea) in `Joomla.editors.instances`, so one API fits them all.
 *
 * @param {object} world
 * @param {string} [field]
 * @returns {Promise<string>} The id of the editor.
 */
async function editorId(world, field) {
  const ids = await world.page.evaluate(() => Object.keys((window.Joomla && window.Joomla.editors && window.Joomla.editors.instances) || {}));
  if (!ids.length) throw friendly({ message: 'There is no editor on the page.', hint: 'Open a form with an editor first (an article, a Custom module).' });
  if (!supplied(field)) {
    if (ids.length > 1) throw friendly({ message: `The page has ${ids.length} editors (${ids.join(', ')}).`, hint: 'Name the one to fill: "I fill in the rich text editor field "Article Text" with ...".' });
    return ids[0];
  }
  if (ids.includes(field)) return field;
  const control = await controlByLabel(world, field);
  const id = await control.getAttribute('id');
  if (!ids.includes(id)) throw friendly({ message: `The field "${field}" is not an editor. The editors are: ${ids.join(', ')}.`, hint: 'Use the label or the id of the editor field.' });
  return id;
}

/**
 * Write the content of an editor.
 *
 * @param {object} world
 * @param {string|undefined} field
 * @param {string} value
 */
async function setEditor(world, field, value) {
  const id = await editorId(world, field);
  await world.page.evaluate(({ id: editor, value: text }) => window.Joomla.editors.instances[editor].setValue(text), { id, value });
}

/**
 * Read the content of an editor.
 *
 * @param {object} world
 * @param {string|undefined} field
 * @returns {Promise<string>}
 */
async function getEditor(world, field) {
  const id = await editorId(world, field);
  return world.page.evaluate((editor) => window.Joomla.editors.instances[editor].getValue(), id);
}

module.exports = {
  budget,
  supplied,
  escapeRegExp,
  literal,
  exactly,
  siteRoot,
  siteUrl,
  adminUrl,
  open,
  actOrExplain,
  assertPresence,
  resolveUser,
  ALERT_TYPES,
  alerts,
  ADMIN_PAGES,
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
  editorId,
  setEditor,
  getEditor,
};
