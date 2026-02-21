const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("skillsApi", {
  getSnapshot: () => ipcRenderer.invoke("skills:getSnapshot"),
  refresh: () => ipcRenderer.invoke("skills:refresh"),
  getRecommendations: (request) => ipcRenderer.invoke("skills:getRecommendations", request),
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
  addSource: (repoUrl) => ipcRenderer.invoke("skills:addSource", repoUrl),
  disableSource: (sourceId) => ipcRenderer.invoke("skills:disableSource", sourceId),
  enableSource: (sourceId) => ipcRenderer.invoke("skills:enableSource", sourceId),
  removeSource: (sourceId) => ipcRenderer.invoke("skills:removeSource", sourceId),
  exportInstalled: () => ipcRenderer.invoke("skills:exportInstalled"),
  getSkillMarkdown: (skillId) => ipcRenderer.invoke("skills:getSkillMarkdown", skillId),
  editSkill: (skillId) => ipcRenderer.invoke("skills:editSkill", skillId),
  openPath: (targetPath) => ipcRenderer.invoke("shell:openPath", targetPath),
  openExternal: (targetUrl) => ipcRenderer.invoke("shell:openExternal", targetUrl),
  toggleTarget: (targetPath) => ipcRenderer.invoke("skills:toggleTarget", targetPath),
  updateApp: () => ipcRenderer.invoke("skills:updateApp"),
});
