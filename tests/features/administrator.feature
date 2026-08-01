Feature: Administrator login
  As the site's Super User
  I want to log in to and out of the /administrator control panel
  So that I can manage the site and be sure unauthorized logins are rejected

  Background:
    Given I am on the administrator login page

  Scenario: Log in with valid credentials
    When I log in to the administrator panel as "admin" with password "Admin123456789!"
    Then I should see the administrator dashboard

  Scenario: Log in with an invalid password is rejected
    When I log in to the administrator panel as "admin" with password "not-the-right-password"
    Then I should see an invalid login error in the administrator panel

  Scenario: Log out returns to the login page
    When I log in to the administrator panel as "admin" with password "Admin123456789!"
    Then I should see the administrator dashboard
    When I log out of the administrator panel
    Then I should be on the administrator login page
