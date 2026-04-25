# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: playtest-enemy-qa.spec.js >> enemy patrol QA on level 3: Vertical Drift
- Location: playtest-enemy-qa.spec.js:177:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.victory')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('.victory')

```

# Page snapshot

```yaml
- main [ref=e3]:
  - region "Neon Labyrinth game" [ref=e4]:
    - generic:
      - generic [ref=e7]:
        - heading "Neon Labyrinth" [level=1] [ref=e8]
        - paragraph [ref=e9]: "Level 3: Vertical Drift"
        - group "Campaign level selection" [ref=e10]:
          - 'button "Load level 1: Neon Run" [ref=e11] [cursor=pointer]':
            - generic [ref=e12]: Lv 1
            - strong [ref=e13]: Neon Run
          - 'button "Load level 2: Forked Grid" [ref=e14] [cursor=pointer]':
            - generic [ref=e15]: Lv 2
            - strong [ref=e16]: Forked Grid
          - 'button "Load level 3: Vertical Drift" [pressed] [ref=e17] [cursor=pointer]':
            - generic [ref=e18]: Lv 3
            - strong [ref=e19]: Vertical Drift
          - 'button "Load level 4: Lockdown Labyrinth" [ref=e20] [cursor=pointer]':
            - generic [ref=e21]: Lv 4
            - strong [ref=e22]: Lockdown Labyrinth
        - generic [ref=e23]:
          - generic [ref=e24]: Floor 2 / 2
          - generic [ref=e25]: Ladder down
        - generic "Layer and traversal cues" [ref=e26]:
          - list "Current floor 2 of 2" [ref=e27]:
            - listitem [ref=e28]:
              - generic [ref=e29]: Floor 2
              - strong [ref=e30]: Current
            - listitem [ref=e31]:
              - generic [ref=e32]: Floor 1
              - strong [ref=e33]: Below
          - generic "Traversal marker legend" [ref=e34]:
            - generic [ref=e35]: Ladder = climb
            - generic [ref=e36]: Hole = drop
        - paragraph [ref=e37]: Reach the green beacon. Cyan ladders connect floors, amber shafts drop you down, and the floor stack keeps your current deck in view. Avoid the red patrol — one hit ends the run until you restart.
      - generic "Game stats" [ref=e38]:
        - generic [ref=e39]:
          - img [ref=e40]
          - generic [ref=e42]: Time
          - strong [ref=e43]: 0:13
        - generic [ref=e44]:
          - img [ref=e45]
          - generic [ref=e47]: Moves
          - strong [ref=e48]: "21"
        - generic [ref=e49]:
          - img [ref=e50]
          - generic [ref=e52]: Hits
          - strong [ref=e53]: "1"
        - generic [ref=e54]:
          - img [ref=e55]
          - generic [ref=e61]: Best
          - strong [ref=e62]: "--"
      - generic:
        - button "Reset view":
          - img
          - generic: Reset view
        - button "Restart maze" [ref=e63] [cursor=pointer]:
          - img [ref=e64]
    - paragraph: Ladder in reach — use Floor Up / Down or Q / E to change levels.
    - generic "Vertical traversal controls" [ref=e69]:
      - button "Climb to the upper floor" [disabled] [ref=e70]:
        - img [ref=e71]
        - generic [ref=e73]: Floor up
      - button "Climb to the lower floor" [disabled] [ref=e74]:
        - img [ref=e75]
        - generic [ref=e77]: Floor down
    - generic "Movement controls" [ref=e78]:
      - button "Move forward" [disabled] [ref=e79]:
        - img [ref=e80]
      - button "Move left" [disabled] [ref=e82]:
        - img [ref=e83]
      - button "Move backward" [disabled] [ref=e85]:
        - img [ref=e86]
      - button "Move right" [disabled] [ref=e88]:
        - img [ref=e89]
    - dialog "Patrol caught you" [ref=e91]:
      - img [ref=e92]
      - heading "Patrol caught you" [level=2] [ref=e94]
      - paragraph [ref=e95]: 0:13 before the hit, 21 moves taken.
      - button "Restart run" [ref=e96] [cursor=pointer]
```

# Test source

```ts
  114 |       "backward",
  115 |       "backward",
  116 |       "backward",
  117 |       "backward",
  118 |       "backward",
  119 |     ],
  120 |   },
  121 | ];
  122 | 
  123 | async function clickAction(page, action) {
  124 |   const movesBefore = Number((await page.locator(".stat").nth(1).locator("strong").innerText()) || "0");
  125 |   const floorBefore = await page.locator(".floor-chip").innerText();
  126 |   await page.getByLabel(ACTION_LABELS[action]).click();
  127 |   await page.waitForFunction(
  128 |     ({ previousMoves, previousFloor }) => {
  129 |       if (document.querySelector(".victory") || document.querySelector(".defeat")) return true;
  130 |       const movesValue = document.querySelectorAll(".stat strong")[1]?.textContent ?? "0";
  131 |       const floorValue = document.querySelector(".floor-chip")?.textContent ?? "";
  132 |       return Number(movesValue) > previousMoves || floorValue !== previousFloor;
  133 |     },
  134 |     { previousMoves: movesBefore, previousFloor: floorBefore },
  135 |     { timeout: 3_000 },
  136 |   );
  137 |   await page.waitForTimeout(action === "up" || action === "down" ? 160 : 120);
  138 | }
  139 | 
  140 | async function runRoute(page, actions) {
  141 |   for (const action of actions) {
  142 |     if (await page.locator(".defeat").isVisible().catch(() => false)) {
  143 |       break;
  144 |     }
  145 |     if (await page.locator(".victory").isVisible().catch(() => false)) {
  146 |       break;
  147 |     }
  148 |     await clickAction(page, action);
  149 |     if (await page.locator(".defeat").isVisible().catch(() => false)) {
  150 |       break;
  151 |     }
  152 |     if (await page.locator(".victory").isVisible().catch(() => false)) {
  153 |       break;
  154 |     }
  155 |   }
  156 | }
  157 | 
  158 | async function snapshotHud(page) {
  159 |   return {
  160 |     level: await page.locator(".hud-level").innerText(),
  161 |     floor: await page.locator(".floor-chip").innerText(),
  162 |     tile: await page.locator(".tile-chip").innerText(),
  163 |     stats: await page.locator(".stats").innerText(),
  164 |     hint: await page.locator(".camera-hint").innerText(),
  165 |   };
  166 | }
  167 | 
  168 | async function selectLevel(page, level) {
  169 |   await page.getByRole("button", { name: `Load level ${level.id}: ${level.title}` }).click();
  170 |   await expect(page.locator(".hud-level")).toContainText(`Level ${level.id}: ${level.title}`);
  171 |   await expect(page.locator(".stat").nth(1).locator("strong")).toHaveText("0");
  172 |   await expect(page.locator(".defeat")).toHaveCount(0);
  173 |   await expect(page.locator(".victory")).toHaveCount(0);
  174 | }
  175 | 
  176 | for (const level of LEVEL_SCENARIOS) {
  177 |   test(`enemy patrol QA on level ${level.id}: ${level.title}`, async ({ page }) => {
  178 |     test.setTimeout(240_000);
  179 |     const report = {
  180 |       generatedAt: new Date().toISOString(),
  181 |       levelId: level.id,
  182 |       title: level.title,
  183 |       issues: [],
  184 |     };
  185 | 
  186 |     await page.goto("/", { waitUntil: "networkidle" });
  187 |     await expect(page.getByText("Neon Labyrinth")).toBeVisible();
  188 |     await expect(page.locator("canvas")).toBeVisible();
  189 |     await selectLevel(page, level);
  190 | 
  191 |     await page.screenshot({ path: `test-results/enemy-qa-level-${level.id}-start.png` });
  192 |     report.startState = await snapshotHud(page);
  193 | 
  194 |     await runRoute(page, level.catchRoute);
  195 |     await expect(page.locator(".defeat")).toBeVisible({ timeout: 10_000 });
  196 |     report.defeatState = await snapshotHud(page);
  197 |     report.defeatTitle = await page.locator("#defeat-title").innerText();
  198 |     await page.screenshot({ path: `test-results/enemy-qa-level-${level.id}-caught.png` });
  199 | 
  200 |     const hitsAfterCatch = await page.locator(".stat").nth(2).locator("strong").innerText();
  201 |     if (hitsAfterCatch !== "1") {
  202 |       report.issues.push({
  203 |         severity: "warning",
  204 |         levelId: level.id,
  205 |         message: `Expected hit counter to show 1 after defeat, got ${hitsAfterCatch}.`,
  206 |       });
  207 |     }
  208 | 
  209 |     await page.getByRole("button", { name: "Restart run" }).click();
  210 |     await expect(page.locator(".defeat")).toHaveCount(0);
  211 |     await expect(page.locator(".stat").nth(1).locator("strong")).toHaveText("0");
  212 | 
  213 |     await runRoute(page, level.finishRoute);
> 214 |     await expect(page.locator(".victory")).toBeVisible({ timeout: 10_000 });
      |                                            ^ Error: expect(locator).toBeVisible() failed
  215 |     report.victoryState = await snapshotHud(page);
  216 |     report.victoryTitle = await page.locator("#victory-title").innerText();
  217 |     await page.screenshot({ path: `test-results/enemy-qa-level-${level.id}-victory.png` });
  218 | 
  219 |     report.screenshots = {
  220 |       start: `test-results/enemy-qa-level-${level.id}-start.png`,
  221 |       caught: `test-results/enemy-qa-level-${level.id}-caught.png`,
  222 |       victory: `test-results/enemy-qa-level-${level.id}-victory.png`,
  223 |     };
  224 | 
  225 |     const outPath = resolve(process.cwd(), `test-results/enemy-qa-level-${level.id}.json`);
  226 |     mkdirSync(dirname(outPath), { recursive: true });
  227 |     writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  228 |     console.log(JSON.stringify(report, null, 2));
  229 |   });
  230 | }
  231 | 
```