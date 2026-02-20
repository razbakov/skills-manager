import { existsSync, lstatSync, readFileSync, readdirSync } from "fs";
import { homedir } from "os";
import { basename, extname, join, resolve } from "path";
import type { Skill } from "./types";

export type RecommendationMode = "standard" | "explore-new";
export type RecommendationScope = "all" | "current-project";
export type RecommendationUsageStatus = "unused" | "low-use" | "used";
export type RecommendationConfidence = "low" | "medium" | "high";
export type RecommendationEvidenceSource = "Cursor" | "Codex" | "both" | "none";

export interface RecommendationRequest {
  mode?: RecommendationMode;
  scope?: RecommendationScope;
  projectPath?: string;
  limit?: number;
}

export interface RecommendationItem {
  skillId: string;
  skillName: string;
  description: string;
  installed: boolean;
  usageStatus: RecommendationUsageStatus;
  confidence: RecommendationConfidence;
  evidenceSource: RecommendationEvidenceSource;
  matchedSessions: number;
  matchedQueries: number;
  reason: string;
  trigger: string;
  exampleQuery: string;
  score: number;
}

export interface RecommendationHistorySummary {
  totalQueries: number;
  cursorQueries: number;
  codexQueries: number;
  uniqueSessions: number;
}

export interface RecommendationSnapshot {
  generatedAt: string;
  mode: RecommendationMode;
  scope: RecommendationScope;
  projectPath: string;
  historySummary: RecommendationHistorySummary;
  items: RecommendationItem[];
}

type HistorySource = "Cursor" | "Codex";

interface QueryEvent {
  source: HistorySource;
  sessionKey: string;
  timestampMs: number;
  text: string;
}

interface QueryGroup {
  key: string;
  text: string;
  textLower: string;
  sourceSet: Set<HistorySource>;
  sessionSet: Set<string>;
  tokenSet: Set<string>;
  timestampMs: number;
}

interface SkillProfile {
  skill: Skill;
  skillId: string;
  aliases: string[];
  nameTokens: string[];
  keywordSet: Set<string>;
}

interface MatchStats {
  strictQueries: number;
  strictSessionSet: Set<string>;
  directHits: number;
  matchedSources: Set<HistorySource>;
  lastMatchedMs: number;
  potentialTotal: number;
  themeScore: number;
  bestStrictExample: QueryGroup | null;
  bestPotentialExample: QueryGroup | null;
  bestStrictScore: number;
  bestPotentialScore: number;
}

interface MatchSignal {
  strict: boolean;
  direct: boolean;
  potential: number;
  strictScore: number;
}

const CURSOR_PROJECTS_ROOT = join(homedir(), ".cursor", "projects");
const CODEX_HISTORY_PATH = join(homedir(), ".codex", "history.jsonl");
const CODEX_SESSIONS_ROOT = join(homedir(), ".codex", "sessions");

const MAX_CURSOR_FILES_ALL = 900;
const MAX_CURSOR_FILES_PROJECT = 320;
const MAX_CODEX_HISTORY_LINES = 5000;
const MAX_CODEX_SESSION_FILES_ALL = 700;
const MAX_CODEX_SESSION_FILES_PROJECT = 260;
const MAX_RECOMMENDATIONS = 7;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "then",
  "these",
  "this",
  "to",
  "use",
  "using",
  "when",
  "with",
  "you",
  "your",
  "user",
  "users",
  "skill",
  "skills",
  "agent",
  "agents",
  "task",
  "tasks",
  "file",
  "files",
  "tool",
  "tools",
  "workflow",
  "workflows",
  "project",
  "projects",
  "support",
  "supports",
  "including",
  "based",
  "also",
  "need",
  "needs",
  "any",
  "all",
  "can",
  "will",
  "should",
  "must",
  "just",
  "only",
  "into",
  "across",
  "through",
  "about",
  "than",
  "after",
  "before",
  "where",
  "what",
  "which",
  "who",
  "why",
  "does",
  "doing",
  "done",
  "make",
  "build",
  "create",
  "update",
  "read",
  "write",
  "new",
  "existing",
  "manager",
  "code",
  "coding",
]);

const EXTRA_SKILL_KEYWORDS: Record<string, string[]> = {
  atlassian: ["jira", "confluence", "ticket", "sprint", "issue"],
  "feature-spec": ["prd", "requirements", "acceptance", "metrics", "scope"],
  "frontend-design": ["landing", "website", "banner", "ui", "design", "component"],
  "google-drive": ["google", "docs", "sheets", "gmail", "drive", "calendar"],
  "user-story": ["story", "invest", "acceptance", "criteria", "ticket"],
  workflow: ["plan", "planning", "orchestrate", "steps", "verification", "checklist"],
  xlsx: ["xlsx", "xlsm", "csv", "tsv", "spreadsheet", "excel"],
  docx: ["docx", "word", "document"],
  pptx: ["pptx", "slides", "presentation", "deck"],
  pdf: ["pdf", "form", "merge", "split"],
};

const FILE_TRIGGERS: Record<string, string[]> = {
  xlsx: [".xlsx", ".xlsm", ".csv", ".tsv", "spreadsheet", "excel"],
  docx: [".docx", "word document"],
  pptx: [".pptx", "slides", "presentation", "deck"],
  pdf: [".pdf", "pdf form"],
};

export function buildRecommendations(
  skills: Skill[],
  request: RecommendationRequest = {},
): RecommendationSnapshot {
  const mode: RecommendationMode = request.mode === "explore-new" ? "explore-new" : "standard";
  const scope: RecommendationScope = request.scope === "current-project" ? "current-project" : "all";
  const projectPath = resolve(request.projectPath || process.cwd());
  const limit = Math.max(3, Math.min(request.limit || MAX_RECOMMENDATIONS, 15));

  const queryEvents = loadQueryEvents(scope, projectPath);
  const groups = aggregateQueries(queryEvents);
  const profiles = buildSkillProfiles(skills);
  const tokenFrequency = buildTokenFrequency(groups);
  const ranked = rankSkillRecommendations(profiles, groups, tokenFrequency, mode, limit);

  const cursorQueries = groups.filter((group) => group.sourceSet.has("Cursor")).length;
  const codexQueries = groups.filter((group) => group.sourceSet.has("Codex")).length;
  const uniqueSessions = new Set(
    groups.flatMap((group) => Array.from(group.sessionSet.values())),
  ).size;

  return {
    generatedAt: new Date().toISOString(),
    mode,
    scope,
    projectPath,
    historySummary: {
      totalQueries: groups.length,
      cursorQueries,
      codexQueries,
      uniqueSessions,
    },
    items: ranked,
  };
}

function loadQueryEvents(scope: RecommendationScope, projectPath: string): QueryEvent[] {
  const events: QueryEvent[] = [];

  events.push(...loadCursorQueries(scope, projectPath));

  if (scope === "all") {
    const fromHistory = loadCodexHistoryQueries();
    if (fromHistory.length > 0) {
      events.push(...fromHistory);
    } else {
      events.push(...loadCodexSessionQueries(null));
    }
  } else {
    events.push(...loadCodexSessionQueries(projectPath));
  }

  return events;
}

function loadCursorQueries(scope: RecommendationScope, projectPath: string): QueryEvent[] {
  if (!existsSync(CURSOR_PROJECTS_ROOT)) return [];

  const projectDirs = listDirectories(CURSOR_PROJECTS_ROOT);
  const selectedProjectDirs =
    scope === "current-project"
      ? selectCursorProjectDirs(projectDirs, projectPath)
      : projectDirs;

  const maxFiles = scope === "current-project" ? MAX_CURSOR_FILES_PROJECT : MAX_CURSOR_FILES_ALL;
  const transcriptFiles = collectCursorTranscriptFiles(selectedProjectDirs)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, maxFiles);

  const events: QueryEvent[] = [];

  for (const file of transcriptFiles) {
    const content = readFileSafe(file.path);
    if (!content) continue;

    const ext = extname(file.path).toLowerCase();
    const sessionKey = `${basename(file.projectDir)}:${basename(file.path)}`;
    const timestampMs = Math.floor(file.mtimeMs);

    if (ext === ".jsonl") {
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        let parsed: any;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue;
        }

        if (parsed?.role !== "user") continue;
        const contentItems = parsed?.message?.content;
        if (!Array.isArray(contentItems)) continue;

        for (const item of contentItems) {
          if (!item || typeof item !== "object") continue;
          if (item.type !== "text" || typeof item.text !== "string") continue;
          for (const text of extractUserQueryTexts(item.text)) {
            events.push({
              source: "Cursor",
              sessionKey,
              timestampMs,
              text,
            });
          }
        }
      }
      continue;
    }

    for (const text of extractUserQueryTexts(content)) {
      events.push({
        source: "Cursor",
        sessionKey,
        timestampMs,
        text,
      });
    }
  }

  return events;
}

function loadCodexHistoryQueries(): QueryEvent[] {
  if (!existsSync(CODEX_HISTORY_PATH)) return [];
  const content = readFileSafe(CODEX_HISTORY_PATH);
  if (!content) return [];

  const events: QueryEvent[] = [];
  const lines = content.split(/\r?\n/);
  const cappedLines = lines.slice(Math.max(0, lines.length - MAX_CODEX_HISTORY_LINES));

  for (const line of cappedLines) {
    if (!line.trim()) continue;

    let parsed: any;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    if (!parsed || typeof parsed !== "object") continue;
    if (typeof parsed.text !== "string" || !parsed.text.trim()) continue;

    const timestampMs =
      typeof parsed.ts === "number" && Number.isFinite(parsed.ts)
        ? Math.floor(parsed.ts * 1000)
        : Date.now();

    events.push({
      source: "Codex",
      sessionKey: String(parsed.session_id || "history"),
      timestampMs,
      text: parsed.text,
    });
  }

  return events;
}

function loadCodexSessionQueries(projectPath: string | null): QueryEvent[] {
  if (!existsSync(CODEX_SESSIONS_ROOT)) return [];

  const maxFiles = projectPath ? MAX_CODEX_SESSION_FILES_PROJECT : MAX_CODEX_SESSION_FILES_ALL;
  const sessionFiles = collectFilesRecursive(CODEX_SESSIONS_ROOT, (path) =>
    path.toLowerCase().endsWith(".jsonl"),
  )
    .map((path) => ({
      path,
      mtimeMs: safeMtime(path),
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, maxFiles);

  const resolvedProjectPath = projectPath ? resolve(projectPath) : null;
  const events: QueryEvent[] = [];

  for (const file of sessionFiles) {
    const content = readFileSafe(file.path);
    if (!content) continue;

    let sessionId = basename(file.path, ".jsonl");
    let sessionCwd: string | null = null;
    let sessionTimestampMs = Math.floor(file.mtimeMs);
    const pendingEvents: QueryEvent[] = [];

    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;

      let parsed: any;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      if (parsed?.type === "session_meta") {
        const meta = parsed.payload;
        if (meta && typeof meta === "object") {
          if (typeof meta.id === "string" && meta.id) {
            sessionId = meta.id;
          }
          if (typeof meta.cwd === "string" && meta.cwd) {
            sessionCwd = resolve(meta.cwd);
          }
        }
        continue;
      }

      if (parsed?.type !== "response_item") continue;
      const payload = parsed.payload;
      if (!payload || typeof payload !== "object") continue;
      if (payload.type !== "message" || payload.role !== "user") continue;
      if (!Array.isArray(payload.content)) continue;

      let lineTimestampMs = sessionTimestampMs;
      if (typeof parsed.timestamp === "string") {
        const ts = Date.parse(parsed.timestamp);
        if (Number.isFinite(ts)) {
          lineTimestampMs = ts;
          sessionTimestampMs = Math.max(sessionTimestampMs, ts);
        }
      }

      for (const item of payload.content) {
        if (!item || typeof item !== "object") continue;
        if (item.type !== "input_text" || typeof item.text !== "string") continue;
        pendingEvents.push({
          source: "Codex",
          sessionKey: sessionId,
          timestampMs: lineTimestampMs,
          text: item.text,
        });
      }
    }

    if (resolvedProjectPath && sessionCwd && sessionCwd !== resolvedProjectPath) {
      continue;
    }

    if (resolvedProjectPath && !sessionCwd) {
      continue;
    }

    events.push(...pendingEvents);
  }

  return events;
}

function aggregateQueries(events: QueryEvent[]): QueryGroup[] {
  const groups = new Map<string, QueryGroup>();

  for (const event of events) {
    const cleaned = sanitizeQueryText(event.text);
    if (!cleaned) continue;

    const key = queryDedupeKey(cleaned);
    if (!key) continue;

    const tokenSet = new Set(tokenize(cleaned));
    if (tokenSet.size === 0) continue;

    const sessionKey = `${event.source}:${event.sessionKey}`;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        text: cleaned,
        textLower: cleaned.toLowerCase(),
        sourceSet: new Set<HistorySource>([event.source]),
        sessionSet: new Set([sessionKey]),
        tokenSet,
        timestampMs: event.timestampMs,
      });
      continue;
    }

    existing.sourceSet.add(event.source);
    existing.sessionSet.add(sessionKey);
    existing.timestampMs = Math.max(existing.timestampMs, event.timestampMs);
  }

  return Array.from(groups.values()).sort((a, b) => b.timestampMs - a.timestampMs);
}

function buildSkillProfiles(skills: Skill[]): SkillProfile[] {
  return skills.map((skill) => {
    const normalizedName = normalizeForToken(skill.name);
    const aliases = new Set<string>([
      skill.name.toLowerCase(),
      normalizedName,
      normalizedName.replace(/\s+/g, "-"),
      normalizedName.replace(/\s+/g, ""),
    ]);

    if (skill.installName) {
      const install = normalizeForToken(skill.installName);
      aliases.add(install);
      aliases.add(install.replace(/\s+/g, "-"));
      aliases.add(install.replace(/\s+/g, ""));
    }

    const nameTokens = tokenize(skill.name).filter((token) => token.length >= 3);
    const keywordSet = new Set<string>([
      ...tokenize(`${skill.name} ${skill.description}`)
        .filter((token) => token.length >= 3)
        .filter((token) => !STOP_WORDS.has(token)),
      ...(EXTRA_SKILL_KEYWORDS[skill.name.toLowerCase()] || []),
    ]);

    return {
      skill,
      skillId: resolve(skill.sourcePath),
      aliases: Array.from(aliases).filter((entry) => entry.length >= 2),
      nameTokens,
      keywordSet,
    };
  });
}

function buildTokenFrequency(groups: QueryGroup[]): Map<string, number> {
  const frequency = new Map<string, number>();

  for (const group of groups) {
    for (const token of group.tokenSet) {
      if (STOP_WORDS.has(token)) continue;
      if (token.length < 3) continue;
      frequency.set(token, (frequency.get(token) || 0) + 1);
    }
  }

  return frequency;
}

function rankSkillRecommendations(
  profiles: SkillProfile[],
  groups: QueryGroup[],
  tokenFrequency: Map<string, number>,
  mode: RecommendationMode,
  limit: number,
): RecommendationItem[] {
  const now = Date.now();
  const scored: RecommendationItem[] = [];

  for (const profile of profiles) {
    const stats: MatchStats = {
      strictQueries: 0,
      strictSessionSet: new Set<string>(),
      directHits: 0,
      matchedSources: new Set<HistorySource>(),
      lastMatchedMs: 0,
      potentialTotal: 0,
      themeScore: computeThemeScore(profile.keywordSet, tokenFrequency),
      bestStrictExample: null,
      bestPotentialExample: null,
      bestStrictScore: 0,
      bestPotentialScore: 0,
    };

    for (const group of groups) {
      const signal = scoreSkillAgainstQuery(profile, group);
      if (signal.potential <= 0) continue;

      stats.potentialTotal += signal.potential;

      if (!stats.bestPotentialExample || signal.potential > stats.bestPotentialScore) {
        stats.bestPotentialExample = group;
        stats.bestPotentialScore = signal.potential;
      }

      if (!signal.strict) continue;

      stats.strictQueries += 1;
      if (signal.direct) stats.directHits += 1;
      stats.lastMatchedMs = Math.max(stats.lastMatchedMs, group.timestampMs);

      for (const session of group.sessionSet) {
        stats.strictSessionSet.add(session);
      }

      for (const source of group.sourceSet) {
        stats.matchedSources.add(source);
      }

      if (!stats.bestStrictExample || signal.strictScore > stats.bestStrictScore) {
        stats.bestStrictExample = group;
        stats.bestStrictScore = signal.strictScore;
      }
    }

    const matchedSessions = stats.strictSessionSet.size;
    const matchedQueries = stats.strictQueries;
    const usageStatus = usageFromSessionCount(matchedSessions);
    const confidence = confidenceFromStats(matchedSessions, matchedQueries, stats.directHits, stats.themeScore);
    const evidenceSource = sourceFromSet(stats.matchedSources);
    const exampleSource = stats.bestStrictExample || stats.bestPotentialExample;
    const exampleQuery = truncate(exampleSource?.text || "No matching history query available yet.", 220);
    const reason = buildReason(profile, stats, usageStatus);
    const trigger = buildTrigger(profile.skill);

    const recency = recencyBoost(stats.lastMatchedMs, now);
    const standardScore =
      matchedSessions * 12 +
      matchedQueries * 4 +
      stats.directHits * 7 +
      stats.potentialTotal * 0.35 +
      stats.themeScore * 0.25 +
      recency;

    const usageWeight = usageStatus === "unused" ? 300 : usageStatus === "low-use" ? 200 : 100;
    const exploreScore = usageWeight + stats.themeScore * 2 + stats.potentialTotal * 0.55 + recency;

    const score = mode === "explore-new" ? exploreScore : standardScore;

    const includeInStandard = matchedSessions > 0 || stats.potentialTotal >= 8;
    const includeInExplore = stats.themeScore > 0 || stats.potentialTotal > 0 || matchedSessions > 0;
    if ((mode === "standard" && !includeInStandard) || (mode === "explore-new" && !includeInExplore)) {
      continue;
    }

    scored.push({
      skillId: profile.skillId,
      skillName: profile.skill.name,
      description: profile.skill.description || "",
      installed: profile.skill.installed,
      usageStatus,
      confidence,
      evidenceSource,
      matchedSessions,
      matchedQueries,
      reason,
      trigger,
      exampleQuery,
      score,
    });
  }

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.skillName.localeCompare(b.skillName, undefined, {
        sensitivity: "base",
        numeric: true,
      });
    })
    .slice(0, limit);
}

function scoreSkillAgainstQuery(profile: SkillProfile, group: QueryGroup): MatchSignal {
  let direct = false;
  for (const alias of profile.aliases) {
    if (!alias) continue;
    if (containsAlias(group.textLower, alias)) {
      direct = true;
      break;
    }
  }

  let nameOverlap = 0;
  for (const token of profile.nameTokens) {
    if (group.tokenSet.has(token)) {
      nameOverlap += 1;
    }
  }

  let keywordOverlap = 0;
  for (const token of profile.keywordSet) {
    if (group.tokenSet.has(token)) {
      keywordOverlap += 1;
    }
  }

  const triggerWords = FILE_TRIGGERS[profile.skill.name.toLowerCase()] || [];
  let triggerHit = false;
  for (const trigger of triggerWords) {
    if (trigger.startsWith(".")) {
      if (group.textLower.includes(trigger)) {
        triggerHit = true;
        break;
      }
      continue;
    }

    if (trigger.includes(" ")) {
      if (group.textLower.includes(trigger)) {
        triggerHit = true;
        break;
      }
      continue;
    }

    if (group.tokenSet.has(trigger)) {
      triggerHit = true;
      break;
    }
  }

  const potential =
    (direct ? 8 : 0) +
    (triggerHit ? 6 : 0) +
    Math.min(nameOverlap * 2, 6) +
    Math.min(keywordOverlap, 6);

  let strict = false;
  if (direct || triggerHit) {
    strict = true;
  } else if (nameOverlap >= 2) {
    strict = true;
  } else if (keywordOverlap >= 3) {
    strict = true;
  } else if (keywordOverlap >= 2 && nameOverlap >= 1) {
    strict = true;
  }

  const strictScore = potential + (strict ? 5 : 0);

  return {
    strict,
    direct,
    potential,
    strictScore,
  };
}

function usageFromSessionCount(sessionCount: number): RecommendationUsageStatus {
  if (sessionCount <= 0) return "unused";
  if (sessionCount <= 2) return "low-use";
  return "used";
}

function confidenceFromStats(
  matchedSessions: number,
  matchedQueries: number,
  directHits: number,
  themeScore: number,
): RecommendationConfidence {
  if (matchedSessions >= 4 || directHits >= 2) return "high";
  if (matchedSessions >= 2 || matchedQueries >= 3) return "medium";
  if (matchedSessions >= 1) return "low";
  if (themeScore >= 8) return "low";
  return "low";
}

function sourceFromSet(sources: Set<HistorySource>): RecommendationEvidenceSource {
  const hasCursor = sources.has("Cursor");
  const hasCodex = sources.has("Codex");
  if (hasCursor && hasCodex) return "both";
  if (hasCursor) return "Cursor";
  if (hasCodex) return "Codex";
  return "none";
}

function computeThemeScore(skillKeywords: Set<string>, tokenFrequency: Map<string, number>): number {
  const scores: number[] = [];
  for (const token of skillKeywords) {
    const freq = tokenFrequency.get(token);
    if (!freq) continue;
    scores.push(freq);
  }

  scores.sort((a, b) => b - a);
  return scores.slice(0, 6).reduce((sum, value) => sum + value, 0);
}

function recencyBoost(lastMatchedMs: number, now: number): number {
  if (!lastMatchedMs) return 0;

  const daysAgo = (now - lastMatchedMs) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 7) return 4;
  if (daysAgo <= 30) return 2;
  if (daysAgo <= 90) return 1;
  return 0;
}

function buildReason(
  profile: SkillProfile,
  stats: MatchStats,
  usageStatus: RecommendationUsageStatus,
): string {
  const matchedSessions = stats.strictSessionSet.size;

  if (matchedSessions > 0) {
    const source = sourceFromSet(stats.matchedSources);
    const sessionLabel = matchedSessions === 1 ? "session" : "sessions";

    if (usageStatus === "used") {
      return `Recurring across ${matchedSessions} ${sessionLabel} (${source}).`;
    }

    return `Observed in ${matchedSessions} ${sessionLabel} (${source}); good fit for similar prompts.`;
  }

  const highSignalKeywords = Array.from(profile.keywordSet).slice(0, 3).join(", ");
  if (highSignalKeywords) {
    return `No direct usage yet; aligns with recurring themes: ${highSignalKeywords}.`;
  }

  return "No direct usage yet; exploratory recommendation based on adjacent requests.";
}

function buildTrigger(skill: Skill): string {
  const description = firstSentence(skill.description || "");
  if (!description) {
    return `Use \`${skill.name}\` for this workflow.`;
  }

  const cleaned = description.replace(/^use\s+/i, "").trim();
  return `Use \`${skill.name}\` when you need to ${lowercaseFirst(cleaned)}.`;
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const period = trimmed.indexOf(".");
  if (period <= 0) return trimmed;
  return trimmed.slice(0, period).trim();
}

function lowercaseFirst(text: string): string {
  if (!text) return text;
  return `${text[0].toLowerCase()}${text.slice(1)}`;
}

function sanitizeQueryText(raw: string): string | null {
  let text = raw.replace(/\\n/g, "\n");
  text = text.replace(/<user_query>/gi, "").replace(/<\/user_query>/gi, "").trim();
  if (!text) return null;

  if (isNoiseText(text)) return null;

  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length < 2) return null;
  if (compact.length > 2800) return truncate(compact, 2800);

  return compact;
}

function isNoiseText(text: string): boolean {
  const lower = text.toLowerCase();

  if (lower.startsWith("<environment_context>")) return true;
  if (lower.includes("# agents.md instructions")) return true;
  if (lower.includes("<permissions instructions>")) return true;
  if (lower.includes("<app-context>")) return true;
  if (lower.startsWith("<skill>")) return true;
  if (lower.includes("</skill>")) return true;
  if (lower.includes("### available skills") && lower.includes("how to use skills")) return true;

  const lineCount = text.split(/\r?\n/).length;
  if (lineCount > 90 && text.length > 5000) return true;

  if (/######\s*\d{2}:\d{2}/.test(text)) return true;
  const speakerMatches = text.match(/speaker\s*-?\d+/gi) || [];
  if (speakerMatches.length >= 8) return true;

  return false;
}

function tokenize(text: string): string[] {
  const rawTokens = text
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9+.#-]*/g);

  if (!rawTokens) return [];

  return rawTokens
    .map((token) => token.replace(/^\.+/, "").replace(/\.+$/, ""))
    .filter((token) => token.length >= 2)
    .filter((token) => !STOP_WORDS.has(token));
}

function normalizeForToken(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryDedupeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAlias(textLower: string, alias: string): boolean {
  if (!alias) return false;

  const normalizedAlias = alias.toLowerCase().trim();
  if (!normalizedAlias) return false;

  if (normalizedAlias.includes(" ")) {
    return textLower.includes(normalizedAlias);
  }

  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedAlias)}([^a-z0-9]|$)`);
  return pattern.test(textLower);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

function extractUserQueryTexts(text: string): string[] {
  const queries: string[] = [];
  const regex = /<user_query>([\s\S]*?)<\/user_query>/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      queries.push(match[1]);
    }
  }

  if (queries.length > 0) return queries;
  return [text];
}

function listDirectories(root: string): string[] {
  if (!existsSync(root)) return [];

  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => !entry.name.startsWith("."))
      .map((entry) => resolve(join(root, entry.name)));
  } catch {
    return [];
  }
}

function selectCursorProjectDirs(projectDirs: string[], projectPath: string): string[] {
  if (projectDirs.length === 0) return [];

  const fullSlug = pathToSlug(projectPath);
  const exact = projectDirs.filter(
    (dir) => basename(dir).toLowerCase() === fullSlug,
  );
  if (exact.length > 0) return exact;

  const segments = resolve(projectPath).split(/[\\/]/).filter(Boolean);
  const tail2 = pathToSlug(segments.slice(-2).join("-"));
  const tail3 = pathToSlug(segments.slice(-3).join("-"));

  const fallback = projectDirs.filter((dir) => {
    const name = basename(dir).toLowerCase();
    return (
      name === tail2 ||
      name === tail3 ||
      name.endsWith(`-${tail2}`) ||
      name.endsWith(`-${tail3}`)
    );
  });

  return fallback;
}

function pathToSlug(pathValue: string): string {
  return resolve(pathValue)
    .replace(/^\/+/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function collectCursorTranscriptFiles(projectDirs: string[]): Array<{ path: string; projectDir: string; mtimeMs: number }> {
  const files: Array<{ path: string; projectDir: string; mtimeMs: number }> = [];

  for (const projectDir of projectDirs) {
    const transcriptsRoot = join(projectDir, "agent-transcripts");
    if (!existsSync(transcriptsRoot)) continue;

    const projectFiles = collectFilesRecursive(
      transcriptsRoot,
      (path) => {
        const ext = extname(path).toLowerCase();
        return ext === ".jsonl" || ext === ".txt";
      },
    );

    for (const path of projectFiles) {
      files.push({
        path,
        projectDir,
        mtimeMs: safeMtime(path),
      });
    }
  }

  return files;
}

function collectFilesRecursive(root: string, predicate: (path: string) => boolean): string[] {
  if (!existsSync(root)) return [];

  const files: string[] = [];
  const stack = [resolve(root)];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && predicate(fullPath)) {
        files.push(resolve(fullPath));
      }
    }
  }

  return files;
}

function safeMtime(path: string): number {
  try {
    return lstatSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
