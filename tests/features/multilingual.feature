# A multilingual site changes every address of the front end (the language code
# comes first), so this feature is a lane of its own: CUCUMBER_TAGS=@multilingual.
# It needs the French language pack installed (JOOMLA_LANGUAGES=fr-FR when the site
# is built, or Administrator > System > Install > Languages) and puts the site back
# as it found it at the end. It starts by removing what a failed run may have left,
# and the content language Joomla adds by itself when the language pack is installed:
# the scenario creates its own.
@multilingual
Feature: Multilingual site and the language switcher
  As a visitor
  I want to switch the language of the site
  So that I read the pages in my own language

  Scenario: Two content languages give a language switcher that changes the page language
    Given I am a logged in user with the "admin" user
    And the module "Review languages" is removed
    And the menu "Review multilingual" is removed
    And the content language "French" is removed
    And the content language "French (fr-FR)" is removed
    And I disable the plugin "System - Language Filter"
    And I am on the homepage
    Then I should not see the language switcher
    When I enable the plugin "System - Language Filter"
    And I am on the administrator "option=com_languages&task=language.add" page
    And I set the field labelled "Title" to "French"
    And I set the field labelled "Title in Native Language" to "Français"
    And I set the field labelled "Language Tag" to "fr-FR"
    And I set the field labelled "URL Language Code" to "fr"
    And I click the "Save & Close" toolbar button
    Then I should see a success message "saved"
    When I create a menu titled "Review multilingual"
    And I create a menu item titled "Home EN" in the "Review multilingual" menu of the type "Articles > Featured Articles"
    And I open the menu item "Home EN" for editing
    And I choose "English (en-GB)" in the "Language" field
    And I switch "Default Page" to "Yes"
    And I click the "Save & Close" toolbar button
    Then I should see a success message "saved"
    When I create a menu item titled "Accueil" in the "Review multilingual" menu of the type "Articles > Featured Articles"
    And I open the menu item "Accueil" for editing
    And I choose "French" in the "Language" field
    And I switch "Default Page" to "Yes"
    And I click the "Save & Close" toolbar button
    Then I should see a success message "saved"
    When I create a "Language Switcher" site module titled "Review languages" in the "sidebar-right" position
    Then I should see a success message "Module saved"
    Given I am on the homepage
    Then I should see the language switcher
    And the page language should be "en-gb"
    When I switch the site language to "Français"
    Then the url should match "/fr"
    And the page language should be "fr-fr"
    When I switch the site language to "English (United Kingdom)"
    Then the page language should be "en-gb"
    Given I am a logged in user with the "admin" user
    When I open the module "Review languages" for editing
    And I switch "Use Dropdown" to "Yes"
    And I click the "Save & Close" toolbar button
    Then I should see a success message "Module saved"
    Given I am on the homepage
    When I switch the site language to "Français"
    Then the page language should be "fr-fr"
    When I switch the site language to "English (United Kingdom)"
    Then the page language should be "en-gb"
    Given I am a logged in user with the "admin" user
    When I trash the module "Review languages"
    And I delete the module "Review languages" permanently
    And I delete the menu "Review multilingual"
    And the content language "French" is removed
    And the content language "French (fr-FR)" is removed
    And I disable the plugin "System - Language Filter"
    Given I am on the homepage
    Then I should not see the language switcher
