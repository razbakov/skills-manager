export interface SkillShareInput {
  repoUrl?: string | null;
  installName?: string | null;
  pathLabel?: string | null;
  name?: string | null;
}

export function shellEscape(value: string): string {
  if (/^[A-Za-z0-9._/:@%-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function buildSkillShareCommand(input: SkillShareInput): string | null {
  const repoUrl = input.repoUrl?.trim();
  if (!repoUrl) return null;

  const installName = input.installName?.trim()
    || input.pathLabel?.trim()
    || input.name?.trim();
  if (!installName) return null;

  const normalizedRepoUrl = repoUrl.replace(/\/+$/g, "");
  const sourceWithSkill = `${normalizedRepoUrl}/${encodeURIComponent(installName)}`;

  return `npx -y skill-mix ${shellEscape(sourceWithSkill)}`;
}
