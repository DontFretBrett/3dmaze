export default {
  testDir: ".",
  testMatch: ["**/playtest-*.spec.js", "**/playtest-*.spec.ts"],
  reporter: "line",
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    viewport: { width: 1440, height: 1200 },
    launchOptions: {
      args: ["--use-angle=swiftshader", "--use-gl=swiftshader"],
    },
  },
};
