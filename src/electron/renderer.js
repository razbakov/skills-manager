const api = window.skillsApi;

if (!api) {
  throw new Error("skillsApi bridge is unavailable.");
}

const TAB_IDS = ["installed", "available", "sources"];

const state = {
  snapshot: null,
  activeTab: "installed",
  busy: false,
  queries: {
    installed: "",
    available: "",
  },
  selected: {
    installed: null,
    available: null,
    source: null,
  },
  statusTimeout: null,
  skillMdCache: new Map(),
  previewRequestVersion: {
    installed: 0,
    available: 0,
  },
};

const tabButtons = Array.from(document.querySelectorAll(".tab"));
const tabViews = new Map(
  TAB_IDS.map((tabId) => [tabId, document.getElementById(`${tabId}-view`)]),
);

const installedSearch = document.getElementById("installed-search");
const availableSearch = document.getElementById("available-search");
const sourceUrlInput = document.getElementById("source-url");

const installedList = document.getElementById("installed-list");
const availableList = document.getElementById("available-list");
const sourcesList = document.getElementById("sources-list");
const sourceSkillsList = document.getElementById("source-skills-list");
const statusBar = document.getElementById("status-bar");

const installedTitle = document.getElementById("installed-title");
const installedDescription = document.getElementById("installed-description");
const installedSource = document.getElementById("installed-source");
const installedPath = document.getElementById("installed-path");
const installedOpenPath = document.getElementById("installed-open-path");
const installedToggle = document.getElementById("installed-toggle");
const installedUninstall = document.getElementById("installed-uninstall");
const installedSkillMd = document.getElementById("installed-skill-md");

const availableTitle = document.getElementById("available-title");
const availableDescription = document.getElementById("available-description");
const availableSource = document.getElementById("available-source");
const availablePath = document.getElementById("available-path");
const availableOpenPath = document.getElementById("available-open-path");
const availableInstall = document.getElementById("available-install");
const availableSkillMd = document.getElementById("available-skill-md");

const sourceTitle = document.getElementById("source-title");
const sourceMeta = document.getElementById("source-meta");
const sourceOpenPath = document.getElementById("source-open-path");
const sourceOpenRepo = document.getElementById("source-open-repo");

const refreshButton = document.getElementById("refresh-button");
const exportButton = document.getElementById("export-button");
const sourceAddButton = document.getElementById("source-add-button");

function clearStatusTimer() {
  if (state.statusTimeout) {
    clearTimeout(state.statusTimeout);
    state.statusTimeout = null;
  }
}

function setStatus(message, type = "info", durationMs = 2600) {
  clearStatusTimer();
  statusBar.textContent = message;
  statusBar.classList.remove("ok", "error", "pending");

  if (type === "ok" || type === "error" || type === "pending") {
    statusBar.classList.add(type);
  }

  if (durationMs > 0) {
    state.statusTimeout = setTimeout(() => {
      statusBar.classList.remove("ok", "error", "pending");
      if (statusBar.textContent === message) {
        statusBar.textContent = "Ready.";
      }
      state.statusTimeout = null;
    }, durationMs);
  }
}

function compactPath(rawPath) {
  if (!rawPath) return "-";
  const normalized = String(rawPath).replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return normalized || "-";
  const tail = parts.slice(-3).join("/");
  return tail;
}

function fuzzyScore(query, rawText) {
  const text = rawText.toLowerCase();
  const q = query.toLowerCase();
  if (!q) return 1;
  if (text.includes(q)) return 3;

  let qi = 0;
  for (const char of text) {
    if (char === q[qi]) {
      qi += 1;
      if (qi === q.length) return 1;
    }
  }
  return 0;
}

function filterSkills(skills, query) {
  if (!query.trim()) return skills;

  const filtered = [];
  for (const skill of skills) {
    const score = Math.max(
      fuzzyScore(query, skill.name),
      fuzzyScore(query, skill.description || ""),
      fuzzyScore(query, skill.sourcePath),
      fuzzyScore(query, skill.sourceName || ""),
      fuzzyScore(query, skill.installName || ""),
    );
    if (score > 0) {
      filtered.push({ skill, score });
    }
  }

  filtered.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.skill.name.localeCompare(b.skill.name, undefined, {
      sensitivity: "base",
      numeric: true,
    });
  });

  return filtered.map((entry) => entry.skill);
}

function findById(items, itemId) {
  return items.find((item) => item.id === itemId);
}

function buildSkillChip(skill) {
  if (!skill.installed) return { label: "available", className: "chip muted" };
  if (skill.disabled) return { label: "disabled", className: "chip warn" };
  return { label: "installed", className: "chip" };
}

function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function addEmptyState(listNode, message) {
  const empty = document.createElement("div");
  empty.className = "empty";
  empty.textContent = message;
  listNode.appendChild(empty);
}

function ensureSelectedRowInView(listNode) {
  const selectedRow = listNode.querySelector(".item.selected");
  if (!selectedRow) return;

  const rowTop = selectedRow.offsetTop;
  const rowBottom = rowTop + selectedRow.offsetHeight;
  const viewportTop = listNode.scrollTop;
  const viewportBottom = viewportTop + listNode.clientHeight;

  if (rowTop < viewportTop) {
    listNode.scrollTop = rowTop;
    return;
  }

  if (rowBottom > viewportBottom) {
    listNode.scrollTop = rowBottom - listNode.clientHeight;
  }
}

function setSkillMarkdownPreview(view, content, resetScroll = false) {
  const target = view === "installed" ? installedSkillMd : availableSkillMd;
  target.textContent = content;
  if (resetScroll) {
    target.scrollTop = 0;
  }
}

function requestSkillMarkdownPreview(view, skill) {
  if (!skill) {
    state.previewRequestVersion[view] += 1;
    setSkillMarkdownPreview(view, "Select a skill to preview SKILL.md.", true);
    return;
  }

  const cached = state.skillMdCache.get(skill.id);
  if (typeof cached === "string") {
    setSkillMarkdownPreview(view, cached, false);
    return;
  }

  setSkillMarkdownPreview(view, "Loading SKILL.md...", true);
  const requestVersion = ++state.previewRequestVersion[view];

  void api.getSkillMarkdown(skill.id)
    .then((content) => {
      if (requestVersion !== state.previewRequestVersion[view]) return;

      const normalizedContent =
        typeof content === "string" && content.trim().length > 0
          ? content
          : "(SKILL.md is empty)";
      state.skillMdCache.set(skill.id, normalizedContent);

      const currentSelectedSkill = view === "installed"
        ? getSelectedInstalledSkill()
        : getSelectedAvailableSkill();
      if (!currentSelectedSkill || currentSelectedSkill.id !== skill.id) return;

      setSkillMarkdownPreview(view, normalizedContent, true);
    })
    .catch((err) => {
      if (requestVersion !== state.previewRequestVersion[view]) return;

      const message = `Could not load SKILL.md: ${err?.message || "Unknown error"}`;
      setSkillMarkdownPreview(view, message, true);
    });
}

function createSkillListButton(skill, selected) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = `item${selected ? " selected" : ""}`;
  row.dataset.skillId = skill.id;

  const top = document.createElement("span");
  top.className = "item-topline";

  const name = document.createElement("span");
  name.className = "item-name";
  name.textContent = skill.name;

  const chip = document.createElement("span");
  const chipMeta = buildSkillChip(skill);
  chip.className = chipMeta.className;
  chip.textContent = chipMeta.label;

  top.append(name, chip);

  const description = document.createElement("span");
  description.className = "item-desc";
  description.textContent =
    `${compactPath(skill.sourcePath)} - ${skill.description || "(no description)"}`;

  row.append(top, description);
  return row;
}

function createSourceButton(source, selected) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = `item${selected ? " selected" : ""}`;
  row.dataset.sourceId = source.id;

  const top = document.createElement("span");
  top.className = "item-topline";

  const name = document.createElement("span");
  name.className = "item-name";
  name.textContent = source.name;

  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = `${source.installedCount}/${source.totalCount}`;

  const desc = document.createElement("span");
  desc.className = "item-desc";
  desc.textContent = source.repoUrl || source.path;

  top.append(name, chip);
  row.append(top, desc);
  return row;
}

function createSourceSkillRow(skill) {
  const row = document.createElement("div");
  row.className = "source-skill";

  const name = document.createElement("span");
  name.className = "source-skill-name";
  name.textContent = skill.name;

  const chip = document.createElement("span");
  const chipMeta = buildSkillChip(skill);
  chip.className = chipMeta.className;
  chip.textContent = chipMeta.label;

  const manage = document.createElement("button");
  manage.type = "button";
  manage.className = "secondary";
  manage.dataset.manageSkillId = skill.id;
  manage.textContent = "Manage";

  row.append(name, chip, manage);
  return row;
}

function ensureSelection() {
  if (!state.snapshot) return;

  const installedSkills = state.snapshot.installedSkills;
  const availableSkills = state.snapshot.availableSkills;
  const sources = state.snapshot.sources;

  if (!findById(installedSkills, state.selected.installed)) {
    state.selected.installed = installedSkills[0]?.id || null;
  }
  if (!findById(availableSkills, state.selected.available)) {
    state.selected.available = availableSkills[0]?.id || null;
  }
  if (!findById(sources, state.selected.source)) {
    state.selected.source = sources[0]?.id || null;
  }
}

function getSelectedInstalledSkill() {
  if (!state.snapshot) return null;
  return findById(state.snapshot.installedSkills, state.selected.installed) || null;
}

function getSelectedAvailableSkill() {
  if (!state.snapshot) return null;
  return findById(state.snapshot.availableSkills, state.selected.available) || null;
}

function getSelectedSource() {
  if (!state.snapshot) return null;
  return findById(state.snapshot.sources, state.selected.source) || null;
}

function renderTabs() {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === state.activeTab;
    button.classList.toggle("active", isActive);
  });

  for (const tabId of TAB_IDS) {
    const tabView = tabViews.get(tabId);
    if (!tabView) continue;
    tabView.classList.toggle("active", tabId === state.activeTab);
  }
}

function renderInstalledView() {
  if (!state.snapshot) return;

  const filtered = filterSkills(state.snapshot.installedSkills, state.queries.installed);
  clearNode(installedList);
  if (filtered.length === 0) {
    addEmptyState(installedList, "No installed skills match your search.");
  } else {
    filtered.forEach((skill) => {
      installedList.appendChild(createSkillListButton(skill, skill.id === state.selected.installed));
    });
    ensureSelectedRowInView(installedList);
  }

  const selectedSkill = getSelectedInstalledSkill();
  if (!selectedSkill) {
    installedTitle.textContent = "No installed skill selected";
    installedDescription.textContent = "Pick a skill to manage enable, disable, or uninstall state.";
    installedSource.textContent = "-";
    installedPath.textContent = "-";
    installedToggle.disabled = true;
    installedUninstall.disabled = true;
    installedOpenPath.disabled = true;
    installedToggle.textContent = "Disable Skill";
    requestSkillMarkdownPreview("installed", null);
    return;
  }

  installedTitle.textContent = selectedSkill.name;
  installedDescription.textContent = selectedSkill.description || "(no description)";
  installedSource.textContent = selectedSkill.sourceName || "-";
  installedPath.textContent = compactPath(selectedSkill.sourcePath);
  installedToggle.disabled = state.busy;
  installedUninstall.disabled = state.busy;
  installedOpenPath.disabled = false;
  installedToggle.textContent = selectedSkill.disabled ? "Enable Skill" : "Disable Skill";
  requestSkillMarkdownPreview("installed", selectedSkill);
}

function renderAvailableView() {
  if (!state.snapshot) return;

  const filtered = filterSkills(state.snapshot.availableSkills, state.queries.available);
  clearNode(availableList);
  if (filtered.length === 0) {
    addEmptyState(availableList, "No available skills match your search.");
  } else {
    filtered.forEach((skill) => {
      availableList.appendChild(createSkillListButton(skill, skill.id === state.selected.available));
    });
    ensureSelectedRowInView(availableList);
  }

  const selectedSkill = getSelectedAvailableSkill();
  if (!selectedSkill) {
    availableTitle.textContent = "No available skill selected";
    availableDescription.textContent = "Choose a skill to install it across configured targets.";
    availableSource.textContent = "-";
    availablePath.textContent = "-";
    availableInstall.disabled = true;
    availableOpenPath.disabled = true;
    requestSkillMarkdownPreview("available", null);
    return;
  }

  availableTitle.textContent = selectedSkill.name;
  availableDescription.textContent = selectedSkill.description || "(no description)";
  availableSource.textContent = selectedSkill.sourceName || "-";
  availablePath.textContent = compactPath(selectedSkill.sourcePath);
  availableInstall.disabled = state.busy;
  availableOpenPath.disabled = false;
  requestSkillMarkdownPreview("available", selectedSkill);
}

function renderSourcesView() {
  if (!state.snapshot) return;

  clearNode(sourcesList);
  if (state.snapshot.sources.length === 0) {
    addEmptyState(sourcesList, "No sources discovered.");
  } else {
    state.snapshot.sources.forEach((source) => {
      sourcesList.appendChild(createSourceButton(source, source.id === state.selected.source));
    });
    ensureSelectedRowInView(sourcesList);
  }

  const selectedSource = getSelectedSource();
  if (!selectedSource) {
    sourceTitle.textContent = "No source selected";
    sourceMeta.textContent = "Select a source package to inspect contained skills.";
    sourceOpenPath.disabled = true;
    sourceOpenRepo.disabled = true;
    clearNode(sourceSkillsList);
    addEmptyState(sourceSkillsList, "No source selected.");
    return;
  }

  sourceTitle.textContent =
    `${selectedSource.name} (${selectedSource.installedCount}/${selectedSource.totalCount})`;
  sourceMeta.textContent = selectedSource.repoUrl || selectedSource.path;
  sourceOpenPath.disabled = false;
  sourceOpenRepo.disabled = !selectedSource.repoUrl;

  clearNode(sourceSkillsList);
  if (selectedSource.skills.length === 0) {
    addEmptyState(sourceSkillsList, "No skills discovered for this source.");
    return;
  }

  selectedSource.skills.forEach((skill) => {
    sourceSkillsList.appendChild(createSourceSkillRow(skill));
  });
}

function render() {
  renderTabs();
  renderInstalledView();
  renderAvailableView();
  renderSourcesView();
}

function applySnapshot(snapshot) {
  state.snapshot = snapshot;
  state.skillMdCache.clear();
  state.previewRequestVersion.installed += 1;
  state.previewRequestVersion.available += 1;
  ensureSelection();
  render();
}

async function runTask(task, pendingMessage, successMessage) {
  if (state.busy) return;
  state.busy = true;
  document.body.classList.add("busy");
  setStatus(pendingMessage, "pending", 0);
  render();

  try {
    const result = await task();
    const snapshot = result?.snapshot || result;
    if (snapshot?.skills) {
      applySnapshot(snapshot);
    }
    if (successMessage) {
      setStatus(successMessage(result), "ok");
    } else {
      setStatus("Done.", "ok");
    }
  } catch (err) {
    setStatus(err?.message || "Operation failed.", "error", 4200);
  } finally {
    state.busy = false;
    document.body.classList.remove("busy");
    render();
  }
}

function isTextInput(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function switchTab(nextTab) {
  if (!TAB_IDS.includes(nextTab)) return;
  state.activeTab = nextTab;
  renderTabs();
}

function moveSelection(delta) {
  if (!state.snapshot) return;

  if (state.activeTab === "installed") {
    const list = filterSkills(state.snapshot.installedSkills, state.queries.installed);
    if (!list.length) return;
    const currentIndex = Math.max(0, list.findIndex((skill) => skill.id === state.selected.installed));
    const nextIndex = Math.max(0, Math.min(list.length - 1, currentIndex + delta));
    state.selected.installed = list[nextIndex].id;
    renderInstalledView();
    return;
  }

  if (state.activeTab === "available") {
    const list = filterSkills(state.snapshot.availableSkills, state.queries.available);
    if (!list.length) return;
    const currentIndex = Math.max(0, list.findIndex((skill) => skill.id === state.selected.available));
    const nextIndex = Math.max(0, Math.min(list.length - 1, currentIndex + delta));
    state.selected.available = list[nextIndex].id;
    renderAvailableView();
    return;
  }

  if (state.activeTab === "sources") {
    const list = state.snapshot.sources;
    if (!list.length) return;
    const currentIndex = Math.max(0, list.findIndex((source) => source.id === state.selected.source));
    const nextIndex = Math.max(0, Math.min(list.length - 1, currentIndex + delta));
    state.selected.source = list[nextIndex].id;
    renderSourcesView();
  }
}

function focusCurrentSearch() {
  if (state.activeTab === "installed") {
    installedSearch.focus();
    installedSearch.select();
    return;
  }
  if (state.activeTab === "available") {
    availableSearch.focus();
    availableSearch.select();
  }
}

function jumpToSkill(skillId) {
  if (!state.snapshot) return;
  const skill = findById(state.snapshot.skills, skillId);
  if (!skill) return;

  if (skill.installed) {
    state.selected.installed = skill.id;
    switchTab("installed");
    renderInstalledView();
    setStatus(`Focused ${skill.name} in Installed.`, "ok");
    return;
  }

  state.selected.available = skill.id;
  switchTab("available");
  renderAvailableView();
  setStatus(`Focused ${skill.name} in Available.`, "ok");
}

async function refreshSnapshot() {
  await runTask(
    () => api.refresh(),
    "Refreshing skills...",
    (snapshot) => {
      const total = snapshot?.skills?.length || 0;
      return `Loaded ${total} skills.`;
    },
  );
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tab = button.dataset.tab;
    if (!tab) return;
    switchTab(tab);
  });
});

installedSearch.addEventListener("input", () => {
  state.queries.installed = installedSearch.value;
  renderInstalledView();
});

availableSearch.addEventListener("input", () => {
  state.queries.available = availableSearch.value;
  renderAvailableView();
});

installedList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-skill-id]");
  if (!row) return;
  state.selected.installed = row.dataset.skillId;
  renderInstalledView();
});

availableList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-skill-id]");
  if (!row) return;
  state.selected.available = row.dataset.skillId;
  renderAvailableView();
});

sourcesList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-source-id]");
  if (!row) return;
  state.selected.source = row.dataset.sourceId;
  renderSourcesView();
});

sourceSkillsList.addEventListener("click", (event) => {
  const manageButton = event.target.closest("[data-manage-skill-id]");
  if (!manageButton) return;
  jumpToSkill(manageButton.dataset.manageSkillId);
});

refreshButton.addEventListener("click", () => {
  void refreshSnapshot();
});

exportButton.addEventListener("click", () => {
  void runTask(
    () => api.exportInstalled(),
    "Exporting installed skills...",
    (result) => `Exported ${result.installedCount} installed skills to ${result.outputPath}.`,
  );
});

installedOpenPath.addEventListener("click", () => {
  const selectedSkill = getSelectedInstalledSkill();
  if (!selectedSkill) return;
  void api.openPath(selectedSkill.sourcePath);
});

availableOpenPath.addEventListener("click", () => {
  const selectedSkill = getSelectedAvailableSkill();
  if (!selectedSkill) return;
  void api.openPath(selectedSkill.sourcePath);
});

sourceOpenPath.addEventListener("click", () => {
  const source = getSelectedSource();
  if (!source) return;
  void api.openPath(source.path);
});

sourceOpenRepo.addEventListener("click", () => {
  const source = getSelectedSource();
  if (!source?.repoUrl) return;
  void api.openExternal(source.repoUrl);
});

installedToggle.addEventListener("click", () => {
  const selectedSkill = getSelectedInstalledSkill();
  if (!selectedSkill) return;
  const isEnable = selectedSkill.disabled;
  void runTask(
    () => (isEnable ? api.enableSkill(selectedSkill.id) : api.disableSkill(selectedSkill.id)),
    `${isEnable ? "Enabling" : "Disabling"} ${selectedSkill.name}...`,
    () => `${isEnable ? "Enabled" : "Disabled"} ${selectedSkill.name}.`,
  );
});

installedUninstall.addEventListener("click", () => {
  const selectedSkill = getSelectedInstalledSkill();
  if (!selectedSkill) return;
  void runTask(
    () => api.uninstallSkill(selectedSkill.id),
    `Uninstalling ${selectedSkill.name}...`,
    () => `Uninstalled ${selectedSkill.name}.`,
  );
});

availableInstall.addEventListener("click", () => {
  const selectedSkill = getSelectedAvailableSkill();
  if (!selectedSkill) return;
  void runTask(
    () => api.installSkill(selectedSkill.id),
    `Installing ${selectedSkill.name}...`,
    () => `Installed ${selectedSkill.name}.`,
  );
});

sourceAddButton.addEventListener("click", () => {
  const repoUrl = sourceUrlInput.value.trim();
  if (!repoUrl) {
    setStatus("Enter a GitHub repository URL.", "error");
    return;
  }

  void runTask(
    () => api.addSource(repoUrl),
    "Adding source package...",
    (result) => {
      sourceUrlInput.value = "";
      return `Added source ${result.sourceName}.`;
    },
  );
});

sourceUrlInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  sourceAddButton.click();
});

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && ["1", "2", "3"].includes(event.key)) {
    const index = Number(event.key) - 1;
    switchTab(TAB_IDS[index]);
    event.preventDefault();
    return;
  }

  if (event.key === "/" && !isTextInput(event.target)) {
    focusCurrentSearch();
    event.preventDefault();
    return;
  }

  if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !isTextInput(event.target)) {
    moveSelection(event.key === "ArrowDown" ? 1 : -1);
    event.preventDefault();
    return;
  }

  if (event.key === "Enter" && !isTextInput(event.target)) {
    if (state.activeTab === "installed") {
      installedToggle.click();
      event.preventDefault();
      return;
    }
    if (state.activeTab === "available") {
      availableInstall.click();
      event.preventDefault();
    }
  }
});

void refreshSnapshot();
