import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { CAMPAIGN_WALKTHROUGHS, type CampaignAction } from "./src/campaign/campaignWalkthrough";
import { CAMPAIGN_LEVELS } from "./src/campaign/campaignProgression";
import { PLAYER_MOVE_SECONDS } from "./src/enemyDesign";
import { intentMappingTable, type Direction } from "./src/movementFromCamera";

test.describe.configure({ mode: "serial", timeout: 300_000 });

const NO_ENEMY_URL = "http://127.0.0.1:4173/?noEnemy";
const DEFAULT_CAMERA_YAW = Math.atan2(10, 11);
const ROTATION_SPEED = 0.008;
const HALF_TURN_DRAG_PX = Math.round(Math.PI / ROTATION_SPEED);
const HORIZONTAL_SETTLE_MS = Math.ceil(PLAYER_MOVE_SECONDS * 1000) + 180;
const VERTICAL_SETTLE_MS = Math.ceil(PLAYER_MOVE_SECONDS * 1.08 * 1000) + 240;

const ACTION_LABELS: Record<CampaignAction, string> = {
  forward: "Move forward",
  backward: "Move backward",
  left: "Move left",
  right: "Move right",
  up: "Climb to the upper floor",
  down: "Climb to the lower floor",
};

const ROTATED_INTENT_BY_WORLD_ACTION = Object.fromEntries(
  Object.entries(intentMappingTable(DEFAULT_CAMERA_YAW + Math.PI, "continuous")).map(([intent, direction]) => [
    direction,
    intent,
  ]),
) as Record<Direction, Direction>;

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
    hint: (await page.locator(".camera-hint").textContent())?.trim() ?? "",
  };
}

async function waitForControlsReady(page: Page) {
  await expect.poll(
    async () =>
      (await page.getByRole("button", { name: "Restart maze" }).isEnabled()) &&
      (await page.getByRole("button", { name: ACTION_LABELS.forward }).isEnabled()) &&
      (await page.getByRole("button", { name: "Reset view" }).isEnabled()),
    { timeout: 15_000 },
  ).toBe(true);
}

async function expectLevelReady(page: Page, levelId: number, title: string) {
  await expect(page.locator(".hud-level")).toContainText(`Level ${levelId}: ${title}`);
  await waitForControlsReady(page);
  await expect(page.locator(".victory")).toHaveCount(0);
  await expect(page.locator(".defeat")).toHaveCount(0);
}

async function selectLevel(page: Page, levelId: number, title: string) {
  await page.getByRole("button", { name: `Load level ${levelId}: ${title}` }).click();
  await expectLevelReady(page, levelId, title);
}

async function restartLevel(page: Page) {
  await waitForControlsReady(page);
  await page.getByRole("button", { name: "Restart maze" }).click();
  await waitForControlsReady(page);
  await expect.poll(() => statValue(page, "Moves")).toBe("0");
}

async function clickAction(page: Page, action: CampaignAction) {
  await page.getByRole("button", { name: ACTION_LABELS[action] }).click();
  await page.waitForTimeout(action === "up" || action === "down" ? VERTICAL_SETTLE_MS : HORIZONTAL_SETTLE_MS);

  if (await page.locator(".defeat").isVisible().catch(() => false)) {
    throw new Error(`Action ${action} ended the run in defeat.`);
  }
}

async function rotateCanvasHalfTurn(page: Page) {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("Canvas bounds were unavailable for rotated-controls evidence.");
  }

  const startX = box.x + box.width * 0.66;
  const startY = box.y + box.height * 0.45;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - HALF_TURN_DRAG_PX, startY, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(160);
}

async function captureScreenshot(page: Page, name: string) {
  await page.screenshot({ path: artifactPath(name), fullPage: true });
  return artifactPath(name);
}

test("runs final level-progression regression and records release evidence", async ({ page }) => {
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
    generatedAt: new Date().toISOString(),
    runMode: "noEnemy",
    status: "pass" as "pass" | "blockers-found",
    consoleErrors,
    pageErrors,
    failedRequests,
    levels: [] as Array<Record<string, unknown>>,
    blockers: [] as string[],
  };

  for (const walkthrough of CAMPAIGN_WALKTHROUGHS) {
    const nextLevel = CAMPAIGN_LEVELS.find((level) => level.id === walkthrough.id + 1);
    const levelReport: Record<string, unknown> = {
      id: walkthrough.id,
      title: walkthrough.title,
      band: walkthrough.band,
      actions: walkthrough.actions,
      actionCount: walkthrough.actionCount,
      verticalActionCount: walkthrough.verticalActionCount,
      blockers: [] as string[],
    };

    try {
      await page.goto(NO_ENEMY_URL, { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name: "Neon Labyrinth" })).toBeVisible();
      await expect(page.locator("canvas")).toBeVisible();
      await selectLevel(page, walkthrough.id, walkthrough.title);

      const loaded = await snapshotLevelState(page);
      levelReport.loaded = loaded;
      levelReport.startScreenshot = await captureScreenshot(page, `progression-level-${walkthrough.id}-loaded.png`);

      const firstHorizontalAction = walkthrough.actions.find(
        (action): action is Direction => action !== "up" && action !== "down",
      );

      if (!firstHorizontalAction) {
        throw new Error(`Level ${walkthrough.id} does not expose a horizontal action for rotated-controls coverage.`);
      }

      const rotatedIntent = ROTATED_INTENT_BY_WORLD_ACTION[firstHorizontalAction];
      if (!rotatedIntent) {
        throw new Error(`Missing inverted control mapping for ${firstHorizontalAction}.`);
      }

      await rotateCanvasHalfTurn(page);
      await clickAction(page, rotatedIntent);
      await expect.poll(() => statValue(page, "Moves")).toBe("1");
      levelReport.rotatedControls = {
        desiredWorldAction: firstHorizontalAction,
        rotatedIntent,
        stateAfterMove: await snapshotLevelState(page),
        screenshot: await captureScreenshot(page, `progression-level-${walkthrough.id}-rotated-controls.png`),
      };

      await page.getByRole("button", { name: "Reset view" }).click();
      await restartLevel(page);

      const restarted = await snapshotLevelState(page);
      levelReport.restarted = restarted;
      if (restarted.moves !== "0") {
        throw new Error(`Restart did not reset move count on level ${walkthrough.id}.`);
      }
      if (restarted.floor !== loaded.floor || restarted.tile !== loaded.tile) {
        throw new Error(`Restart did not restore the authored start state on level ${walkthrough.id}.`);
      }
      levelReport.restartScreenshot = await captureScreenshot(page, `progression-level-${walkthrough.id}-restart.png`);

      let traversalEvidence: Record<string, unknown> | null = null;

      for (const [stepIndex, action] of walkthrough.actions.entries()) {
        await clickAction(page, action);
        const state = await snapshotLevelState(page);

        if (
          traversalEvidence === null &&
          (action === "up" || action === "down" || state.floor !== restarted.floor || state.tile.includes("Ladder"))
        ) {
          traversalEvidence = {
            step: stepIndex + 1,
            action,
            state,
            screenshot: await captureScreenshot(
              page,
              `progression-level-${walkthrough.id}-traversal-step-${stepIndex + 1}.png`,
            ),
          };
        }
      }

      await expect(page.locator(".victory")).toBeVisible();
      levelReport.completed = await snapshotLevelState(page);
      levelReport.victoryTitle = (await page.locator("#victory-title").textContent())?.trim() ?? "";
      levelReport.victoryBody = (await page.locator(".victory").textContent())?.trim() ?? "";
      levelReport.victoryScreenshot = await captureScreenshot(page, `progression-level-${walkthrough.id}-victory.png`);
      levelReport.layeredTraversal = traversalEvidence;

      if (walkthrough.verticalActionCount > 0 && traversalEvidence === null) {
        throw new Error(`Level ${walkthrough.id} completed without capturing layered traversal evidence.`);
      }

      if (nextLevel) {
        await expect(page.locator(".campaign-status")).toContainText(`Level ${nextLevel.id} is ready when you are.`);
        await page.waitForTimeout(1_900);
        await expect(page.locator(".victory")).toBeVisible();
        await expect(page.locator(".hud-level")).toContainText(`Level ${walkthrough.id}: ${walkthrough.title}`);
        await page.getByRole("button", { name: "Next level" }).click();
        await expectLevelReady(page, nextLevel.id, nextLevel.title);
        levelReport.transition = {
          kind: "manual-advance",
          destination: nextLevel.id,
          state: await snapshotLevelState(page),
          screenshot: await captureScreenshot(page, `progression-level-${walkthrough.id}-to-${nextLevel.id}.png`),
        };
      } else {
        await expect(page.locator("#victory-title")).toHaveText("Campaign complete");
        await page.getByRole("button", { name: "Back to Level 1" }).click();
        await expectLevelReady(page, 1, CAMPAIGN_LEVELS[0]!.title);
        levelReport.transition = {
          kind: "campaign-reset",
          destination: 1,
          state: await snapshotLevelState(page),
          screenshot: await captureScreenshot(page, "progression-level-4-back-to-level-1.png"),
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      (levelReport.blockers as string[]).push(message);
      report.blockers.push(`Level ${walkthrough.id}: ${message}`);
      report.status = "blockers-found";
      levelReport.failureScreenshot = await captureScreenshot(page, `progression-level-${walkthrough.id}-failure.png`).catch(
        () => null,
      );
    }

    report.levels.push(levelReport);
  }

  writeFileSync(artifactPath("level-progression-regression.json"), `${JSON.stringify(report, null, 2)}\n`);

  expect.soft(consoleErrors, "browser console errors").toEqual([]);
  expect.soft(pageErrors, "page errors").toEqual([]);
  expect.soft(failedRequests, "failed requests").toEqual([]);
  expect(report.blockers).toEqual([]);
});
