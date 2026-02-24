<script setup lang="ts">
import { computed } from "vue";
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

const displayedSkills = computed(() => {
  const all = store.addSourcePreview.skills;
  if (!activeTab.value) return all;

  const collection = store.addSourcePreview.collections.find(
    (c) => c.name === activeTab.value,
  );
  if (!collection) return all;

  const nameSet = new Set(collection.skillNames.map((n) => n.toLowerCase()));
  return all.filter((skill) => nameSet.has(skill.name.toLowerCase()));
});

const selectedCount = computed(() => store.addSourcePreview.selectedIndexes.size);
const totalCount = computed(() => store.addSourcePreview.skills.length);

const visibleCollections = computed(() => {
  const allSkillNames = new Set(
    store.addSourcePreview.skills.map((s) => s.name.toLowerCase()),
  );
  return store.addSourcePreview.collections.filter((col) =>
    col.skillNames.some((n) => allSkillNames.has(n.toLowerCase())),
  );
});
const hasCollections = computed(() => visibleCollections.value.length > 0);

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

      <div v-if="hasCollections && totalCount > 0" class="flex gap-1 border-b">
        <button
          class="px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px"
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
          v-for="col in visibleCollections"
          :key="col.name"
          class="px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px"
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

      <div v-if="totalCount > 0" class="flex gap-2 my-1">
        <Button variant="outline" size="sm" @click="selectAll">Select All</Button>
        <Button variant="outline" size="sm" @click="selectNone">Select None</Button>
        <span class="text-xs text-muted-foreground self-center">
          {{ selectedCount }} selected
        </span>
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
          :disabled="store.busy.value || selectedCount === 0"
          @click="store.addSourceFromPreview()"
        >
          Add {{ selectedCount }} Skill{{ selectedCount === 1 ? "" : "s" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
