import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  writeCollectionFile,
  removeCollectionFile,
  tryCommitCollectionChange,
  collectionFilePath,
  listCollectionFiles,
  syncPersonalRepo,
} from "./collection-sync";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { spawnSync } from "child_process";
import type { Skill } from "./types";

function makeSkill(overrides: Partial<Skill> & { name: string; sourcePath: string }): Skill {
  return {
    description: "",
    sourceName: "test-source",
    installed: true,
    disabled: false,
    unmanaged: false,
    targetStatus: {},
    ...overrides,
  };
}

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

function initBareRemoteWithClone(): { remote: string; clone: string } {
  const remote = mkdtempSync(join(tmpdir(), "collection-remote-"));
  spawnSync("git", ["init", "--bare", remote], { encoding: "utf-8" });

  const clone = mkdtempSync(join(tmpdir(), "collection-clone-"));
  rmSync(clone, { recursive: true, force: true });
  spawnSync("git", ["clone", remote, clone], { encoding: "utf-8" });
  spawnSync("git", ["-C", clone, "config", "user.email", "test@test.com"], {
    encoding: "utf-8",
  });
  spawnSync("git", ["-C", clone, "config", "user.name", "Test"], {
    encoding: "utf-8",
  });
  spawnSync(
    "git",
    ["-C", clone, "commit", "--allow-empty", "-m", "initial"],
    { encoding: "utf-8" },
  );
  spawnSync("git", ["-C", clone, "push"], { encoding: "utf-8" });

  return { remote, clone };
}

describe("collectionFilePath", () => {
  it("returns path in repo root with .json extension", () => {
    const result = collectionFilePath("/repo", "Writing");
    expect(result).toBe(join("/repo", "Writing.json"));
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

  it("writes export-format JSON in repo root", () => {
    const skills = [
      makeSkill({ name: "research", sourcePath: "/skills/research", description: "Research skill" }),
      makeSkill({ name: "brainstorming", sourcePath: "/skills/brainstorming", description: "Brainstorming skill" }),
    ];
    writeCollectionFile(root, "Writing", skills);

    const filePath = join(root, "Writing.json");
    expect(existsSync(filePath)).toBe(true);

    const content = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(content.schemaVersion).toBe(3);
    expect(content.generatedAt).toBeDefined();
    expect(content.installedSkills).toHaveLength(2);
    expect(content.installedSkills[0].name).toBe("brainstorming");
    expect(content.installedSkills[1].name).toBe("research");
  });

  it("overwrites an existing file for the same collection", () => {
    const skill1 = makeSkill({ name: "research", sourcePath: "/skills/research" });
    const skill2 = makeSkill({ name: "brainstorming", sourcePath: "/skills/brainstorming" });
    writeCollectionFile(root, "Writing", [skill1]);
    writeCollectionFile(root, "Writing", [skill1, skill2]);

    const filePath = join(root, "Writing.json");
    const content = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(content.installedSkills).toHaveLength(2);
  });

  it("writes valid JSON with 2-space indentation", () => {
    const skills = [makeSkill({ name: "a", sourcePath: "/skills/a" })];
    writeCollectionFile(root, "My Group", skills);

    const raw = readFileSync(join(root, "My Group.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(raw).toBe(JSON.stringify(parsed, null, 2) + "\n");
    expect(parsed.schemaVersion).toBe(3);
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
    writeCollectionFile(root, "Writing", [makeSkill({ name: "a", sourcePath: "/skills/a" })]);
    const filePath = join(root, "Writing.json");
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
    writeCollectionFile(root, "Writing", [makeSkill({ name: "a", sourcePath: "/skills/a" })]);
    const result = tryCommitCollectionChange(root, "Writing", "add");

    expect(result.committed).toBe(true);
    expect(result.message).toContain("add Writing");

    const log = spawnSync("git", ["-C", root, "log", "--oneline"], {
      encoding: "utf-8",
    });
    expect(log.stdout).toContain("chore(collections): add Writing");
  });

  it("commits collection file removal", () => {
    writeCollectionFile(root, "Coding", [makeSkill({ name: "b", sourcePath: "/skills/b" })]);
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
  });

  it("commits rename (old removed, new added)", () => {
    const skill = makeSkill({ name: "a", sourcePath: "/skills/a" });
    writeCollectionFile(root, "OldName", [skill]);
    tryCommitCollectionChange(root, "OldName", "add");

    removeCollectionFile(root, "OldName");
    writeCollectionFile(root, "NewName", [skill]);
    const result = tryCommitCollectionChange(root, "NewName", "rename");

    expect(result.committed).toBe(true);

    const log = spawnSync("git", ["-C", root, "log", "--oneline"], {
      encoding: "utf-8",
    });
    expect(log.stdout).toContain("chore(collections): rename NewName");
  });
});

describe("syncPersonalRepo", () => {
  let remote: string;
  let clone: string;

  beforeEach(() => {
    const repos = initBareRemoteWithClone();
    remote = repos.remote;
    clone = repos.clone;
  });

  afterEach(() => {
    rmSync(remote, { recursive: true, force: true });
    rmSync(clone, { recursive: true, force: true });
  });

  it("pulls and pushes local commits to origin", () => {
    writeCollectionFile(clone, "Writing", [makeSkill({ name: "a", sourcePath: "/skills/a" })]);
    tryCommitCollectionChange(clone, "Writing", "add");

    const result = syncPersonalRepo(clone);

    expect(result.pulled).toBe(true);
    expect(result.pushed).toBe(true);
    expect(result.message).toBe("Synced with remote.");

    const remoteLog = spawnSync(
      "git",
      ["--git-dir", remote, "log", "--oneline"],
      { encoding: "utf-8" },
    );
    expect(remoteLog.stdout).toContain("chore(collections): add Writing");
  });

  it("returns pushed=false when no remote is configured", () => {
    const local = mkdtempSync(join(tmpdir(), "collection-no-remote-"));
    initGitRepo(local);

    try {
      writeCollectionFile(local, "Test", [makeSkill({ name: "a", sourcePath: "/skills/a" })]);
      tryCommitCollectionChange(local, "Test", "add");

      const result = syncPersonalRepo(local);
      expect(result.pulled).toBe(false);
      expect(result.pushed).toBe(false);
      expect(result.message).toContain("Pull failed");
    } finally {
      rmSync(local, { recursive: true, force: true });
    }
  });

  it("succeeds with nothing to push", () => {
    const result = syncPersonalRepo(clone);

    expect(result.pulled).toBe(true);
    expect(result.pushed).toBe(true);
    expect(result.message).toBe("Synced with remote.");
  });
});

describe("listCollectionFiles", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "collection-list-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("returns collection files matching the manifest schema", () => {
    const skills = [
      makeSkill({ name: "atlassian", sourcePath: "/skills/atlassian" }),
      makeSkill({ name: "estimation", sourcePath: "/skills/estimation" }),
    ];
    writeCollectionFile(root, "ommax-dev", skills);

    const collections = listCollectionFiles(root);
    expect(collections).toHaveLength(1);
    expect(collections[0].name).toBe("ommax-dev");
    expect(collections[0].file).toBe("ommax-dev.json");
    expect(collections[0].skillNames).toEqual(["atlassian", "estimation"]);
  });

  it("ignores non-manifest JSON files", () => {
    writeFileSync(join(root, "package.json"), '{"name":"test"}', "utf-8");
    writeFileSync(join(root, "tsconfig.json"), '{"compilerOptions":{}}', "utf-8");

    const collections = listCollectionFiles(root);
    expect(collections).toHaveLength(0);
  });

  it("returns empty array for non-existent directory", () => {
    const collections = listCollectionFiles("/tmp/nonexistent-path-xyz");
    expect(collections).toHaveLength(0);
  });

  it("sorts collections alphabetically", () => {
    const skill = makeSkill({ name: "a", sourcePath: "/skills/a" });
    writeCollectionFile(root, "writing", [skill]);
    writeCollectionFile(root, "coding", [skill]);

    const collections = listCollectionFiles(root);
    expect(collections.map((c) => c.name)).toEqual(["coding", "writing"]);
  });
});
