import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { isAbsolute, join, relative } from "path";
import { homedir } from "os";
import yaml from "js-yaml";
import type { Config, Source } from "./types";

export interface SupportedIde {
  name: string;
  path: string;
}

export interface SuggestedSource {
  name: string;
  url: string;
}

export const SUGGESTED_SOURCES: SuggestedSource[] = [
  {
    name: "benjaming/ai-skills",
    url: "https://github.com/benjaming/ai-skills",
  },
  {
    name: "sickn33/antigravity-awesome-skills",
    url: "https://github.com/sickn33/antigravity-awesome-skills",
  },
  {
    name: "ComposioHQ/awesome-claude-skills",
    url: "https://github.com/ComposioHQ/awesome-claude-skills",
  },
  {
    name: "Shubhamsaboo/awesome-llm-apps",
    url: "https://github.com/Shubhamsaboo/awesome-llm-apps",
  },
  {
    name: "anthropics/knowledge-work-plugins",
    url: "https://github.com/anthropics/knowledge-work-plugins",
  },
  { name: "cursor/plugins", url: "https://github.com/cursor/plugins" },
  { name: "anthropics/skills", url: "https://github.com/anthropics/skills" },
  { name: "dylanfeltus/skills", url: "https://github.com/dylanfeltus/skills" },
  { name: "openai/skills", url: "https://github.com/openai/skills" },
  { name: "razbakov/skills", url: "https://github.com/razbakov/skills" },
  { name: "obra/superpowers", url: "https://github.com/obra/superpowers" },
];

export const SUPPORTED_IDES: SupportedIde[] = [
  { name: "Cursor", path: "~/.cursor/skills" },
  { name: "Claude", path: "~/.claude/skills" },
  { name: "Codex", path: "~/.codex/skills" },
  { name: "Gemini", path: "~/.gemini/skills" },
  { name: "Antigravity", path: "~/.gemini/antigravity/skills" },
  { name: "VSCode", path: "~/.copilot/skills" },
  { name: "Amp", path: "~/.config/agents/skills" },
  { name: "Goose", path: "~/.config/goose/skills" },
  { name: "OpenCode", path: "~/.config/opencode/skills" },
];

const CONFIG_DIR = join(homedir(), ".config", "skills-manager");
const CONFIG_PATH = join(CONFIG_DIR, "config.yaml");
const DEFAULT_SOURCES_ROOT_PATH = join(homedir(), ".skills-manager", "sources");

function normalizePathForMatch(path: string): string {
  return expandTilde(path).replace(/\/+$/g, "").toLowerCase();
}

function isSourcesRootSource(source: Source): boolean {
  return (
    source.name.toLowerCase() === "sources" ||
    normalizePathForMatch(source.path) ===
      normalizePathForMatch(DEFAULT_SOURCES_ROOT_PATH)
  );
}

function isPathWithin(path: string, root: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function hasSourceWithinSourcesRoot(sources: Source[]): boolean {
  const rootPath = expandTilde(DEFAULT_SOURCES_ROOT_PATH);
  return sources.some((source) =>
    isPathWithin(expandTilde(source.path), rootPath),
  );
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

  if (
    !sources.some(isSourcesRootSource) &&
    !hasSourceWithinSourcesRoot(sources)
  ) {
    sources.push({
      name: "sources",
      path: DEFAULT_SOURCES_ROOT_PATH,
      recursive: true,
    });
  }

  const targetEntries = Array.isArray(parsed.targets) ? parsed.targets : [];
  const targets = targetEntries
    .filter((target): target is string => typeof target === "string")
    .map(expandTilde);

  const disabledSourceEntries = Array.isArray(parsed.disabledSources)
    ? parsed.disabledSources
    : [];
  const disabledSources = disabledSourceEntries
    .filter((entry): entry is string => typeof entry === "string")
    .map(expandTilde);

  return { sources, targets, disabledSources };
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
  const serializable: Record<string, unknown> = {
    sources: config.sources.map((s) => ({
      name: s.name,
      path: s.path.replace(homedir(), "~"),
      ...(s.recursive ? { recursive: true } : {}),
      ...(s.url ? { url: s.url } : {}),
    })),
    targets: config.targets.map((t) => t.replace(homedir(), "~")),
  };
  if (config.disabledSources.length > 0) {
    serializable.disabledSources = config.disabledSources.map((p) =>
      p.replace(homedir(), "~"),
    );
  }
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
