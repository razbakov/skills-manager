import { describe, expect, it } from "vitest";
import { isWslEnvironment, shouldUseWslForInstall } from "./platform";

describe("isWslEnvironment", () => {
  it("detects WSL by env var", () => {
    expect(
      isWslEnvironment("linux", { WSL_DISTRO_NAME: "Ubuntu" } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it("returns false without WSL markers on non-linux platform", () => {
    expect(isWslEnvironment("darwin", {} as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("shouldUseWslForInstall", () => {
  it("returns true on native Windows", () => {
    expect(shouldUseWslForInstall("win32", {} as NodeJS.ProcessEnv)).toBe(true);
  });

  it("returns false inside WSL markers", () => {
    expect(
      shouldUseWslForInstall(
        "win32",
        { WSL_INTEROP: "/run/WSL/1_interop" } as NodeJS.ProcessEnv,
      ),
    ).toBe(false);
  });

  it("returns false on non-Windows platforms", () => {
    expect(shouldUseWslForInstall("linux", {} as NodeJS.ProcessEnv)).toBe(false);
  });
});
