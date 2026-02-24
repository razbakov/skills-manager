import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

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

export function collectionFilePath(repoPath: string, name: string): string {
  return join(repoPath, "collections", `${name}.json`);
}

export function writeCollectionFile(
  repoPath: string,
  name: string,
  skillIds: string[],
): void {
  const dir = join(repoPath, "collections");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const filePath = collectionFilePath(repoPath, name);
  const content = JSON.stringify({ name, skills: skillIds }, null, 2) + "\n";
  writeFileSync(filePath, content, "utf-8");
}

export function removeCollectionFile(repoPath: string, name: string): void {
  const filePath = collectionFilePath(repoPath, name);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

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
  const collectionsDir = "collections";

  const addResult = spawnSync(
    "git",
    ["-C", repoPath, "add", "--all", "--", collectionsDir],
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
    ["-C", repoPath, "diff", "--cached", "--quiet", "--", collectionsDir],
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
    ["-C", repoPath, "commit", "-m", commitMessage, "--", collectionsDir],
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
  skillIds: string[],
  action: CollectionAction,
): CollectionCommitResult | null {
  if (!repoPath) return null;

  if (action === "remove") {
    removeCollectionFile(repoPath, collectionName);
  } else {
    writeCollectionFile(repoPath, collectionName, skillIds);
  }

  return tryCommitCollectionChange(repoPath, collectionName, action);
}

export function syncPersonalRepo(repoPath: string): SyncResult {
  const pullResult = spawnSync(
    "git",
    ["-C", repoPath, "pull", "--rebase"],
    { encoding: "utf-8" },
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
    ["-C", repoPath, "push"],
    { encoding: "utf-8" },
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
