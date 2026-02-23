import { get_encoding } from "tiktoken";
import type { Skill } from "./types";

const ENCODING_NAME = "cl100k_base";
const METHOD_LABEL = `tiktoken/${ENCODING_NAME}` as const;

let sharedEncoder: ReturnType<typeof get_encoding> | null = null;

function encoder(): ReturnType<typeof get_encoding> {
  if (!sharedEncoder) {
    sharedEncoder = get_encoding(ENCODING_NAME);
  }
  return sharedEncoder;
}

function skillMetadataText(skill: Skill): string {
  return `name: ${skill.name}\ndescription: ${skill.description || ""}\npath: ${skill.sourcePath}`;
}

export interface ActiveBudgetSummary {
  enabledCount: number;
  estimatedTokens: number;
  method: typeof METHOD_LABEL;
}

function installedSkills(skills: Skill[]): Skill[] {
  return skills.filter((skill) => skill.installed);
}

function enabledInstalledSkills(skills: Skill[]): Skill[] {
  return installedSkills(skills).filter((skill) => !skill.disabled);
}

function estimateTokens(skills: Skill[]): number {
  let estimatedTokens = 0;
  const enc = encoder();
  for (const skill of skills) {
    estimatedTokens += enc.encode(skillMetadataText(skill)).length;
  }
  return estimatedTokens;
}

export function buildActiveBudgetSummary(skills: Skill[]): ActiveBudgetSummary {
  const enabledSkills = enabledInstalledSkills(skills);

  return {
    enabledCount: enabledSkills.length,
    estimatedTokens: estimateTokens(enabledSkills),
    method: METHOD_LABEL,
  };
}

export function buildGroupBudgetSummary(skills: Skill[]): ActiveBudgetSummary {
  const installed = installedSkills(skills);
  const enabledCount = installed.filter((skill) => !skill.disabled).length;

  return {
    enabledCount,
    estimatedTokens: estimateTokens(installed),
    method: METHOD_LABEL,
  };
}
