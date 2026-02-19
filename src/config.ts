import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import yaml from "js-yaml";
import type { Config, Source } from "./types";

const CONFIG_DIR = join(homedir(), ".config", "skills-manager");
const CONFIG_PATH = join(CONFIG_DIR, "config.yaml");

export function expandTilde(p: string): string {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  if (p === "~") return homedir();
  return p;
}

export function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      `Config not found at ${CONFIG_PATH}\nCreate it with sources and targets.`,
    );
  }

  const raw = readFileSync(CONFIG_PATH, "utf-8");
  const parsed = yaml.load(raw) as Record<string, unknown>;

  const sources = (parsed.sources as Array<Record<string, unknown>>).map(
    (s) => ({
      name: s.name as string,
      path: expandTilde(s.path as string),
      recursive: (s.recursive as boolean) ?? false,
      ...(typeof s.url === "string" && s.url ? { url: s.url } : {}),
    }),
  );

  const targets = (parsed.targets as string[]).map(expandTilde);

  return { sources, targets };
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function findKitchenSource(config: Config): Source | undefined {
  return (
    config.sources.find((source) => source.name.toLowerCase() === "kitchen") ||
    config.sources.find((source) => source.path.toLowerCase().includes("skills-kitchen"))
  );
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
