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

export interface SkillSetViewModel {
  name: string;
  skillCount: number;
}

export interface Snapshot {
  generatedAt: string;
  exportDefaultPath: string;
  activeBudget: {
    enabledCount: number;
    estimatedTokens: number;
    method: string;
  };
  skillSets: SkillSetViewModel[];
  activeSkillSet: string | null;
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
  | "triggering-precision"
  | "degrees-of-freedom-calibration"
  | "context-economy"
  | "verifiability"
  | "reversibility-and-safety"
  | "generalizability";

export type SkillReviewBand =
  | "weak"
  | "fair"
  | "good"
  | "strong"
  | "excellent";

export type SkillReviewVerdict =
  | "ready-to-use"
  | "needs-targeted-fixes"
  | "needs-rethink";

export interface SkillReviewDimension {
  id: SkillReviewDimensionId;
  label: string;
  score: number;
  summary: string;
}

export interface SkillReviewFailureMode {
  id: string;
  prediction: string;
  impact: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  relatedDimensions: SkillReviewDimensionId[];
  evidence?: string;
}

export interface SkillReviewCriticalIssue {
  statement: string;
  whyItMatters: string;
  failureModeId?: string;
}

export interface SkillReviewFix {
  id: string;
  title: string;
  priority: 1 | 2 | 3;
  targetsFailureModeIds: string[];
  rationale: string;
  proposedRewrite: string;
}

export interface SkillReviewSnapshot {
  schemaVersion: 3;
  framework: "skill-runtime-v1";
  generatedAt: string;
  skillId: string;
  skillName: string;
  summary: string;
  overallScore: number;
  overallScoreFive: number;
  overallBand: SkillReviewBand;
  verdict: SkillReviewVerdict;
  scoring: {
    dimensionScale: "1-5";
    overallScale: "0-100";
    method: "mean";
  };
  mostCriticalIssue: SkillReviewCriticalIssue;
  failureModePredictions: SkillReviewFailureMode[];
  prioritizedFixes: SkillReviewFix[];
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
