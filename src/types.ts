export interface Source {
  name: string;
  path: string;
  recursive?: boolean;
  url?: string;
}

export interface SkillSetConfig {
  name: string;
  skillIds: string[];
}

export interface Config {
  sources: Source[];
  targets: string[];
  disabledSources: string[];
  personalSkillsRepo?: string;
  personalSkillsRepoPrompted: boolean;
  skillSets?: SkillSetConfig[];
  activeSkillSet?: string;
}

export interface Skill {
  name: string;
  description: string;
  sourcePath: string;
  sourceName: string;
  installName?: string;
  installed: boolean;
  disabled: boolean;
  unmanaged: boolean;
  targetStatus: Record<string, "installed" | "disabled" | "not-installed">;
}
