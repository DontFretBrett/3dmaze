import { describe, expect, it } from "vitest";
import { assessCampaignLevels } from "./campaignAssessment";

describe("campaign assessment", () => {
  const assessments = assessCampaignLevels();
  const [level1, level2, level3, level4] = assessments;
  const finalLevel = assessments.at(-1)!;

  it("keeps every authored level solvable and every traversal feature usable without soft-locking the exit", () => {
    assessments.forEach((assessment) => {
      expect(assessment.canReachFinish, `${assessment.id} should remain completable from its start`).toBe(true);

      assessment.traversalPoints.forEach((point) => {
        expect(point.reachableFromStart, `${assessment.id} ${point.type} at ${point.coordinate.layer}:${point.coordinate.x}:${point.coordinate.z} should be reachable`).toBe(true);
        expect(point.canReachFinish, `${assessment.id} ${point.type} at ${point.coordinate.layer}:${point.coordinate.x}:${point.coordinate.z} should preserve a route to the exit`).toBe(true);
        expect(point.entryCount, `${assessment.id} ${point.type} at ${point.coordinate.layer}:${point.coordinate.x}:${point.coordinate.z} should have a usable approach`).toBeGreaterThan(0);
        expect(point.landing, `${assessment.id} ${point.type} at ${point.coordinate.layer}:${point.coordinate.x}:${point.coordinate.z} should resolve to a stable cell`).not.toBeNull();
      });
    });
  });

  it("ramps complexity by introducing longer routing first, then deeper expert layouts", () => {
    expect(level1.layerCount).toBe(1);
    expect(level2.layerCount).toBe(1);
    expect(level3.layerCount).toBe(2);
    expect(level4.layerCount).toBe(3);
    expect(finalLevel.layerCount).toBeGreaterThan(level4.layerCount);

    expect(level2.shortestPathSteps).toBeGreaterThan(level1.shortestPathSteps);
    expect(level1.shortestPathVerticalMoves).toBe(0);
    expect(level2.shortestPathVerticalMoves).toBe(0);
    expect(level3.shortestPathVerticalMoves).toBeGreaterThanOrEqual(1);
    expect(level4.shortestPathVerticalMoves).toBeGreaterThan(level3.shortestPathVerticalMoves);

    expect(level3.reachableCells).toBeGreaterThan(level2.reachableCells);
    expect(level4.reachableCells).toBeGreaterThan(level3.reachableCells);
    expect(level3.branchSurplus).toBeGreaterThan(level2.branchSurplus);
    expect(level4.branchSurplus).toBeGreaterThan(level3.branchSurplus);

    expect(level3.enemyPathLength).toBeGreaterThan(0);
    expect(level4.enemyPathLength).toBeGreaterThan(level3.enemyPathLength);
    expect(level3.enemySecondsPerCell).not.toBeNull();
    expect(level4.enemySecondsPerCell).not.toBeNull();
    expect(level4.enemySecondsPerCell!).toBeLessThan(level3.enemySecondsPerCell!);
    expect(finalLevel.enemySecondsPerCell).not.toBeNull();
    expect(finalLevel.enemySecondsPerCell!).toBeLessThan(level4.enemySecondsPerCell!);
  });

  it("keeps hole traversal optional on the shortest path even after vertical mechanics arrive", () => {
    expect(level1.shortestPathHoleDrops).toBe(0);
    expect(level2.shortestPathHoleDrops).toBe(0);
    expect(level3.shortestPathHoleDrops).toBe(0);
    expect(level4.shortestPathHoleDrops).toBe(0);

    expect(level3.traversalPoints.some((point) => point.type === "hole")).toBe(true);
    expect(level4.traversalPoints.some((point) => point.type === "hole")).toBe(true);
    expect(finalLevel.traversalPoints.some((point) => point.type === "hole")).toBe(true);
  });
});
