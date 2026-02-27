<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useSkills } from "@/composables/useSkills";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const store = useSkills();

const activeTab = computed(() => store.addSourcePreview.activeCollectionTab);

const activeCollection = computed(() => {
  if (!activeTab.value) return null;
  return store.addSourcePreview.collections.find(
    (c) => c.name === activeTab.value,
  ) ?? null;
});

const displayedSkills = computed(() => {
  const all = store.addSourcePreview.skills;
  if (!activeTab.value) return all;

  const collection = activeCollection.value;
  if (!collection) return all;

  const nameSet = new Set(collection.skillNames.map((n) => n.toLowerCase()));
  return all.filter((skill) => nameSet.has(skill.name.toLowerCase()));
});

const isExternalCollection = computed(
  () => activeCollection.value !== null && displayedSkills.value.length === 0,
);

const externalSelectedNames = ref(new Set<string>());
const saveToCollection = ref(true);
const saveCollectionName = ref("");
const normalizedSaveCollectionName = computed(() => saveCollectionName.value.trim());

function toggleExternalSkill(name: string) {
  const next = new Set(externalSelectedNames.value);
  if (next.has(name)) {
    next.delete(name);
  } else {
    next.add(name);
  }
  externalSelectedNames.value = next;
}

watch(
  () => [activeCollection.value, isExternalCollection.value] as const,
  ([col, isExternal]) => {
    if (isExternal && col) {
      externalSelectedNames.value = new Set(col.skillNames);
    } else {
      externalSelectedNames.value = new Set();
    }

    if (col) {
      saveCollectionName.value = col.name;
    } else {
      saveCollectionName.value = "";
    }
    saveToCollection.value = true;
  },
);

function selectAllExternal() {
  if (!activeCollection.value) return;
  externalSelectedNames.value = new Set(activeCollection.value.skillNames);
}

function selectNoneExternal() {
  externalSelectedNames.value = new Set();
}

function installExternalCollection() {
  if (!activeCollection.value) return;
  const selected = activeCollection.value.skills.filter((s) =>
    externalSelectedNames.value.has(s.name),
  );
  if (saveToCollection.value && !normalizedSaveCollectionName.value) {
    store.addToast("Enter a collection name or skip saving.", "error", 5000);
    return;
  }
  store.installCollectionSkills(
    selected,
    saveToCollection.value ? normalizedSaveCollectionName.value : undefined,
  );
}

function installFromLoadedSource() {
  if (saveToCollection.value && !normalizedSaveCollectionName.value) {
    store.addToast("Enter a collection name or skip saving.", "error", 5000);
    return;
  }
  store.addSourceFromPreview(
    saveToCollection.value ? normalizedSaveCollectionName.value : undefined,
  );
}

const selectedCount = computed(() =>
  isExternalCollection.value
    ? externalSelectedNames.value.size
    : store.addSourcePreview.selectedIndexes.size,
);
const totalCount = computed(() => store.addSourcePreview.skills.length);
const hasCollections = computed(() => store.addSourcePreview.collections.length > 0);

function toggleSkill(index: number) {
  if (store.addSourcePreview.selectedIndexes.has(index)) {
    store.addSourcePreview.selectedIndexes.delete(index);
  } else {
    store.addSourcePreview.selectedIndexes.add(index);
  }
}

function selectAll() {
  const indexes = new Set(store.addSourcePreview.selectedIndexes);
  for (const skill of displayedSkills.value) {
    indexes.add(skill.index);
  }
  store.addSourcePreview.selectedIndexes = indexes;
}

function selectNone() {
  const displayed = new Set(displayedSkills.value.map((s) => s.index));
  store.addSourcePreview.selectedIndexes = new Set(
    [...store.addSourcePreview.selectedIndexes].filter((i) => !displayed.has(i)),
  );
}
</script>

<template>
  <Dialog
    :open="store.addSourcePreview.open"
    @update:open="(open) => { if (!open) store.closeAddSourcePreview(); }"
  >
    <DialogContent class="max-w-2xl max-h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Add Skills</DialogTitle>
        <DialogDescription>
          Enter a skill path, skill set path, repository URL, or marketplace URL.
        </DialogDescription>
      </DialogHeader>

      <div class="flex gap-2">
        <Input
          v-model="store.addSourcePreview.input"
          placeholder="Path to SKILL.md, skill set, repository, or marketplace URL"
          @keydown.enter.prevent="store.previewAddSourceInput()"
        />
        <Button
          variant="outline"
          :disabled="store.busy.value || !store.addSourcePreview.input.trim()"
          @click="store.previewAddSourceInput()"
        >
          Load Skills
        </Button>
      </div>

      <p
        v-if="store.addSourcePreview.sourceName"
        class="text-xs text-muted-foreground"
      >
        {{ store.addSourcePreview.sourceName }} · {{ store.addSourcePreview.sourcePath }}
      </p>

      <div v-if="hasCollections && totalCount > 0" class="flex gap-1 border-b overflow-x-auto">
        <button
          class="px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap"
          :class="
            activeTab === null
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
          @click="store.applyCollectionTab(null)"
        >
          Skills
        </button>
        <button
          v-for="col in store.addSourcePreview.collections"
          :key="col.name"
          class="px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap"
          :class="
            activeTab === col.name
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
          @click="store.applyCollectionTab(col.name)"
        >
          {{ col.name }}
        </button>
      </div>

      <!-- External collection: skills from other repos -->
      <template v-if="isExternalCollection && activeCollection">
        <div class="flex gap-2 my-1">
          <Button variant="outline" size="sm" @click="selectAllExternal">Select All</Button>
          <Button variant="outline" size="sm" @click="selectNoneExternal">Select None</Button>
          <span class="text-xs text-muted-foreground self-center">
            {{ externalSelectedNames.size }} of {{ activeCollection.skills.length }} selected
          </span>
        </div>
        <div class="mb-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
          <label class="flex items-center gap-2 text-xs">
            <input
              v-model="saveToCollection"
              type="checkbox"
              class="cursor-pointer"
            />
            Save installed skills to a local collection
          </label>
          <Input
            v-model="saveCollectionName"
            class="mt-2 h-8 text-xs"
            :disabled="!saveToCollection"
            placeholder="Collection name"
          />
          <p class="mt-1 text-[11px] text-muted-foreground">
            Default: {{ activeCollection.name }}. Uncheck to skip.
          </p>
        </div>

        <ScrollArea class="flex-1 min-h-0 max-h-[50vh] border rounded-lg">
          <label
            v-for="skill in activeCollection.skills"
            :key="skill.name"
            class="flex items-start gap-3 px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-accent/50 transition-colors"
          >
            <input
              type="checkbox"
              :checked="externalSelectedNames.has(skill.name)"
              class="mt-1 cursor-pointer"
              @change="toggleExternalSkill(skill.name)"
            />
            <div class="min-w-0">
              <p class="text-sm font-medium">{{ skill.name }}</p>
              <p class="text-xs text-muted-foreground">
                {{ skill.description || "(no description)" }}
              </p>
              <p v-if="skill.repoUrl" class="text-[11px] text-muted-foreground/70 mt-0.5">
                {{ skill.repoUrl }}
              </p>
            </div>
          </label>
        </ScrollArea>

        <DialogFooter class="mt-3">
          <Button
            variant="outline"
            :disabled="store.busy.value"
            @click="store.closeAddSourcePreview()"
          >
            Cancel
          </Button>
          <Button
            :disabled="store.busy.value || externalSelectedNames.size === 0"
            @click="installExternalCollection()"
          >
            Add {{ externalSelectedNames.size }} Skill{{ externalSelectedNames.size === 1 ? "" : "s" }}
          </Button>
        </DialogFooter>
      </template>

      <!-- Normal source skills (or filtered by collection) -->
      <template v-else>
        <div v-if="totalCount > 0 || displayedSkills.length > 0" class="flex gap-2 my-1">
          <Button variant="outline" size="sm" @click="selectAll">Select All</Button>
          <Button variant="outline" size="sm" @click="selectNone">Select None</Button>
          <span class="text-xs text-muted-foreground self-center">
            {{ store.addSourcePreview.selectedIndexes.size }} selected
          </span>
        </div>
        <div
          v-if="activeCollection"
          class="mb-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2"
        >
          <label class="flex items-center gap-2 text-xs">
            <input
              v-model="saveToCollection"
              type="checkbox"
              class="cursor-pointer"
            />
            Save installed skills to a local collection
          </label>
          <Input
            v-model="saveCollectionName"
            class="mt-2 h-8 text-xs"
            :disabled="!saveToCollection"
            placeholder="Collection name"
          />
          <p class="mt-1 text-[11px] text-muted-foreground">
            Default: {{ activeCollection.name }}. Uncheck to skip.
          </p>
        </div>

        <ScrollArea class="flex-1 min-h-0 max-h-[50vh] border rounded-lg">
          <div
            v-if="totalCount === 0"
            class="px-4 py-8 text-center text-sm text-muted-foreground"
          >
            Load skills to choose what to add.
          </div>

          <label
            v-for="skill in displayedSkills"
            :key="skill.index"
            class="flex items-start gap-3 px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-accent/50 transition-colors"
          >
            <input
              type="checkbox"
              :checked="store.addSourcePreview.selectedIndexes.has(skill.index)"
              class="mt-1 cursor-pointer"
              @change="toggleSkill(skill.index)"
            />
            <div class="min-w-0">
              <p class="text-sm font-medium">{{ skill.name || "(unnamed)" }}</p>
              <p class="text-xs text-muted-foreground">
                {{ skill.description || "(no description)" }}
              </p>
              <p class="text-[11px] text-muted-foreground/70 mt-0.5">
                {{ skill.skillPath }}
              </p>
            </div>
          </label>
        </ScrollArea>

        <DialogFooter class="mt-3">
          <Button
            variant="outline"
            :disabled="store.busy.value"
            @click="store.closeAddSourcePreview()"
          >
            Cancel
          </Button>
          <Button
            :disabled="store.busy.value || store.addSourcePreview.selectedIndexes.size === 0"
            @click="installFromLoadedSource()"
          >
            Add {{ store.addSourcePreview.selectedIndexes.size }} Skill{{ store.addSourcePreview.selectedIndexes.size === 1 ? "" : "s" }}
          </Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>
