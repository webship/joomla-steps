Feature: Site modules
  As an administrator
  I want to publish and unpublish the modules of a page
  So that visitors see the blocks I choose

  Background:
    Given I am a logged in user with the "admin" user

  Scenario: A Custom module shows on the site while it is published
    Given the module "Review custom module" is removed
    When I create a "Custom" site module titled "Review custom module" with the text "Text of the review module." in the "sidebar-right" position
    Then I should see a success message "Module saved."
    And the module "Review custom module" should be published
    Given I am on the homepage
    Then I should see the "Review custom module" module
    And I should see "Text of the review module."
    Given I am a logged in user with the "admin" user
    When I unpublish the module "Review custom module"
    Then the module "Review custom module" should be unpublished
    Given I am on the homepage
    Then I should not see the "Review custom module" module
    Given I am a logged in user with the "admin" user
    When I trash the module "Review custom module"
    And I delete the module "Review custom module" permanently
    Then the module "Review custom module" should not exist

  Scenario: The modules of the blog sample data are listed
    Given I am on the administrator "Site Modules" page
    Then I should see the row "Main Menu" in the list
    And I should see the row "Login Form" in the list
    And the module "Login Form" should be published
