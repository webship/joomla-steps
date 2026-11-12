# The titles, menu items and paths below are those of the Joomla "blog" sample
# data; swap them for your own content when you copy this feature.
Feature: Site search
  As a visitor
  I want to search the site with the Smart Search box
  So that I can find relevant articles quickly

  Scenario: Search for a term that matches an article
    Given I am on the homepage
    When I search the site for "joomla"
    Then I should see "Joomla" in the search results
    And I should see at least 1 search result

  Scenario: Search for a word from an article the front page lists
    Given I am on the homepage
    When I search the site for a word from the first article
    Then I should see that word in the search results

  Scenario: Search for a term no article contains
    Given I am on the homepage
    When I search the site for "qzxjvwk-no-such-term"
    Then I should see no search results
    And I should not see "qzxjvwk" in the search results

  Scenario: A search result opens its article
    Given I am on the search page
    When I search the site for "typography"
    And I open the search result "Typography"
    Then I should be viewing the "Typography" article

  Scenario: The first search result opens
    Given I am on the homepage
    When I search the site for "blog"
    And I open the first search result
    Then I should not be on the 404 page

  Scenario: The search page has its own form
    Given I am on the search page
    Then I should see the search form

  @mobile
  Scenario: Search on a mobile viewport
    Given I am on the homepage
    When I set the viewport to the "xs" breakpoint
    And I search the site for "joomla"
    Then I should see "Joomla" in the search results
