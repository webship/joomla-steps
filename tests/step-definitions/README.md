# Step definitions

| File | Covers |
| --- | --- |
| `joomla.steps.js` | The front end: menus, articles, breadcrumbs, named pages, login and logout of the site, system messages, Smart Search, the 404 page, modules, the language switcher. |
| `joomla-admin.steps.js` | The administrator: login and logout, the session, named pages, the page title, the sidebar menu, the toolbar, the Dashboard, the Joomla version. |
| `joomla-content.steps.js` | Administrator content: list views, the lifecycle of articles, categories, menus, menu items and modules, form controls, the Media Manager. |
| `joomla-system.steps.js` | Administrator system: users, groups, access levels, cache, global check-in. |
| `joomla-helpers.js` | Shared plumbing: wait budget, presence assertions, URLs, the users registry, system messages, named administrator pages, the toolbar, form controls. It registers no step. |

## Rules for a new step

- Check `node_modules/webship-js/tests/step-definitions/` first: a step that the
  generic click, fill and see vocabulary already covers is not added here.
- The regular expression starts with the pronoun group `(I |we )*`, and an
  assertion takes `should( not)*`, so one definition reads both polarities.
- A JSDoc block above the step holds at least five `Example #N:` lines. Run
  `npm run test:examples`: every example must match its own step and no step of
  webship-js.
- Wait on the locator (`locator.waitFor`, `assertPresence`), never on a fixed
  time, and fail with `friendly({ message, hint })` so the failure names the
  cause and the way out.
- A step that names an item of a list opens the list itself, filtered by the
  title, so it does not depend on the page the scenario was on.
- A step never creates or deletes a user: accounts are configuration, named in
  the `users` registry of `cucumber.js` and created with the Joomla CLI.
