const api = window.skillsApi;

if (!api) {
  throw new Error("skillsApi bridge is unavailable.");
}

const TAB_IDS = ["installed", "available", "sources", "recommendations", "settings"];

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
    recommendation: null,
    setting: null,
  },
  recommendations: {
    mode: "standard",
    loading: false,
    data: null,
    progress: {
      active: false,
      stage: "idle",
      percent: 0,
      message: "Waiting for run.",
      stats: null,
    },
  },
  statusTimeout: null,
  skillMdCache: new Map(),
  previewRequestVersion: {
    installed: 0,
    available: 0,
  },
  importPreview: {
    open: false,
    inputPath: "",
    skills: [],
    selectedIndexes: new Set(),
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
const sourcesSuggestedList = document.getElementById("sources-suggested-list");
const statusBar = document.getElementById("status-bar");

const installedTitle = document.getElementById("installed-title");
const installedDescription = document.getElementById("installed-description");
const installedSource = document.getElementById("installed-source");
const installedPath = document.getElementById("installed-path");
const installedIdesRow = document.getElementById("installed-ides-row");
const installedIdes = document.getElementById("installed-ides");
const installedOpenPath = document.getElementById("installed-open-path");
const installedAdopt = document.getElementById("installed-adopt");
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
const sourceDisable = document.getElementById("source-disable");
const sourceRemove = document.getElementById("source-remove");

const refreshButton = document.getElementById("refresh-button");
const exportButton = document.getElementById("export-button");
const importButton = document.getElementById("import-button");
const sourceAddButton = document.getElementById("source-add-button");
const recommendationMode = document.getElementById("recommendation-mode");
const recommendationRunButton = document.getElementById("recommendation-run-button");
const recommendationProgress = document.getElementById("recommendation-progress");
const recommendationProgressStage = document.getElementById("recommendation-progress-stage");
const recommendationProgressPercent = document.getElementById("recommendation-progress-percent");
const recommendationProgressBar = document.getElementById("recommendation-progress-bar");
const recommendationProgressMessage = document.getElementById("recommendation-progress-message");
const recommendationProgressStats = document.getElementById("recommendation-progress-stats");
const recommendationList = document.getElementById("recommendation-list");
const recommendationTitle = document.getElementById("recommendation-title");
const recommendationSummary = document.getElementById("recommendation-summary");
const recommendationUsage = document.getElementById("recommendation-usage");
const recommendationConfidence = document.getElementById("recommendation-confidence");
const recommendationSource = document.getElementById("recommendation-source");
const recommendationMatches = document.getElementById("recommendation-matches");
const recommendationReason = document.getElementById("recommendation-reason");
const recommendationTrigger = document.getElementById("recommendation-trigger");
const recommendationExample = document.getElementById("recommendation-example");
const recommendationManage = document.getElementById("recommendation-manage");
const recommendationInstall = document.getElementById("recommendation-install");

const settingsList = document.getElementById("settings-list");
const settingsTitle = document.getElementById("settings-title");
const settingsDescription = document.getElementById("settings-description");
const settingsStatus = document.getElementById("settings-status");
const settingsPath = document.getElementById("settings-path");
const settingsToggle = document.getElementById("settings-toggle");

const updateButton = document.getElementById("update-button");
const importModal = document.getElementById("import-modal");
const importModalMeta = document.getElementById("import-modal-meta");
const importList = document.getElementById("import-list");
const importSelectAll = document.getElementById("import-select-all");
const importSelectNone = document.getElementById("import-select-none");
const importCancel = document.getElementById("import-cancel");
const importConfirm = document.getElementById("import-confirm");

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

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(toFiniteNumber(value))));
}

function formatDurationMs(value) {
  const ms = Math.max(0, Math.round(toFiniteNumber(value)));
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatRecommendationStats(stats) {
  if (!stats || typeof stats !== "object") {
    return "-";
  }

  const scannedSkills = Math.max(0, Math.round(toFiniteNumber(stats.scannedSkills)));
  const rawEvents = Math.max(0, Math.round(toFiniteNumber(stats.rawQueryEvents)));
  const cursorRaw = Math.max(0, Math.round(toFiniteNumber(stats.rawCursorQueryEvents)));
  const codexRaw = Math.max(0, Math.round(toFiniteNumber(stats.rawCodexQueryEvents)));
  const deduplicated = Math.max(0, Math.round(toFiniteNumber(stats.deduplicatedQueries)));
  const contextHistory = Math.max(0, Math.round(toFiniteNumber(stats.contextHistoryQueries)));
  const contextSkills = Math.max(0, Math.round(toFiniteNumber(stats.contextSkills)));
  const contextInstalled = Math.max(0, Math.round(toFiniteNumber(stats.contextInstalledSkills)));
  const requested = Math.max(0, Math.round(toFiniteNumber(stats.requestedRecommendations)));
  const returned = Math.max(0, Math.round(toFiniteNumber(stats.returnedRecommendations)));
  const agentDuration = formatDurationMs(stats.agentDurationMs);
  const totalDuration = formatDurationMs(stats.totalDurationMs);

  return [
    `Scanned skills: ${scannedSkills}`,
    `Raw history events: ${rawEvents} (Cursor ${cursorRaw}, Codex ${codexRaw})`,
    `Deduplicated queries: ${deduplicated}`,
    `Context: ${contextHistory} queries, ${contextSkills} skills (${contextInstalled} installed)`,
    `Recommendations: ${returned}/${requested}`,
    `Durations: agent ${agentDuration}, total ${totalDuration}`,
  ].join("\n");
}

function setRecommendationProgress(progress, active = state.recommendations.loading) {
  if (!progress || typeof progress !== "object") return;

  state.recommendations.progress = {
    active,
    stage: typeof progress.stage === "string" ? progress.stage : "unknown",
    percent: clampPercent(progress.percent),
    message: typeof progress.message === "string" && progress.message.trim()
      ? progress.message.trim()
      : state.recommendations.progress.message,
    stats:
      progress.stats && typeof progress.stats === "object"
        ? {
          ...(state.recommendations.progress.stats || {}),
          ...progress.stats,
        }
        : state.recommendations.progress.stats,
  };
}

function formatRecommendationStage(stage) {
  if (typeof stage !== "string" || !stage.trim()) return "Idle";
  return stage
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  if (skill.unmanaged) return { label: "local", className: "chip muted" };
  if (skill.disabled) return { label: "disabled", className: "chip warn" };
  if (skill.partiallyInstalled) return { label: "partial", className: "chip warn" };
  return { label: "installed", className: "chip" };
}

function buildUsageChip(rec) {
  if (rec.usageStatus === "unused") return { label: "unused", className: "chip warn" };
  if (rec.usageStatus === "low-use") return { label: "low-use", className: "chip muted" };
  return { label: "used", className: "chip" };
}

function buildConfidenceChip(rec) {
  if (rec.confidence === "high") return { label: "high", className: "chip" };
  if (rec.confidence === "medium") return { label: "medium", className: "chip muted" };
  return { label: "low", className: "chip warn" };
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

function closeImportPreview() {
  state.importPreview.open = false;
  state.importPreview.inputPath = "";
  state.importPreview.skills = [];
  state.importPreview.selectedIndexes = new Set();
}

function getSelectedImportIndexes() {
  return Array.from(state.importPreview.selectedIndexes).sort((a, b) => a - b);
}

function createImportPreviewRow(skill, selected) {
  const row = document.createElement("label");
  row.className = "import-row";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "import-row-check";
  checkbox.checked = selected;
  checkbox.dataset.importIndex = String(skill.index);

  const content = document.createElement("div");
  content.className = "import-row-content";

  const title = document.createElement("span");
  title.className = "import-row-title";
  title.textContent = skill.name || "(unnamed skill)";

  const description = document.createElement("span");
  description.className = "import-row-description";
  description.textContent = skill.description || "(no description)";

  const metaParts = [];
  if (skill.repoUrl) {
    metaParts.push(skill.repoUrl);
  } else {
    metaParts.push("missing repo URL");
  }
  if (skill.skillPath) {
    metaParts.push(skill.skillPath);
  }

  const meta = document.createElement("span");
  meta.className = "import-row-meta";
  meta.textContent = metaParts.join(" • ");

  content.append(title, description, meta);
  row.append(checkbox, content);
  return row;
}

function renderImportPreview() {
  const isOpen = state.importPreview.open;
  importModal.classList.toggle("active", isOpen);
  importModal.setAttribute("aria-hidden", isOpen ? "false" : "true");

  if (!isOpen) return;

  const total = state.importPreview.skills.length;
  const selectedCount = getSelectedImportIndexes().length;
  const bundlePath = state.importPreview.inputPath || "";
  importModalMeta.textContent =
    `${total} skill${total === 1 ? "" : "s"} in ${bundlePath}. ${selectedCount} selected.`;

  clearNode(importList);
  if (total === 0) {
    addEmptyState(importList, "No skills found in this bundle.");
  } else {
    state.importPreview.skills.forEach((skill) => {
      importList.appendChild(
        createImportPreviewRow(skill, state.importPreview.selectedIndexes.has(skill.index)),
      );
    });
  }

  importSelectAll.disabled = state.busy || total === 0;
  importSelectNone.disabled = state.busy || selectedCount === 0;
  importCancel.disabled = state.busy;
  importConfirm.disabled = state.busy || selectedCount === 0;
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
    skill.sourceName && skill.sourceName !== "unknown"
      ? skill.sourceName
      : (skill.pathLabel || compactPath(skill.sourcePath));

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

  top.append(name, chip);

  if (source.enabled === false) {
    const disabledChip = document.createElement("span");
    disabledChip.className = "chip warn";
    disabledChip.textContent = "disabled";
    top.append(disabledChip);
  }

  const desc = document.createElement("span");
  desc.className = "item-desc";
  desc.textContent = source.repoUrl || source.path;

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

function createSuggestedSourceRow(source) {
  const row = document.createElement("div");
  row.className = "suggested-source";

  const info = document.createElement("div");
  info.className = "suggested-source-info";

  const name = document.createElement("span");
  name.className = "suggested-source-name";
  name.textContent = source.name;

  const url = document.createElement("span");
  url.className = "suggested-source-url";
  url.textContent = source.url;

  info.append(name, url);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "secondary";
  addBtn.textContent = "Add";
  addBtn.dataset.suggestedUrl = source.url;

  row.append(info, addBtn);
  return row;
}

function createRecommendationButton(rec, selected) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = `item${selected ? " selected" : ""}`;
  row.dataset.recommendationSkillId = rec.skillId;

  const top = document.createElement("span");
  top.className = "item-topline";

  const name = document.createElement("span");
  name.className = "item-name";
  name.textContent = rec.skillName;

  const usageChipMeta = buildUsageChip(rec);
  const usageChip = document.createElement("span");
  usageChip.className = usageChipMeta.className;
  usageChip.textContent = usageChipMeta.label;

  const confidenceChipMeta = buildConfidenceChip(rec);
  const confidenceChip = document.createElement("span");
  confidenceChip.className = confidenceChipMeta.className;
  confidenceChip.textContent = confidenceChipMeta.label;

  top.append(name, usageChip, confidenceChip);

  const meta = document.createElement("span");
  meta.className = "item-meta";
  meta.textContent = `${rec.confidence} confidence • ${rec.evidenceSource}`;

  const desc = document.createElement("span");
  desc.className = "item-desc";
  desc.textContent = rec.reason || rec.description || "(no reason)";

  row.append(top, meta, desc);
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

  const recommendationItems = state.recommendations.data?.items || [];
  const hasRecommendation = recommendationItems.some(
    (item) => item.skillId === state.selected.recommendation,
  );
  if (!hasRecommendation) {
    state.selected.recommendation = recommendationItems[0]?.skillId || null;
  }

  if (!findById(state.snapshot.settings, state.selected.setting)) {
    state.selected.setting = state.snapshot.settings[0]?.id || null;
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

function getSkillById(skillId) {
  if (!state.snapshot) return null;
  return findById(state.snapshot.skills, skillId) || null;
}

function getSelectedRecommendation() {
  const items = state.recommendations.data?.items || [];
  return items.find((item) => item.skillId === state.selected.recommendation) || null;
}

function getSelectedSetting() {
  if (!state.snapshot) return null;
  return findById(state.snapshot.settings, state.selected.setting) || null;
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

function formatInstalledIdes(skill) {
  if (!skill || !skill.targetLabels || skill.targetLabels.length === 0) return "-";

  const configuredCount = state.snapshot?.settings?.filter((s) => s.isTarget).length ?? 0;
  const allInstalled =
    configuredCount > 1 &&
    skill.targetLabels.length === configuredCount &&
    skill.targetLabels.every((t) => t.status === "installed");

  if (allInstalled) return "All IDEs";

  return skill.targetLabels
    .map((t) => (t.status === "disabled" ? `${t.name} (disabled)` : t.name))
    .join(", ");
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

  const configuredTargetCount = state.snapshot?.settings?.filter((s) => s.isTarget).length ?? 0;
  installedIdesRow.style.display = configuredTargetCount <= 1 ? "none" : "";

  const selectedSkill = getSelectedInstalledSkill();
  if (!selectedSkill) {
    installedTitle.textContent = "No installed skill selected";
    installedDescription.textContent = "Pick a skill to manage enable, disable, or uninstall state.";
    installedSource.textContent = "-";
    installedPath.textContent = "-";
    installedIdes.textContent = "-";
    installedAdopt.disabled = true;
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
  installedPath.textContent = selectedSkill.pathLabel || compactPath(selectedSkill.sourcePath);
  installedIdes.textContent = formatInstalledIdes(selectedSkill);
  installedAdopt.disabled = state.busy || !selectedSkill.unmanaged;
  installedToggle.disabled = state.busy || selectedSkill.unmanaged;
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
  availablePath.textContent = selectedSkill.pathLabel || compactPath(selectedSkill.sourcePath);
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
    sourceDisable.disabled = true;
    sourceDisable.textContent = "Disable Source";
    sourceRemove.disabled = true;
    clearNode(sourceSkillsList);
    addEmptyState(sourceSkillsList, "No source selected.");
  } else {
    sourceTitle.textContent =
      `${selectedSource.name} (${selectedSource.installedCount}/${selectedSource.totalCount})`;
    sourceMeta.textContent = selectedSource.repoUrl || selectedSource.path;
    sourceOpenPath.disabled = false;
    sourceOpenRepo.disabled = !selectedSource.repoUrl;
    sourceDisable.disabled = state.busy;
    sourceRemove.disabled = state.busy;

    if (selectedSource.enabled === false) {
      sourceDisable.textContent = "Enable Source";
      sourceDisable.classList.remove("warn");
      sourceDisable.classList.add("secondary");
    } else {
      sourceDisable.textContent = "Disable Source";
      sourceDisable.classList.add("warn");
      sourceDisable.classList.remove("secondary");
    }

    clearNode(sourceSkillsList);
    if (selectedSource.skills.length === 0) {
      addEmptyState(sourceSkillsList, "No skills discovered for this source.");
    } else {
      selectedSource.skills.forEach((skill) => {
        sourceSkillsList.appendChild(createSourceSkillRow(skill));
      });
    }
  }

  clearNode(sourcesSuggestedList);
  const suggestions = state.snapshot.suggestedSources || [];
  if (suggestions.length === 0) {
    addEmptyState(sourcesSuggestedList, "All suggested sources have been added.");
  } else {
    suggestions.forEach((source) => {
      sourcesSuggestedList.appendChild(createSuggestedSourceRow(source));
    });
  }
}

function renderRecommendationsView() {
  const progress = state.recommendations.progress || {};
  const progressPercent = clampPercent(progress.percent);
  const progressStats = progress.stats || state.recommendations.data?.stats || null;

  recommendationRunButton.disabled = state.busy || state.recommendations.loading;
  recommendationMode.disabled = state.recommendations.loading;
  recommendationProgress.classList.toggle("active", state.recommendations.loading);
  recommendationProgressStage.textContent = formatRecommendationStage(progress.stage);
  recommendationProgressPercent.textContent = `${progressPercent}%`;
  recommendationProgressBar.style.width = `${progressPercent}%`;
  recommendationProgressMessage.textContent = progress.message || "Waiting for run.";
  recommendationProgressStats.textContent = formatRecommendationStats(progressStats);

  clearNode(recommendationList);

  if (state.recommendations.loading) {
    addEmptyState(
      recommendationList,
      `${progress.message || "Generating recommendations..."} (${progressPercent}%)`,
    );
  } else {
    const items = state.recommendations.data?.items || [];
    if (items.length === 0) {
      addEmptyState(recommendationList, "No recommendations yet. Click Generate.");
    } else {
      items.forEach((rec) => {
        recommendationList.appendChild(
          createRecommendationButton(rec, rec.skillId === state.selected.recommendation),
        );
      });
      ensureSelectedRowInView(recommendationList);
    }
  }

  const selectedRecommendation = getSelectedRecommendation();
  const historySummary = state.recommendations.data?.historySummary;
  const totalQueries = historySummary?.totalQueries || 0;
  const totalSessions = historySummary?.uniqueSessions || 0;
  const summaryLine = `${totalQueries} deduplicated queries across ${totalSessions} sessions.`;

  if (!selectedRecommendation) {
    recommendationTitle.textContent = "No recommendation selected";
    recommendationSummary.textContent = summaryLine;
    recommendationUsage.textContent = "-";
    recommendationConfidence.textContent = "-";
    recommendationSource.textContent = "-";
    recommendationMatches.textContent = "-";
    recommendationReason.textContent = "-";
    recommendationTrigger.textContent = "-";
    recommendationExample.textContent = "-";
    recommendationManage.disabled = true;
    recommendationInstall.disabled = true;
    return;
  }

  const selectedSkill = getSkillById(selectedRecommendation.skillId);
  const installed = Boolean(selectedSkill?.installed);

  recommendationTitle.textContent = selectedRecommendation.skillName;
  recommendationSummary.textContent = summaryLine;
  recommendationUsage.textContent = selectedRecommendation.usageStatus;
  recommendationConfidence.textContent = selectedRecommendation.confidence;
  recommendationSource.textContent = selectedRecommendation.evidenceSource;
  recommendationMatches.textContent =
    `${selectedRecommendation.matchedSessions} sessions • ${selectedRecommendation.matchedQueries} queries`;
  recommendationReason.textContent = selectedRecommendation.reason || "(no reason)";
  recommendationTrigger.textContent = selectedRecommendation.trigger || "(no trigger)";
  recommendationExample.textContent = selectedRecommendation.exampleQuery || "(no example)";
  recommendationManage.disabled = !selectedSkill;
  recommendationInstall.disabled = state.busy || installed || !selectedSkill;
}

function buildTargetChip(setting) {
  if (!setting.isDetected) return { label: "not detected", className: "chip muted" };
  if (!setting.isTarget) return { label: "disabled", className: "chip warn" };
  return { label: "enabled", className: "chip" };
}

function createSettingButton(setting, selected) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = `item${selected ? " selected" : ""}`;
  row.dataset.settingId = setting.id;

  const top = document.createElement("span");
  top.className = "item-topline";

  const name = document.createElement("span");
  name.className = "item-name";
  name.textContent = setting.name;

  const chipMeta = buildTargetChip(setting);
  const chip = document.createElement("span");
  chip.className = chipMeta.className;
  chip.textContent = chipMeta.label;

  top.append(name, chip);

  const desc = document.createElement("span");
  desc.className = "item-desc";
  desc.textContent = setting.targetPath;

  row.append(top, desc);
  return row;
}

function renderSettingsView() {
  if (!state.snapshot) return;

  clearNode(settingsList);
  if (state.snapshot.settings.length === 0) {
    addEmptyState(settingsList, "No target IDEs discovered.");
  } else {
    state.snapshot.settings.forEach((setting) => {
      settingsList.appendChild(createSettingButton(setting, setting.id === state.selected.setting));
    });
    ensureSelectedRowInView(settingsList);
  }

  const selectedSetting = getSelectedSetting();
  if (!selectedSetting) {
    settingsTitle.textContent = "No target selected";
    settingsDescription.textContent = "Select a target IDE to learn more about its status.";
    settingsStatus.textContent = "-";
    settingsPath.textContent = "-";
    settingsToggle.disabled = true;
    return;
  }

  settingsTitle.textContent = selectedSetting.name;
  settingsDescription.textContent = selectedSetting.isDetected ? "Detected locally." : "Not detected locally.";
  settingsStatus.textContent = selectedSetting.isTarget ? "Enabled" : "Disabled";
  settingsPath.textContent = selectedSetting.targetPath;
  settingsToggle.disabled = state.busy;
  // Match installed tab: warn class = destructive action (disable), default = constructive (enable)
  if (selectedSetting.isTarget) {
    settingsToggle.classList.add("warn");
    settingsToggle.classList.remove("secondary");
    settingsToggle.textContent = "Disable Target";
  } else {
    settingsToggle.classList.remove("warn");
    settingsToggle.classList.add("secondary");
    settingsToggle.textContent = "Enable Target";
  }
}

function render() {
  renderTabs();
  renderInstalledView();
  renderAvailableView();
  renderSourcesView();
  renderRecommendationsView();
  renderSettingsView();
  renderImportPreview();
}

function applySnapshot(snapshot) {
  state.snapshot = snapshot;
  state.skillMdCache.clear();
  state.previewRequestVersion.installed += 1;
  state.previewRequestVersion.available += 1;
  ensureSelection();
  render();
}

function formatImportSummary(result) {
  if (result?.cancelled) {
    return "Import canceled.";
  }

  const installed = Math.max(0, Math.round(toFiniteNumber(result?.installed)));
  const alreadyInstalled = Math.max(0, Math.round(toFiniteNumber(result?.alreadyInstalled)));
  const addedSources = Math.max(0, Math.round(toFiniteNumber(result?.addedSources)));
  const missingRepoUrl = Math.max(0, Math.round(toFiniteNumber(result?.missingRepoUrl)));
  const unsupportedRepoUrl = Math.max(0, Math.round(toFiniteNumber(result?.unsupportedRepoUrl)));
  const missingSkills = Array.isArray(result?.missingSkills) ? result.missingSkills.length : 0;

  const skipped = [];
  if (missingRepoUrl > 0) skipped.push(`${missingRepoUrl} missing repo URL`);
  if (unsupportedRepoUrl > 0) skipped.push(`${unsupportedRepoUrl} unsupported repo URL`);
  if (missingSkills > 0) skipped.push(`${missingSkills} not found`);

  const skippedSuffix = skipped.length > 0 ? ` Skipped: ${skipped.join(", ")}.` : "";
  return `Imported bundle: installed ${installed}, already installed ${alreadyInstalled}, added sources ${addedSources}.${skippedSuffix}`;
}

function openImportPreview(preview) {
  const skills = Array.isArray(preview?.skills)
    ? preview.skills
      .map((skill) => ({
        index: Number(skill?.index),
        name: typeof skill?.name === "string" ? skill.name : "",
        description: typeof skill?.description === "string" ? skill.description : "",
        repoUrl: typeof skill?.repoUrl === "string" ? skill.repoUrl : "",
        skillPath: typeof skill?.skillPath === "string" ? skill.skillPath : "",
      }))
      .filter((skill) => Number.isInteger(skill.index) && skill.index >= 0)
    : [];
  const selectedIndexes = new Set(skills.map((skill) => skill.index));

  state.importPreview.open = true;
  state.importPreview.inputPath = typeof preview?.inputPath === "string" ? preview.inputPath : "";
  state.importPreview.skills = skills;
  state.importPreview.selectedIndexes = selectedIndexes;
  render();
}

async function runTask(task, pendingMessage, successMessage) {
  if (state.busy) {
    return { ok: false, skipped: true };
  }
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
    return { ok: true, result };
  } catch (err) {
    setStatus(err?.message || "Operation failed.", "error", 4200);
    return { ok: false, error: err };
  } finally {
    state.busy = false;
    document.body.classList.remove("busy");
    render();
  }
}

function isTextInput(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function switchTab(nextTab) {
  if (!TAB_IDS.includes(nextTab)) return;
  state.activeTab = nextTab;

  render();
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
    return;
  }

  if (state.activeTab === "recommendations") {
    const list = state.recommendations.data?.items || [];
    if (!list.length) return;
    const currentIndex = Math.max(
      0,
      list.findIndex((item) => item.skillId === state.selected.recommendation),
    );
    const nextIndex = Math.max(0, Math.min(list.length - 1, currentIndex + delta));
    state.selected.recommendation = list[nextIndex].skillId;
    renderRecommendationsView();
    return;
  }

  if (state.activeTab === "settings") {
    const list = state.snapshot.settings;
    if (!list.length) return;
    const currentIndex = Math.max(0, list.findIndex((s) => s.id === state.selected.setting));
    const nextIndex = Math.max(0, Math.min(list.length - 1, currentIndex + delta));
    state.selected.setting = list[nextIndex].id;
    renderSettingsView();
    return;
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

  if (state.recommendations.data) {
    await loadRecommendations(false);
  }
}

async function loadRecommendations(showStatus = true) {
  if (state.recommendations.loading) return;
  state.recommendations.loading = true;
  setRecommendationProgress(
    {
      stage: "scan-skills",
      message: "Starting recommendation run...",
      percent: 1,
      stats: {
        requestedRecommendations: 7,
      },
    },
    true,
  );
  renderRecommendationsView();

  if (showStatus) {
    setStatus("Generating recommendations...", "pending", 0);
  }

  try {
    const result = await api.getRecommendations({
      mode: state.recommendations.mode,
      limit: 7,
    });

    state.recommendations.data = result || { items: [], historySummary: null };
    ensureSelection();
    renderRecommendationsView();

    if (showStatus) {
      const count = result?.items?.length || 0;
      setStatus(`Generated ${count} recommendations.`, "ok");
    }
  } catch (err) {
    setRecommendationProgress(
      {
        stage: "error",
        message: err?.message || "Could not generate recommendations.",
        percent: 100,
      },
      false,
    );
    if (showStatus) {
      setStatus(err?.message || "Could not generate recommendations.", "error", 4200);
    }
  } finally {
    state.recommendations.loading = false;
    state.recommendations.progress.active = false;
    renderRecommendationsView();
  }
}

const unsubscribeRecommendationProgress =
  typeof api.onRecommendationProgress === "function"
    ? api.onRecommendationProgress((progress) => {
      if (!progress || typeof progress !== "object") return;
      setRecommendationProgress(progress, state.recommendations.loading);
      renderRecommendationsView();
    })
    : null;

window.addEventListener("beforeunload", () => {
  if (typeof unsubscribeRecommendationProgress === "function") {
    unsubscribeRecommendationProgress();
  }
});

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

sourcesSuggestedList.addEventListener("click", (event) => {
  const addBtn = event.target.closest("[data-suggested-url]");
  if (!addBtn) return;
  const repoUrl = addBtn.dataset.suggestedUrl;
  void runTask(
    () => api.addSource(repoUrl),
    "Adding suggested source...",
    (result) => `Added source ${result.sourceName}.`,
  );
});

recommendationList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-recommendation-skill-id]");
  if (!row) return;
  state.selected.recommendation = row.dataset.recommendationSkillId;
  renderRecommendationsView();
});

settingsList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-setting-id]");
  if (!row) return;
  state.selected.setting = row.dataset.settingId;
  renderSettingsView();
});

settingsToggle.addEventListener("click", () => {
  const selectedSetting = getSelectedSetting();
  if (!selectedSetting) return;

  void runTask(
    () => api.toggleTarget(selectedSetting.id),
    "Toggling target...",
    () => `Target ${selectedSetting.name} toggled.`
  );
});

updateButton.addEventListener("click", () => {
  const btnText = updateButton.textContent;
  updateButton.textContent = "Updating...";
  updateButton.disabled = true;
  api.updateApp()
    .then((res) => {
      if (res.updated) {
        setStatus("Update installed! Restarting...", "ok");
      } else {
        setStatus("App is up to date.", "ok");
      }
    })
    .catch((err) => {
      setStatus(err?.message || "Failed to update app.", "error", 4200);
    })
    .finally(() => {
      updateButton.textContent = "Update";
      updateButton.disabled = false;
    });
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

importButton.addEventListener("click", () => {
  if (state.busy) return;
  setStatus("Selecting skill bundle...", "pending", 0);
  void api.pickImportBundle()
    .then((preview) => {
      if (preview?.cancelled) {
        setStatus("Import canceled.");
        return;
      }
      openImportPreview(preview);
      const count = state.importPreview.skills.length;
      setStatus(`Loaded import preview (${count} skill${count === 1 ? "" : "s"}).`, "ok");
    })
    .catch((err) => {
      setStatus(err?.message || "Could not open bundle preview.", "error", 4200);
    });
});

importList.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.type !== "checkbox") return;
  const index = Number(target.dataset.importIndex);
  if (!Number.isInteger(index) || index < 0) return;

  if (target.checked) {
    state.importPreview.selectedIndexes.add(index);
  } else {
    state.importPreview.selectedIndexes.delete(index);
  }
  renderImportPreview();
});

importSelectAll.addEventListener("click", () => {
  const selectedIndexes = new Set(
    state.importPreview.skills
      .map((skill) => Number(skill.index))
      .filter((index) => Number.isInteger(index) && index >= 0),
  );
  state.importPreview.selectedIndexes = selectedIndexes;
  renderImportPreview();
});

importSelectNone.addEventListener("click", () => {
  state.importPreview.selectedIndexes = new Set();
  renderImportPreview();
});

importCancel.addEventListener("click", () => {
  closeImportPreview();
  render();
  setStatus("Import canceled.");
});

importModal.addEventListener("click", (event) => {
  if (event.target !== importModal) return;
  closeImportPreview();
  render();
  setStatus("Import canceled.");
});

importConfirm.addEventListener("click", () => {
  const selectedIndexes = getSelectedImportIndexes();
  if (!selectedIndexes.length) {
    setStatus("Select at least one skill to import.", "error");
    return;
  }

  const inputPath = state.importPreview.inputPath;
  if (!inputPath) {
    setStatus("Missing import file path.", "error");
    return;
  }

  void (async () => {
    const result = await runTask(
      () => api.importInstalled({ inputPath, selectedIndexes }),
      `Importing ${selectedIndexes.length} selected skill${selectedIndexes.length === 1 ? "" : "s"}...`,
      (outcome) => formatImportSummary(outcome),
    );

    if (result?.ok) {
      closeImportPreview();
      render();
    }
  })();
});

installedOpenPath.addEventListener("click", () => {
  const selectedSkill = getSelectedInstalledSkill();
  if (!selectedSkill) return;
  void api.editSkill(selectedSkill.id)
    .then(() => {
      setStatus(`Opened ${selectedSkill.name} in Cursor.`, "ok");
    })
    .catch((err) => {
      setStatus(err?.message || "Could not open selected skill in Cursor.", "error", 4200);
    });
});

availableOpenPath.addEventListener("click", () => {
  const selectedSkill = getSelectedAvailableSkill();
  if (!selectedSkill) return;
  void api.editSkill(selectedSkill.id)
    .then(() => {
      setStatus(`Opened ${selectedSkill.name} in Cursor.`, "ok");
    })
    .catch((err) => {
      setStatus(err?.message || "Could not open selected skill in Cursor.", "error", 4200);
    });
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

sourceDisable.addEventListener("click", () => {
  const source = getSelectedSource();
  if (!source) return;
  const isEnable = source.enabled === false;
  void runTask(
    () => (isEnable ? api.enableSource(source.id) : api.disableSource(source.id)),
    `${isEnable ? "Enabling" : "Disabling"} source ${source.name}...`,
    () => `${isEnable ? "Enabled" : "Disabled"} source ${source.name}.`,
  );
});

sourceRemove.addEventListener("click", () => {
  const source = getSelectedSource();
  if (!source) return;
  if (!confirm(`Remove source "${source.name}"? This will delete the cloned directory and uninstall all its skills.`)) {
    return;
  }
  void runTask(
    () => api.removeSource(source.id),
    `Removing source ${source.name}...`,
    () => `Removed source ${source.name}.`,
  );
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

installedAdopt.addEventListener("click", () => {
  const selectedSkill = getSelectedInstalledSkill();
  if (!selectedSkill) return;
  void runTask(
    () => api.adoptSkill(selectedSkill.id),
    `Adopting ${selectedSkill.name}...`,
    () => `Adopted ${selectedSkill.name}. It is now managed and installed everywhere.`,
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

recommendationMode.addEventListener("change", () => {
  state.recommendations.mode = recommendationMode.value;
  renderRecommendationsView();
});

recommendationRunButton.addEventListener("click", () => {
  void loadRecommendations(true);
});

recommendationManage.addEventListener("click", () => {
  const selected = getSelectedRecommendation();
  if (!selected) return;
  jumpToSkill(selected.skillId);
});

recommendationInstall.addEventListener("click", () => {
  const selected = getSelectedRecommendation();
  if (!selected) return;

  void (async () => {
    await runTask(
      () => api.installSkill(selected.skillId),
      `Installing ${selected.skillName}...`,
      () => `Installed ${selected.skillName}.`,
    );
    await loadRecommendations(false);
  })();
});

window.addEventListener("keydown", (event) => {
  if (state.importPreview.open) {
    if (event.key === "Escape") {
      closeImportPreview();
      render();
      setStatus("Import canceled.");
      event.preventDefault();
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && ["1", "2", "3", "4"].includes(event.key)) {
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
      return;
    }
    if (state.activeTab === "recommendations") {
      const selected = getSelectedRecommendation();
      if (!selected) return;
      const selectedSkill = getSkillById(selected.skillId);
      if (selectedSkill?.installed) {
        recommendationManage.click();
      } else {
        recommendationInstall.click();
      }
      event.preventDefault();
      return;
    }
    if (state.activeTab === "settings") {
      settingsToggle.click();
      event.preventDefault();
      return;
    }
  }
});

recommendationMode.value = state.recommendations.mode;

void refreshSnapshot();
