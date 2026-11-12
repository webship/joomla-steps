Feature: Media Manager
  As an administrator
  I want to upload images to the media folder
  So that I can use them in articles

  Background:
    Given I am a logged in user with the "admin" user

  Scenario: Upload an image and delete it
    Given I am on the administrator "Media" page
    Then I should see the media file "joomla_black.png"
    When I upload the file "tests/fixtures/pixel.png" to the media manager
    Then I should see the media file "pixel.png"
    When I delete the media file "pixel.png"
    Then I should not see the media file "pixel.png"
