'use strict';

// Joomla-specific step definitions: main-menu navigation (including the
// collapsed mobile menu), the Joomla Smart Search (com_finder) component,
// blog "Read more" teasers, article headings, and breadcrumb trails. Steps
// that are already covered by webship-js's generic click / fill / see
// vocabulary are not duplicated here — see README.md "When to add a step".
//
// Every assertion waits on its locator (the assertion is the wait), and
// every failure is a friendly error with a hint instead of a raw Playwright
// timeout stack.

const { When, Then } = require('@cucumber/cucumber');
const { smartSettle, friendly } = require('webship-js/tests/step-definitions/webship');

const MENU_HINT = 'The menu or template may have changed; check the visible text of the main menu (`.mod-menu`).';

/** The per-assertion wait budget: `minWaitTime.page` from cucumber.js, else 10 s. */
function budget(world) {
  return Math.max((world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

/** Escape a literal string for use inside a RegExp (case-sensitive text match). */
function literal(text) {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

/**
 * Run a locator action and rethrow as a friendly error (action, target,
 * cause and a hint) instead of Playwright's raw timeout stack — keeps
 * failures readable when a Joomla template or menu changes.
 */
async function actOrExplain(label, target, fn, hint = MENU_HINT) {
  try {
    return await fn();
  } catch (err) {
    throw friendly({ action: label, target, cause: err, hint });
  }
}

/**
 * Wait until `locator` has (or, with `notCase`, has no) visible match, then
 * throw a friendly error otherwise. This is the web-first form of
 * `assert(count > 0)`: the wait and the assertion are the same call.
 */
async function assertPresence(locator, notCase, { label, hint, timeout, state = 'visible' }) {
  try {
    await locator.first().waitFor({ state: notCase ? 'hidden' : state, timeout });
  } catch {
    throw friendly({
      message: notCase ? `Expected no ${label}, but one is still on the page.` : `Expected ${label}, but none appeared within ${timeout} ms.`,
      hint,
    });
  }
}

// ---------------------------------------------------------------------------
// Main menu navigation
// ---------------------------------------------------------------------------

/**
 * Click a top-level or nested link inside the Joomla main menu module
 * (`.mod-menu`), by its visible text. Works for both the desktop nav and an
 * already-expanded mobile nav.
 *
 * Example #1: When I open the "Blog" menu item
 * Example #2: When I open the "Help" menu item
 * Example #3: When we open the "FAQ" menu item
 * Example #4: And I open the "Login" menu item
 * Example #5: When open the "Typography" menu item
 *
 */
When(/^(I |we )*open the "([^"]*)?" menu item$/, async function (pronounCase, name) {
  const link = this.page.locator('.mod-menu a', { hasText: name }).first();
  await actOrExplain('open menu item', name, async () => {
    await link.waitFor({ state: 'visible', timeout: budget(this) });
    await link.click();
  });
  await smartSettle(this.page, 1500);
});

/**
 * Expand the collapsed Joomla/Bootstrap main menu on narrow (mobile)
 * viewports by clicking the navbar toggler button. Fails with a clear
 * message if the toggler is not present (e.g. desktop viewport where the
 * menu is already expanded).
 *
 * Example #1: When I open the mobile menu
 * Example #2: When I open the mobile navigation menu
 * Example #3: When we open the mobile menu
 * Example #4: And I open the mobile menu
 * Example #5: When I open the mobile navigation
 *
 */
When(/^(I |we )*open the mobile (navigation menu|navigation|menu)$/, async function (pronounCase, navigationCase) {
  const toggler = this.page.locator('.navbar-toggler').first();
  await actOrExplain('open mobile menu', 'navbar toggler', async () => {
    await toggler.waitFor({ state: 'visible', timeout: budget(this) });
    await toggler.click();
  }, 'The toggler only shows on narrow viewports: set the viewport to the "xs" breakpoint first, or check the template still uses `.navbar-toggler`.');
  await smartSettle(this.page, 1000);
});

/**
 * Assert a menu item with the given text is (or is not) present in the main
 * menu module.
 *
 * Example #1: Then I should see the "Blog" menu item
 * Example #2: Then I should see the "FAQ" menu item
 * Example #3: And I should not see the "Checkout" menu item
 * Example #4: Then we should see the "Login" menu item
 * Example #5: And should see the "Help" menu item
 *
 */
Then(/^(I |we )*should( not)* see the "([^"]*)?" menu item$/, async function (pronounCase, notCase, name) {
  await assertPresence(this.page.locator('.mod-menu a', { hasText: name }), notCase, {
    label: `a "${name}" menu item`,
    hint: MENU_HINT + ' On a narrow viewport, open the mobile menu first.',
    timeout: budget(this),
  });
});

// ---------------------------------------------------------------------------
// Blog / article content
// ---------------------------------------------------------------------------

/**
 * Open the article teaser with the given title. Joomla only renders a
 * dedicated "Read more" link (`aria-label="Read more: <title>"`) when the
 * intro text is split from the full article; otherwise the teaser heading
 * itself is the link, so this step tries the "Read more" link first and
 * falls back to the heading link.
 *
 * Example #1: When I read more of "Joomla"
 * Example #2: When I read more of "Welcome to your blog"
 * Example #3: When we read more of "Your Template"
 * Example #4: And I read more of "About your home page"
 * Example #5: When read more of "Your Modules"
 *
 */
When(/^(I |we )*read more of "([^"]*)?"$/, async function (pronounCase, title) {
  const readMoreLink = this.page.getByRole('link', { name: `Read more: ${title}` }).first();
  const headingLink = this.page.locator('.page-header a', { hasText: title }).first();
  const link = readMoreLink.or(headingLink).first();
  await actOrExplain('read more of', title, async () => {
    await link.waitFor({ state: 'visible', timeout: budget(this) });
    await link.click();
  }, 'The article must be listed on the current page with a "Read more" link or a linked heading; check the title text.');
  await smartSettle(this.page, 1500);
});

/**
 * Assert the article currently open has (or does not have) the given
 * title. Joomla renders the title as the page's `h1` for a standalone
 * article view, but as the second `.page-header h2` for a blog/category
 * item view (where `h1` is the category name instead) — so both headings
 * are checked.
 *
 * Example #1: Then I should be viewing the "Joomla" article
 * Example #2: Then I should be viewing the "Love" article
 * Example #3: And I should not be viewing the "Millions" article
 * Example #4: Then we should be viewing the "Welcome to your blog" article
 * Example #5: And should be viewing the "Your Template" article
 *
 */
Then(/^(I |we )*should( not)* be viewing the "([^"]*)?" article$/, async function (pronounCase, notCase, title) {
  const heading = this.page.locator('h1, .page-header h2').filter({ hasText: literal(title) });
  await assertPresence(heading, notCase, {
    label: `an article heading containing "${title}"`,
    hint: 'The article heading is the page `h1`, or `.page-header h2` in a blog/category view; check the title text and that the "read more" step reached the article.',
    timeout: budget(this),
  });
});

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------

/**
 * Assert the breadcrumb trail equals the given "Home > Section > Page" path.
 * Segments are compared in order after trimming whitespace.
 *
 * Example #1: Then the breadcrumb should show "Home > Blog"
 * Example #2: And the breadcrumb should show "Home > Sample Layouts > Articles > Joomla"
 * Example #3: Then the breadcrumb should show "Home"
 * Example #4: And breadcrumb should show "Home > FAQ"
 * Example #5: Then the breadcrumb should show "Home > Sample Layouts > Articles > Love"
 *
 */
Then(/^(the )*breadcrumb should show "([^"]*)?"$/, async function (theCase, expectedPath) {
  const expected = expectedPath.split('>').map((part) => part.trim());
  const items = this.page.locator('.mod-breadcrumbs .breadcrumb-item');
  const timeout = budget(this);
  let texts = [];
  try {
    await items.first().waitFor({ state: 'visible', timeout });
    // Poll until the trail matches or the budget runs out, so a breadcrumb
    // that is still rendering does not fail the step.
    await this.page.waitForFunction(
      (want) => {
        const got = Array.from(document.querySelectorAll('.mod-breadcrumbs .breadcrumb-item'))
          .map((el) => (el.innerText || '').trim()).filter(Boolean);
        return JSON.stringify(got) === JSON.stringify(want);
      },
      expected,
      { timeout }
    );
  } catch (err) {
    texts = (await items.allInnerTexts().catch(() => [])).map((text) => text.trim()).filter(Boolean);
    throw friendly({
      message: `Expected the breadcrumb "${expected.join(' > ')}" but the page shows "${texts.join(' > ') || '(no breadcrumb)'}".`,
      cause: err,
      hint: 'Breadcrumbs come from the Breadcrumbs module (`.mod-breadcrumbs`); check the menu item titles and that the module is published on this page.',
    });
  }
});

// ---------------------------------------------------------------------------
// Site search (com_finder)
// ---------------------------------------------------------------------------

const SEARCH_HINT = 'The Smart Search module (`.js-finder-search-query`) must be published on this page; on a narrow viewport the search box may be inside the mobile menu.';

async function submitSearch(world, term) {
  const input = world.page.locator('.js-finder-search-query').first();
  await actOrExplain('search the site for', term, async () => {
    await input.waitFor({ state: 'visible', timeout: budget(world) });
    await input.fill(term);
    await input.press('Enter');
  }, SEARCH_HINT);
  await smartSettle(world.page, 1500);
}

/**
 * Submit the Joomla Smart Search form (`com_finder`) with the given search
 * term, using whichever search box is visible (header search or the
 * dedicated search page).
 *
 * Example #1: When I search the site for "joomla"
 * Example #2: When I search the site for "template"
 * Example #3: When we search the site for "articles"
 * Example #4: And I search the site for "blog"
 * Example #5: When search the site for "modules"
 *
 */
When(/^(I |we )*search the site for "([^"]*)?"$/, async function (pronounCase, term) {
  await submitSearch(this, term);
});

/**
 * Search for a word taken from the first article on the current page (its
 * `.item-title`), so the search is guaranteed to match content the site really
 * has without naming any article in the feature file. The word is kept for
 * `I should see that word in the search results`.
 *
 * Example #1: When I search the site for a word from the first article
 * Example #2: When we search the site for a word from the first article
 * Example #3: And I search the site for a word from the first article
 * Example #4: When search the site for a word from the first article
 * Example #5: And we search the site for a word from the first article
 *
 */
When(/^(I |we )*search the site for a word from the first article$/, async function (pronounCase) {
  const heading = this.page.locator('.item-title, .page-header h1, .page-header h2').first();
  await heading.waitFor({ state: 'visible', timeout: budget(this) }).catch((err) => {
    throw friendly({
      message: 'No article title on this page to take a search word from.',
      cause: err,
      hint: 'Open a page that lists articles first (the home page or the blog listing).',
    });
  });
  const title = (await heading.innerText()).trim();
  const word = title.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4)[0] || title.split(/\s+/)[0];
  if (!word) {
    throw friendly({
      message: `The first article title on this page ("${title}") has no word to search for.`,
      hint: 'Open a page whose first article has a title of at least one word.',
    });
  }
  this.joomlaSearchWord = word;
  await submitSearch(this, word);
});

/**
 * Assert the Smart Search results list contains (or does not contain) the
 * word the previous `search the site for a word from the first article`
 * step searched for.
 *
 * Example #1: Then I should see that word in the search results
 * Example #2: And we should see that word in the search results
 * Example #3: Then should see that word in the search results
 * Example #4: Then I should not see that word in the search results
 * Example #5: And we should not see that word in the search results
 *
 */
Then(/^(I |we )*should( not)* see that word in the search results$/, async function (pronounCase, notCase) {
  const word = this.joomlaSearchWord;
  if (!word) {
    throw friendly({
      message: 'No search word is remembered for this scenario.',
      hint: 'Add "When I search the site for a word from the first article" before this step.',
    });
  }
  // A string `hasText` is a case-insensitive, whitespace-normalised match.
  await assertPresence(this.page.locator('#search-results').filter({ hasText: word }), notCase, {
    label: `"${word}" in the search results`,
    hint: 'Smart Search only finds indexed content: run the Smart Search indexer (System > Smart Search > Index) and check the word is in a published article.',
    timeout: budget(this),
  });
});

/**
 * Assert the Smart Search answered with no results: Joomla keeps the results
 * list and prints its "no results were found" sentence (which repeats the
 * term) instead of entries.
 *
 * Example #1: Then I should see no search results
 * Example #2: And we should see no search results
 * Example #3: Then should see no search results
 * Example #4: And I should see no search results
 * Example #5: Then we should see no search results
 *
 */
Then(/^(I |we )*should see no search results$/, async function (pronounCase) {
  const results = this.page.locator('#search-results');
  const timeout = budget(this);
  try {
    await results.waitFor({ state: 'attached', timeout });
    await this.page.waitForFunction(() => {
      const el = document.querySelector('#search-results');
      if (!el) return false;
      return /no results/i.test(el.innerText || '') || el.querySelectorAll('.result-item, .search-result, li').length === 0;
    }, null, { timeout });
  } catch (err) {
    const text = (await results.innerText().catch(() => '')).trim();
    throw friendly({
      message: `Expected no search results, but the results list shows: "${text.slice(0, 200)}"`,
      cause: err,
      hint: 'Use a term no article contains, and check the page reached the Smart Search results (`#search-results`).',
    });
  }
});

/**
 * Assert the Smart Search results list contains (or does not contain) an
 * entry with the given text.
 *
 * Example #1: Then I should see "Joomla" in the search results
 * Example #2: And I should see "Template positions" in the search results
 * Example #3: Then I should not see "Checkout" in the search results
 * Example #4: And we should see "Blog" in the search results
 * Example #5: Then should see "Welcome" in the search results
 *
 */
Then(/^(I |we )*should( not)* see "([^"]*)?" in the search results$/, async function (pronounCase, notCase, expectedText) {
  await assertPresence(this.page.locator('#search-results').filter({ hasText: literal(expectedText) }), notCase, {
    label: `"${expectedText}" in the search results`,
    hint: 'Smart Search only finds indexed content: run the Smart Search indexer (System > Smart Search > Index) and check the text is in a published article. The match is case-sensitive.',
    timeout: budget(this),
  });
});
