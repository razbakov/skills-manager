const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("skillsApi", {
  getSnapshot: () => ipcRenderer.invoke("skills:getSnapshot"),
  refresh: () => ipcRenderer.invoke("skills:refresh"),
  installSkill: (skillId) => ipcRenderer.invoke("skills:install", skillId),
  disableSkill: (skillId) => ipcRenderer.invoke("skills:disable", skillId),
  enableSkill: (skillId) => ipcRenderer.invoke("skills:enable", skillId),
  uninstallSkill: (skillId) => ipcRenderer.invoke("skills:uninstall", skillId),
  addSource: (repoUrl) => ipcRenderer.invoke("skills:addSource", repoUrl),
  exportInstalled: () => ipcRenderer.invoke("skills:exportInstalled"),
  openPath: (targetPath) => ipcRenderer.invoke("shell:openPath", targetPath),
  openExternal: (targetUrl) => ipcRenderer.invoke("shell:openExternal", targetUrl),
});
