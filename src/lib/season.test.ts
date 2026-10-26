import { afterEach, describe, expect, it } from "vitest";
import { applySeason, currentSeason, seasonOn } from "./season";

describe("tema de Halloween", () => {
  afterEach(() => {
    delete document.documentElement.dataset.season;
  });

  it("dura 15 días: del 26 de octubre al 9 de noviembre de 2026", () => {
    expect(seasonOn(new Date(2026, 9, 25, 23, 59))).toBeNull();
    expect(seasonOn(new Date(2026, 9, 26, 0, 0))).toBe("halloween");
    expect(seasonOn(new Date(2026, 9, 31, 12, 0))).toBe("halloween");
    expect(seasonOn(new Date(2026, 10, 9, 23, 59))).toBe("halloween");
    expect(seasonOn(new Date(2026, 10, 10, 0, 0))).toBeNull();
    expect(seasonOn(new Date(2027, 9, 31, 12, 0))).toBeNull();
  });

  it("se pone y se quita solo en <html>", () => {
    expect(applySeason(new Date(2026, 9, 31))).toBe("halloween");
    expect(currentSeason()).toBe("halloween");
    expect(document.documentElement.dataset.season).toBe("halloween");
    expect(applySeason(new Date(2026, 10, 10))).toBeNull();
    expect(currentSeason()).toBeNull();
  });
});
