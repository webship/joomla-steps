module.exports = {
  default: {
    // The step timeout is webship-js's (45 s, set when it loads): WEBSHIP_STEP_TIMEOUT=<milliseconds> changes it; a `timeout` key here is ignored.
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',          // Webship-js core step definitions (auto HTML report on exit; disable: WEBSHIP_REPORT_DISABLE=1).
      // 'node_modules/webship-js/tests/step-definitions-diffy/**/*.js', // Diffy step definitions (optional).
      'tests/step-definitions/**/*.js',                                  // Your custom step definitions.
    ],
    // FEATURES=tests/features/a.feature,tests/features/b.feature runs a subset.
    paths: process.env.FEATURES ? process.env.FEATURES.split(',') : ['tests/features/**/*.feature'],
    // CUCUMBER_TAGS=@critical runs a lane; the default keeps work-in-progress and auth-state setup out.
    tags: process.env.CUCUMBER_TAGS || 'not @wip and not @auth-setup',
    format: [
      '@cucumber/pretty-formatter',
      'json:tests/reports/cucumber_report.json',
    ],
    formatOptions: {
      colorsEnabled: true,
      theme: {
        'feature keyword': ['bold', 'blue'],
        'feature name': ['blue', 'underline'],
        'feature description': ['blueBright'],
        'scenario keyword': ['bold', 'magenta'],
        'scenario name': ['magenta', 'underline'],
        'step keyword': ['bold', 'green'],
        'step text': ['greenBright', 'italic'],
      },
    },
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'https://cassiopeia.joomla.com',
      // Video of the browser: 'off', 'on', 'on-failure' or 'tag' (scenarios tagged @video; @no-video opts out).
      video: { mode: process.env.WEBSHIP_VIDEO || 'off', dir: './videos', size: { width: 1280, height: 720 }, filenamePattern: '{datetime}.{feature_file}.{scenario}.{status}.{ext}' },
      // JavaScript errors the page raises: 'warn' reports them, 'fail' fails the scenario, 'off' ignores them; @js-fail, @js-warn and @js-off per scenario.
      javascript: { mode: process.env.WEBSHIP_JS_ERROR_MODE || 'warn', levels: ['error'], ignore: '', beforeScenario: false, afterScenario: true },
      // The accounts that "a logged in user with ..." and "logged in to the site with ..."
      // use, by handle. They are configuration, not test data: the Joomla CLI creates them
      // once (`php cli/joomla.php user:add`; .github/scripts/build-ddev-joomla.sh does it
      // for the test site) and a feature never creates or deletes users. Point the suite at
      // another site with the JOOMLA_* variables.
      //   admin    Super Users   logs in to the administrator
      //   manager  Manager       logs in to the administrator, with fewer rights
      //   editor   Editor        logs in to the site only
      //   member   Registered    logs in to the site only
      users: {
        admin: { username: process.env.JOOMLA_ADMIN_USER || 'admin', password: process.env.JOOMLA_ADMIN_PASSWORD || 'Admin123456789!' },
        manager: { username: process.env.JOOMLA_MANAGER_USER || 'manager', password: process.env.JOOMLA_MANAGER_PASSWORD || 'Manager123456789!' },
        editor: { username: process.env.JOOMLA_EDITOR_USER || 'editor', password: process.env.JOOMLA_EDITOR_PASSWORD || 'Editor123456789!' },
        member: { username: process.env.JOOMLA_MEMBER_USER || 'member', password: process.env.JOOMLA_MEMBER_PASSWORD || 'Member123456789!' },
      },
      minWaitTime: {
        page: 3000,
        before_scenario: 0,
        after_scenario: 0,
        before_step: 0,
        after_step: 0,
      },
      selectors: {
        css: {},
        xpath: {},
        filesPath: './tests/selectors/',
        files: [],
        offset: 60,
        breakpoints: {
          xs:   { width: 375,  height: 667  },
          sm:   { width: 576,  height: 800  },
          md:   { width: 768,  height: 1024 },
          lg:   { width: 992,  height: 768  },
          xl:   { width: 1200, height: 900, default: true },
          xxl:  { width: 1400, height: 900  },
          xxxl: { width: 1920, height: 1080 },
        },
      },
      screenshot: {
        dir: './screenshots',
        purge: false,
        onFailed: true,
        onEveryStep: false,
        alwaysFullscreen: false,
        failedPrefix: 'failed_',
        filenamePattern: '{datetime}.{feature_file}.feature_{step_line}.{ext}',
        filenamePatternFailed: '{failed_prefix}{datetime}.{feature_file}.feature_{step_line}.{ext}',
        infoTypes: '',
      },
      // Diffy visual-regression (optional). Uncomment and set apiKey / projectId to enable.
      // diffy: {
      //   apiKey: '',                                 // DIFFY_API_KEY
      //   projectId: 0,                               // DIFFY_PROJECT_ID
      //   breakpoints: '640,1200',                    // DIFFY_BREAKPOINTS
      //   windowHeight: 2000,                         // DIFFY_WINDOW_HEIGHT
      //   screenshotsDir: '',                         // DIFFY_SCREENSHOTS_DIR
      //   baseUrl: 'https://app.diffy.website/api/',  // DIFFY_API_BASE_URL
      //   maxWait: 30,                                // DIFFY_MAX_WAIT (seconds)
      //   env1Url: '',                                // DIFFY_ENV1_URL
      //   env2Url: '',                                // DIFFY_ENV2_URL
      // },
    },
  },
};
