import { defineConfig, devices } from "@playwright/test";

type WebServers = Extract<Parameters<typeof defineConfig>[0]["webServer"], any[]>;

const getWebServers = () => {
  const webServers: WebServers = [];

  if (!process.env.CI) {
    webServers.push({
      command: "yarn playwright-db",
      port: 5433,
      reuseExistingServer: true,
      stdout: "ignore",
      stderr: "ignore",
    });
  }

  webServers.push({
    command: "yarn start-playwright",
    url: "http://localhost:3456",
    reuseExistingServer: true,
    stdout: "ignore",
    stderr: "pipe",
  });

  return webServers;
}

const getProjects = () => {
  let projects = [
    {
      name: "chromium",
      use: {...devices["Desktop Chrome"]},
    },
  ];
  if (process.env.CI) {
    projects = projects.concat([
      {
        name: "firefox",
        use: {...devices["Desktop Firefox"]},
      },
      {
        name: "webkit",
        use: {...devices["Desktop Safari"]},
      },

      /* Test against mobile viewports. */
      // {
      //   name: "Mobile Chrome",
      //   use: {...devices["Pixel 5"]},
      // },
      // {
      //   name: "Mobile Safari",
      //   use: {...devices["iPhone 12"]},
      // },

      /* Test against branded browsers. */
      // {
      //   name: "Microsoft Edge",
      //   use: {...devices["Desktop Edge"], channel: "msedge"},
      // },
      // {
      //   name: "Google Chrome",
      //   use: {...devices["Desktop Chrome"], channel: "chrome"},
      // },
    ]);
  }
  return projects;
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./playwright",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Increase timeout in CI as github runners are very underpowered */
  timeout: process.env.CI ? 60000 : 30000,
  /*
   * Shared settings for all the projects below.
   * See https://playwright.dev/docs/api/class-testoptions.
   */
  use: {
    /* Base URL to use in actions like `await page.goto("/")`. */
    baseURL: "http://localhost:3456",

    /*
     * Collect trace when retrying the failed test.
     * See https://playwright.dev/docs/trace-viewer
     */
    trace: "on-first-retry",
  },
  projects: getProjects(),
  webServer: getWebServers(),
});
