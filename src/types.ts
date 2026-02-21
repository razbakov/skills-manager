export interface Source {
  name: string;
  path: string;
  recursive?: boolean;
  url?: string;
}

export interface Config {
  sources: Source[];
  targets: string[];
  disabledSources: string[];
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
