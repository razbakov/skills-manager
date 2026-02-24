import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  writeCollectionFile,
  removeCollectionFile,
  tryCommitCollectionChange,
  collectionFilePath,
} from "./collection-sync";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { spawnSync } from "child_process";

function initGitRepo(dir: string): void {
  spawnSync("git", ["init", dir], { encoding: "utf-8" });
  spawnSync("git", ["-C", dir, "config", "user.email", "test@test.com"], {
    encoding: "utf-8",
  });
  spawnSync("git", ["-C", dir, "config", "user.name", "Test"], {
    encoding: "utf-8",
  });
  spawnSync(
    "git",
    ["-C", dir, "commit", "--allow-empty", "-m", "initial"],
    { encoding: "utf-8" },
  );
}

describe("collectionFilePath", () => {
  it("returns path under collections/ with .json extension", () => {
    const result = collectionFilePath("/repo", "Writing");
    expect(result).toBe(join("/repo", "collections", "Writing.json"));
  });
});

describe("writeCollectionFile", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "collection-sync-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("creates collections directory and writes JSON file", () => {
    writeCollectionFile(root, "Writing", ["/skills/research", "/skills/brainstorming"]);

    const filePath = join(root, "collections", "Writing.json");
    expect(existsSync(filePath)).toBe(true);

    const content = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(content).toEqual({
      name: "Writing",
      skills: ["/skills/research", "/skills/brainstorming"],
    });
  });

  it("overwrites an existing file for the same collection", () => {
    writeCollectionFile(root, "Writing", ["/skills/research"]);
    writeCollectionFile(root, "Writing", ["/skills/research", "/skills/brainstorming"]);

    const filePath = join(root, "collections", "Writing.json");
    const content = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(content.skills).toEqual(["/skills/research", "/skills/brainstorming"]);
  });

  it("writes valid JSON with 2-space indentation", () => {
    writeCollectionFile(root, "My Group", ["/skills/a"]);

    const raw = readFileSync(join(root, "collections", "My Group.json"), "utf-8");
    expect(raw).toBe(
      JSON.stringify({ name: "My Group", skills: ["/skills/a"] }, null, 2) + "\n",
    );
  });
});

describe("removeCollectionFile", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "collection-sync-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("deletes the collection JSON file", () => {
    writeCollectionFile(root, "Writing", ["/skills/a"]);
    const filePath = join(root, "collections", "Writing.json");
    expect(existsSync(filePath)).toBe(true);

    removeCollectionFile(root, "Writing");
    expect(existsSync(filePath)).toBe(false);
  });

  it("does nothing when the file does not exist", () => {
    expect(() => removeCollectionFile(root, "NonExistent")).not.toThrow();
  });
});

describe("tryCommitCollectionChange", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "collection-sync-"));
    initGitRepo(root);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("commits a new collection file", () => {
    writeCollectionFile(root, "Writing", ["/skills/a"]);
    const result = tryCommitCollectionChange(root, "Writing", "add");

    expect(result.committed).toBe(true);

    const log = spawnSync("git", ["-C", root, "log", "--oneline"], {
      encoding: "utf-8",
    });
    expect(log.stdout).toContain("chore(collections): add Writing");
  });

  it("commits collection file removal", () => {
    writeCollectionFile(root, "Coding", ["/skills/b"]);
    tryCommitCollectionChange(root, "Coding", "add");

    removeCollectionFile(root, "Coding");
    const result = tryCommitCollectionChange(root, "Coding", "remove");

    expect(result.committed).toBe(true);

    const log = spawnSync("git", ["-C", root, "log", "--oneline"], {
      encoding: "utf-8",
    });
    expect(log.stdout).toContain("chore(collections): remove Coding");
  });

  it("returns committed=false when there are no staged changes", () => {
    writeCollectionFile(root, "Empty", []);
    tryCommitCollectionChange(root, "Empty", "add");

    const result = tryCommitCollectionChange(root, "Empty", "update");
    expect(result.committed).toBe(false);
    expect(result.pushed).toBe(false);
  });

  it("commits rename (old removed, new added)", () => {
    writeCollectionFile(root, "OldName", ["/skills/a"]);
    tryCommitCollectionChange(root, "OldName", "add");

    removeCollectionFile(root, "OldName");
    writeCollectionFile(root, "NewName", ["/skills/a"]);
    const result = tryCommitCollectionChange(root, "NewName", "rename");

    expect(result.committed).toBe(true);

    const log = spawnSync("git", ["-C", root, "log", "--oneline"], {
      encoding: "utf-8",
    });
    expect(log.stdout).toContain("chore(collections): rename NewName");
  });

  it("reports pushed=false when no remote is configured", () => {
    writeCollectionFile(root, "NoRemote", ["/skills/a"]);
    const result = tryCommitCollectionChange(root, "NoRemote", "add");

    expect(result.committed).toBe(true);
    expect(result.pushed).toBe(false);
    expect(result.message).toContain("push failed");
  });
});
