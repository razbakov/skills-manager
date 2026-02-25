import { ref, computed, reactive } from "vue";
import type {
  Snapshot,
  TabId,
  RecommendationData,
  RecommendationProgress,
  SkillReviewSnapshot,
  AddSourcePreviewSkill,
  ImportPreviewSkill,
  SkillViewModel,
  SourceViewModel,
  SettingViewModel,
  RecommendationItem,
  RecommendationRunStats,
  SkillSetLaunchRequest,
  SkillSetPreviewSkill,
  RuntimeAvailability,
  FeedbackSessionSummary,
  FeedbackSessionDetail,
  FeedbackReportAnalysis,
  FeedbackReportDraft,
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
const lastNonFeedbackTab = ref<TabId>("skills");
const busy = ref(false);
const syncing = ref(false);
const syncSetupOpen = ref(false);
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
  feedbackSkill: null as string | null,
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

interface CollectionSkillItem {
  name: string;
  description: string;
  repoUrl?: string;
  skillPath?: string;
}

interface CollectionPreviewItem {
  name: string;
  file: string;
  skillNames: string[];
  skills: CollectionSkillItem[];
}

const addSourcePreview = reactive({
  open: false,
  input: "",
  sourceName: "",
  sourcePath: "",
  skills: [] as AddSourcePreviewSkill[],
  selectedIndexes: new Set<number>(),
  collections: [] as CollectionPreviewItem[],
  activeCollectionTab: null as string | null,
});

const skillSetPreview = reactive({
  open: false,
  source: "",
  sourceName: "",
  sourceId: "",
  sourceAdded: false,
  skills: [] as SkillSetPreviewSkill[],
  selectedSkillIds: new Set<string>(),
  missingSkills: [] as string[],
});
const skillSetLaunchQueue: SkillSetLaunchRequest[] = [];
let processingSkillSetLaunchQueue = false;

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

const selectedFeedbackSkill = computed<SkillViewModel | null>(() => {
  if (!snapshot.value) return null;
  const feedbackSkillId = selected.feedbackSkill;
  if (!feedbackSkillId) return null;
  return snapshot.value.skills.find((skill) => skill.id === feedbackSkillId) ?? null;
});

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

function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  return unique;
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
  if (!allSkills.find((skill) => skill.id === selected.feedbackSkill)) {
    selected.feedbackSkill = allSkills[0]?.id ?? null;
    if (activeTab.value === "feedback" && !selected.feedbackSkill) {
      activeTab.value = "skills";
    }
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

function openAddSourcePreview(input: string = "") {
  addSourcePreview.open = true;
  addSourcePreview.input = input.trim();
  addSourcePreview.sourceName = "";
  addSourcePreview.sourcePath = "";
  addSourcePreview.skills = [];
  addSourcePreview.selectedIndexes = new Set();
  addSourcePreview.collections = [];
  addSourcePreview.activeCollectionTab = null;
}

function closeAddSourcePreview() {
  addSourcePreview.open = false;
  addSourcePreview.input = "";
  addSourcePreview.sourceName = "";
  addSourcePreview.sourcePath = "";
  addSourcePreview.skills = [];
  addSourcePreview.selectedIndexes = new Set();
  addSourcePreview.collections = [];
  addSourcePreview.activeCollectionTab = null;
}

function applyDefaultSelection(skills: AddSourcePreviewSkill[], preview: any) {
  const defaultIndexes = Array.isArray(preview?.defaultSelectedIndexes)
    ? preview.defaultSelectedIndexes
    : skills.map((skill) => skill.index);
  addSourcePreview.selectedIndexes = new Set(
    defaultIndexes
      .map((value: any) => Number(value))
      .filter(
        (value: number) =>
          Number.isInteger(value) && value >= 0 && value < skills.length,
      ),
  );
}

function applyCollectionTab(collectionName: string | null) {
  addSourcePreview.activeCollectionTab = collectionName;
  const skills = addSourcePreview.skills;

  if (!collectionName) {
    addSourcePreview.selectedIndexes = new Set(
      skills.map((skill) => skill.index),
    );
    return;
  }

  const collection = addSourcePreview.collections.find(
    (c) => c.name === collectionName,
  );
  if (!collection) return;

  const nameSet = new Set(collection.skillNames.map((n) => n.toLowerCase()));
  addSourcePreview.selectedIndexes = new Set(
    skills
      .filter((skill) => nameSet.has(skill.name.toLowerCase()))
      .map((skill) => skill.index),
  );
}

async function previewAddSourceInput() {
  const input = addSourcePreview.input.trim();
  if (!input) {
    addToast("Enter a valid skill path, repository URL, or marketplace URL.", "error", 5000);
    return;
  }
  if (busy.value) return;

  busy.value = true;
  try {
    const preview = await api.previewAddSourceInput(input);
    const skills: AddSourcePreviewSkill[] = (preview?.skills ?? []).filter(
      (skill: any) => Number.isInteger(skill?.index) && skill.index >= 0,
    );
    addSourcePreview.input = preview?.input ?? input;
    addSourcePreview.sourceName = preview?.sourceName ?? "";
    addSourcePreview.sourcePath = preview?.sourcePath ?? "";
    addSourcePreview.skills = skills;

    const collections: CollectionPreviewItem[] = Array.isArray(preview?.collections)
      ? preview.collections
          .filter((c: any) => c?.name && Array.isArray(c?.skillNames))
          .map((c: any) => ({
            name: c.name as string,
            file: c.file as string,
            skillNames: c.skillNames as string[],
            skills: Array.isArray(c.skills) ? c.skills : [],
          }))
      : [];
    addSourcePreview.collections = collections;

    const collectionFile: string | undefined = preview?.collectionFile;
    const matchingCollection = collectionFile
      ? collections.find((c) => c.file === collectionFile)
      : null;

    if (matchingCollection) {
      applyCollectionTab(matchingCollection.name);
    } else {
      addSourcePreview.activeCollectionTab = null;
      applyDefaultSelection(skills, preview);
    }
  } catch (err: any) {
    addToast(err?.message ?? "Could not load skills for this input.", "error", 5000);
  } finally {
    busy.value = false;
  }
}

async function addSourceFromPreview() {
  const input = addSourcePreview.input.trim();
  const indexes = Array.from(addSourcePreview.selectedIndexes).sort((a, b) => a - b);
  if (!input) {
    addToast("Enter a valid skill path, repository URL, or marketplace URL.", "error", 5000);
    return;
  }
  if (!indexes.length) {
    addToast("Select at least one skill.", "error", 5000);
    return;
  }

  const result = await runTask(
    () =>
      api.addSourceFromInput({
        input,
        selectedIndexes: indexes,
      }),
    `Adding ${indexes.length} skill${indexes.length === 1 ? "" : "s"}...`,
    (response: any) => {
      const sourceName = response?.sourceName ?? "source";
      const installed = Number(response?.installedCount ?? 0);
      const already = Number(response?.alreadyInstalledCount ?? 0);
      if (already > 0) {
        return `Added ${sourceName}: installed ${installed}, already installed ${already}.`;
      }
      return `Added ${sourceName}: installed ${installed} skill${installed === 1 ? "" : "s"}.`;
    },
  );

  if (result.ok) {
    closeAddSourcePreview();
  }
}

async function installCollectionSkills(
  skills: Array<{ name: string; description: string; repoUrl?: string; skillPath?: string }>,
) {
  if (!skills.length) {
    addToast("Select at least one skill.", "error", 5000);
    return;
  }

  const result = await runTask(
    () => api.installCollectionSkills(skills),
    `Installing ${skills.length} skill${skills.length === 1 ? "" : "s"} from collection...`,
    (response: any) => {
      const installed = Number(response?.installedCount ?? 0);
      const already = Number(response?.alreadyInstalledCount ?? 0);
      const failed = Number(response?.failedCount ?? 0);
      const parts: string[] = [];
      if (installed > 0) parts.push(`installed ${installed}`);
      if (already > 0) parts.push(`already installed ${already}`);
      if (failed > 0) parts.push(`${failed} not found`);
      return parts.length > 0 ? parts.join(", ") + "." : "Done.";
    },
  );

  if (result.ok) {
    closeAddSourcePreview();
  }
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

function closeSkillSetPreview() {
  skillSetPreview.open = false;
  skillSetPreview.source = "";
  skillSetPreview.sourceName = "";
  skillSetPreview.sourceId = "";
  skillSetPreview.sourceAdded = false;
  skillSetPreview.skills = [];
  skillSetPreview.selectedSkillIds = new Set();
  skillSetPreview.missingSkills = [];
}

function selectAllSkillSetPreviewSkills() {
  skillSetPreview.selectedSkillIds = new Set(skillSetPreview.skills.map((skill) => skill.id));
}

function clearSkillSetPreviewSelection() {
  skillSetPreview.selectedSkillIds = new Set();
}

async function waitUntilIdle(timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (busy.value) {
    if (Date.now() - start >= timeoutMs) {
      return false;
    }
    await wait(120);
  }
  return true;
}

function normalizeSkillSetLaunchRequest(payload: any): SkillSetLaunchRequest | null {
  const source = typeof payload?.source === "string" ? payload.source.trim() : "";
  if (!source) return null;

  const collectionFile =
    typeof payload?.collectionFile === "string" && payload.collectionFile.trim()
      ? payload.collectionFile.trim()
      : undefined;

  return {
    source,
    requestedSkills: dedupeCaseInsensitive(
      Array.isArray(payload?.requestedSkills)
        ? payload.requestedSkills.filter((entry: unknown): entry is string => typeof entry === "string")
        : [],
    ),
    installAll: payload?.installAll === true,
    ...(collectionFile ? { collectionFile } : {}),
  };
}

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

function skillPathCandidates(skillPath: string): string[] {
  const normalizedPath = skillPath.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
  if (!normalizedPath) return [];

  const segments = normalizedPath.split("/").filter(Boolean);
  const candidates: string[] = [normalizedPath];
  if (segments.length > 0) {
    const last = segments[segments.length - 1];
    candidates.push(last);
    if (last.toLowerCase() === "skill.md" && segments.length > 1) {
      candidates.push(segments[segments.length - 2]);
    }
  }

  return candidates;
}

function selectAddSourceIndexesByRequestedSkills(
  skills: AddSourcePreviewSkill[],
  requestedSkills: string[],
): { selectedIndexes: Set<number>; missingSkills: string[] } {
  const lookup = new Map<string, Set<number>>();
  for (const skill of skills) {
    const candidates = [skill.name, ...skillPathCandidates(skill.skillPath)];
    for (const candidate of candidates) {
      const key = normalizeLookupKey(candidate);
      if (!key) continue;
      if (!lookup.has(key)) lookup.set(key, new Set<number>());
      lookup.get(key)!.add(skill.index);
    }
  }

  const selectedIndexes = new Set<number>();
  const missingSkills: string[] = [];

  for (const requested of requestedSkills) {
    const key = normalizeLookupKey(requested);
    if (!key) continue;
    const matchedIndexes = lookup.get(key);
    if (!matchedIndexes || matchedIndexes.size === 0) {
      missingSkills.push(requested);
      continue;
    }
    for (const index of matchedIndexes) {
      selectedIndexes.add(index);
    }
  }

  return { selectedIndexes, missingSkills };
}

async function openSkillSetPreviewFromRequest(request: SkillSetLaunchRequest): Promise<void> {
  const idle = await waitUntilIdle();
  if (!idle) {
    addToast("Could not open Add dialog while another task is running.", "error", 5000);
    return;
  }

  openAddSourcePreview(request.source);
  await previewAddSourceInput();

  const previewSkills = addSourcePreview.skills;
  if (previewSkills.length === 0) {
    activeTab.value = "sources";
    return;
  }

  if (request.collectionFile && !addSourcePreview.activeCollectionTab) {
    const match = addSourcePreview.collections.find(
      (c) => c.file === request.collectionFile,
    );
    if (match) {
      applyCollectionTab(match.name);
    }
  }

  if (request.installAll) {
    addSourcePreview.selectedIndexes = new Set(
      previewSkills.map((skill) => skill.index),
    );
  } else if (request.requestedSkills.length > 0) {
    const selection = selectAddSourceIndexesByRequestedSkills(
      previewSkills,
      request.requestedSkills,
    );
    addSourcePreview.selectedIndexes = selection.selectedIndexes;
    if (selection.missingSkills.length > 0) {
      addToast(
        `Not found in source: ${selection.missingSkills.join(", ")}.`,
        "error",
        6000,
      );
    }
  }

  activeTab.value = "sources";
}

async function processSkillSetLaunchQueue(): Promise<void> {
  if (processingSkillSetLaunchQueue) return;
  processingSkillSetLaunchQueue = true;
  try {
    while (skillSetLaunchQueue.length > 0) {
      const next = skillSetLaunchQueue.shift();
      if (!next) continue;
      await openSkillSetPreviewFromRequest(next);
    }
  } finally {
    processingSkillSetLaunchQueue = false;
  }
}

function enqueueSkillSetLaunchRequest(request: SkillSetLaunchRequest) {
  skillSetLaunchQueue.push(request);
  void processSkillSetLaunchQueue();
}

async function installSelectedSkillSetSkills() {
  const skillIds = Array.from(skillSetPreview.selectedSkillIds);
  if (!skillIds.length) {
    addToast("Select at least one skill.", "error", 5000);
    return;
  }

  const sourceName = skillSetPreview.sourceName || "source";
  const result = await runTask(
    () =>
      api.applySkillSetInstall({
        sourceId: skillSetPreview.sourceId,
        skillIds,
      }),
    `Installing selected skills from ${sourceName}...`,
    (payload: any) =>
      `Installed ${payload?.installedCount ?? 0}, enabled ${payload?.enabledCount ?? 0}, already installed ${payload?.alreadyInstalledCount ?? 0}.`,
  );

  if (result.ok) {
    closeSkillSetPreview();
  }
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

async function syncRepo() {
  if (syncing.value || busy.value) return;
  syncing.value = true;
  try {
    const result = await api.syncPersonalRepo();
    if (result?.snapshot) {
      snapshot.value = result.snapshot;
    }
    if (result?.pulled && result?.pushed) {
      addToast("Synced with remote.", "success");
    } else {
      addToast(result?.message ?? "Sync failed.", "error", 5000);
    }
  } catch (err: any) {
    addToast(err?.message ?? "Sync failed.", "error", 5000);
  } finally {
    syncing.value = false;
  }
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

async function getRuntimeAvailability(): Promise<RuntimeAvailability> {
  try {
    const result = await api.getRuntimeAvailability();
    return {
      npm: result?.npm === true,
      npx: result?.npx === true,
      bunx: result?.bunx === true,
      git: result?.git === true,
    };
  } catch {
    return {
      npm: false,
      npx: false,
      bunx: false,
      git: false,
    };
  }
}

async function getFeedbackSessions(skillId: string): Promise<FeedbackSessionSummary[]> {
  const result = await api.getFeedbackSessions({ skillId });
  if (!Array.isArray(result)) return [];
  return result as FeedbackSessionSummary[];
}

async function getFeedbackSession(sessionId: string): Promise<FeedbackSessionDetail | null> {
  const result = await api.getFeedbackSession({ sessionId });
  if (!result || typeof result !== "object") return null;
  return result as FeedbackSessionDetail;
}

async function analyzeFeedbackReport(input: {
  skillId: string;
  sessionId: string;
  messageId: string;
  whatWasWrong: string;
  expectedBehavior: string;
  suggestedRule: string;
}): Promise<FeedbackReportAnalysis> {
  return (await api.analyzeFeedbackReport(input)) as FeedbackReportAnalysis;
}

async function saveFeedbackReport(input: {
  reportId?: string;
  skillId: string;
  sessionId: string;
  messageId: string;
  whatWasWrong: string;
  expectedBehavior: string;
  suggestedRule: string;
  analysis: FeedbackReportAnalysis;
}): Promise<FeedbackReportDraft> {
  return (await api.saveFeedbackReport(input)) as FeedbackReportDraft;
}

async function submitFeedbackReport(reportId: string): Promise<FeedbackReportDraft> {
  return (await api.submitFeedbackReport({ reportId })) as FeedbackReportDraft;
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
let unsubscribeSkillSetLaunch: (() => void) | null = null;

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

  if (unsubscribeSkillSetLaunch) {
    unsubscribeSkillSetLaunch();
    unsubscribeSkillSetLaunch = null;
  }
}

function subscribeToSkillSetLaunch() {
  if (unsubscribeSkillSetLaunch) return;
  unsubscribeSkillSetLaunch = api.onSkillSetLaunch((payload: any) => {
    const request = normalizeSkillSetLaunchRequest(payload);
    if (!request) return;
    enqueueSkillSetLaunchRequest(request);
  });
}

async function consumePendingSkillSetLaunchRequest() {
  try {
    const payload = await api.consumeLaunchSkillSetRequest();
    const request = normalizeSkillSetLaunchRequest(payload);
    if (!request) return;
    enqueueSkillSetLaunchRequest(request);
  } catch (err: any) {
    addToast(err?.message ?? "Could not consume launch request.", "error", 5000);
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
  setActiveTab("skills");
}

function setActiveTab(tab: TabId) {
  if (tab !== "feedback") {
    lastNonFeedbackTab.value = tab;
  }
  activeTab.value = tab;
}

function openFeedbackForSkill(skillId: string) {
  if (!snapshot.value) return;
  const skill = snapshot.value.skills.find((entry) => entry.id === skillId);
  if (!skill) return;

  selectSkill(skillId);
  selected.feedbackSkill = skillId;
  if (activeTab.value !== "feedback") {
    lastNonFeedbackTab.value = activeTab.value;
  }
  activeTab.value = "feedback";
}

function closeFeedback() {
  const fallback =
    lastNonFeedbackTab.value && lastNonFeedbackTab.value !== "feedback"
      ? lastNonFeedbackTab.value
      : "skills";
  activeTab.value = fallback;
}

// ── Init ──
async function init() {
  subscribeToProgress();
  subscribeToSkillSetLaunch();
  await refresh();
  await consumePendingSkillSetLaunchRequest();
}

export function useSkills() {
  return {
    // State
    snapshot,
    activeTab,
    busy,
    syncing,
    syncSetupOpen,
    queries,
    libraryFilters,
    selected,
    toasts,
    recommendations,
    importPreview,
    addSourcePreview,
    skillSetPreview,
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
    selectedFeedbackSkill,
    selectedRecommendation,
    configuredTargetCount,
    activeBudgetSummary,

    // Toast
    addToast,
    removeToast,

    // Actions
    init,
    refresh,
    setActiveTab,
    selectSkill,
    openFeedbackForSkill,
    closeFeedback,
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
    openAddSourcePreview,
    closeAddSourcePreview,
    previewAddSourceInput,
    applyCollectionTab,
    addSourceFromPreview,
    installCollectionSkills,
    removeSource,
    disableSource,
    enableSource,
    toggleTarget,
    exportInstalled,
    exportSkillGroup,
    pickImportBundle,
    importSelected,
    closeImportPreview,
    installSelectedSkillSetSkills,
    closeSkillSetPreview,
    selectAllSkillSetPreviewSkills,
    clearSkillSetPreviewSelection,
    setPersonalRepoFromUrl,
    clearPersonalRepo,
    syncRepo,
    updateApp,
    getSkillMarkdown,
    loadSkillReview,
    reviewSkill,
    editSkill,
    openPath,
    openExternal,
    getRuntimeAvailability,
    getFeedbackSessions,
    getFeedbackSession,
    analyzeFeedbackReport,
    saveFeedbackReport,
    submitFeedbackReport,
    loadRecommendations,
    jumpToSkill,
    unsubscribeFromProgress,
  };
}
