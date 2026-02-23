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

export function buildActiveBudgetSummary(skills: Skill[]): ActiveBudgetSummary {
  const enabledSkills = skills.filter((skill) => skill.installed && !skill.disabled);

  let estimatedTokens = 0;
  const enc = encoder();
  for (const skill of enabledSkills) {
    estimatedTokens += enc.encode(skillMetadataText(skill)).length;
  }

  return {
    enabledCount: enabledSkills.length,
    estimatedTokens,
    method: METHOD_LABEL,
  };
}
