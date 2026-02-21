export interface TargetLabel {
  name: string;
  status: "installed" | "disabled";
}

export interface SkillViewModel {
  id: string;
  name: string;
  description: string;
  sourcePath: string;
  sourceName: string;
  pathLabel: string;
  installName: string;
  installed: boolean;
  disabled: boolean;
  partiallyInstalled: boolean;
  unmanaged: boolean;
  targetLabels: TargetLabel[];
}

export interface SourceViewModel {
  id: string;
  name: string;
  path: string;
  recursive: boolean;
  repoUrl?: string;
  enabled: boolean;
  installedCount: number;
  totalCount: number;
  skills: SkillViewModel[];
}

export interface SettingViewModel {
  id: string;
  name: string;
  targetPath: string;
  isTarget: boolean;
  isDetected: boolean;
}

export interface SuggestedSourceViewModel {
  name: string;
  url: string;
}

export interface PersonalRepoViewModel {
  configured: boolean;
  path: string;
  exists: boolean;
  isGitRepo: boolean;
}

export interface Snapshot {
  generatedAt: string;
  exportDefaultPath: string;
  skills: SkillViewModel[];
  installedSkills: SkillViewModel[];
  availableSkills: SkillViewModel[];
  sources: SourceViewModel[];
  suggestedSources: SuggestedSourceViewModel[];
  settings: SettingViewModel[];
  personalRepo: PersonalRepoViewModel;
}

export interface RecommendationItem {
  skillId: string;
  skillName: string;
  description: string;
  reason: string;
  trigger: string;
  exampleQuery: string;
  confidence: "high" | "medium" | "low";
  usageStatus: "unused" | "low-use" | "used";
  evidenceSource: string;
  matchedSessions: number;
  matchedQueries: number;
}

export interface RecommendationHistorySummary {
  totalQueries: number;
  uniqueSessions: number;
}

export interface RecommendationRunStats {
  scannedSkills?: number;
  rawQueryEvents?: number;
  rawCursorQueryEvents?: number;
  rawCodexQueryEvents?: number;
  deduplicatedQueries?: number;
  contextHistoryQueries?: number;
  contextSkills?: number;
  contextInstalledSkills?: number;
  requestedRecommendations?: number;
  returnedRecommendations?: number;
  agentDurationMs?: number;
  totalDurationMs?: number;
}

export interface RecommendationData {
  items: RecommendationItem[];
  historySummary: RecommendationHistorySummary | null;
  stats: RecommendationRunStats | null;
}

export interface RecommendationProgress {
  active: boolean;
  stage: string;
  percent: number;
  message: string;
  stats: RecommendationRunStats | null;
}

export type SkillReviewDimensionId =
  | "clarity"
  | "coverage"
  | "actionability"
  | "safety"
  | "maintainability"
  | "signal-to-noise";

export interface SkillReviewDimension {
  id: SkillReviewDimensionId;
  label: string;
  score: number;
  summary: string;
  strengths: string[];
  issues: string[];
  suggestions: string[];
}

export interface SkillReviewSnapshot {
  generatedAt: string;
  skillId: string;
  skillName: string;
  summary: string;
  overallScore: number;
  quickWins: string[];
  risks: string[];
  dimensions: SkillReviewDimension[];
}

export interface ImportPreviewSkill {
  index: number;
  name: string;
  description: string;
  repoUrl: string;
  skillPath: string;
}

export type TabId = "installed" | "available" | "sources" | "recommendations" | "settings";
