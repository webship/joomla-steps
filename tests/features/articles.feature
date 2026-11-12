# Each scenario creates what it needs with the steps and removes it at the end (trash,
# then delete permanently), so the suite leaves the site as it found it. The category
# "Blog" and the home page of the "blog" sample data carry the front end checks.
Feature: Articles
  As an administrator
  I want to create, publish and remove articles
  So that I know the content I manage reaches the site

  Background:
    Given I am a logged in user with the "admin" user

  Scenario: Create an article and remove it
    Given the article "Review article one" is removed
    When I create an article titled "Review article one" in the "Blog" category with the text "The text of the first review article."
    Then I should see a success message "Article saved."
    And the article "Review article one" should exist
    And the article "Review article one" should be published
    And the article "Review article one" should be unfeatured
    When I trash the article "Review article one"
    Then the article "Review article one" should be trashed
    When I delete the article "Review article one" permanently
    Then the article "Review article one" should not exist

  Scenario: A featured article is on the home page until it is unpublished
    Given the article "Review featured article" is removed
    When I create a featured article titled "Review featured article" with the text "Shown on the front page."
    Then the article "Review featured article" should be featured
    Given I am on the homepage
    Then I should see "Review featured article"
    When I unpublish the article "Review featured article"
    Then the article "Review featured article" should be unpublished
    Given I am on the homepage
    Then I should not see "Review featured article"
    When I publish the article "Review featured article"
    Then the article "Review featured article" should be published
    When I unfeature the article "Review featured article"
    Then the article "Review featured article" should be unfeatured
    Given I am on the homepage
    Then I should not see "Review featured article"
    When I trash the article "Review featured article"
    And I delete the article "Review featured article" permanently
    Then the article "Review featured article" should not exist

  Scenario: An unpublished article is not on the site and can be published and archived
    Given the article "Review draft article" is removed
    When I create an unpublished article titled "Review draft article" in the "Blog" category
    Then the article "Review draft article" should be unpublished
    When I publish the article "Review draft article"
    And I feature the article "Review draft article"
    Then the article "Review draft article" should be featured
    When I archive the article "Review draft article"
    Then the article "Review draft article" should be archived
    And the article "Review draft article" should not be published
    When I trash the article "Review draft article"
    And I delete the article "Review draft article" permanently
    Then the article "Review draft article" should not exist

  Scenario: The article form keeps what was typed
    When I open the article "Typography" for editing
    Then I should see the administrator page title "Articles: Edit"
    And the field labelled "Title" should have the value "Typography"
    And the field labelled "Alias" should have the value "typography"
    And the rich text editor should contain "Typography"
    And the field labelled "Featured" should have the value "No"
    When I open the "Publishing" tab
    And I click the "Close" toolbar button
    Then I should be on the administrator "Articles" page

  Scenario: The list of articles can be searched and filtered
    Given I am on the administrator "Articles" page
    When I search the list for "Typography"
    Then I should see the row "Typography" in the list
    When I search the list for "qzxjvwk no such article"
    Then I should see an empty list

  Scenario: Edit an article with the editor, a select and a switcher, then check it in
    Given the article "Review edited article" is removed
    When I create an article titled "Review edited article" in the "Blog" category
    And I open the article "Review edited article" for editing
    And I fill in the rich text editor with "<p>The text the editor step wrote.</p>"
    And I choose "Typography" in the "Category" field
    And I switch "Featured" to "Yes"
    And I click the "Save" toolbar button
    Then I should see a success message "Article saved."
    And the rich text editor should contain "The text the editor step wrote."
    And the field labelled "Category" should have the value "Typography"
    And the field labelled "Featured" should have the value "Yes"
    When I am on the administrator "Articles" page
    Then the article "Review edited article" should be featured
    And the article "Review edited article" should be checked out
    When I check in the article "Review edited article"
    Then the article "Review edited article" should not be checked out
    And the article "Review edited article" is removed
