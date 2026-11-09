# The titles, menu items and paths below are those of the Joomla "blog" sample
# data; swap them for your own content when you copy this feature.
Feature: Menu and category navigation
  As a visitor
  I want to move between the site's menu items and category pages
  So that I can reach the content I'm looking for

  Scenario: Open a nested "Sample Layouts" menu item
    Given I am on the homepage
    When I go to "/sample-layouts/category-list"
    Then the breadcrumb should show "Home > Sample Layouts > Category List"

  Scenario: Open the Help page from the main menu
    Given I am on the homepage
    When I open the "Help" menu item
    Then I should be on "/help"

  Scenario: Navigate back to the homepage after visiting another page
    Given I am on the homepage
    When I open the "Blog" menu item
    Then I should be on "/blog"
    When I go to the homepage
    Then I should be on homepage
    And the breadcrumb should show "Home"

  @mobile
  Scenario: Open a menu item on a mobile viewport
    Given I am on the homepage
    When I set the viewport to the "xs" breakpoint
    And I open the mobile menu
    And I open the "Help" menu item
    Then I should be on "/help"
