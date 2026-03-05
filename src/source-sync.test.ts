import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import type { Source } from "./types";
import {
  findConfiguredSource,
  parseAheadBehindCounts,
  parsePendingCommitCount,
  readLastUpdatedAt,
  writeLastUpdatedAt,
} from "./source-sync";

describe("source-sync", () => {
  let root = "";

  afterEach(() => {
    if (root) {
      rmSync(root, { recursive: true, force: true });
      root = "";
    }
  });

  it("parses ahead/behind count output", () => {
    expect(parseAheadBehindCounts("2 3\n")).toEqual({ ahead: 2, behind: 3 });
    expect(parseAheadBehindCounts("0 0\n")).toEqual({ ahead: 0, behind: 0 });
    expect(parseAheadBehindCounts("invalid")).toBeNull();
  });

  it("parses pending commit count output", () => {
    expect(parsePendingCommitCount("5\n")).toBe(5);
    expect(parsePendingCommitCount("0\n")).toBe(0);
    expect(parsePendingCommitCount("nope")).toBeNull();
  });

  it("matches only configured sources by resolved path", () => {
    const sources: Source[] = [
      { name: "one", path: "/tmp/one", recursive: true },
      { name: "two", path: "/tmp/two" },
    ];

    expect(findConfiguredSource("/tmp/one/", sources)?.name).toBe("one");
    expect(findConfiguredSource("/tmp/three", sources)).toBeUndefined();
  });

  it("stores and loads last updated timestamps", () => {
    root = mkdtempSync(join(tmpdir(), "source-sync-state-"));
    const statePath = join(root, "source-update-state.json");
    const sourcePath = resolve("/tmp/source-a");

    expect(readLastUpdatedAt(sourcePath, statePath)).toBeUndefined();

    writeLastUpdatedAt(sourcePath, "2026-03-05T10:00:00.000Z", statePath);

    expect(readLastUpdatedAt(sourcePath, statePath)).toBe("2026-03-05T10:00:00.000Z");
  });
});
