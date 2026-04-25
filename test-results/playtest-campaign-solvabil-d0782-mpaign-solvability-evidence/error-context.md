# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: playtest-campaign-solvability.spec.ts >> plays through all authored levels and records campaign solvability evidence
- Location: playtest-campaign-solvability.spec.ts:79:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4173/?noEnemy
Call log:
  - navigating to "http://127.0.0.1:4173/?noEnemy", waiting until "networkidle"

```

# Test source

```ts
  10  |   backward: "Move backward",
  11  |   left: "Move left",
  12  |   right: "Move right",
  13  |   up: "Climb to the upper floor",
  14  |   down: "Climb to the lower floor",
  15  | };
  16  | const NO_ENEMY_URL = "http://127.0.0.1:4173/?noEnemy";
  17  | const HORIZONTAL_SETTLE_MS = Math.ceil(PLAYER_MOVE_SECONDS * 1000) + 180;
  18  | const VERTICAL_SETTLE_MS = Math.ceil(PLAYER_MOVE_SECONDS * 1.08 * 1000) + 240;
  19  | 
  20  | function artifactPath(name: string) {
  21  |   return `test-results/${name}`;
  22  | }
  23  | 
  24  | async function statValue(page: Page, label: string) {
  25  |   return (
  26  |     (await page
  27  |       .locator(".stat")
  28  |       .filter({ hasText: label })
  29  |       .locator("strong")
  30  |       .textContent()) ?? ""
  31  |   ).trim();
  32  | }
  33  | 
  34  | async function snapshotLevelState(page: Page) {
  35  |   return {
  36  |     level: (await page.locator(".hud-level").textContent())?.trim() ?? "",
  37  |     floor: (await page.locator(".floor-chip").textContent())?.trim() ?? "",
  38  |     tile: (await page.locator(".tile-chip").textContent())?.trim() ?? "",
  39  |     moves: await statValue(page, "Moves"),
  40  |     time: await statValue(page, "Time"),
  41  |   };
  42  | }
  43  | 
  44  | async function waitForControlsReady(page: Page) {
  45  |   await expect.poll(
  46  |     async () =>
  47  |       (await page.getByRole("button", { name: "Restart maze" }).isEnabled()) &&
  48  |       (await page.getByRole("button", { name: ACTION_LABELS.forward }).isEnabled()),
  49  |     { timeout: 15_000 },
  50  |   ).toBe(true);
  51  | }
  52  | 
  53  | async function restartLevel(page: Page) {
  54  |   await waitForControlsReady(page);
  55  |   await page.getByRole("button", { name: "Restart maze" }).click();
  56  |   await waitForControlsReady(page);
  57  |   await expect.poll(() => statValue(page, "Moves")).toBe("0");
  58  | }
  59  | 
  60  | async function clickAction(page: Page, action: CampaignAction) {
  61  |   await page.getByRole("button", { name: ACTION_LABELS[action] }).click();
  62  |   await page.waitForTimeout(action === "up" || action === "down" ? VERTICAL_SETTLE_MS : HORIZONTAL_SETTLE_MS);
  63  | 
  64  |   if (await page.locator(".defeat").isVisible().catch(() => false)) {
  65  |     throw new Error(`Action ${action} ended the run in defeat.`);
  66  |   }
  67  | }
  68  | 
  69  | async function expectLevelReady(page: Page, levelId: number, title: string) {
  70  |   await expect(page.locator(".hud-level")).toContainText(`Level ${levelId}: ${title}`);
  71  |   await waitForControlsReady(page);
  72  | }
  73  | 
  74  | async function selectLevel(page: Page, levelId: number, title: string) {
  75  |   await page.getByRole("button", { name: `Load level ${levelId}: ${title}` }).click();
  76  |   await expectLevelReady(page, levelId, title);
  77  | }
  78  | 
  79  | test("plays through all authored levels and records campaign solvability evidence", async ({ page }) => {
  80  |   mkdirSync("test-results", { recursive: true });
  81  | 
  82  |   const consoleErrors: string[] = [];
  83  |   const pageErrors: string[] = [];
  84  |   const failedRequests: string[] = [];
  85  | 
  86  |   page.on("console", (message) => {
  87  |     if (message.type() === "error") {
  88  |       consoleErrors.push(message.text());
  89  |     }
  90  |   });
  91  |   page.on("pageerror", (error) => {
  92  |     pageErrors.push(error.message);
  93  |   });
  94  |   page.on("requestfailed", (request) => {
  95  |     const url = request.url();
  96  |     if (url.endsWith("/favicon.ico")) return;
  97  |     failedRequests.push(`${request.failure()?.errorText ?? "requestfailed"} ${url}`);
  98  |   });
  99  | 
  100 |   const report = {
  101 |     runMode: "noEnemy",
  102 |     generatedAt: new Date().toISOString(),
  103 |     consoleErrors,
  104 |     pageErrors,
  105 |     failedRequests,
  106 |     levels: [] as Array<Record<string, unknown>>,
  107 |   };
  108 | 
  109 |   for (const walkthrough of CAMPAIGN_WALKTHROUGHS) {
> 110 |     await page.goto(NO_ENEMY_URL, { waitUntil: "networkidle" });
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4173/?noEnemy
  111 |     await expect(page.getByRole("heading", { name: "Neon Labyrinth" })).toBeVisible();
  112 |     await expect(page.locator("canvas")).toBeVisible();
  113 |     await selectLevel(page, walkthrough.id, walkthrough.title);
  114 |     await restartLevel(page);
  115 | 
  116 |     const before = await snapshotLevelState(page);
  117 |     await page.screenshot({ path: artifactPath(`campaign-level-${walkthrough.id}-start.png`) });
  118 | 
  119 |     let traversalEvidence: null | {
  120 |       step: number;
  121 |       action: CampaignAction;
  122 |       state: Awaited<ReturnType<typeof snapshotLevelState>>;
  123 |       screenshot: string;
  124 |     } = null;
  125 | 
  126 |     for (const [stepIndex, action] of walkthrough.actions.entries()) {
  127 |       await clickAction(page, action);
  128 | 
  129 |       if (traversalEvidence !== null) continue;
  130 |       const state = await snapshotLevelState(page);
  131 |       if (action === "up" || action === "down" || state.tile.includes("Ladder") || state.floor !== before.floor) {
  132 |         const screenshot = artifactPath(`campaign-level-${walkthrough.id}-traversal-step-${stepIndex + 1}.png`);
  133 |         await page.screenshot({ path: screenshot });
  134 |         traversalEvidence = {
  135 |           step: stepIndex + 1,
  136 |           action,
  137 |           state,
  138 |           screenshot,
  139 |         };
  140 |       }
  141 |     }
  142 | 
  143 |     await expect(page.locator(".victory")).toBeVisible();
  144 | 
  145 |     const after = await snapshotLevelState(page);
  146 |     const victoryTitle = (await page.locator("#victory-title").textContent())?.trim() ?? "";
  147 |     const victoryBody = (await page.locator(".victory").textContent())?.trim() ?? "";
  148 |     const victoryScreenshot = artifactPath(`campaign-level-${walkthrough.id}-victory.png`);
  149 | 
  150 |     await page.screenshot({ path: victoryScreenshot });
  151 | 
  152 |     report.levels.push({
  153 |       id: walkthrough.id,
  154 |       title: walkthrough.title,
  155 |       band: walkthrough.band,
  156 |       before,
  157 |       after,
  158 |       actions: walkthrough.actions,
  159 |       actionCount: walkthrough.actionCount,
  160 |       verticalActionCount: walkthrough.verticalActionCount,
  161 |       firstVerticalActionStep: walkthrough.firstVerticalActionStep,
  162 |       traversalEvidence,
  163 |       victoryTitle,
  164 |       victoryBody,
  165 |       victoryScreenshot,
  166 |     });
  167 |   }
  168 | 
  169 |   writeFileSync(artifactPath("campaign-solvability-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  170 | });
  171 | 
```