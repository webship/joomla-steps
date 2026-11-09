Feature: Site search
  As a visitor
  I want to search the site with the Smart Search box
  So that I can find relevant articles quickly

  Scenario: Search for a term that matches an article
    Given I am on the homepage
    When I search the site for "joomla"
    Then I should see "Joomla" in the search results

  Scenario: Search for a word from an article the front page lists
    Given I am on the homepage
    When I search the site for a word from the first article
    Then I should see that word in the search results

  Scenario: Search for a term no article contains
    Given I am on the homepage
    When I search the site for "qzxjvwk-no-such-term"
    Then I should see no search results

  @mobile
  Scenario: Search on a mobile viewport
    Given I am on the homepage
    When I set the viewport to the "xs" breakpoint
    And I search the site for "joomla"
    Then I should see "Joomla" in the search results
