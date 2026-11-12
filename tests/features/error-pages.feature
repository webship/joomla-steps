Feature: Error pages
  As a visitor
  I want a page that does not exist to answer with the 404 error page
  So that I know the address is wrong and can go back to the site

  @js-off
  Scenario: A page that does not exist answers with the 404 page
    Given I am on "/no-such-page-xyz"
    Then I should be on the 404 page
    And I should see "can't be found"
    And I should see "Page not found"

  Scenario: A page that exists is not the 404 page
    Given I am on the homepage
    Then I should not be on the 404 page
