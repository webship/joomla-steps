# The accounts "admin" (Super Users) and "manager" (Manager) are in the users registry of
# cucumber.js; the Joomla CLI created them when the site was built.
Feature: Administrator login
  As a site administrator
  I want to log in to and out of the /administrator control panel
  So that I can manage the site and be sure unauthorised logins are rejected

  Scenario: Log in with valid credentials
    Given I am a logged in user with the "admin" user
    Then I should see the administrator dashboard
    And I should be logged in to the administrator panel as "Super User"
    And I should not be on the administrator login page
    And I should not see an invalid login error in the administrator panel

  Scenario: A Manager logs in to the administrator
    Given I am a logged in user with the "manager" user
    Then I should see the administrator dashboard
    And I should be logged in to the administrator panel as "Test Manager"

  Scenario: Log in with an invalid password is rejected
    Given I am on the administrator login page
    When I log in to the administrator panel as "admin" with password "not-the-right-password"
    Then I should see an invalid login error in the administrator panel
    And I should be on the administrator login page
    And I should not see the administrator menu

  Scenario: A Manager's dashboard and toolbar leave out what a Manager may not use
    Given I am a logged in user with the "manager" user
    Then I should see the "Popular Articles" dashboard module
    And I should not see the "System" dashboard module
    When I am on the administrator "Articles" page
    Then I should see the "New" toolbar button
    And I should not see the "Options" toolbar button
    And I should not be on the administrator "Global Configuration" page

  Scenario: A registered user cannot log in to the administrator
    Given I am on the administrator login page
    When I log in to the administrator panel as "member" with password "Member123456789!"
    Then I should not see the administrator dashboard
    And I should be on the administrator login page

  Scenario: Log out returns to the login page
    Given I am a logged in user with the "admin" user
    Then I should see the administrator dashboard
    When I log out of the administrator panel
    Then I should be on the administrator login page

  Scenario: A visitor with a cleared session sees the login form
    Given I am a logged in user with the "admin" user
    Then I should see the administrator dashboard
    Given I am not logged in
    Then I should be on the administrator login page
    And I should not be logged in to the administrator panel
