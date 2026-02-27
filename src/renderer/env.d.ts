/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface SkillsApi {
  consumeLaunchSkillSetRequest: () => Promise<any>;
  onSkillSetLaunch: (listener: (payload: any) => void) => () => void;
  getSnapshot: () => Promise<any>;
  refresh: () => Promise<any>;
  getRecommendations: (request: any) => Promise<any>;
  reviewSkill: (skillId: string) => Promise<any>;
  getSkillReview: (skillId: string) => Promise<any>;
  getFeedbackSessions: (payload: { skillId: string }) => Promise<any[]>;
  getFeedbackSession: (payload: { sessionId: string }) => Promise<any>;
  analyzeFeedbackReport: (payload: {
    skillId: string;
    sessionId: string;
    messageId: string;
    whatWasWrong: string;
    expectedBehavior: string;
    suggestedRule: string;
  }) => Promise<any>;
  saveFeedbackReport: (payload: {
    reportId?: string;
    skillId: string;
    sessionId: string;
    messageId: string;
    whatWasWrong: string;
    expectedBehavior: string;
    suggestedRule: string;
    analysis: any;
  }) => Promise<any>;
  submitFeedbackReport: (payload: { reportId: string }) => Promise<any>;
  onRecommendationProgress: (listener: (payload: any) => void) => () => void;
  installSkill: (skillId: string) => Promise<any>;
  disableSkill: (skillId: string) => Promise<any>;
  enableSkill: (skillId: string) => Promise<any>;
  uninstallSkill: (skillId: string) => Promise<any>;
  createSkillGroup: (request: { name: string }) => Promise<any>;
  toggleSkillGroup: (request: { name: string; active: boolean }) => Promise<any>;
  renameSkillGroup: (request: { name: string; nextName: string }) => Promise<any>;
  deleteSkillGroup: (request: { name: string }) => Promise<any>;
  updateSkillGroupMembership: (
    request: { groupName: string; skillId: string; member: boolean },
  ) => Promise<any>;
  adoptSkill: (skillId: string) => Promise<any>;
  addSource: (repoUrl: string) => Promise<any>;
  previewAddSourceInput: (input: string) => Promise<any>;
  getRuntimeAvailability: () => Promise<{ npm: boolean; npx: boolean; bunx: boolean; git: boolean }>;
  addSourceFromInput: (
    request: {
      input: string;
      selectedIndexes: number[];
      saveToCollectionName?: string;
    },
  ) => Promise<any>;
  prepareSkillSetInstall: (request: any) => Promise<any>;
  applySkillSetInstall: (request: any) => Promise<any>;
  readCollectionSkillNames: (sourceUrl: string, collectionFile: string) => Promise<string[]>;
  installCollectionSkills: (request: {
    skillEntries: Array<{ name: string; description: string; repoUrl?: string; skillPath?: string }>;
    saveToCollectionName?: string;
  }) => Promise<{
    snapshot: any;
    installedCount: number;
    alreadyInstalledCount: number;
    failedCount: number;
    savedCollectionName?: string;
  }>;
  disableSource: (sourceId: string) => Promise<any>;
  enableSource: (sourceId: string) => Promise<any>;
  removeSource: (sourceId: string) => Promise<any>;
  pickImportBundle: () => Promise<any>;
  exportInstalled: () => Promise<any>;
  exportSkillGroup: (request: { name: string }) => Promise<any>;
  importInstalled: (request: any) => Promise<any>;
  getSkillMarkdown: (skillId: string) => Promise<string>;
  editSkill: (skillId: string) => Promise<void>;
  openPath: (targetPath: string) => Promise<void>;
  openExternal: (targetUrl: string) => Promise<void>;
  toggleTarget: (targetPath: string) => Promise<any>;
  setPersonalSkillsRepoFromUrl: (repoUrl: string) => Promise<any>;
  clearPersonalSkillsRepo: () => Promise<any>;
  syncPersonalRepo: () => Promise<any>;
  updateApp: () => Promise<{ updated: boolean; message?: string; version?: string }>;
}

interface Window {
  skillsApi: SkillsApi;
}
