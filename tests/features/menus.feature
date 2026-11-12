# The menu "Main Menu Blog" and its module belong to the "blog" sample data.
Feature: Menus and menu items
  As an administrator
  I want to build the menus of the site
  So that visitors can reach the pages

  Background:
    Given I am a logged in user with the "admin" user

  Scenario: A new menu item shows in the main menu of the site and leaves with its trash
    Given the menu item "Review menu item" is removed
    When I create a menu item titled "Review menu item" in the "Main Menu Blog" menu of the type "Articles > Featured Articles"
    Then I should see a success message "Menu item saved."
    And the menu item "Review menu item" should be published
    Given I am on the homepage
    Then I should see the "Review menu item" menu item
    Given I am a logged in user with the "admin" user
    When I unpublish the menu item "Review menu item"
    Then the menu item "Review menu item" should be unpublished
    Given I am on the homepage
    Then I should not see the "Review menu item" menu item
    Given I am a logged in user with the "admin" user
    When I trash the menu item "Review menu item"
    And I delete the menu item "Review menu item" permanently
    Then the menu item "Review menu item" should not exist

  Scenario: Create a menu and remove it with its menu items
    Given the menu "Review menu" is removed
    When I create a menu titled "Review menu"
    Then I should see a success message "Menu saved"
    And the menu "Review menu" should exist
    When I delete the menu "Review menu"
    Then the menu "Review menu" should not exist

  Scenario: The menus of the blog sample data are listed
    Given I am on the administrator "Menus" page
    Then I should see the row "Main Menu Blog" in the list
    And I should see the row "Bottom Menu" in the list
    Given I am on the administrator "Menu Items" page
    Then I should see the row "Typography" in the list
