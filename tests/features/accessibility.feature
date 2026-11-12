@a11y
Feature: Accessibility audit
  As a site owner
  I want the main pages audited against the accessibility rules
  So that a template or a module cannot quietly ship a serious violation

  Scenario Outline: A public page has no critical accessibility violations
    Given I am an anonymous user
    And I am on "<path>"
    Then the page should have no critical accessibility violations
    And the page should declare a language

    Examples:
      | path                                       |
      | /                                          |
      | /index.php/sample-layouts/articles/joomla  |
      | /index.php/login                           |

  Scenario Outline: A public page has no serious accessibility violations
    Given I am an anonymous user
    And I am on "<path>"
    Then the page should have no serious accessibility violations

    Examples:
      | path                                       |
      | /                                          |
      | /index.php/sample-layouts/articles/joomla  |
      | /index.php/login                           |

  # Cassiopeia 5 and 6 carry a few findings the suite does not hide: the front page
  # has two h1 headings and the login page has none. The article page has one, and
  # the audit with the axe rules passes on all three.
  Scenario: An article page has exactly one h1 heading
    Given I am on "/index.php/sample-layouts/articles/joomla"
    Then the page should have exactly one h1

  Scenario: The login page passes the accessibility audit
    Given I am on the login page
    Then the page should pass an accessibility audit
    And every form field should have an accessible label
    And every button should have an accessible name

  Scenario: The front page has a main landmark, a navigation landmark and a title
    Given I am on the homepage
    Then the page should have a main landmark
    And the page should have a navigation landmark
    And the page should have a title
    And every image should have an alt attribute
    And every form field should have an accessible label

  @js-off
  Scenario: The 404 page has no critical accessibility violations
    Given I am on "/no-such-page-xyz"
    Then the page should have no critical accessibility violations

  Scenario Outline: An administrator page has no critical accessibility violations
    Given I am a logged in user with the "admin" user
    And I am on the administrator "<page>" page
    Then the page should have no critical accessibility violations

    Examples:
      | page      |
      | Dashboard |
      | Articles  |
      | Users     |
