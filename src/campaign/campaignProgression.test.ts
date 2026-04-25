import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_LEVEL_IDS,
  DEFAULT_CAMPAIGN_LEVEL_ID,
  getCampaignLevel,
  getNextCampaignLevelId,
} from "./campaignProgression";

describe("campaign progression", () => {
  it("starts on level 1 and exposes all ten authored campaign slots", () => {
    expect(DEFAULT_CAMPAIGN_LEVEL_ID).toBe(1);
    expect(CAMPAIGN_LEVEL_IDS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("advances one level at a time until the campaign is complete", () => {
    CAMPAIGN_LEVEL_IDS.slice(0, -1).forEach((id, index) => {
      expect(getNextCampaignLevelId(id)).toBe(CAMPAIGN_LEVEL_IDS[index + 1]);
    });
    expect(getNextCampaignLevelId(10)).toBeNull();
  });

  it("keeps metadata aligned with the authored campaign order", () => {
    expect(CAMPAIGN_LEVEL_IDS.map((id) => getCampaignLevel(id).title)).toEqual([
      "Neon Run",
      "Switchback Grid",
      "Vertical Drift",
      "Prism Spire",
      "Orbital Shell",
      "Gravity Cube",
      "Helix Ramp",
      "Pyramid Fold",
      "Mirror Vault",
      "Astral Nexus",
    ]);
  });
});
