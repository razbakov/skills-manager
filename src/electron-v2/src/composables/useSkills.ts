import { ref, computed, reactive, onUnmounted } from "vue";
import type {
  Snapshot,
  TabId,
  RecommendationData,
  RecommendationProgress,
  ImportPreviewSkill,
  SkillViewModel,
  SourceViewModel,
  SettingViewModel,
  RecommendationItem,
  RecommendationRunStats,
} from "@/types";
import { filterSkills, sortByName } from "./useSearch";

const api = window.skillsApi;

// ── Singleton state ──
const snapshot = ref<Snapshot | null>(null);
const activeTab = ref<TabId>("installed");
const busy = ref(false);
const queries = reactive({ installed: "", available: "" });

const selected = reactive({
  installed: null as string | null,
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

// ── Derived ──
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

const selectedInstalledSkill = computed<SkillViewModel | null>(() => {
  if (!snapshot.value) return null;
  return snapshot.value.installedSkills.find((s) => s.id === selected.installed) ?? null;
});

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

  const inst = sortByName(snapshot.value.installedSkills);
  const avail = sortByName(snapshot.value.availableSkills);
  const src = sources.value;

  if (!inst.find((s) => s.id === selected.installed)) {
    selected.installed = inst[0]?.id ?? null;
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

  const recItems = recommendations.data?.items ?? [];
  if (!recItems.find((i) => i.skillId === selected.recommendation)) {
    selected.recommendation = recItems[0]?.skillId ?? null;
  }
}

function applySnapshot(snap: Snapshot) {
  snapshot.value = snap;
  skillMdCache.clear();
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

  if (skill.installed) {
    selected.installed = skill.id;
    activeTab.value = "installed";
  } else {
    selected.available = skill.id;
    activeTab.value = "available";
  }
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
    selected,
    toasts,
    recommendations,
    importPreview,

    // Derived
    installedSkills,
    availableSkills,
    sources,
    settings,
    suggestedSources,
    personalRepo,
    selectedInstalledSkill,
    selectedAvailableSkill,
    selectedSource,
    selectedSetting,
    selectedRecommendation,
    configuredTargetCount,

    // Toast
    addToast,
    removeToast,

    // Actions
    init,
    refresh,
    installSkill,
    uninstallSkill,
    disableSkill,
    enableSkill,
    adoptSkill,
    addSource,
    removeSource,
    disableSource,
    enableSource,
    toggleTarget,
    exportInstalled,
    pickImportBundle,
    importSelected,
    closeImportPreview,
    setPersonalRepoFromUrl,
    clearPersonalRepo,
    updateApp,
    getSkillMarkdown,
    editSkill,
    openPath,
    openExternal,
    loadRecommendations,
    jumpToSkill,
    unsubscribeFromProgress,
  };
}
