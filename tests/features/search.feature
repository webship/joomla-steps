Feature: Site search
  As a visitor
  I want to search the site with the Smart Search box
  So that I can find relevant articles quickly

  Scenario: Search for a term that matches an article
    Given I am on the homepage
    When I search the site for "joomla"
    Then I should see "Joomla" in the search results

  Scenario: Search for a template-related term
    Given I am on the homepage
    When I search the site for "template"
    Then I should see "Template" in the search results

  Scenario: Search for a blog-related term
    Given I am on the homepage
    When I search the site for "blog"
    Then I should see "blog" in the search results

  @mobile
  Scenario: Search on a mobile viewport
    Given I am on the homepage
    When I set the viewport to the "xs" breakpoint
    And I search the site for "joomla"
    Then I should see "Joomla" in the search results
