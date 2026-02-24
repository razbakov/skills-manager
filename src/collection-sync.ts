import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import type { Skill } from "./types";
import { buildInstalledSkillsManifest } from "./export";

export interface CollectionCommitResult {
  committed: boolean;
  message: string;
}

export interface SyncResult {
  pulled: boolean;
  pushed: boolean;
  message: string;
}

export type CollectionAction = "add" | "update" | "remove" | "rename";

export interface CollectionSkillEntry {
  name: string;
  description: string;
  repoUrl?: string;
  skillPath?: string;
}

export interface CollectionPreview {
  name: string;
  file: string;
  skillNames: string[];
  skills: CollectionSkillEntry[];
}

export function listCollectionFiles(sourcePath: string): CollectionPreview[] {
  if (!existsSync(sourcePath)) return [];

  const entries: CollectionPreview[] = [];
  let files: string[];
  try {
    files = readdirSync(sourcePath).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }

  for (const file of files) {
    try {
      const raw = readFileSync(join(sourcePath, file), "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed.schemaVersion !== 3 || !Array.isArray(parsed.installedSkills)) continue;

      const skills: CollectionSkillEntry[] = [];
      for (const s of parsed.installedSkills as Array<Record<string, unknown>>) {
        const name = typeof s.name === "string" ? s.name : "";
        if (!name) continue;
        const install = s.install as Record<string, unknown> | undefined;
        skills.push({
          name,
          description: typeof s.description === "string" ? s.description : "",
          ...(typeof install?.repoUrl === "string" ? { repoUrl: install.repoUrl } : {}),
          ...(typeof install?.skillPath === "string" ? { skillPath: install.skillPath } : {}),
        });
      }

      entries.push({
        name: basename(file, ".json"),
        file,
        skillNames: skills.map((s) => s.name),
        skills,
      });
    } catch {
      continue;
    }
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export function collectionFilePath(repoPath: string, name: string): string {
  return join(repoPath, `${name}.json`);
}

export function writeCollectionFile(
  repoPath: string,
  name: string,
  skills: Skill[],
): void {
  const filePath = collectionFilePath(repoPath, name);
  const manifest = buildInstalledSkillsManifest(skills);
  const content = JSON.stringify(manifest, null, 2) + "\n";
  writeFileSync(filePath, content, "utf-8");
}

export function removeCollectionFile(repoPath: string, name: string): void {
  const filePath = collectionFilePath(repoPath, name);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

function cleanGitEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  delete env.GIT_ASKPASS;
  delete env.GIT_TERMINAL_PROMPT;
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.VSCODE_GIT_ASKPASS_MAIN;
  delete env.VSCODE_GIT_ASKPASS_NODE;
  delete env.VSCODE_GIT_ASKPASS_EXTRA_ARGS;
  delete env.VSCODE_GIT_IPC_HANDLE;
  return env;
}

const SSH_REWRITE_CONFIG = "url.git@github.com:.insteadOf=https://github.com/";

function formatGitFailure(result: ReturnType<typeof spawnSync>): string {
  const stderr = result.stderr?.toString().trim();
  const stdout = result.stdout?.toString().trim();
  if (stderr) return stderr;
  if (stdout) return stdout;
  if (result.error?.message) return result.error.message;
  return "Unknown git error.";
}

export function tryCommitCollectionChange(
  repoPath: string,
  collectionName: string,
  action: CollectionAction,
): CollectionCommitResult {
  const filePattern = `${collectionName}.json`;

  const addResult = spawnSync(
    "git",
    ["-C", repoPath, "add", "--all", "--", filePattern],
    { encoding: "utf-8" },
  );
  if (addResult.error || addResult.status !== 0) {
    return {
      committed: false,
      message: `Collection saved, but git add failed: ${formatGitFailure(addResult)}`,
    };
  }

  const diffResult = spawnSync(
    "git",
    ["-C", repoPath, "diff", "--cached", "--quiet", "--", filePattern],
    { encoding: "utf-8" },
  );
  if (diffResult.status === 0) {
    return {
      committed: false,
      message: "No changes to commit.",
    };
  }
  if (diffResult.error || diffResult.status !== 1) {
    return {
      committed: false,
      message: `Collection saved, but git diff failed: ${formatGitFailure(diffResult)}`,
    };
  }

  const commitMessage = `chore(collections): ${action} ${collectionName}`;
  const commitResult = spawnSync(
    "git",
    ["-C", repoPath, "commit", "-m", commitMessage, "--", filePattern],
    { encoding: "utf-8" },
  );
  if (commitResult.error || commitResult.status !== 0) {
    return {
      committed: false,
      message: `Collection saved, but git commit failed: ${formatGitFailure(commitResult)}`,
    };
  }

  return {
    committed: true,
    message: commitMessage,
  };
}

export function syncCollectionToRepo(
  repoPath: string | undefined,
  collectionName: string,
  skills: Skill[],
  action: CollectionAction,
): CollectionCommitResult | null {
  if (!repoPath) return null;

  if (action === "remove") {
    removeCollectionFile(repoPath, collectionName);
  } else {
    writeCollectionFile(repoPath, collectionName, skills);
  }

  return tryCommitCollectionChange(repoPath, collectionName, action);
}

export function syncPersonalRepo(repoPath: string): SyncResult {
  const env = cleanGitEnv();
  const opts = { encoding: "utf-8" as const, env };

  const pullResult = spawnSync(
    "git",
    ["-C", repoPath, "-c", SSH_REWRITE_CONFIG, "pull", "--rebase"],
    opts,
  );
  if (pullResult.error || pullResult.status !== 0) {
    return {
      pulled: false,
      pushed: false,
      message: `Pull failed: ${formatGitFailure(pullResult)}`,
    };
  }

  const pushResult = spawnSync(
    "git",
    ["-C", repoPath, "-c", SSH_REWRITE_CONFIG, "push"],
    opts,
  );
  if (pushResult.error || pushResult.status !== 0) {
    return {
      pulled: true,
      pushed: false,
      message: `Pulled, but push failed: ${formatGitFailure(pushResult)}`,
    };
  }

  return {
    pulled: true,
    pushed: true,
    message: "Synced with remote.",
  };
}
