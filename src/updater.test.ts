import { describe, expect, it } from "bun:test";
import { getUpdateInstallArgs } from "./updater";

describe("updater install args", () => {
  it("pins runtime install to production with lockfile when available", () => {
    expect(getUpdateInstallArgs(true)).toEqual([
      "install",
      "--production",
      "--frozen-lockfile",
    ]);
  });

  it("falls back to production install without lockfile", () => {
    expect(getUpdateInstallArgs(false)).toEqual(["install", "--production"]);
  });
});
