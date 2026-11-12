# The accounts are the ones the build script creates with the Joomla CLI. The suite
# only reads them: no feature creates, changes or deletes a user.
Feature: Users, groups and access levels
  As an administrator
  I want to see who may do what on the site
  So that I know the access rules are the ones I set

  Background:
    Given I am a logged in user with the "admin" user

  Scenario: The accounts of the registry exist and are enabled
    Then the user "admin" should exist
    And the user "manager" should exist
    And the user "editor" should exist
    And the user "member" should exist
    And the user "member" should be enabled
    And the user "no-such-user" should not exist

  Scenario: Each account is in the group of its role
    Then the user "admin" should be in the "Super Users" group
    And the user "manager" should be in the "Manager" group
    And the user "editor" should be in the "Editor" group
    And the user "member" should be in the "Registered" group
    And the user "member" should not be in the "Super Users" group

  Scenario: The user groups of Joomla are listed with their users
    Then the group "Public" should exist
    And the group "Manager" should exist
    And the group "Super Users" should have 1 enabled user
    And the group "Registered" should have 1 enabled user

  Scenario: The viewing access levels include the expected groups
    Then the access level "Public" should include the "Public" group
    And the access level "Registered" should include the "Registered" group
    And the access level "Special" should include the "Manager" group
    And the access level "Registered" should not include the "Guest" group

  Scenario: A Manager does not reach the system pages of the Super User
    Given I am a logged in user with the "manager" user
    When I go to the administrator "Global Configuration" page
    Then I should not see the administrator page title "Global Configuration"
