import { parseGitHubRepoUrl } from "./source-url";

const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);
const SKILLS_SH_HOSTS = new Set(["skills.sh", "www.skills.sh"]);
const EMBEDDED_URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const OWNER_REPO_PATH_PATTERN =
  /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[^\s"'<>?#]+$/;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stripOuterQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}

function normalizeHint(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function inferFromGithubLikePath(pathname: string, host: string): string | undefined {
  const segments = pathname
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
  if (segments.length === 0) return undefined;

  if (SKILLS_SH_HOSTS.has(host)) {
    if (segments.length >= 3) {
      return normalizeHint(safeDecode(segments[segments.length - 1]));
    }
    return undefined;
  }

  if (!GITHUB_HOSTS.has(host)) {
    return undefined;
  }

  if (segments.length >= 5 && (segments[2] === "tree" || segments[2] === "blob")) {
    const tail = segments.slice(4);
    if (tail.length === 0) return undefined;
    const last = safeDecode(tail[tail.length - 1]);
    if (/^skill\.md$/i.test(last) && tail.length >= 2) {
      return normalizeHint(safeDecode(tail[tail.length - 2]));
    }
    return normalizeHint(last);
  }

  if (segments.length > 2) {
    const last = safeDecode(segments[segments.length - 1]);
    if (/^skill\.md$/i.test(last) && segments.length >= 2) {
      return normalizeHint(safeDecode(segments[segments.length - 2]));
    }
    return normalizeHint(last);
  }

  return undefined;
}

function inferFromUrlCandidate(candidate: string): string | undefined {
  const value = stripOuterQuotes(candidate.trim());
  if (!value) return undefined;

  try {
    const parsed = new URL(value);
    return inferFromGithubLikePath(parsed.pathname, parsed.hostname.toLowerCase());
  } catch {
    return undefined;
  }
}

function inferFromOwnerRepoPathToken(token: string): string | undefined {
  const normalized = stripOuterQuotes(token.trim()).replace(/^\/+|\/+$/g, "");
  if (!OWNER_REPO_PATH_PATTERN.test(normalized)) {
    return undefined;
  }

  const segments = normalized.split("/").filter(Boolean);
  const tail = segments.slice(2);
  if (tail.length === 0) return undefined;
  const last = safeDecode(tail[tail.length - 1]);
  if (/^skill\.md$/i.test(last) && tail.length >= 2) {
    return normalizeHint(safeDecode(tail[tail.length - 2]));
  }
  return normalizeHint(last);
}

function findSourceTokenIndex(tokens: string[]): number {
  return tokens.findIndex((token) => {
    const normalized = stripOuterQuotes(token.trim());
    if (!normalized) return false;
    return parseGitHubRepoUrl(normalized) !== null
      || inferFromOwnerRepoPathToken(normalized) !== undefined;
  });
}

export function inferSpecificSkillHint(rawInput: string): string | undefined {
  const trimmed = rawInput.trim();
  if (!trimmed) return undefined;

  const direct =
    inferFromUrlCandidate(trimmed)
    || inferFromOwnerRepoPathToken(trimmed);
  if (direct) return direct;

  for (const match of trimmed.matchAll(EMBEDDED_URL_PATTERN)) {
    const embedded = inferFromUrlCandidate(match[0]);
    if (embedded) return embedded;
  }

  const tokens = trimmed
    .split(/\s+/)
    .map((token) => stripOuterQuotes(token))
    .filter(Boolean);
  const sourceTokenIndex = findSourceTokenIndex(tokens);
  if (sourceTokenIndex < 0) return undefined;

  const sourceToken = tokens[sourceTokenIndex];
  const sourceHint =
    inferFromUrlCandidate(sourceToken)
    || inferFromOwnerRepoPathToken(sourceToken);
  if (sourceHint) return sourceHint;

  const maybeSkillToken = tokens[sourceTokenIndex + 1];
  if (!maybeSkillToken || maybeSkillToken.startsWith("-")) return undefined;

  return normalizeHint(safeDecode(maybeSkillToken));
}
