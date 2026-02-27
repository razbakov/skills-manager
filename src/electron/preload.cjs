const { contextBridge, ipcRenderer } = require("electron");

const skillSetLaunchChannel = "skills:launchSkillSet";

contextBridge.exposeInMainWorld("skillsApi", {
  consumeLaunchSkillSetRequest: () =>
    ipcRenderer.invoke("skills:consumeLaunchSkillSetRequest"),
  onSkillSetLaunch: (listener) => {
    if (typeof listener !== "function") {
      return () => { };
    }

    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on(skillSetLaunchChannel, wrapped);
    return () => ipcRenderer.removeListener(skillSetLaunchChannel, wrapped);
  },
  getSnapshot: () => ipcRenderer.invoke("skills:getSnapshot"),
  refresh: () => ipcRenderer.invoke("skills:refresh"),
  getRecommendations: (request) => ipcRenderer.invoke("skills:getRecommendations", request),
  reviewSkill: (skillId) => ipcRenderer.invoke("skills:reviewSkill", skillId),
  getSkillReview: (skillId) => ipcRenderer.invoke("skills:getSkillReview", skillId),
  getFeedbackSessions: (payload) =>
    ipcRenderer.invoke("skills:getFeedbackSessions", payload),
  getFeedbackSession: (payload) =>
    ipcRenderer.invoke("skills:getFeedbackSession", payload),
  analyzeFeedbackReport: (payload) =>
    ipcRenderer.invoke("skills:analyzeFeedbackReport", payload),
  saveFeedbackReport: (payload) =>
    ipcRenderer.invoke("skills:saveFeedbackReport", payload),
  submitFeedbackReport: (payload) =>
    ipcRenderer.invoke("skills:submitFeedbackReport", payload),
  onRecommendationProgress: (listener) => {
    if (typeof listener !== "function") {
      return () => { };
    }

    const channel = "skills:recommendationProgress";
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
  installSkill: (skillId) => ipcRenderer.invoke("skills:install", skillId),
  disableSkill: (skillId) => ipcRenderer.invoke("skills:disable", skillId),
  enableSkill: (skillId) => ipcRenderer.invoke("skills:enable", skillId),
  uninstallSkill: (skillId) => ipcRenderer.invoke("skills:uninstall", skillId),
  createSkillGroup: (request) => ipcRenderer.invoke("skills:createSkillGroup", request),
  toggleSkillGroup: (request) => ipcRenderer.invoke("skills:toggleSkillGroup", request),
  renameSkillGroup: (request) => ipcRenderer.invoke("skills:renameSkillGroup", request),
  deleteSkillGroup: (request) => ipcRenderer.invoke("skills:deleteSkillGroup", request),
  updateSkillGroupMembership: (request) =>
    ipcRenderer.invoke("skills:updateSkillGroupMembership", request),
  adoptSkill: (skillId) => ipcRenderer.invoke("skills:adopt", skillId),
  addSource: (repoUrl) => ipcRenderer.invoke("skills:addSource", repoUrl),
  previewAddSourceInput: (input) =>
    ipcRenderer.invoke("skills:previewAddSourceInput", input),
  getRuntimeAvailability: () =>
    ipcRenderer.invoke("skills:getRuntimeAvailability"),
  addSourceFromInput: (payload) =>
    ipcRenderer.invoke("skills:addSourceFromInput", payload),
  prepareSkillSetInstall: (request) =>
    ipcRenderer.invoke("skills:prepareSkillSetInstall", request),
  applySkillSetInstall: (request) =>
    ipcRenderer.invoke("skills:applySkillSetInstall", request),
  readCollectionSkillNames: (sourceUrl, collectionFile) =>
    ipcRenderer.invoke("skills:readCollectionSkillNames", sourceUrl, collectionFile),
  installCollectionSkills: (payload) =>
    ipcRenderer.invoke("skills:installCollectionSkills", payload),
  disableSource: (sourceId) => ipcRenderer.invoke("skills:disableSource", sourceId),
  enableSource: (sourceId) => ipcRenderer.invoke("skills:enableSource", sourceId),
  removeSource: (sourceId) => ipcRenderer.invoke("skills:removeSource", sourceId),
  pickImportBundle: () => ipcRenderer.invoke("skills:pickImportBundle"),
  exportInstalled: () => ipcRenderer.invoke("skills:exportInstalled"),
  exportSkillGroup: (request) => ipcRenderer.invoke("skills:exportSkillGroup", request),
  importInstalled: (request) => ipcRenderer.invoke("skills:importInstalled", request),
  getSkillMarkdown: (skillId) => ipcRenderer.invoke("skills:getSkillMarkdown", skillId),
  editSkill: (skillId) => ipcRenderer.invoke("skills:editSkill", skillId),
  openPath: (targetPath) => ipcRenderer.invoke("shell:openPath", targetPath),
  openExternal: (targetUrl) => ipcRenderer.invoke("shell:openExternal", targetUrl),
  toggleTarget: (targetPath) => ipcRenderer.invoke("skills:toggleTarget", targetPath),
  setPersonalSkillsRepoFromUrl: (repoUrl) =>
    ipcRenderer.invoke("skills:setPersonalSkillsRepoFromUrl", repoUrl),
  clearPersonalSkillsRepo: () => ipcRenderer.invoke("skills:clearPersonalSkillsRepo"),
  syncPersonalRepo: () => ipcRenderer.invoke("skills:syncPersonalRepo"),
  updateApp: () => ipcRenderer.invoke("skills:updateApp"),
});
