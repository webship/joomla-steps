Feature: Extensions and plugins
  As an administrator
  I want to see which extensions and plugins run on the site
  So that I know what the site is built from

  Background:
    Given I am a logged in user with the "admin" user

  Scenario: The default template and the Smart Search plugin are enabled
    Then the extension "Cassiopeia" should exist
    And the extension "Cassiopeia" should be enabled
    And the plugin "Content - Smart Search" should be enabled

  Scenario: Enable and disable a plugin
    Given I am on the administrator "Plugins" page
    Then the plugin "System - Page Cache" should be disabled
    When I enable the plugin "System - Page Cache"
    Then the plugin "System - Page Cache" should be enabled
    When I disable the plugin "System - Page Cache"
    Then the plugin "System - Page Cache" should be disabled
    And the plugin "System - Page Cache" should not be enabled

  Scenario: The plugin list can be searched
    Given I am on the administrator "Plugins" page
    When I search the list for "Smart Search"
    Then I should see the row "Content - Smart Search" in the list
    When I search the list for "qzxjvwk no such plugin"
    Then I should see an empty list
