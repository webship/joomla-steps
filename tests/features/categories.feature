Feature: Categories
  As an administrator
  I want to organise articles in categories
  So that the content is grouped the way readers look for it

  Background:
    Given I am a logged in user with the "admin" user

  Scenario: Create, unpublish and remove a category
    Given the category "Review category" is removed
    When I create a category titled "Review category"
    Then I should see a success message "Category saved."
    And the category "Review category" should be published
    When I unpublish the category "Review category"
    Then the category "Review category" should be unpublished
    When I trash the category "Review category"
    Then the category "Review category" should be trashed
    When I delete the category "Review category" permanently
    Then the category "Review category" should not exist

  Scenario: The categories of the blog sample data are listed
    Given I am on the administrator "Categories" page
    Then I should see the row "Blog" in the list
    And I should see the row "Typography" in the list
    And I should see the administrator page title "Articles: Categories"
