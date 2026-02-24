export interface ParsedGitHubRepo {
  owner: string;
  repo: string;
  canonicalUrl: string;
  sourceName: string;
}

const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);
const SKILLS_SH_HOSTS = new Set(["skills.sh", "www.skills.sh"]);
const GITHUB_SSH_REGEX =
  /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?\/?$/i;
const EMBEDDED_GITHUB_REGEX =
  /(?:https?:\/\/(?:www\.)?github\.com\/|git@github\.com:)([^/\s"'<>?#]+)\/([^/\s"'<>?#]+?)(?:\.git)?(?=$|[/"'<>?#\s])/gi;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitizeSegment(input: string, stripGitSuffix: boolean): string {
  let value = safeDecode(input).trim().replace(/^\/+|\/+$/g, "");
  if (stripGitSuffix) {
    value = value.replace(/\.git$/i, "");
  }
  return value.replace(/[),.;:]+$/g, "");
}

function toParsedRepo(ownerRaw: string, repoRaw: string): ParsedGitHubRepo | null {
  const owner = sanitizeSegment(ownerRaw, false);
  const repo = sanitizeSegment(repoRaw, true);
  if (!owner || !repo) return null;
  if (!/^[a-z0-9._-]+$/i.test(owner)) return null;
  if (!/^[a-z0-9._-]+$/i.test(repo)) return null;

  return {
    owner,
    repo,
    canonicalUrl: `https://github.com/${owner}/${repo}`,
    sourceName: `${repo}@${owner}`,
  };
}

function parseFromPathname(pathname: string): ParsedGitHubRepo | null {
  const segments = pathname
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
  if (segments.length < 2) return null;
  return toParsedRepo(segments[0], segments[1]);
}

function parseFromUrlCandidate(candidate: string): ParsedGitHubRepo | null {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(candidate);
  } catch {
    return null;
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (GITHUB_HOSTS.has(host) || SKILLS_SH_HOSTS.has(host)) {
    return parseFromPathname(parsedUrl.pathname);
  }

  const embedded = extractGitHubRepoUrl(
    `${safeDecode(parsedUrl.pathname)} ${safeDecode(parsedUrl.search)} ${safeDecode(parsedUrl.hash)}`,
  );
  return embedded ? parseGitHubRepoUrl(embedded) : null;
}

export function extractGitHubRepoUrl(text: string): string | null {
  if (!text) return null;

  EMBEDDED_GITHUB_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = EMBEDDED_GITHUB_REGEX.exec(text);
  while (match) {
    const parsed = toParsedRepo(match[1], match[2]);
    if (parsed) {
      EMBEDDED_GITHUB_REGEX.lastIndex = 0;
      return parsed.canonicalUrl;
    }
    match = EMBEDDED_GITHUB_REGEX.exec(text);
  }

  EMBEDDED_GITHUB_REGEX.lastIndex = 0;
  return null;
}

export function parseGitHubRepoUrl(input: string): ParsedGitHubRepo | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const sshMatch = trimmed.match(GITHUB_SSH_REGEX);
  if (sshMatch) {
    return toParsedRepo(sshMatch[1], sshMatch[2]);
  }

  const parsedDirect = parseFromUrlCandidate(trimmed);
  if (parsedDirect) return parsedDirect;

  const embedded = extractGitHubRepoUrl(`${trimmed} ${safeDecode(trimmed)}`);
  return embedded ? parseGitHubRepoUrl(embedded) : null;
}

export function normalizedGitHubUrl(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = parseGitHubRepoUrl(value);
  return parsed ? parsed.canonicalUrl.toLowerCase() : null;
}

function parseHttpUrl(input: string): URL | null {
  try {
    const parsed = new URL(input.trim());
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function resolveGitHubRepoUrl(
  input: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ParsedGitHubRepo | null> {
  const direct = parseGitHubRepoUrl(input);
  if (direct) return direct;

  const candidate = parseHttpUrl(input);
  if (!candidate) return null;

  try {
    const response = await fetchImpl(candidate.toString(), {
      method: "GET",
      redirect: "follow",
    });
    if (!response.ok) return null;

    const redirected = parseGitHubRepoUrl(response.url || candidate.toString());
    if (redirected) return redirected;

    const body = await response.text();
    const embedded = extractGitHubRepoUrl(body);
    return embedded ? parseGitHubRepoUrl(embedded) : null;
  } catch {
    return null;
  }
}
