'use strict';

// Joomla-specific step definitions: main-menu navigation (including the
// collapsed mobile menu), the Joomla Smart Search (com_finder) component,
// blog "Read more" teasers, article headings, and breadcrumb trails. Steps
// that are already covered by webship-js's generic click / fill / see
// vocabulary are not duplicated here — see README.md "When to add a step".
//
// All locator interactions are wrapped in a friendly try/catch so a missing
// selector reports a clear Joomla-flavoured hint instead of a raw
// Playwright timeout stack.

const { When, Then } = require('@cucumber/cucumber');
const assert = require('assert');
const { smartSettle } = require('webship-js/tests/step-definitions/webship');

/**
 * Run a locator action and rethrow with a short, friendly explanation on
 * failure instead of Playwright's raw timeout stack — keeps failures
 * readable when a Joomla template/menu changes.
 */
async function actOrExplain(label, target, fn) {
  try {
    return await fn();
  } catch (err) {
    throw new Error(`Could not ${label} "${target}": ${err.message.split('\n')[0]}`);
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
 * Example #4: When I open the "Login" menu item
 * Example #5: When I open the "Typography" menu item
 *
 */
When(/^(I |we )*open the "([^"]*)?" menu item$/, async function (pronounCase, name) {
  const link = this.page.locator('.mod-menu a', { hasText: name }).first();
  await actOrExplain('open menu item', name, async () => {
    await link.waitFor({ state: 'visible', timeout: 10000 });
    await link.click();
  });
  await smartSettle(this.page, 1500);
});

/**
 * Expand the collapsed Joomla/Bootstrap main menu on narrow (mobile)
 * viewports by clicking the navbar toggler button. No-op-safe: fails with a
 * clear message if the toggler is not present (e.g. desktop viewport where
 * the menu is already expanded).
 *
 * Example #1: When I open the mobile menu
 * Example #2: When I open the mobile navigation menu
 * Example #3: When we open the mobile menu
 * Example #4: And I open the mobile menu
 * Example #5: When I open the mobile navigation
 *
 */
When(/^(I |we )*open the mobile( navigation)* menu$/, async function (pronounCase, navigationCase) {
  const toggler = this.page.locator('.navbar-toggler').first();
  await actOrExplain('open mobile menu', 'navbar toggler', async () => {
    await toggler.waitFor({ state: 'visible', timeout: 10000 });
    await toggler.click();
  });
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
  const count = await this.page.locator('.mod-menu a', { hasText: name }).count();
  if (notCase) {
    assert.ok(count === 0, `Expected no "${name}" menu item, but found ${count}.`);
  } else {
    assert.ok(count > 0, `Expected a "${name}" menu item, but found none.`);
  }
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
 * Example #4: When I read more of "About your home page"
 * Example #5: And I read more of "Your Modules"
 *
 */
When(/^(I |we )*read more of "([^"]*)?"$/, async function (pronounCase, title) {
  const readMoreLink = this.page.getByRole('link', { name: `Read more: ${title}` });
  const headingLink = this.page.locator('.page-header a', { hasText: title }).first();
  await actOrExplain('read more of', title, async () => {
    if (await readMoreLink.count()) {
      await readMoreLink.first().click();
    } else {
      await headingLink.click();
    }
  });
  await smartSettle(this.page, 1500);
});

/**
 * Assert the article currently open has the given title. Joomla renders
 * the title as the page's `h1` for a standalone article view, but as the
 * second `.page-header h2` for a blog/category item view (where `h1` is
 * the category name instead) — so both headings are checked.
 *
 * Example #1: Then I should be viewing the "Joomla" article
 * Example #2: Then I should be viewing the "Love" article
 * Example #3: And I should be viewing the "Millions" article
 * Example #4: Then we should be viewing the "Welcome to your blog" article
 * Example #5: And should be viewing the "Your Template" article
 *
 */
Then(/^(I |we )*should be viewing the "([^"]*)?" article$/, async function (pronounCase, title) {
  const h1 = (await this.page.locator('h1').first().innerText()).trim();
  if (h1.includes(title)) return;
  const h2 = (await this.page.locator('.page-header h2').first().innerText()).trim();
  assert.ok(h2.includes(title), `Expected the article heading to include "${title}", but the h1 was "${h1}" and the h2 was "${h2}".`);
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
 * Example #4: And the breadcrumb should show "Home > FAQ"
 * Example #5: Then the breadcrumb should show "Home > Sample Layouts > Articles > Love"
 *
 */
Then(/^(the )*breadcrumb should show "([^"]*)?"$/, async function (theCase, expectedPath) {
  const items = this.page.locator('.mod-breadcrumbs .breadcrumb-item');
  const texts = (await items.allInnerTexts()).map((text) => text.trim()).filter(Boolean);
  const expected = expectedPath.split('>').map((part) => part.trim());
  assert.deepStrictEqual(texts, expected, `Expected breadcrumb "${expected.join(' > ')}" but got "${texts.join(' > ')}".`);
});

// ---------------------------------------------------------------------------
// Site search (com_finder)
// ---------------------------------------------------------------------------

/**
 * Submit the Joomla Smart Search form (`com_finder`) with the given search
 * term, using whichever search box is visible (header search or the
 * dedicated search page).
 *
 * Example #1: When I search the site for "joomla"
 * Example #2: When I search the site for "template"
 * Example #3: When we search the site for "articles"
 * Example #4: And I search the site for "blog"
 * Example #5: When I search the site for "modules"
 *
 */
When(/^(I |we )*search the site for "([^"]*)?"$/, async function (pronounCase, term) {
  const input = this.page.locator('.js-finder-search-query').first();
  await actOrExplain('search the site for', term, async () => {
    await input.waitFor({ state: 'visible', timeout: 10000 });
    await input.fill(term);
    await input.press('Enter');
  });
  await smartSettle(this.page, 1500);
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
  const results = this.page.locator('#search-results');
  const text = await results.innerText();
  if (notCase) {
    assert.ok(!text.includes(expectedText), `Search results should NOT contain "${expectedText}" but they do.`);
  } else {
    assert.ok(text.includes(expectedText), `Search results should contain "${expectedText}" but they contain: ${text}`);
  }
});
