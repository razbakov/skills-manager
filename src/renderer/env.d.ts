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
  addSourceFromInput: (
    request: { input: string; selectedIndexes: number[] },
  ) => Promise<any>;
  prepareSkillSetInstall: (request: any) => Promise<any>;
  applySkillSetInstall: (request: any) => Promise<any>;
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
  updateApp: () => Promise<{ updated: boolean; message?: string; version?: string }>;
}

interface Window {
  skillsApi: SkillsApi;
}
