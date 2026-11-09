Feature: Administrator login
  As the site's Super User
  I want to log in to and out of the /administrator control panel
  So that I can manage the site and be sure unauthorized logins are rejected

  Scenario: Log in with valid credentials
    Given I am a logged in user with the "admin" user
    Then I should see the administrator dashboard

  Scenario: Log in with an invalid password is rejected
    Given I am on the administrator login page
    When I log in to the administrator panel as "admin" with password "not-the-right-password"
    Then I should see an invalid login error in the administrator panel

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
