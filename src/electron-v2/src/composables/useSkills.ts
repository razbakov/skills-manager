import { ref, computed, reactive } from "vue";
import type {
  Snapshot,
  TabId,
  RecommendationData,
  RecommendationProgress,
  SkillReviewSnapshot,
  ImportPreviewSkill,
  SkillViewModel,
  SourceViewModel,
  SettingViewModel,
  RecommendationItem,
  RecommendationRunStats,
} from "@/types";
import {
  filterSkillLibrary,
  filterSkills,
  sortByName,
  type LibraryStatusFilter,
} from "./useSearch";

const api = window.skillsApi;

// ── Singleton state ──
const snapshot = ref<Snapshot | null>(null);
const activeTab = ref<TabId>("skills");
const busy = ref(false);
const queries = reactive({ skills: "", installed: "", available: "" });
const libraryFilters = reactive({
  status: "all" as LibraryStatusFilter,
  sourceName: "",
});

const selected = reactive({
  skills: null as string | null,
  installed: null as string | null,
  installedGroup: null as string | null,
  available: null as string | null,
  source: null as string | null,
  recommendation: null as string | null,
  setting: null as string | null,
});

const toasts = ref<{ id: number; message: string; type: string }[]>([]);
let toastId = 0;

const recommendations = reactive({
  mode: "standard" as "standard" | "explore-new",
  loading: false,
  data: null as RecommendationData | null,
  progress: {
    active: false,
    stage: "idle",
    percent: 0,
    message: "Waiting for run.",
    stats: null as RecommendationRunStats | null,
  } as RecommendationProgress,
});

const importPreview = reactive({
  open: false,
  inputPath: "",
  skills: [] as ImportPreviewSkill[],
  selectedIndexes: new Set<number>(),
});

const skillMdCache = new Map<string, string>();
const skillReviews = reactive({
  loadingSkillId: null as string | null,
  bySkillId: {} as Record<string, SkillReviewSnapshot>,
});

const REVIEW_REQUEST_TIMEOUT_MS = 180000;
const REVIEW_RECOVERY_POLL_ATTEMPTS = 5;
const REVIEW_RECOVERY_POLL_INTERVAL_MS = 1200;

// ── Derived ──
const librarySkills = computed(() =>
  snapshot.value
    ? filterSkillLibrary(snapshot.value.skills, {
        query: queries.skills,
        status: libraryFilters.status,
        sourceName: libraryFilters.sourceName,
      })
    : [],
);

const librarySources = computed(() => {
  if (!snapshot.value) return [];
  const names = new Set<string>();
  for (const skill of snapshot.value.skills) {
    const name = (skill.sourceName || "").trim();
    if (name) names.add(name);
  }
  return Array.from(names).sort((a, b) =>
    a.localeCompare(b, undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );
});

const installedSkills = computed(() =>
  snapshot.value ? filterSkills(snapshot.value.installedSkills, queries.installed) : [],
);

const availableSkills = computed(() =>
  snapshot.value ? filterSkills(snapshot.value.availableSkills, queries.available) : [],
);

const sources = computed(() =>
  snapshot.value ? sortByName(snapshot.value.sources) : [],
);

const settings = computed(() => snapshot.value?.settings ?? []);
const suggestedSources = computed(() => snapshot.value?.suggestedSources ?? []);
const personalRepo = computed(() => snapshot.value?.personalRepo ?? null);
const skillGroups = computed(() => snapshot.value?.skillGroups ?? []);
const activeGroups = computed(() => snapshot.value?.activeGroups ?? []);

const selectedSkill = computed<SkillViewModel | null>(() => {
  const list = librarySkills.value;
  if (!list.length) return null;
  return list.find((skill) => skill.id === selected.skills) ?? list[0];
});

const selectedInstalledSkill = computed<SkillViewModel | null>(() => {
  if (!snapshot.value) return null;
  return snapshot.value.installedSkills.find((s) => s.id === selected.installed) ?? null;
});

const selectedInstalledGroup = computed(() =>
  skillGroups.value.find((group) => group.name === selected.installedGroup) ?? null,
);

const selectedAvailableSkill = computed<SkillViewModel | null>(() => {
  if (!snapshot.value) return null;
  return snapshot.value.availableSkills.find((s) => s.id === selected.available) ?? null;
});

const selectedSource = computed<SourceViewModel | null>(() =>
  sources.value.find((s) => s.id === selected.source) ?? null,
);

const selectedSetting = computed<SettingViewModel | null>(() =>
  settings.value.find((s) => s.id === selected.setting) ?? null,
);

const selectedRecommendation = computed<RecommendationItem | null>(() => {
  const items = recommendations.data?.items ?? [];
  return items.find((i) => i.skillId === selected.recommendation) ?? null;
});

const configuredTargetCount = computed(
  () => settings.value.filter((s) => s.isTarget).length,
);

const activeBudgetSummary = computed(() => {
  const budget = snapshot.value?.activeBudget;
  if (budget) return budget;
  return {
    enabledCount: 0,
    estimatedTokens: 0,
    method: "tiktoken/cl100k_base",
  };
});

// ── Toast ──
function addToast(message: string, type = "info", durationMs = 3000) {
  const id = ++toastId;
  toasts.value.push({ id, message, type });
  if (durationMs > 0) {
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, durationMs);
  }
}

function removeToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

// ── Helpers ──
function ensureSelection() {
  if (!snapshot.value) return;

  const allSkills = sortByName(snapshot.value.skills);
  const inst = sortByName(snapshot.value.installedSkills);
  const avail = sortByName(snapshot.value.availableSkills);
  const src = sources.value;
  const groups = skillGroups.value;

  if (!allSkills.find((s) => s.id === selected.skills)) {
    selected.skills = allSkills[0]?.id ?? null;
  }
  if (!inst.find((s) => s.id === selected.installed)) {
    selected.installed = inst[0]?.id ?? null;
  }
  if (!groups.find((group) => group.name === selected.installedGroup)) {
    selected.installedGroup = null;
  }
  if (!avail.find((s) => s.id === selected.available)) {
    selected.available = avail[0]?.id ?? null;
  }
  if (!src.find((s) => s.id === selected.source)) {
    selected.source = src[0]?.id ?? null;
  }
  if (!settings.value.find((s) => s.id === selected.setting)) {
    selected.setting = settings.value[0]?.id ?? null;
  }
  if (
    libraryFilters.sourceName &&
    !librarySources.value.some((name) => name === libraryFilters.sourceName)
  ) {
    libraryFilters.sourceName = "";
  }

  const recItems = recommendations.data?.items ?? [];
  if (!recItems.find((i) => i.skillId === selected.recommendation)) {
    selected.recommendation = recItems[0]?.skillId ?? null;
  }
}

function applySnapshot(snap: Snapshot) {
  snapshot.value = snap;
  skillMdCache.clear();
  skillReviews.loadingSkillId = null;
  const activeSkillIds = new Set((snap.skills ?? []).map((skill) => skill.id));
  for (const skillId of Object.keys(skillReviews.bySkillId)) {
    if (!activeSkillIds.has(skillId)) {
      delete skillReviews.bySkillId[skillId];
    }
  }
  ensureSelection();
}

// ── Task runner ──
async function runTask<T>(
  task: () => Promise<T>,
  pendingMessage: string,
  successFn?: (result: T) => string,
): Promise<{ ok: boolean; result?: T }> {
  if (busy.value) return { ok: false };
  busy.value = true;
  addToast(pendingMessage, "pending", 0);

  try {
    const result = await task();
    const snap = (result as any)?.snapshot ?? result;
    if (snap?.skills) {
      applySnapshot(snap);
    }
    // Remove pending toast
    toasts.value = toasts.value.filter((t) => t.type !== "pending");
    if (successFn) {
      addToast(successFn(result), "success");
    } else {
      addToast("Done.", "success");
    }
    return { ok: true, result };
  } catch (err: any) {
    toasts.value = toasts.value.filter((t) => t.type !== "pending");
    addToast(err?.message ?? "Operation failed.", "error", 5000);
    return { ok: false };
  } finally {
    busy.value = false;
  }
}

// ── Actions ──
async function refresh() {
  await runTask(
    () => api.refresh(),
    "Refreshing...",
    (snap: any) => `Loaded ${snap?.skills?.length ?? 0} skills.`,
  );
}

function selectSkill(skillId: string) {
  if (!snapshot.value) return;
  const skill = snapshot.value.skills.find((entry) => entry.id === skillId);
  if (!skill) return;

  selected.skills = skill.id;
  if (skill.installed) {
    selected.installed = skill.id;
    selected.installedGroup = null;
    return;
  }

  selected.available = skill.id;
}

async function installSkill(skillId: string) {
  const name = snapshot.value?.skills.find((s) => s.id === skillId)?.name ?? "skill";
  await runTask(
    () => api.installSkill(skillId),
    `Installing ${name}...`,
    () => `Installed ${name}.`,
  );
}

async function uninstallSkill(skillId: string) {
  const name = snapshot.value?.skills.find((s) => s.id === skillId)?.name ?? "skill";
  await runTask(
    () => api.uninstallSkill(skillId),
    `Uninstalling ${name}...`,
    () => `Uninstalled ${name}.`,
  );
}

async function createSkillGroup(name: string) {
  const normalized = name.trim();
  if (!normalized) {
    addToast("Enter a collection name.", "error", 5000);
    return { ok: false };
  }

  return runTask(
    () => api.createSkillGroup({ name: normalized }),
    `Creating collection ${normalized}...`,
    (result: any) => `Created collection ${result?.groupName ?? normalized}.`,
  );
}

async function toggleSkillGroup(name: string, active: boolean) {
  const normalized = name.trim();
  if (!normalized) {
    addToast("Select a collection.", "error", 5000);
    return { ok: false };
  }
  return runTask(
    () => api.toggleSkillGroup({ name: normalized, active }),
    `${active ? "Enabling" : "Disabling"} ${normalized}...`,
    (result: any) => {
      const skipped = Number(result?.skippedMissing || 0);
      if (skipped > 0) {
        return `${active ? "Enabled" : "Disabled"} ${normalized} (${skipped} missing skill${skipped === 1 ? "" : "s"} skipped).`;
      }
      return `${active ? "Enabled" : "Disabled"} ${normalized}.`;
    },
  );
}

async function renameSkillGroup(name: string, nextName: string) {
  const current = name.trim();
  const next = nextName.trim();
  if (!current) {
    addToast("Select a collection.", "error", 5000);
    return { ok: false };
  }
  if (!next) {
    addToast("Enter a collection name.", "error", 5000);
    return { ok: false };
  }

  return runTask(
    () => api.renameSkillGroup({ name: current, nextName: next }),
    `Renaming ${current}...`,
    (result: any) => `Renamed collection to ${result?.groupName ?? next}.`,
  );
}

async function deleteSkillGroup(name: string) {
  const normalized = name.trim();
  if (!normalized) {
    addToast("Select a collection.", "error", 5000);
    return { ok: false };
  }

  return runTask(
    () => api.deleteSkillGroup({ name: normalized }),
    `Deleting ${normalized}...`,
    (result: any) => `Deleted collection ${result?.deletedGroup ?? normalized}.`,
  );
}

async function updateSkillGroupMembership(
  groupName: string,
  skillId: string,
  member: boolean,
) {
  const normalized = groupName.trim();
  if (!normalized || !skillId) {
    addToast("Could not update collection membership.", "error", 5000);
    return { ok: false };
  }

  return runTask(
    () => api.updateSkillGroupMembership({ groupName: normalized, skillId, member }),
    member ? "Adding skill to collection..." : "Removing skill from collection...",
    () => (member ? `Added skill to ${normalized}.` : `Removed skill from ${normalized}.`),
  );
}

async function disableSkill(skillId: string) {
  const name = snapshot.value?.skills.find((s) => s.id === skillId)?.name ?? "skill";
  await runTask(
    () => api.disableSkill(skillId),
    `Disabling ${name}...`,
    () => `Disabled ${name}.`,
  );
}

async function enableSkill(skillId: string) {
  const name = snapshot.value?.skills.find((s) => s.id === skillId)?.name ?? "skill";
  await runTask(
    () => api.enableSkill(skillId),
    `Enabling ${name}...`,
    () => `Enabled ${name}.`,
  );
}

async function adoptSkill(skillId: string) {
  const name = snapshot.value?.skills.find((s) => s.id === skillId)?.name ?? "skill";
  await runTask(
    () => api.adoptSkill(skillId),
    `Adopting ${name}...`,
    (result: any) => {
      const adoption = result?.adoption;
      if (adoption?.usedPersonalRepo && adoption.committed) {
        return `Adopted ${name} and committed to ${adoption.repoPath}.`;
      }
      return `Adopted ${name}.`;
    },
  );
}

async function addSource(repoUrl: string) {
  await runTask(
    () => api.addSource(repoUrl),
    "Adding source...",
    (result: any) => `Added source ${result.sourceName}.`,
  );
}

async function removeSource(sourceId: string) {
  const name = sources.value.find((s) => s.id === sourceId)?.name ?? "source";
  await runTask(
    () => api.removeSource(sourceId),
    `Removing ${name}...`,
    () => `Removed ${name}.`,
  );
}

async function disableSource(sourceId: string) {
  const name = sources.value.find((s) => s.id === sourceId)?.name ?? "source";
  await runTask(
    () => api.disableSource(sourceId),
    `Disabling ${name}...`,
    () => `Disabled ${name}.`,
  );
}

async function enableSource(sourceId: string) {
  const name = sources.value.find((s) => s.id === sourceId)?.name ?? "source";
  await runTask(
    () => api.enableSource(sourceId),
    `Enabling ${name}...`,
    () => `Enabled ${name}.`,
  );
}

async function toggleTarget(targetPath: string) {
  await runTask(
    () => api.toggleTarget(targetPath),
    "Toggling target...",
    () => "Target toggled.",
  );
}

async function exportInstalled() {
  await runTask(
    () => api.exportInstalled(),
    "Exporting...",
    (result: any) => {
      if (result?.canceled) return "Export canceled.";
      return `Exported ${result.installedCount} skills to ${result.outputPath}.`;
    },
  );
}

async function exportSkillGroup(name: string) {
  const normalized = name.trim();
  if (!normalized) {
    addToast("Select a collection to export.", "error", 5000);
    return { ok: false };
  }

  return runTask(
    () => api.exportSkillGroup({ name: normalized }),
    `Exporting ${normalized}...`,
    (result: any) => {
      if (result?.canceled) return "Export canceled.";
      const collectionName = (result?.groupName || normalized).toString();
      return `Exported ${result?.installedCount ?? 0} skills from ${collectionName} to ${result?.outputPath}.`;
    },
  );
}

async function pickImportBundle() {
  try {
    const preview = await api.pickImportBundle();
    if (preview?.cancelled) return;
    const skills: ImportPreviewSkill[] = (preview.skills ?? []).filter(
      (s: any) => Number.isInteger(s.index) && s.index >= 0,
    );
    importPreview.open = true;
    importPreview.inputPath = preview.inputPath ?? "";
    importPreview.skills = skills;
    importPreview.selectedIndexes = new Set(skills.map((s) => s.index));
  } catch (err: any) {
    addToast(err?.message ?? "Could not open bundle.", "error", 5000);
  }
}

async function importSelected() {
  const indexes = Array.from(importPreview.selectedIndexes).sort((a, b) => a - b);
  if (!indexes.length || !importPreview.inputPath) return;
  const result = await runTask(
    () => api.importInstalled({ inputPath: importPreview.inputPath, selectedIndexes: indexes }),
    `Importing ${indexes.length} skill${indexes.length === 1 ? "" : "s"}...`,
    (r: any) => {
      if (r?.cancelled) return "Import canceled.";
      return `Imported ${r?.installed ?? 0} skills.`;
    },
  );
  if (result.ok) closeImportPreview();
}

function closeImportPreview() {
  importPreview.open = false;
  importPreview.inputPath = "";
  importPreview.skills = [];
  importPreview.selectedIndexes = new Set();
}

async function setPersonalRepoFromUrl(repoUrl: string) {
  await runTask(
    () => api.setPersonalSkillsRepoFromUrl(repoUrl),
    "Setting personal repository...",
    (result: any) =>
      result?.addedSource
        ? `Added and set ${result?.sourceName ?? "repo"} as personal repository.`
        : `Set ${result?.sourceName ?? "repo"} as personal repository.`,
  );
}

async function clearPersonalRepo() {
  await runTask(
    () => api.clearPersonalSkillsRepo(),
    "Clearing personal repository...",
    () => "Cleared personal repository.",
  );
}

async function updateApp() {
  try {
    const result = await api.updateApp();
    const backendMessage =
      typeof result?.message === "string" && result.message.trim()
        ? result.message.trim()
        : null;

    if (result.updated) {
      addToast(backendMessage ?? "Update installed! Restarting...", "success");
    } else {
      addToast(backendMessage ?? "App is already up to date.", "info");
    }
  } catch (err: any) {
    addToast(err?.message ?? "Update failed.", "error", 5000);
  }
}

async function getSkillMarkdown(skillId: string): Promise<string> {
  const cached = skillMdCache.get(skillId);
  if (cached) return cached;

  try {
    const content = await api.getSkillMarkdown(skillId);
    const normalized = content?.trim() ? content : "(SKILL.md is empty)";
    skillMdCache.set(skillId, normalized);
    return normalized;
  } catch (err: any) {
    return `Could not load SKILL.md: ${err?.message ?? "Unknown error"}`;
  }
}

async function loadSkillReview(skillId: string): Promise<SkillReviewSnapshot | null> {
  const cached = skillReviews.bySkillId[skillId];
  if (cached) return cached;

  try {
    const result = await api.getSkillReview(skillId);
    if (result && typeof result === "object") {
      const review = result as SkillReviewSnapshot;
      skillReviews.bySkillId[skillId] = review;
      return review;
    }
  } catch {
    // Ignore lookup errors and keep UI usable when no cached review exists.
  }

  return null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForRecoveredReview(skillId: string): Promise<SkillReviewSnapshot | null> {
  for (let attempt = 0; attempt < REVIEW_RECOVERY_POLL_ATTEMPTS; attempt += 1) {
    try {
      const result = await api.getSkillReview(skillId);
      if (result && typeof result === "object") {
        return result as SkillReviewSnapshot;
      }
    } catch {
      // Ignore transient lookup errors while waiting for disk cache to appear.
    }

    if (attempt < REVIEW_RECOVERY_POLL_ATTEMPTS - 1) {
      await wait(REVIEW_RECOVERY_POLL_INTERVAL_MS);
    }
  }

  return null;
}

async function reviewSkill(skillId: string) {
  if (skillReviews.loadingSkillId) return;
  const name = snapshot.value?.skills.find((s) => s.id === skillId)?.name ?? "skill";
  skillReviews.loadingSkillId = skillId;
  addToast(`Reviewing ${name}...`, "pending", 0);

  try {
    const timedResult = await Promise.race([
      api
        .reviewSkill(skillId)
        .then((result: any) => ({ type: "result" as const, result }))
        .catch((error: any) => ({ type: "error" as const, error })),
      wait(REVIEW_REQUEST_TIMEOUT_MS).then(() => ({ type: "timeout" as const })),
    ]);

    if (timedResult.type === "error") {
      throw timedResult.error;
    }

    if (timedResult.type === "timeout") {
      const recovered = await waitForRecoveredReview(skillId);
      if (recovered) {
        skillReviews.bySkillId[skillId] = recovered;
        addToast(`Review loaded for ${name}.`, "success");
        return;
      }
      throw new Error("Review request timed out. Please retry.");
    }

    if (timedResult.result && typeof timedResult.result === "object") {
      skillReviews.bySkillId[skillId] = timedResult.result as SkillReviewSnapshot;
      addToast(`Review ready for ${name}.`, "success");
    } else {
      addToast("Skill review returned invalid data.", "error", 5000);
    }
  } catch (err: any) {
    addToast(err?.message ?? "Could not review skill.", "error", 5000);
  } finally {
    toasts.value = toasts.value.filter((t) => t.type !== "pending");
    skillReviews.loadingSkillId = null;
  }
}

function editSkill(skillId: string) {
  api.editSkill(skillId).catch((err: any) => {
    addToast(err?.message ?? "Could not open in editor.", "error");
  });
}

function openPath(path: string) {
  api.openPath(path);
}

function openExternal(url: string) {
  api.openExternal(url);
}

// ── Recommendations ──
function setRecommendationProgress(progress: any) {
  if (!progress || typeof progress !== "object") return;
  recommendations.progress.active = recommendations.loading;
  if (typeof progress.stage === "string") recommendations.progress.stage = progress.stage;
  recommendations.progress.percent = Math.max(0, Math.min(100, Math.round(Number(progress.percent) || 0)));
  if (typeof progress.message === "string" && progress.message.trim()) {
    recommendations.progress.message = progress.message.trim();
  }
  if (progress.stats && typeof progress.stats === "object") {
    recommendations.progress.stats = {
      ...(recommendations.progress.stats ?? {}),
      ...progress.stats,
    };
  }
}

let unsubscribeProgress: (() => void) | null = null;

function subscribeToProgress() {
  if (unsubscribeProgress) return;
  unsubscribeProgress = api.onRecommendationProgress((progress) => {
    setRecommendationProgress(progress);
  });
}

function unsubscribeFromProgress() {
  if (unsubscribeProgress) {
    unsubscribeProgress();
    unsubscribeProgress = null;
  }
}

async function loadRecommendations() {
  if (recommendations.loading) return;
  recommendations.loading = true;
  recommendations.progress = {
    active: true,
    stage: "scan-skills",
    percent: 1,
    message: "Starting recommendation run...",
    stats: null,
  };

  subscribeToProgress();

  try {
    const result = await api.getRecommendations({
      mode: recommendations.mode,
      limit: 7,
    });
    recommendations.data = result ?? { items: [], historySummary: null, stats: null };
    ensureSelection();
    addToast(`Generated ${result?.items?.length ?? 0} recommendations.`, "success");
  } catch (err: any) {
    addToast(err?.message ?? "Could not generate recommendations.", "error", 5000);
  } finally {
    recommendations.loading = false;
    recommendations.progress.active = false;
  }
}

function jumpToSkill(skillId: string) {
  if (!snapshot.value) return;
  const skill = snapshot.value.skills.find((s) => s.id === skillId);
  if (!skill) return;
  selectSkill(skill.id);
  activeTab.value = "skills";
}

// ── Init ──
async function init() {
  subscribeToProgress();
  await refresh();
}

export function useSkills() {
  return {
    // State
    snapshot,
    activeTab,
    busy,
    queries,
    libraryFilters,
    selected,
    toasts,
    recommendations,
    importPreview,
    skillReviews,

    // Derived
    librarySkills,
    librarySources,
    installedSkills,
    availableSkills,
    sources,
    settings,
    suggestedSources,
    personalRepo,
    skillGroups,
    activeGroups,
    selectedSkill,
    selectedInstalledSkill,
    selectedInstalledGroup,
    selectedAvailableSkill,
    selectedSource,
    selectedSetting,
    selectedRecommendation,
    configuredTargetCount,
    activeBudgetSummary,

    // Toast
    addToast,
    removeToast,

    // Actions
    init,
    refresh,
    selectSkill,
    installSkill,
    uninstallSkill,
    disableSkill,
    enableSkill,
    adoptSkill,
    createSkillGroup,
    toggleSkillGroup,
    renameSkillGroup,
    deleteSkillGroup,
    updateSkillGroupMembership,
    addSource,
    removeSource,
    disableSource,
    enableSource,
    toggleTarget,
    exportInstalled,
    exportSkillGroup,
    pickImportBundle,
    importSelected,
    closeImportPreview,
    setPersonalRepoFromUrl,
    clearPersonalRepo,
    updateApp,
    getSkillMarkdown,
    loadSkillReview,
    reviewSkill,
    editSkill,
    openPath,
    openExternal,
    loadRecommendations,
    jumpToSkill,
    unsubscribeFromProgress,
  };
}
