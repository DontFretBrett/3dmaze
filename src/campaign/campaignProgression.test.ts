import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_LEVEL_IDS,
  DEFAULT_CAMPAIGN_LEVEL_ID,
  getCampaignLevel,
  getNextCampaignLevelId,
} from "./campaignProgression";

describe("campaign progression", () => {
  it("starts on level 1 and exposes all four authored campaign slots", () => {
    expect(DEFAULT_CAMPAIGN_LEVEL_ID).toBe(1);
    expect(CAMPAIGN_LEVEL_IDS).toEqual([1, 2, 3, 4]);
  });

  it("advances one level at a time until the campaign is complete", () => {
    expect(getNextCampaignLevelId(1)).toBe(2);
    expect(getNextCampaignLevelId(2)).toBe(3);
    expect(getNextCampaignLevelId(3)).toBe(4);
    expect(getNextCampaignLevelId(4)).toBeNull();
  });

  it("keeps metadata aligned with the authored campaign order", () => {
    expect(CAMPAIGN_LEVEL_IDS.map((id) => getCampaignLevel(id).title)).toEqual([
      "Neon Run",
      "Switchback Grid",
      "Vertical Drift",
      "Prism Spire",
    ]);
  });
});
