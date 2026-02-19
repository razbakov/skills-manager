import {
  readdirSync,
  readFileSync,
  lstatSync,
  readlinkSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  type Stats,
} from "fs";
import { readFile, stat } from "fs/promises";
import { homedir } from "os";
import { join, basename, resolve, dirname } from "path";
import matter from "gray-matter";
import type { Config, Skill, Source } from "./types";

interface RawSkill {
  name: string;
  description: string;
  sourcePath: string;
  sourceName: string;
  installName: string;
}

interface SkillMeta {
  name: string;
  description: string;
}

interface CachedDirectory {
  path: string;
  mtimeMs: number;
}

interface CachedSkillFile {
  skillMdPath: string;
  sourcePath: string;
  installName: string;
  name: string;
  description: string;
  mtimeMs: number;
  size: number;
}

interface CachedSourceScan {
  sourceName: string;
  sourcePath: string;
  recursive: boolean;
  directories: CachedDirectory[];
  files: CachedSkillFile[];
  updatedAt: string;
}

interface ScanCache {
  version: number;
  sources: Record<string, CachedSourceScan>;
}

interface SkillFileDiscovery {
  files: string[];
  directories: CachedDirectory[];
}

interface ParsedSkillFile {
  rawSkill: RawSkill;
  cacheFile: CachedSkillFile;
}

interface SourceScanResult {
  cacheKey: string;
  rawSkills: RawSkill[];
  cacheEntry: CachedSourceScan;
}

const SCAN_CACHE_VERSION = 2;
const SCAN_CACHE_PATH = join(homedir(), ".config", "skills-manager", "scan-cache.json");
const FILE_STAT_CONCURRENCY = 64;
const FILE_READ_CONCURRENCY = 24;
const DIRECTORY_STAT_CONCURRENCY = 128;
const SKIP_SKILL_SCAN_DIRS = new Set(["node_modules", ".git", ".hg", ".svn"]);

function emptyScanCache(): ScanCache {
  return {
    version: SCAN_CACHE_VERSION,
    sources: {},
  };
}

function loadScanCache(): ScanCache {
  if (!existsSync(SCAN_CACHE_PATH)) return emptyScanCache();

  try {
    const raw = readFileSync(SCAN_CACHE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ScanCache>;
    if (parsed.version !== SCAN_CACHE_VERSION) return emptyScanCache();
    if (!parsed.sources || typeof parsed.sources !== "object") return emptyScanCache();
    return {
      version: SCAN_CACHE_VERSION,
      sources: parsed.sources as Record<string, CachedSourceScan>,
    };
  } catch {
    return emptyScanCache();
  }
}

function saveScanCache(cache: ScanCache): void {
  try {
    mkdirSync(dirname(SCAN_CACHE_PATH), { recursive: true });
    writeFileSync(SCAN_CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // Cache is best effort.
  }
}

function sourceCacheKey(source: Source): string {
  return `${source.name}::${resolve(source.path)}::${source.recursive ? "1" : "0"}`;
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex;
      if (index >= items.length) return;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

async function statSafe(path: string): Promise<Stats | null> {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

async function readSkillMetaFromDir(skillDir: string, fallbackName: string): Promise<SkillMeta> {
  try {
    const content = await readFile(join(skillDir, "SKILL.md"), "utf-8");
    const { data } = matter(content);
    return {
      name: (data.name as string) || fallbackName,
      description: (data.description as string) || "",
    };
  } catch {
    return {
      name: fallbackName,
      description: "",
    };
  }
}

function addDirectorySnapshot(dir: string, directories: CachedDirectory[]): void {
  try {
    const resolvedDir = resolve(dir);
    const dirStat = lstatSync(resolvedDir);
    if (!dirStat.isDirectory()) return;
    directories.push({ path: resolvedDir, mtimeMs: dirStat.mtimeMs });
  } catch {
    // skip inaccessible dirs
  }
}

function shouldSkipSkillScanDir(name: string): boolean {
  return SKIP_SKILL_SCAN_DIRS.has(name);
}

function findSkillMdFiles(dir: string, recursive: boolean): SkillFileDiscovery {
  const results: string[] = [];
  const directories: CachedDirectory[] = [];

  if (!existsSync(dir)) return { files: results, directories };

  addDirectorySnapshot(dir, directories);

  if (recursive) {
    walkRecursive(dir, results, directories);
  } else {
    // One level deep: dir/*/SKILL.md
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (shouldSkipSkillScanDir(entry.name)) continue;
        const skillDir = join(dir, entry.name);
        addDirectorySnapshot(skillDir, directories);
        const skillMd = join(skillDir, "SKILL.md");
        if (existsSync(skillMd)) {
          results.push(resolve(skillMd));
        }
      }
    } catch {
      // skip inaccessible dirs
    }
  }

  const uniqueFiles = Array.from(new Set(results)).sort((a, b) => a.localeCompare(b));
  const uniqueDirectoryMap = new Map<string, CachedDirectory>();
  for (const entry of directories) {
    uniqueDirectoryMap.set(entry.path, entry);
  }
  const uniqueDirectories = Array.from(uniqueDirectoryMap.values()).sort((a, b) =>
    a.path.localeCompare(b.path),
  );

  return {
    files: uniqueFiles,
    directories: uniqueDirectories,
  };
}

function walkRecursive(dir: string, results: string[], directories: CachedDirectory[]): void {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (shouldSkipSkillScanDir(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        addDirectorySnapshot(full, directories);
        const skillMd = join(full, "SKILL.md");
        if (existsSync(skillMd)) {
          results.push(resolve(skillMd));
        }
        walkRecursive(full, results, directories);
      }
    }
  } catch {
    // skip inaccessible dirs
  }
}

async function hasDirectoryTreeChanged(directories: CachedDirectory[]): Promise<boolean> {
  if (directories.length === 0) return true;
  const changed = await mapConcurrent(
    directories,
    DIRECTORY_STAT_CONCURRENCY,
    async (entry) => {
      const dirStat = await statSafe(entry.path);
      if (!dirStat || !dirStat.isDirectory()) return true;
      return Math.abs(dirStat.mtimeMs - entry.mtimeMs) > 1;
    },
  );
  return changed.some(Boolean);
}

function rawSkillFromCachedFile(cachedFile: CachedSkillFile, source: Source): RawSkill {
  return {
    name: cachedFile.name,
    description: cachedFile.description,
    sourcePath: cachedFile.sourcePath,
    sourceName: source.name,
    installName: cachedFile.installName,
  };
}

async function parseSkillMdWithStat(
  skillMdPath: string,
  source: Source,
  fileStat: Stats,
): Promise<ParsedSkillFile | null> {
  try {
    const content = await readFile(skillMdPath, "utf-8");
    const { data } = matter(content);
    const skillDir = resolve(dirname(skillMdPath));
    const rawSkill: RawSkill = {
      name: (data.name as string) || basename(skillDir),
      description: (data.description as string) || "",
      sourcePath: skillDir,
      sourceName: source.name,
      installName: basename(skillDir),
    };
    return {
      rawSkill,
      cacheFile: {
        skillMdPath,
        sourcePath: skillDir,
        installName: rawSkill.installName,
        name: rawSkill.name,
        description: rawSkill.description,
        mtimeMs: fileStat.mtimeMs,
        size: fileStat.size,
      },
    };
  } catch {
    return null;
  }
}

async function scanSource(source: Source, cachedSource?: CachedSourceScan): Promise<SourceScanResult> {
  const cacheKey = sourceCacheKey(source);
  const sourcePath = resolve(source.path);
  const recursive = source.recursive ?? false;
  const canReuseRecursiveDiscovery =
    recursive &&
    cachedSource &&
    cachedSource.sourcePath === sourcePath &&
    cachedSource.sourceName === source.name &&
    cachedSource.recursive === recursive &&
    cachedSource.directories.length > 0 &&
    !(await hasDirectoryTreeChanged(cachedSource.directories));

  const discovery = canReuseRecursiveDiscovery
    ? {
        files: cachedSource.files.map((entry) => entry.skillMdPath),
        directories: cachedSource.directories,
      }
    : findSkillMdFiles(sourcePath, recursive);

  const cachedFileMap = new Map<string, CachedSkillFile>();
  for (const cached of cachedSource?.files ?? []) {
    cachedFileMap.set(cached.skillMdPath, cached);
  }

  const fileStats = await mapConcurrent(discovery.files, FILE_STAT_CONCURRENCY, async (skillMdPath) => {
    const fileStat = await statSafe(skillMdPath);
    return { skillMdPath, fileStat };
  });

  const rawSkills: RawSkill[] = [];
  const cacheFiles: CachedSkillFile[] = [];
  const filesToParse: Array<{ skillMdPath: string; fileStat: Stats }> = [];

  for (const { skillMdPath, fileStat } of fileStats) {
    if (!fileStat || !fileStat.isFile()) continue;

    const cached = cachedFileMap.get(skillMdPath);
    if (cached && cached.mtimeMs === fileStat.mtimeMs && cached.size === fileStat.size) {
      rawSkills.push(rawSkillFromCachedFile(cached, source));
      cacheFiles.push({
        ...cached,
        mtimeMs: fileStat.mtimeMs,
        size: fileStat.size,
      });
      continue;
    }

    filesToParse.push({ skillMdPath, fileStat });
  }

  const parsedFresh = await mapConcurrent(
    filesToParse,
    FILE_READ_CONCURRENCY,
    async ({ skillMdPath, fileStat }) => parseSkillMdWithStat(skillMdPath, source, fileStat),
  );

  for (const parsed of parsedFresh) {
    if (!parsed) continue;
    rawSkills.push(parsed.rawSkill);
    cacheFiles.push(parsed.cacheFile);
  }

  rawSkills.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  cacheFiles.sort((a, b) => a.skillMdPath.localeCompare(b.skillMdPath));

  return {
    cacheKey,
    rawSkills,
    cacheEntry: {
      sourceName: source.name,
      sourcePath,
      recursive,
      directories: discovery.directories,
      files: cacheFiles,
      updatedAt: new Date().toISOString(),
    },
  };
}

interface InstalledEntry {
  name: string;
  targetPath: string;
  fullPath: string;
  realPath: string | null;
  disabled: boolean;
  isSymlink: boolean;
}

function scanTarget(targetDir: string): InstalledEntry[] {
  const entries: InstalledEntry[] = [];

  if (!existsSync(targetDir)) return entries;

  // Scan enabled skills
  try {
    for (const entry of readdirSync(targetDir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = join(targetDir, entry.name);
      const stat = lstatSync(fullPath);
      const isSymlink = stat.isSymbolicLink();
      let realPath: string | null = null;

      if (isSymlink) {
        try {
          realPath = resolve(targetDir, readlinkSync(fullPath));
        } catch {
          // broken symlink
        }
      }

      if (isSymlink || stat.isDirectory()) {
        entries.push({
          name: entry.name,
          targetPath: targetDir,
          fullPath,
          realPath,
          disabled: false,
          isSymlink,
        });
      }
    }
  } catch {
    // skip
  }

  // Scan .disabled/ subdirectory
  const disabledDir = join(targetDir, ".disabled");
  if (existsSync(disabledDir)) {
    try {
      for (const entry of readdirSync(disabledDir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        const fullPath = join(disabledDir, entry.name);
        const stat = lstatSync(fullPath);
        const isSymlink = stat.isSymbolicLink();
        let realPath: string | null = null;

        if (isSymlink) {
          try {
            realPath = resolve(disabledDir, readlinkSync(fullPath));
          } catch {
            // broken symlink
          }
        }

        if (isSymlink || stat.isDirectory()) {
          entries.push({
            name: entry.name,
            targetPath: targetDir,
            fullPath,
            realPath,
            disabled: true,
            isSymlink,
          });
        }
      }
    } catch {
      // skip
    }
  }

  return entries;
}

function newTargetStatus(targets: string[]): Record<string, "installed" | "disabled" | "not-installed"> {
  const status: Record<string, "installed" | "disabled" | "not-installed"> = {};
  for (const target of targets) {
    status[target] = "not-installed";
  }
  return status;
}

interface UnmatchedGroup {
  fallbackName: string;
  sourcePath: string;
  sourceName: string;
  installName: string;
  targetStatus: Record<string, "installed" | "disabled" | "not-installed">;
}

export async function scan(config: Config): Promise<Skill[]> {
  const cache = loadScanCache();
  const nextCache: ScanCache = {
    version: SCAN_CACHE_VERSION,
    sources: { ...cache.sources },
  };

  // 1. Find all source skills (reusing cache and parsing changed files in parallel)
  const rawSkills: RawSkill[] = [];
  const sourceResults = await mapConcurrent(config.sources, config.sources.length || 1, async (source) =>
    scanSource(source, cache.sources[sourceCacheKey(source)]),
  );
  for (const result of sourceResults) {
    nextCache.sources[result.cacheKey] = result.cacheEntry;
    rawSkills.push(...result.rawSkills);
  }
  saveScanCache(nextCache);

  // Deduplicate by sourcePath
  const sourceMap = new Map<string, RawSkill>();
  for (const s of rawSkills) {
    sourceMap.set(s.sourcePath, s);
  }

  // 2. Scan all targets for installed skills
  const allInstalled: InstalledEntry[] = [];
  for (const target of config.targets) {
    allInstalled.push(...scanTarget(target));
  }

  // 3. Build unified skill list
  const skills: Skill[] = [];
  const matchedInstalled = new Set<number>();

  for (const [sourcePath, raw] of sourceMap) {
    const targetStatus = newTargetStatus(config.targets);
    const sourceDirName = basename(sourcePath);
    let anyInstalled = false;
    let allDisabled = true;
    let detectedInstallName = raw.installName;

    for (const target of config.targets) {
      const matchIndex = allInstalled.findIndex(
        (entry, i) =>
          !matchedInstalled.has(i) &&
          entry.targetPath === target &&
          (
            (entry.isSymlink && entry.realPath === sourcePath) ||
            (!entry.isSymlink && entry.name === sourceDirName)
          ),
      );

      if (matchIndex >= 0) {
        const match = allInstalled[matchIndex];
        matchedInstalled.add(matchIndex);

        targetStatus[target] = match.disabled ? "disabled" : "installed";
        anyInstalled = true;
        if (!match.disabled) allDisabled = false;
        detectedInstallName = match.name;
      }
    }

    skills.push({
      name: raw.name,
      description: raw.description,
      sourcePath: raw.sourcePath,
      sourceName: raw.sourceName,
      installName: detectedInstallName,
      installed: anyInstalled,
      disabled: anyInstalled && allDisabled,
      targetStatus,
    });
  }

  // 4. Add installed skills that don't exist in source folders
  const unmatchedGroups = new Map<string, UnmatchedGroup>();

  for (const [index, entry] of allInstalled.entries()) {
    if (matchedInstalled.has(index)) continue;

    const key = entry.realPath
      ? `external:${entry.realPath}|name:${entry.name}`
      : `target-copy:${entry.name}`;

    let group = unmatchedGroups.get(key);
    if (!group) {
      const originPath = entry.realPath || entry.fullPath;

      group = {
        fallbackName: entry.name,
        sourcePath: originPath,
        sourceName: entry.realPath ? "external" : "target-copy",
        installName: entry.name,
        targetStatus: newTargetStatus(config.targets),
      };
      unmatchedGroups.set(key, group);
    }

    group.targetStatus[entry.targetPath] = entry.disabled ? "disabled" : "installed";
  }

  const unmatchedWithMeta = await mapConcurrent(
    Array.from(unmatchedGroups.values()),
    FILE_READ_CONCURRENCY,
    async (group) => ({
      group,
      meta: await readSkillMetaFromDir(group.sourcePath, group.fallbackName),
    }),
  );

  for (const { group, meta } of unmatchedWithMeta) {
    const statuses = Object.values(group.targetStatus).filter(
      (s) => s !== "not-installed",
    );
    const anyInstalled = statuses.length > 0;
    const allDisabled = anyInstalled && statuses.every((s) => s === "disabled");

    skills.push({
      name: meta.name,
      description: meta.description,
      sourcePath: group.sourcePath,
      sourceName: group.sourceName,
      installName: group.installName,
      installed: anyInstalled,
      disabled: allDisabled,
      targetStatus: group.targetStatus,
    });
  }

  return skills;
}
