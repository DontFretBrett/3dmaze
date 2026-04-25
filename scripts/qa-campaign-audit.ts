import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { assessCampaignLevels } from "../src/campaign/campaignAssessment";
import { CAMPAIGN_WALKTHROUGHS } from "../src/campaign/campaignWalkthrough";
import { CAMPAIGN_LEVELS } from "../src/campaign/campaignProgression";

type Severity = "warning" | "blocker";
type Category = "solvability" | "pacing" | "ux";

interface QaIssue {
  severity: Severity;
  category: Category;
  levelId?: string;
  message: string;
}

const assessments = assessCampaignLevels();
const issues: QaIssue[] = [];
const [level1, level2, level3, level4] = assessments;
const [, , walkthrough3, walkthrough4] = CAMPAIGN_WALKTHROUGHS;

assessments.forEach((assessment) => {
  if (!assessment.canReachFinish) {
    issues.push({
      severity: "blocker",
      category: "solvability",
      levelId: assessment.id,
      message: "Start cannot reach the exit.",
    });
  }

  assessment.traversalPoints.forEach((point) => {
    if (!point.reachableFromStart) {
      issues.push({
        severity: "blocker",
        category: "solvability",
        levelId: assessment.id,
        message: `${point.type} at ${point.coordinate.layer}:${point.coordinate.x}:${point.coordinate.z} is unreachable from the spawn.`,
      });
    }

    if (!point.canReachFinish) {
      issues.push({
        severity: "blocker",
        category: "solvability",
        levelId: assessment.id,
        message: `${point.type} at ${point.coordinate.layer}:${point.coordinate.x}:${point.coordinate.z} does not preserve a route to the exit.`,
      });
    }
  });
});

if (level2.shortestPathSteps <= level1.shortestPathSteps) {
  issues.push({
    severity: "blocker",
    category: "pacing",
    message: "Level 2 no longer extends the route length beyond Level 1.",
  });
}

if (level3.shortestPathVerticalMoves < 1) {
  issues.push({
    severity: "blocker",
    category: "pacing",
    message: "Level 3 no longer requires a vertical traversal step.",
  });
}

if (level4.shortestPathVerticalMoves <= level3.shortestPathVerticalMoves) {
  issues.push({
    severity: "blocker",
    category: "pacing",
    message: "Level 4 no longer increases vertical demand beyond Level 3.",
  });
}

if (level4.reachableCells <= level3.reachableCells) {
  issues.push({
    severity: "warning",
    category: "ux",
    message: "Level 4 no longer expands the explorable footprint beyond Level 3.",
  });
}

if (level4.branchSurplus <= level3.branchSurplus) {
  issues.push({
    severity: "warning",
    category: "ux",
    message: "Level 4 no longer adds branching over Level 3.",
  });
}

if ((walkthrough3.firstVerticalActionStep ?? 0) <= 1) {
  issues.push({
    severity: "warning",
    category: "ux",
    levelId: level3.id,
    message: "Level 3 introduces vertical traversal too early for a clean on-ramp.",
  });
}

if ((walkthrough4.firstVerticalActionStep ?? Number.POSITIVE_INFINITY) > (walkthrough3.firstVerticalActionStep ?? 0)) {
  issues.push({
    severity: "warning",
    category: "ux",
    levelId: level4.id,
    message: "Level 4 should demand vertical routing earlier than Level 3.",
  });
}

const levelReports = assessments.map((assessment, index) => {
  const campaignLevel = CAMPAIGN_LEVELS[index]!;
  const walkthrough = CAMPAIGN_WALKTHROUGHS[index]!;
  const blockers = issues.filter((issue) => issue.levelId === assessment.id && issue.severity === "blocker");
  const warnings = issues.filter((issue) => issue.levelId === assessment.id && issue.severity === "warning");

  return {
    id: assessment.id,
    title: assessment.title,
    band: campaignLevel.band,
    solvable: assessment.canReachFinish,
    traversalPointCount: assessment.traversalPoints.length,
    reachableTraversalPointCount: assessment.traversalPoints.filter((point) => point.reachableFromStart).length,
    finishSafeTraversalPointCount: assessment.traversalPoints.filter((point) => point.canReachFinish).length,
    metrics: {
      layerCount: assessment.layerCount,
      reachableCells: assessment.reachableCells,
      shortestPathSteps: assessment.shortestPathSteps,
      shortestPathDecisionCount: assessment.shortestPathDecisionCount,
      shortestPathVerticalMoves: assessment.shortestPathVerticalMoves,
      shortestPathHoleDrops: assessment.shortestPathHoleDrops,
      branchSurplus: assessment.branchSurplus,
      enemyPathLength: assessment.enemyPathLength,
      enemySecondsPerCell: assessment.enemySecondsPerCell,
    },
    walkthrough: {
      actionCount: walkthrough.actionCount,
      verticalActionCount: walkthrough.verticalActionCount,
      firstVerticalActionStep: walkthrough.firstVerticalActionStep,
    },
    issues: [...blockers, ...warnings],
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    authoredLevelsChecked: assessments.length,
    blockerCount: issues.filter((issue) => issue.severity === "blocker").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    status: issues.some((issue) => issue.severity === "blocker")
      ? "issues-found"
      : issues.length > 0
        ? "pass-with-notes"
        : "pass",
    pacingRamp: {
      level2LongerThanLevel1: level2.shortestPathSteps > level1.shortestPathSteps,
      level3IntroducesVerticality: level3.shortestPathVerticalMoves >= 1,
      level4IncreasesVerticality: level4.shortestPathVerticalMoves > level3.shortestPathVerticalMoves,
      level4OpensVerticalityEarlier:
        (walkthrough4.firstVerticalActionStep ?? Number.POSITIVE_INFINITY) <
        (walkthrough3.firstVerticalActionStep ?? Number.POSITIVE_INFINITY),
    },
  },
  levels: levelReports,
  issues,
};

const outPath = resolve(process.cwd(), "test-results/campaign-qa-static.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Campaign QA static audit written to ${outPath}`);
console.log(JSON.stringify(report.summary, null, 2));
issues.forEach((issue) => {
  const scope = issue.levelId ? `${issue.levelId}: ` : "";
  console.log(`[${issue.severity}] ${scope}${issue.message}`);
});
