<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { useSkills } from "@/composables/useSkills";
import { useKeyboard } from "@/composables/useKeyboard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  RefreshCw,
  ArrowDownToLine,
  Plus,
  Package,
  FolderOpen,
  FolderGit2,
  Sparkles,
  Settings,
  X,
  CloudOff,
  CloudUpload,
} from "lucide-vue-next";
import SkillsView from "@/views/SkillsView.vue";
import InstalledView from "@/views/InstalledView.vue";
import SourcesView from "@/views/SourcesView.vue";
import RecommendationsView from "@/views/RecommendationsView.vue";
import SettingsView from "@/views/SettingsView.vue";
import FeedbackView from "@/views/FeedbackView.vue";
import ImportDialog from "@/components/ImportDialog.vue";
import AddSourceDialog from "@/components/AddSourceDialog.vue";
import SyncSetupDialog from "@/components/SyncSetupDialog.vue";

const store = useSkills();

const navItems = [
  { id: "skills" as const, label: "Skills", icon: Package },
  { id: "collections" as const, label: "Collections", icon: FolderOpen },
  { id: "sources" as const, label: "Sources", icon: FolderGit2 },
  { id: "recommendations" as const, label: "Recommend", icon: Sparkles },
  { id: "settings" as const, label: "Settings", icon: Settings },
];

function getTabCount(id: string): number | null {
  if (!store.snapshot.value) return null;
  if (id === "skills") return store.snapshot.value.skills.length;
  if (id === "collections") return store.snapshot.value.skillGroups.length;
  if (id === "sources") return store.snapshot.value.sources.length;
  if (id === "recommendations") return store.recommendations.data?.items?.length ?? 0;
  return null;
}

function getActiveList(): { ids: string[]; selectedKey: keyof typeof store.selected } | null {
  const tab = store.activeTab.value;
  if (tab === "skills") {
    return { ids: store.librarySkills.value.map((s) => s.id), selectedKey: "skills" };
  }
  if (tab === "collections") {
    return { ids: store.installedSkills.value.map((s) => s.id), selectedKey: "installed" };
  }
  if (tab === "sources") return { ids: store.sources.value.map(s => s.id), selectedKey: "source" };
  if (tab === "recommendations") return { ids: (store.recommendations.data?.items ?? []).map(i => i.skillId), selectedKey: "recommendation" };
  if (tab === "settings") return { ids: store.settings.value.map(s => s.id), selectedKey: "setting" };
  return null;
}

function moveSelection(delta: number) {
  const list = getActiveList();
  if (!list || list.ids.length === 0) return;
  const currentId = store.selected[list.selectedKey];
  const idx = currentId ? list.ids.indexOf(currentId) : -1;
  let next = idx === -1 ? (delta > 0 ? 0 : list.ids.length - 1) : idx + delta;
  next = Math.max(0, Math.min(next, list.ids.length - 1));
  const nextId = list.ids[next];
  if (list.selectedKey === "skills") {
    store.selectSkill(nextId);
  } else {
    store.selected[list.selectedKey] = nextId;
    if (list.selectedKey === "installed") {
      store.selected.installedGroup = null;
    }
  }
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>('[data-selected="true"]');
    if (el) {
      el.scrollIntoView({ block: "nearest" });
      el.focus({ preventScroll: true });
    }
  });
}

function triggerPrimaryAction() {
  const tab = store.activeTab.value;
  if (tab === "skills") {
    const s = store.selectedSkill.value;
    if (!s) return;
    if (!s.installed) {
      store.installSkill(s.id);
    } else {
      s.disabled ? store.enableSkill(s.id) : store.disableSkill(s.id);
    }
  } else if (tab === "collections") {
    const s = store.selectedInstalledSkill.value;
    if (s) s.disabled ? store.enableSkill(s.id) : store.disableSkill(s.id);
  } else if (tab === "sources") {
    const s = store.selectedSource.value;
    if (s) store.openPath(s.path);
  } else if (tab === "recommendations") {
    const r = store.selectedRecommendation.value;
    if (r) store.installSkill(r.skillId);
  } else if (tab === "settings") {
    const s = store.selectedSetting.value;
    if (s) store.toggleTarget(s.id);
  }
}

useKeyboard({
  getActiveTab: () => store.activeTab.value,
  setActiveTab: (tab) => { store.setActiveTab(tab); },
  focusSearch: () => {
    const el = document.querySelector<HTMLInputElement>('[data-search-input]');
    if (el) { el.focus(); el.select(); }
  },
  moveSelection,
  triggerPrimaryAction,
  isImportOpen: () => store.importPreview.open,
  closeImport: () => store.closeImportPreview(),
  isAddSourceOpen: () => store.addSourcePreview.open,
  closeAddSource: () => store.closeAddSourcePreview(),
});

onMounted(() => store.init());
onUnmounted(() => store.unsubscribeFromProgress());
</script>

<template>
  <TooltipProvider>
    <div class="h-screen flex flex-col bg-background overflow-hidden">
      <!-- Top bar -->
      <header
        v-if="store.activeTab.value !== 'feedback'"
        class="flex items-center justify-between px-5 py-3 border-b bg-background/80 backdrop-blur-sm"
      >
        <div class="flex items-center gap-3">
          <h1 class="text-base font-semibold tracking-tight">Skills Manager</h1>
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="store.personalRepo.value?.configured"
            variant="ghost"
            size="sm"
            :disabled="store.busy.value || store.syncing.value"
            @click="store.syncRepo()"
          >
            <CloudUpload class="h-4 w-4" :class="{ 'animate-spin': store.syncing.value }" />
            Sync
          </Button>
          <Button
            v-else
            variant="ghost"
            size="sm"
            :disabled="store.busy.value"
            @click="store.syncSetupOpen.value = true"
          >
            <CloudOff class="h-4 w-4" />
            Setup Sync
          </Button>
          <Button variant="ghost" size="sm" :disabled="store.busy.value" @click="store.updateApp()">
            <ArrowDownToLine class="h-4 w-4" />
            Update
          </Button>
          <Button variant="ghost" size="sm" :disabled="store.busy.value" @click="store.refresh()">
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': store.busy.value }" />
            Refresh
          </Button>
          <Separator orientation="vertical" class="h-5" />
          <Button variant="outline" size="sm" :disabled="store.busy.value" @click="store.openAddSourcePreview()">
            <Plus class="h-4 w-4" />
            Add
          </Button>
          <Button variant="outline" size="sm" :disabled="store.busy.value" @click="store.pickImportBundle()">
            <Download class="h-4 w-4" />
            Import
          </Button>
        </div>
      </header>

      <div class="flex flex-1 min-h-0">
        <!-- Sidebar -->
        <nav
          v-if="store.activeTab.value !== 'feedback'"
          class="w-48 border-r bg-sidebar-background flex flex-col py-2 shrink-0"
        >
          <button
            v-for="item in navItems"
            :key="item.id"
            class="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer"
            :class="
              store.activeTab.value === item.id
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
            "
            @click="store.setActiveTab(item.id)"
          >
            <component :is="item.icon" class="h-4 w-4 shrink-0" />
            <span class="truncate">{{ item.label }}</span>
            <Badge
              v-if="getTabCount(item.id) !== null"
              variant="secondary"
              class="ml-auto text-[10px] px-1.5 py-0 h-5 min-w-5 justify-center"
            >
              {{ getTabCount(item.id) }}
            </Badge>
          </button>
        </nav>

        <!-- Main content -->
        <main class="flex-1 min-w-0 min-h-0">
          <SkillsView v-if="store.activeTab.value === 'skills'" />
          <InstalledView v-else-if="store.activeTab.value === 'collections'" />
          <SourcesView v-else-if="store.activeTab.value === 'sources'" />
          <RecommendationsView v-else-if="store.activeTab.value === 'recommendations'" />
          <SettingsView v-else-if="store.activeTab.value === 'settings'" />
          <FeedbackView v-else-if="store.activeTab.value === 'feedback'" />
        </main>
      </div>

      <!-- Toasts -->
      <div class="fixed bottom-4 right-4 flex flex-col gap-2 z-50 max-w-sm">
        <TransitionGroup name="toast">
          <div
            v-for="toast in store.toasts.value"
            :key="toast.id"
            class="flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg border text-sm"
            :class="{
              'bg-background text-foreground': toast.type === 'info',
              'bg-emerald-50 text-emerald-800 border-emerald-200': toast.type === 'success',
              'bg-red-50 text-red-800 border-red-200': toast.type === 'error',
              'bg-amber-50 text-amber-800 border-amber-200': toast.type === 'pending',
            }"
          >
            <span class="flex-1">{{ toast.message }}</span>
            <button class="shrink-0 opacity-50 hover:opacity-100 cursor-pointer" @click="store.removeToast(toast.id)">
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
        </TransitionGroup>
      </div>

      <!-- Dialogs -->
      <ImportDialog />
      <AddSourceDialog />
      <SyncSetupDialog />
    </div>
  </TooltipProvider>
</template>

<style>
.toast-enter-active {
  transition: all 0.2s ease;
}
.toast-leave-active {
  transition: all 0.15s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
