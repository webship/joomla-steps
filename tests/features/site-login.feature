# The accounts "member" and "editor" are in the users registry of cucumber.js; the
# Joomla CLI created them when the site was built (see .github/scripts/build-ddev-joomla.sh).
Feature: Logging in to the site
  As a registered user
  I want to log in to and out of the site
  So that I can reach the pages that are for registered users only

  Scenario: The login page shows the login form
    Given I am on the login page
    Then I should see the login form

  Scenario: A registered user logs in with the registry and sees the profile
    Given I am logged in to the site with the "member" user
    Then I should be logged in to the site
    And I should be logged in to the site as "member"
    When I am on the profile page
    Then I should see "Test Registered"

  Scenario: An editor logs in to the site
    Given I am logged in to the site with the "editor" user
    Then I should be logged in to the site as "editor"

  Scenario: A wrong password is refused
    Given I am on the login page
    When I log in to the site as "member" with password "not-the-right-password"
    Then I should see an invalid login error on the site
    And I should see a warning message "Username and password do not match"
    And I should not be logged in to the site

  Scenario: Log out ends the session
    Given I am logged in to the site with the "member" user
    When I log out of the site
    Then I should not be logged in to the site

  Scenario: The profile page asks a visitor to log in
    Given I am not logged in
    When I am on the profile page
    Then I should see the login form
    And the url should match "login"

  Scenario: A visitor can open the password reset and the username reminder pages
    Given I am on the password reset page
    Then I should see the password reset form
    Given I am on the username reminder page
    Then I should see the username reminder form
