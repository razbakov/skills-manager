<script setup lang="ts">
import { computed } from "vue";
import { useSkills } from "@/composables/useSkills";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const store = useSkills();

const selectedCount = computed(() => store.importPreview.selectedIndexes.size);
const totalCount = computed(() => store.importPreview.skills.length);

function toggleSkill(index: number) {
  if (store.importPreview.selectedIndexes.has(index)) {
    store.importPreview.selectedIndexes.delete(index);
  } else {
    store.importPreview.selectedIndexes.add(index);
  }
}

function selectAll() {
  store.importPreview.selectedIndexes = new Set(store.importPreview.skills.map((s) => s.index));
}

function selectNone() {
  store.importPreview.selectedIndexes = new Set();
}
</script>

<template>
  <Dialog :open="store.importPreview.open" @update:open="(v) => { if (!v) store.closeImportPreview(); }">
    <DialogContent class="max-w-2xl max-h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Import Skills</DialogTitle>
        <DialogDescription>
          {{ totalCount }} skill{{ totalCount === 1 ? '' : 's' }} in {{ store.importPreview.inputPath }}.
          {{ selectedCount }} selected.
        </DialogDescription>
      </DialogHeader>

      <div class="flex gap-2 my-2">
        <Button variant="outline" size="sm" :disabled="totalCount === 0" @click="selectAll">Select All</Button>
        <Button variant="outline" size="sm" :disabled="selectedCount === 0" @click="selectNone">Select None</Button>
      </div>

      <ScrollArea class="flex-1 min-h-0 max-h-[50vh] border rounded-lg">
        <div v-if="totalCount === 0" class="px-4 py-8 text-center text-sm text-muted-foreground">
          No skills in this bundle.
        </div>
        <label
          v-for="skill in store.importPreview.skills"
          :key="skill.index"
          class="flex items-start gap-3 px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-accent/50 transition-colors"
        >
          <input
            type="checkbox"
            :checked="store.importPreview.selectedIndexes.has(skill.index)"
            class="mt-1 cursor-pointer"
            @change="toggleSkill(skill.index)"
          />
          <div class="min-w-0">
            <p class="text-sm font-medium">{{ skill.name || '(unnamed)' }}</p>
            <p class="text-xs text-muted-foreground">{{ skill.description || '(no description)' }}</p>
            <p class="text-[11px] text-muted-foreground/70 mt-0.5">
              {{ skill.repoUrl || 'missing repo URL' }}{{ skill.skillPath ? ` / ${skill.skillPath}` : '' }}
            </p>
          </div>
        </label>
      </ScrollArea>

      <DialogFooter class="mt-3">
        <Button variant="outline" :disabled="store.busy.value" @click="store.closeImportPreview()">Cancel</Button>
        <Button :disabled="store.busy.value || selectedCount === 0" @click="store.importSelected()">
          Import {{ selectedCount }} Skill{{ selectedCount === 1 ? '' : 's' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
