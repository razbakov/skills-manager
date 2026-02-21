/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface SkillsApi {
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
  adoptSkill: (skillId: string) => Promise<any>;
  addSource: (repoUrl: string) => Promise<any>;
  disableSource: (sourceId: string) => Promise<any>;
  enableSource: (sourceId: string) => Promise<any>;
  removeSource: (sourceId: string) => Promise<any>;
  pickImportBundle: () => Promise<any>;
  exportInstalled: () => Promise<any>;
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
