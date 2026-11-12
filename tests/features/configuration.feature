Feature: Global Configuration and system messages
  As an administrator
  I want to read and change the global configuration
  So that the site behaves the way I set it up

  Background:
    Given I am a logged in user with the "admin" user
    And I am on the administrator "Global Configuration" page

  Scenario: The configuration shows the values of the site
    Then I should see the administrator page title "Global Configuration"
    And the field labelled "Site Name" should have the value "Joomla CI"
    And the field labelled "Site Offline" should have the value "No"
    And the field labelled "Default Access Level" should have the value "Public"

  Scenario: Change the site name, see it in the page title, then restore it
    When I set the field labelled "Site Name" to "Joomla Review Site"
    And I click the "Save" toolbar button
    Then I should see a success message "Configuration saved"
    And the field labelled "Site Name" should have the value "Joomla Review Site"
    When I set the field labelled "Site Name" to "Joomla CI"
    And I click the "Save & Close" toolbar button
    Then I should see a success message "Configuration saved"

  Scenario: A required field refuses an empty value
    When I set the field labelled "Site Name" to ""
    And I click the "Save" toolbar button
    Then I should not see a success message
    And I should see the administrator page title "Global Configuration"
    When I click the "Close" toolbar button
    Then I should be on the administrator "Dashboard" page

  Scenario: A system message shows after an action and not before
    Given I am on the administrator "Clear Cache" page
    Then I should see no system messages
    When I clear all caches
    Then I should see a success message "cleared"
    And I should not see an error message
