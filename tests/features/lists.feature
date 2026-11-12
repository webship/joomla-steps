# The scenarios work on the list that is on the page: they filter it, select rows
# and press a toolbar button, the way a person does. The article they create is
# removed at the end.
Feature: Administrator lists
  As an administrator
  I want to filter a list, select rows and act on them with the toolbar
  So that I can manage many items at once

  Background:
    Given I am a logged in user with the "admin" user

  Scenario: Filter the article list by status
    Given I am on the administrator "Articles" page
    When I filter the list by "Select Status" with "Published"
    Then I should see the row "Typography" in the list
    When I filter the list by "Select Status" with "Trashed"
    Then I should not see the row "Typography" in the list

  Scenario: Select a row, then every row, and act with the toolbar
    Given the article "Review selected article" is removed
    When I create an unpublished article titled "Review selected article" in the "Blog" category
    And I am on the administrator "Articles" page
    And I search the list for "Review selected article"
    And I select the row "Review selected article"
    And I click the "Publish" toolbar button
    Then I should see a success message "published"
    And the article "Review selected article" should be published
    When I am on the administrator "Articles" page
    And I search the list for "Review selected article"
    And I select all rows
    And I click the "Unpublish" toolbar button
    Then I should see a success message "unpublished"
    And the article "Review selected article" should be unpublished
    And the article "Review selected article" is removed
