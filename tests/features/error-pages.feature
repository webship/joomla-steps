Feature: Error pages
  As a visitor
  I want a page that does not exist or that I may not open to answer with an error page
  So that I know the address is wrong or the page is not for my account

  @js-off
  Scenario: A page that does not exist answers with the 404 page
    Given I am on "/no-such-page-xyz"
    Then I should be on the 404 page
    And I should see "can't be found"
    And I should see "Page not found"

  @js-off
  Scenario: An article that does not exist answers with the 404 page
    Given I am on "/index.php?option=com_content&view=article&id=999999"
    Then I should be on the page not found page
    And I should not be on the 403 page

  Scenario: A page that exists is not the 404 page
    Given I am on the homepage
    Then I should not be on the 404 page
    And I should not be on the 403 page

  @js-off
  Scenario: The administrator refuses a page the account may not open with the 403 page
    Given I am a logged in user with the "manager" user
    When I go to the administrator "Global Configuration" page
    Then I should be on the 403 page
    And I should be on the access denied page
    And I should not be on the 404 page
    And I should see "You don't have permission to access this"

  @js-off
  Scenario: The site refuses the article form to a registered user with an error message
    Given I am logged in to the site with the "member" user
    When I am on "/index.php?option=com_content&view=form&layout=edit"
    Then I should be on the 403 page
    And I should see an error message "You don't have permission to access this"
    And I should not see a success message
