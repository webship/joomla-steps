# Features

Reference features for a default Joomla site with the "blog" sample data
(`.github/scripts/build-ddev-joomla.sh` builds one). Copy a feature into your
project and replace the titles, menu items and search terms with the content of
your site.

| Feature | Covers |
| --- | --- |
| `homepage`, `navigation`, `blog` | Front page, menus, categories, articles, breadcrumbs, the mobile menu. |
| `search` | Smart Search: results, no results, opening a result. |
| `site-login` | Logging in to and out of the site with the users registry. |
| `error-pages` | The 404 page. |
| `administrator`, `administrator-navigation` | Administrator login and logout, the dashboard, the sidebar menu, named pages. |
| `articles`, `categories`, `menus`, `modules`, `media` | Content lifecycles in the administrator and their effect on the site. |
| `users`, `configuration`, `extensions`, `maintenance` | Users, groups, access levels, Global Configuration, plugins, cache, check-in. |
| `accessibility` | The axe audit of front end and administrator pages. |

Scenarios that create content remove it at the end (trash, then delete
permanently) and start with a "... is removed" step, so a failed run does not stop
the next one.
