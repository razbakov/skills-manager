export interface Source {
  name: string;
  path: string;
  recursive?: boolean;
}

export interface Config {
  sources: Source[];
  targets: string[];
}

export interface Skill {
  name: string;
  description: string;
  sourcePath: string;
  sourceName: string;
  installed: boolean;
  disabled: boolean;
  targetStatus: Record<string, "installed" | "disabled" | "not-installed">;
}
