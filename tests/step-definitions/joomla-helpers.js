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
};
