import { describe, expect, it } from "vitest";
import { summarizeLabels } from "../src/label-summary";

describe("label summary", () => {
  it("keeps three labels visible and reports every remaining label", () => {
    expect(summarizeLabels(["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9"])).toEqual({
      visible: ["l1", "l2", "l3"],
      hidden: ["l4", "l5", "l6", "l7", "l8", "l9"]
    });
  });

  it("does not invent overflow for three or fewer labels", () => {
    expect(summarizeLabels(["l1", "l2", "l3"])).toEqual({ visible: ["l1", "l2", "l3"], hidden: [] });
  });
});

