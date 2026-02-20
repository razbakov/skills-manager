import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { isAbsolute, join, relative } from "path";
import { homedir } from "os";
import yaml from "js-yaml";
import type { Config, Source } from "./types";

const CONFIG_DIR = join(homedir(), ".config", "skills-manager");
const CONFIG_PATH = join(CONFIG_DIR, "config.yaml");
const DEFAULT_SOURCES_ROOT_PATH = join(homedir(), ".skills-manager", "sources");

function normalizePathForMatch(path: string): string {
  return expandTilde(path).replace(/\/+$/g, "").toLowerCase();
}

function isSourcesRootSource(source: Source): boolean {
  return (
    source.name.toLowerCase() === "sources" ||
    normalizePathForMatch(source.path) === normalizePathForMatch(DEFAULT_SOURCES_ROOT_PATH)
  );
}

function isPathWithin(path: string, root: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function hasSourceWithinSourcesRoot(sources: Source[]): boolean {
  const rootPath = expandTilde(DEFAULT_SOURCES_ROOT_PATH);
  return sources.some((source) => isPathWithin(expandTilde(source.path), rootPath));
}

export function expandTilde(p: string): string {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  if (p === "~") return homedir();
  return p;
}

export function getDefaultSourcesRootPath(): string {
  return DEFAULT_SOURCES_ROOT_PATH;
}

export function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      `Config not found at ${CONFIG_PATH}\nCreate it with sources and targets.`,
    );
  }

  const raw = readFileSync(CONFIG_PATH, "utf-8");
  const parsed = (yaml.load(raw) as Record<string, unknown> | null) || {};

  const sourceEntries = Array.isArray(parsed.sources) ? parsed.sources : [];
  const sources = sourceEntries
    .filter(
      (entry): entry is Record<string, unknown> =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as Record<string, unknown>).name === "string" &&
        typeof (entry as Record<string, unknown>).path === "string",
    )
    .map((s) => ({
      name: s.name as string,
      path: expandTilde(s.path as string),
      recursive: (s.recursive as boolean) ?? false,
      ...(typeof s.url === "string" && s.url ? { url: s.url } : {}),
    }));

  if (!sources.some(isSourcesRootSource) && !hasSourceWithinSourcesRoot(sources)) {
    sources.push({
      name: "sources",
      path: DEFAULT_SOURCES_ROOT_PATH,
      recursive: true,
    });
  }

  const targetEntries = Array.isArray(parsed.targets) ? parsed.targets : [];
  const targets = targetEntries.filter((target): target is string => typeof target === "string").map(expandTilde);

  return { sources, targets };
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function findSourcesRootSource(config: Config): Source | undefined {
  return config.sources.find(isSourcesRootSource);
}

export function getSourcesRootPath(config: Config): string {
  const sourcesRoot = findSourcesRootSource(config);
  return sourcesRoot ? sourcesRoot.path : DEFAULT_SOURCES_ROOT_PATH;
}

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function serializeConfig(config: Config): Record<string, unknown> {
  const serializable = {
    sources: config.sources.map((s) => ({
      name: s.name,
      path: s.path.replace(homedir(), "~"),
      ...(s.recursive ? { recursive: true } : {}),
      ...(s.url ? { url: s.url } : {}),
    })),
    targets: config.targets.map((t) => t.replace(homedir(), "~")),
  };
  return serializable;
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  const serializable = serializeConfig(config);
  writeFileSync(CONFIG_PATH, yaml.dump(serializable), "utf-8");
}

export function writeDefaultConfig(config: Config): void {
  saveConfig(config);
}
