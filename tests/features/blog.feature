Feature: Blog page and articles
  As a visitor
  I want to browse the blog listing and open individual articles
  So that I can read the site's content

  Scenario: Open the blog listing from the main menu
    Given I am on the homepage
    When I open the "Blog" menu item
    Then I should be on "/blog"
    And the breadcrumb should show "Home > Blog"
    And I should see "Welcome to your blog"
    And I should see "Your Modules"
    And I should see "Your Template"

  Scenario: Read a featured article from the home page
    Given I am on the homepage
    When I read more of "Joomla"
    Then I should be viewing the "Joomla" article
    And the breadcrumb should show "Home > Sample Layouts > Articles > Joomla"

  Scenario: Read another featured article
    Given I am on the homepage
    When I read more of "Millions"
    Then I should be viewing the "Millions" article

  Scenario: Read an article from the blog listing
    Given I am on the homepage
    When I open the "Blog" menu item
    And I read more of "Welcome to your blog"
    Then I should be viewing the "Welcome to your blog" article

  @mobile
  Scenario: Open the blog listing on a mobile viewport
    Given I am on the homepage
    When I set the viewport to the "xs" breakpoint
    And I open the mobile menu
    And I open the "Blog" menu item
    Then I should be on "/blog"
