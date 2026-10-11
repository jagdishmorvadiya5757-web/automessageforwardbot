import { describe, expect, it } from "vitest";
import { DAILY_CODE_LIMIT, istDayStartIso } from "./phone-limit";

describe("phone sign-in daily limit", () => {
  it("allows 3 codes per number per day", () => {
    expect(DAILY_CODE_LIMIT).toBe(3);
  });

  it("resets at India midnight (18:30 UTC)", () => {
    // 2026-10-11 14:18 IST = 08:48 UTC -> day began 2026-10-10 18:30 UTC
    expect(istDayStartIso(Date.UTC(2026, 9, 11, 8, 48))).toBe("2026-10-10T18:30:00.000Z");
    // 00:10 IST on Oct 12 = 18:40 UTC Oct 11 -> new day
    expect(istDayStartIso(Date.UTC(2026, 9, 11, 18, 40))).toBe("2026-10-11T18:30:00.000Z");
  });
});
