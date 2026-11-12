Feature: Administrator dashboard, menu and pages
  As a site administrator
  I want to find my way through the administrator control panel
  So that I can reach the screens that manage the site

  Background:
    Given I am a logged in user with the "admin" user

  Scenario: The dashboard shows its modules and the sidebar menu
    Then I should see the administrator dashboard
    And I should see the administrator menu
    And I should see the "Site Information" dashboard module
    And I should see the "Logged-in Users" dashboard module
    And I should see the "Recently Added Articles" dashboard module

  Scenario: The sidebar menu leads to the article list
    When I open the administrator menu item "Content > Articles"
    Then I should be on the administrator "Articles" page
    And I should see the administrator page title "Articles"
    And I should see the "New" toolbar button

  Scenario: The sidebar menu reaches a third level entry
    When I open the administrator menu item "Components > Smart Search > Index"
    Then I should be on the administrator "Smart Search Index" page
    And I should see the administrator page title "Smart Search: Indexed Content"

  Scenario: The sidebar menu lists the entries of the account
    Then I should see the administrator menu item "Content > Articles"
    And I should see the administrator menu item "Users > Access Levels"
    And I should see the administrator menu item "Components > Smart Search > Index"
    And I should not see the administrator menu item "Content > Spreadsheets"

  Scenario Outline: A named administrator page opens
    When I am on the administrator "<page>" page
    Then I should be on the administrator "<page>" page
    And I should see the administrator page title "<title>"

    Examples:
      | page                 | title                        |
      | Dashboard            | Home Dashboard               |
      | Categories           | Articles: Categories         |
      | Site Modules         | Modules (Site)               |
      | Menu Items           | Menus: All Menu Items        |
      | Users                | Users                        |
      | Access Levels        | Users: Viewing Access Levels |
      | Extensions           | Extensions: Manage           |
      | Plugins              | Plugins                      |
      | Global Configuration | Global Configuration         |
      | Clear Cache          | Maintenance: Clear Cache     |
      | Global Check-in      | Maintenance: Global Check-in |

  Scenario: The system information page reports the Joomla version
    Then the Joomla version should start with "6"
    And the Joomla version should not start with "3"

  Scenario: A Manager does not see the Super User screens
    Given I am a logged in user with the "manager" user
    Then I should see the administrator menu item "Content > Articles"
    And I should not see the administrator menu item "System"
