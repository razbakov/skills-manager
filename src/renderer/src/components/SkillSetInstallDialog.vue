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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const store = useSkills();

const selectedCount = computed(() => store.skillSetPreview.selectedSkillIds.size);
const totalCount = computed(() => store.skillSetPreview.skills.length);

function toggleSkillSelection(skillId: string) {
  if (store.skillSetPreview.selectedSkillIds.has(skillId)) {
    store.skillSetPreview.selectedSkillIds.delete(skillId);
    return;
  }

  store.skillSetPreview.selectedSkillIds.add(skillId);
}

function statusLabel(skill: { installed: boolean; disabled: boolean }): {
  label: string;
  variant: "default" | "secondary" | "warning";
} {
  if (!skill.installed) {
    return { label: "available", variant: "secondary" };
  }

  if (skill.disabled) {
    return { label: "disabled", variant: "warning" };
  }

  return { label: "installed", variant: "default" };
}
</script>

<template>
  <Dialog
    :open="store.skillSetPreview.open"
    @update:open="(v) => { if (!v) store.closeSkillSetPreview(); }"
  >
    <DialogContent class="max-w-3xl max-h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Install Skills from {{ store.skillSetPreview.sourceName }}</DialogTitle>
        <DialogDescription>
          {{ totalCount }} skill{{ totalCount === 1 ? '' : 's' }} found.
          {{ selectedCount }} selected for install.
        </DialogDescription>
        <DialogDescription v-if="store.skillSetPreview.sourceAdded">
          Source was added automatically from {{ store.skillSetPreview.source }}.
        </DialogDescription>
        <DialogDescription
          v-if="store.skillSetPreview.missingSkills.length > 0"
          class="text-red-600"
        >
          Not found: {{ store.skillSetPreview.missingSkills.join(", ") }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex gap-2 my-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="totalCount === 0"
          @click="store.selectAllSkillSetPreviewSkills()"
        >
          Select All
        </Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="selectedCount === 0"
          @click="store.clearSkillSetPreviewSelection()"
        >
          Select None
        </Button>
      </div>

      <ScrollArea class="flex-1 min-h-0 max-h-[50vh] border rounded-lg">
        <div v-if="totalCount === 0" class="px-4 py-8 text-center text-sm text-muted-foreground">
          No skills in this source.
        </div>
        <label
          v-for="skill in store.skillSetPreview.skills"
          :key="skill.id"
          class="flex items-start gap-3 px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-accent/50 transition-colors"
        >
          <input
            type="checkbox"
            :checked="store.skillSetPreview.selectedSkillIds.has(skill.id)"
            class="mt-1 cursor-pointer"
            @change="toggleSkillSelection(skill.id)"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium">{{ skill.name || '(unnamed)' }}</p>
              <Badge :variant="statusLabel(skill).variant" class="text-[10px]">
                {{ statusLabel(skill).label }}
              </Badge>
            </div>
            <p class="text-xs text-muted-foreground">{{ skill.description || '(no description)' }}</p>
            <p class="text-[11px] text-muted-foreground/70 mt-0.5">
              {{ skill.installName || skill.name }}
            </p>
          </div>
        </label>
      </ScrollArea>

      <DialogFooter class="mt-3">
        <Button variant="outline" :disabled="store.busy.value" @click="store.closeSkillSetPreview()">
          Cancel
        </Button>
        <Button
          :disabled="store.busy.value || selectedCount === 0"
          @click="store.installSelectedSkillSetSkills()"
        >
          Install {{ selectedCount }} Skill{{ selectedCount === 1 ? '' : 's' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
