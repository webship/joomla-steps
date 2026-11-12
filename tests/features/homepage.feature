# The titles, menu items and paths below are those of the Joomla "blog" sample
# data; swap them for your own content when you copy this feature.
Feature: Home page
  As a visitor
  I want the Joomla home page to load with its key content and navigation
  So that I know the site is working before I explore further

  Background:
    Given I am on the homepage

  Scenario: Home page loads with the welcome heading
    Then I should see "Welcome to Joomla on Cassiopeia!"
    And the breadcrumb should show "Home"

  Scenario: The page names Joomla as its generator
    Then the site should be running Joomla

  Scenario: Main menu is present
    Then I should see the "Blog" menu item
    And I should see the "Help" menu item
    And I should see the "Login" menu item

  Scenario: Featured article teasers are visible
    Then I should see "Millions of Websites are built on Joomla!"
    And I should see "We love Joomla to the moon and back!"
    And I should see "We proudly present Joomla Version"

  @mobile
  Scenario: Main menu is reachable on a mobile viewport
    When I set the viewport to the "xs" breakpoint
    And I open the mobile menu
    Then I should see the "Blog" menu item
    And I should see the "Login" menu item
