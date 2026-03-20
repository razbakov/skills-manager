import { spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join, resolve } from "path";
import type { Source } from "./types";

interface SourceUpdateEntry {
  lastUpdatedAt: string;
}

interface SourceUpdateState {
  version: number;
  sources: Record<string, SourceUpdateEntry>;
}

const SOURCE_UPDATE_STATE_VERSION = 1;
const DEFAULT_SOURCE_UPDATE_STATE_PATH = join(
  homedir(),
  ".cache",
  "skill-mix",
  "source-update-state.json",
);

function resolveUserPath(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "~") return homedir();
  if (trimmed.startsWith("~/")) return join(homedir(), trimmed.slice(2));
  return resolve(trimmed);
}

const SOURCE_UPDATE_STATE_PATH = resolveUserPath(
  process.env.SKILLS_MANAGER_SOURCE_UPDATE_STATE_PATH || DEFAULT_SOURCE_UPDATE_STATE_PATH,
);

function normalizeSourcePath(sourcePath: string): string {
  return resolve(sourcePath).replace(/\/+$/g, "");
}

function emptySourceUpdateState(): SourceUpdateState {
  return {
    version: SOURCE_UPDATE_STATE_VERSION,
    sources: {},
  };
}

function sourceStateKey(sourcePath: string): string {
  return normalizeSourcePath(sourcePath);
}

function loadSourceUpdateState(statePath: string): SourceUpdateState {
  if (!existsSync(statePath)) return emptySourceUpdateState();

  try {
    const raw = readFileSync(statePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<SourceUpdateState>;
    if (parsed.version !== SOURCE_UPDATE_STATE_VERSION) return emptySourceUpdateState();
    if (!parsed.sources || typeof parsed.sources !== "object") {
      return emptySourceUpdateState();
    }
    return {
      version: SOURCE_UPDATE_STATE_VERSION,
      sources: parsed.sources as Record<string, SourceUpdateEntry>,
    };
  } catch {
    return emptySourceUpdateState();
  }
}

function saveSourceUpdateState(state: SourceUpdateState, statePath: string): void {
  try {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
  } catch {
    // State is best effort.
  }
}

export function parseAheadBehindCounts(raw: string): { ahead: number; behind: number } | null {
  const parts = raw.trim().split(/\s+/);
  if (parts.length < 2) return null;

  const ahead = Number(parts[0]);
  const behind = Number(parts[1]);
  if (!Number.isFinite(ahead) || !Number.isFinite(behind)) return null;

  return { ahead, behind };
}

export function parsePendingCommitCount(raw: string): number | null {
  const value = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(value) ? value : null;
}

export function getAheadBehind(repoPath: string): { ahead: number; behind: number } | null {
  try {
    const result = spawnSync(
      "git",
      ["-C", resolve(repoPath), "rev-list", "--left-right", "--count", "HEAD...@{u}"],
      { encoding: "utf-8", timeout: 5000 },
    );
    if (result.error || result.status !== 0 || !result.stdout.trim()) return null;
    return parseAheadBehindCounts(result.stdout);
  } catch {
    return null;
  }
}

export function getPendingCommitCount(repoPath: string): number | undefined {
  try {
    const result = spawnSync(
      "git",
      ["-C", resolve(repoPath), "rev-list", "--count", "HEAD..@{u}"],
      { encoding: "utf-8", timeout: 5000 },
    );
    if (result.error || result.status !== 0 || !result.stdout.trim()) return undefined;

    const parsed = parsePendingCommitCount(result.stdout);
    if (parsed === null || parsed <= 0) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function getRepoLastCommitAt(repoPath: string): string | undefined {
  try {
    const result = spawnSync(
      "git",
      ["-C", resolve(repoPath), "log", "-1", "--format=%cI"],
      { encoding: "utf-8", timeout: 5000 },
    );
    if (result.error || result.status !== 0 || !result.stdout.trim()) return undefined;
    return result.stdout.trim();
  } catch {
    return undefined;
  }
}

export function findConfiguredSource(sourceId: string, sources: Source[]): Source | undefined {
  const sourcePath = normalizeSourcePath(sourceId);
  return sources.find((source) => normalizeSourcePath(source.path) === sourcePath);
}

export function readLastUpdatedAt(
  sourcePath: string,
  statePath: string = SOURCE_UPDATE_STATE_PATH,
): string | undefined {
  const state = loadSourceUpdateState(statePath);
  return state.sources[sourceStateKey(sourcePath)]?.lastUpdatedAt;
}

export function writeLastUpdatedAt(
  sourcePath: string,
  updatedAt: string,
  statePath: string = SOURCE_UPDATE_STATE_PATH,
): void {
  const state = loadSourceUpdateState(statePath);
  state.sources[sourceStateKey(sourcePath)] = { lastUpdatedAt: updatedAt };
  saveSourceUpdateState(state, statePath);
}
