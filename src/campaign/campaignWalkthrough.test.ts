import { describe, expect, it } from "vitest";
import { assessCampaignLevels } from "./campaignAssessment";
import { CAMPAIGN_WALKTHROUGHS } from "./campaignWalkthrough";

describe("campaign walkthroughs", () => {
  const assessments = assessCampaignLevels();
  const [level1, level2, level3, level4] = CAMPAIGN_WALKTHROUGHS;

  it("keeps one shortest-route walkthrough per authored level", () => {
    expect(CAMPAIGN_WALKTHROUGHS).toHaveLength(assessments.length);

    CAMPAIGN_WALKTHROUGHS.forEach((walkthrough, index) => {
      const assessment = assessments[index];
      expect(assessment).toBeDefined();
      expect(walkthrough.id).toBe(index + 1);
      expect(walkthrough.title).toBe(assessment!.title);
      expect(walkthrough.actionCount).toBe(assessment!.shortestPathSteps);
      expect(walkthrough.path).toHaveLength(assessment!.shortestPathSteps + 1);
    });
  });

  it("keeps early levels flat and introduces vertical routing earlier in level 4 than level 3", () => {
    expect(level1.verticalActionCount).toBe(0);
    expect(level2.verticalActionCount).toBe(0);
    expect(level3.verticalActionCount).toBeGreaterThan(0);
    expect(level4.verticalActionCount).toBeGreaterThan(level3.verticalActionCount);
    expect(level3.firstVerticalActionStep).not.toBeNull();
    expect(level4.firstVerticalActionStep).not.toBeNull();
    expect(level4.firstVerticalActionStep!).toBeLessThan(level3.firstVerticalActionStep!);
  });
});
