import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, test } from "@playwright/test";

const ACTION_LABELS = {
  forward: "Move forward",
  backward: "Move backward",
  left: "Move left",
  right: "Move right",
  up: "Climb to the upper floor",
  down: "Climb to the lower floor",
};

const LEVEL_SCENARIOS = [
  {
    id: 3,
    title: "Vertical Drift",
    catchRoute: [
      "right",
      "right",
      "backward",
      "backward",
      "backward",
      "backward",
      "backward",
      "backward",
      "left",
      "left",
      "backward",
      "backward",
      "right",
      "right",
      "right",
      "right",
      "forward",
      "forward",
      "right",
      "right",
      "up",
    ],
    finishRoute: [
      "right",
      "right",
      "backward",
      "backward",
      "backward",
      "backward",
      "backward",
      "backward",
      "left",
      "left",
      "backward",
      "backward",
      "right",
      "right",
      "right",
      "right",
      "forward",
      "forward",
      "right",
      "right",
      "up",
      "backward",
      "backward",
      "right",
      "right",
    ],
  },
  {
    id: 4,
    title: "Lockdown Labyrinth",
    catchRoute: [
      "right",
      "right",
      "backward",
      "backward",
      "right",
      "right",
      "forward",
      "forward",
      "up",
      "up",
      "right",
      "right",
      "right",
      "right",
      "right",
      "right",
      "backward",
      "backward",
    ],
    finishRoute: [
      "right",
      "right",
      "backward",
      "backward",
      "right",
      "right",
      "forward",
      "forward",
      "up",
      "up",
      "right",
      "right",
      "right",
      "right",
      "right",
      "right",
      "backward",
      "backward",
      "backward",
      "backward",
      "backward",
      "backward",
      "backward",
      "backward",
      "backward",
      "backward",
    ],
  },
];

async function clickAction(page, action) {
  await page.getByLabel(ACTION_LABELS[action]).click();
  await page.waitForTimeout(action === "up" || action === "down" ? 240 : 220);
}

async function runRoute(page, actions) {
  for (const action of actions) {
    if (await page.locator(".defeat").isVisible().catch(() => false)) {
      break;
    }
    if (await page.locator(".victory").isVisible().catch(() => false)) {
      break;
    }
    await clickAction(page, action);
    if (await page.locator(".defeat").isVisible().catch(() => false)) {
      break;
    }
    if (await page.locator(".victory").isVisible().catch(() => false)) {
      break;
    }
  }
}

async function snapshotHud(page) {
  return {
    level: await page.locator(".hud-level").innerText(),
    floor: await page.locator(".floor-chip").innerText(),
    tile: await page.locator(".tile-chip").innerText(),
    stats: await page.locator(".stats").innerText(),
    hint: await page.locator(".camera-hint").innerText(),
  };
}

async function selectLevel(page, level) {
  await page.getByRole("button", { name: `Load level ${level.id}: ${level.title}` }).click();
  await expect(page.locator(".hud-level")).toContainText(`Level ${level.id}: ${level.title}`);
  await expect(page.locator(".stat").nth(1).locator("strong")).toHaveText("0");
  await expect(page.locator(".defeat")).toHaveCount(0);
  await expect(page.locator(".victory")).toHaveCount(0);
}

for (const level of LEVEL_SCENARIOS) {
  test(`enemy patrol QA on level ${level.id}: ${level.title}`, async ({ page }) => {
    test.setTimeout(240_000);
    const report = {
      generatedAt: new Date().toISOString(),
      levelId: level.id,
      title: level.title,
      issues: [],
    };

    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByText("Neon Labyrinth")).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
    await selectLevel(page, level);

    await page.screenshot({ path: `test-results/enemy-qa-level-${level.id}-start.png` });
    report.startState = await snapshotHud(page);

    await runRoute(page, level.catchRoute);
    await expect(page.locator(".defeat")).toBeVisible({ timeout: 10_000 });
    report.defeatState = await snapshotHud(page);
    report.defeatTitle = await page.locator("#defeat-title").innerText();
    await page.screenshot({ path: `test-results/enemy-qa-level-${level.id}-caught.png` });

    const hitsAfterCatch = await page.locator(".stat").nth(2).locator("strong").innerText();
    if (hitsAfterCatch !== "1") {
      report.issues.push({
        severity: "warning",
        levelId: level.id,
        message: `Expected hit counter to show 1 after defeat, got ${hitsAfterCatch}.`,
      });
    }

    await page.getByRole("button", { name: "Restart run" }).click();
    await expect(page.locator(".defeat")).toHaveCount(0);
    await expect(page.locator(".stat").nth(1).locator("strong")).toHaveText("0");

    await runRoute(page, level.finishRoute);
    await expect(page.locator(".victory")).toBeVisible({ timeout: 10_000 });
    report.victoryState = await snapshotHud(page);
    report.victoryTitle = await page.locator("#victory-title").innerText();
    await page.screenshot({ path: `test-results/enemy-qa-level-${level.id}-victory.png` });

    report.screenshots = {
      start: `test-results/enemy-qa-level-${level.id}-start.png`,
      caught: `test-results/enemy-qa-level-${level.id}-caught.png`,
      victory: `test-results/enemy-qa-level-${level.id}-victory.png`,
    };

    const outPath = resolve(process.cwd(), `test-results/enemy-qa-level-${level.id}.json`);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  });
}
