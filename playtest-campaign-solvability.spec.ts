import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { CAMPAIGN_WALKTHROUGHS, type CampaignAction } from "./src/campaign/campaignWalkthrough";
import { PLAYER_MOVE_SECONDS } from "./src/enemyDesign";

test.describe.configure({ mode: "serial", timeout: 240_000 });

const ACTION_LABELS: Record<CampaignAction, string> = {
  forward: "Move forward",
  backward: "Move backward",
  left: "Move left",
  right: "Move right",
  up: "Climb to the upper floor",
  down: "Climb to the lower floor",
};
const NO_ENEMY_URL = "http://127.0.0.1:4173/?noEnemy";
const MOVE_ACCEPT_TIMEOUT_MS = Math.ceil(PLAYER_MOVE_SECONDS * 1000) + 2_000;
const HORIZONTAL_SETTLE_MS = 120;
const VERTICAL_SETTLE_MS = 180;

function artifactPath(name: string) {
  return `test-results/${name}`;
}

async function statValue(page: Page, label: string) {
  return (
    (await page
      .locator(".stat")
      .filter({ hasText: label })
      .locator("strong")
      .textContent()) ?? ""
  ).trim();
}

async function snapshotLevelState(page: Page) {
  return {
    level: (await page.locator(".hud-level").textContent())?.trim() ?? "",
    floor: (await page.locator(".floor-chip").textContent())?.trim() ?? "",
    tile: (await page.locator(".tile-chip").textContent())?.trim() ?? "",
    moves: await statValue(page, "Moves"),
    time: await statValue(page, "Time"),
  };
}

async function waitForControlsReady(page: Page) {
  await expect.poll(
    async () =>
      (await page.getByRole("button", { name: "Restart maze" }).isEnabled()) &&
      (await page.getByRole("button", { name: ACTION_LABELS.forward }).isEnabled()),
    { timeout: 15_000 },
  ).toBe(true);
}

async function restartLevel(page: Page) {
  await waitForControlsReady(page);
  await page.getByRole("button", { name: "Restart maze" }).click();
  await waitForControlsReady(page);
  await expect.poll(() => statValue(page, "Moves")).toBe("0");
}

async function clickAction(page: Page, action: CampaignAction) {
  const previousMoves = Number(await statValue(page, "Moves"));
  await page.getByRole("button", { name: ACTION_LABELS[action] }).click();
  await expect
    .poll(() => statValue(page, "Moves"), { timeout: MOVE_ACCEPT_TIMEOUT_MS })
    .toBe(String(previousMoves + 1));
  await page.waitForTimeout(action === "up" || action === "down" ? VERTICAL_SETTLE_MS : HORIZONTAL_SETTLE_MS);

  if (await page.locator(".defeat").isVisible().catch(() => false)) {
    throw new Error(`Action ${action} ended the run in defeat.`);
  }
}

async function expectLevelReady(page: Page, levelId: number, title: string) {
  await expect(page.locator(".hud-level")).toContainText(`Level ${levelId}: ${title}`);
  await waitForControlsReady(page);
}

async function selectLevel(page: Page, levelId: number, title: string) {
  await page.getByRole("button", { name: `Load level ${levelId}: ${title}` }).click();
  await expectLevelReady(page, levelId, title);
}

test("plays through all four authored levels and records campaign solvability evidence", async ({ page }) => {
  mkdirSync("test-results", { recursive: true });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.endsWith("/favicon.ico")) return;
    failedRequests.push(`${request.failure()?.errorText ?? "requestfailed"} ${url}`);
  });

  const report = {
    runMode: "noEnemy",
    generatedAt: new Date().toISOString(),
    consoleErrors,
    pageErrors,
    failedRequests,
    levels: [] as Array<Record<string, unknown>>,
  };

  for (const walkthrough of CAMPAIGN_WALKTHROUGHS) {
    await page.goto(NO_ENEMY_URL, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Neon Labyrinth" })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
    await selectLevel(page, walkthrough.id, walkthrough.title);
    await restartLevel(page);

    const before = await snapshotLevelState(page);
    await page.screenshot({ path: artifactPath(`campaign-level-${walkthrough.id}-start.png`) });

    let traversalEvidence: null | {
      step: number;
      action: CampaignAction;
      state: Awaited<ReturnType<typeof snapshotLevelState>>;
      screenshot: string;
    } = null;

    for (const [stepIndex, action] of walkthrough.actions.entries()) {
      await clickAction(page, action);

      if (traversalEvidence !== null) continue;
      const state = await snapshotLevelState(page);
      if (action === "up" || action === "down" || state.tile.includes("Ladder") || state.floor !== before.floor) {
        const screenshot = artifactPath(`campaign-level-${walkthrough.id}-traversal-step-${stepIndex + 1}.png`);
        await page.screenshot({ path: screenshot });
        traversalEvidence = {
          step: stepIndex + 1,
          action,
          state,
          screenshot,
        };
      }
    }

    await expect(page.locator(".victory")).toBeVisible();

    const after = await snapshotLevelState(page);
    const victoryTitle = (await page.locator("#victory-title").textContent())?.trim() ?? "";
    const victoryBody = (await page.locator(".victory").textContent())?.trim() ?? "";
    const victoryScreenshot = artifactPath(`campaign-level-${walkthrough.id}-victory.png`);

    await page.screenshot({ path: victoryScreenshot });

    report.levels.push({
      id: walkthrough.id,
      title: walkthrough.title,
      band: walkthrough.band,
      before,
      after,
      actions: walkthrough.actions,
      actionCount: walkthrough.actionCount,
      verticalActionCount: walkthrough.verticalActionCount,
      firstVerticalActionStep: walkthrough.firstVerticalActionStep,
      traversalEvidence,
      victoryTitle,
      victoryBody,
      victoryScreenshot,
    });
  }

  writeFileSync(artifactPath("campaign-solvability-report.json"), `${JSON.stringify(report, null, 2)}\n`);
});
