Feature: Cache and check-in
  As an administrator
  I want to clear the cache and release locked items
  So that the site shows what is saved and no editor is locked out

  Background:
    Given I am a logged in user with the "admin" user

  Scenario: Clear all caches
    When I clear all caches
    Then I should see a success message "cleared"

  Scenario: Clear the expired cache
    When I clear the expired cache
    Then I should see a success message

  Scenario: An open form checks the item out until the global check-in releases it
    When I open the article "Typography" for editing
    And I am on the administrator "Articles" page
    Then the article "Typography" should be checked out
    And there should be checked out items
    When I check in all items
    Then I should see a success message "checked in"
    And there should not be checked out items
    And the article "Typography" should not be checked out

  Scenario: Checking in with nothing checked out says so
    Given I am on the administrator "Global Check-in" page
    Then there should not be checked out items
