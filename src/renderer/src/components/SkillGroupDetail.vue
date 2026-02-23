<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Pencil, Trash2, Upload } from "lucide-vue-next";
import { useSkills } from "@/composables/useSkills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const props = defineProps<{
  groupName: string | null;
}>();

const store = useSkills();
const editingName = ref(false);
const draftName = ref("");

const group = computed(() => {
  if (!props.groupName) return null;
  return store.skillGroups.value.find((entry) => entry.name === props.groupName) ?? null;
});

const installedSkills = computed(() => {
  const list = [...(store.snapshot.value?.installedSkills ?? [])];
  return list.sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );
});

const memberSkillIds = computed(() => new Set(group.value?.skillIds ?? []));

watch(
  () => group.value?.name,
  (name) => {
    draftName.value = name ?? "";
    editingName.value = false;
  },
  { immediate: true },
);

function openSkill(skillId: string) {
  store.selected.installed = skillId;
  store.selected.installedGroup = null;
}

async function saveRename() {
  if (!group.value) return;
  const result = await store.renameSkillGroup(group.value.name, draftName.value);
  if (result.ok) {
    const renamed = (result.result as any)?.groupName;
    if (typeof renamed === "string" && renamed.trim()) {
      store.selected.installedGroup = renamed;
    }
    editingName.value = false;
  }
}

async function removeGroup() {
  if (!group.value) return;
  const confirmed = window.confirm(`Delete collection \"${group.value.name}\"?`);
  if (!confirmed) return;

  const result = await store.deleteSkillGroup(group.value.name);
  if (result.ok) {
    store.selected.installedGroup = null;
  }
}

function updateMembership(skillId: string, checked: boolean) {
  if (!group.value || group.value.isAuto) return;
  void store.updateSkillGroupMembership(group.value.name, skillId, checked);
}

function exportGroup() {
  if (!group.value) return;
  if (group.value.isAuto) {
    void store.exportInstalled();
    return;
  }
  void store.exportSkillGroup(group.value.name);
}
</script>

<template>
  <ScrollArea class="h-full">
    <div class="p-5">
      <div v-if="!group" class="py-16 text-center text-sm text-muted-foreground">
        Select a collection to edit it.
      </div>

      <template v-else>
        <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div v-if="editingName" class="flex flex-wrap items-center gap-2">
              <Input
                v-model="draftName"
                class="max-w-sm"
                placeholder="Collection name"
                @keydown.enter.prevent="saveRename"
                @keydown.escape.prevent="editingName = false"
              />
              <Button size="sm" :disabled="store.busy.value || !draftName.trim()" @click="saveRename">
                Save
              </Button>
              <Button variant="outline" size="sm" :disabled="store.busy.value" @click="editingName = false">
                Cancel
              </Button>
            </div>

            <template v-else>
              <h2 class="truncate text-lg font-semibold">{{ group.name }}</h2>
              <div class="mt-2 flex items-center gap-2">
                <Badge :variant="group.active ? 'default' : 'secondary'" class="text-[11px]">
                  {{ group.active ? 'Active' : 'Inactive' }}
                </Badge>
                <Badge v-if="group.isAuto" variant="secondary" class="text-[11px]">
                  Auto
                </Badge>
                <span class="text-xs text-muted-foreground">
                  {{ group.skillCount }} skill{{ group.skillCount === 1 ? '' : 's' }} in collection
                  ~{{ group.estimatedTokens.toLocaleString() }} tokens
                </span>
              </div>
              <p v-if="group.isAuto" class="mt-2 text-xs text-muted-foreground">
                This collection is managed automatically and always includes all installed skills.
              </p>
            </template>
          </div>

          <div class="flex gap-2">
            <Button variant="outline" size="sm" :disabled="store.busy.value" @click="exportGroup">
              <Upload class="h-3.5 w-3.5" />
              Export
            </Button>
            <Button
              v-if="!group.isAuto"
              variant="outline"
              size="sm"
              :disabled="store.busy.value"
              @click="editingName = true"
            >
              <Pencil class="h-3.5 w-3.5" />
              Rename
            </Button>
            <Button
              v-if="!group.isAuto"
              variant="destructive"
              size="sm"
              :disabled="store.busy.value"
              @click="removeGroup"
            >
              <Trash2 class="h-3.5 w-3.5" />
              Delete Collection
            </Button>
          </div>
        </div>

        <div class="rounded-lg border">
          <div class="border-b px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
            Collection Members
          </div>
          <div class="divide-y">
            <label
              v-for="skill in installedSkills"
              :key="skill.id"
              class="flex cursor-pointer items-start gap-3 px-3 py-2.5"
            >
              <input
                type="checkbox"
                class="mt-0.5 h-4 w-4 rounded border-border"
                :checked="memberSkillIds.has(skill.id)"
                :disabled="store.busy.value || group.isAuto"
                @change="updateMembership(skill.id, ($event.target as HTMLInputElement).checked)"
              />
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium">{{ skill.name }}</div>
                <button
                  class="truncate text-left text-[11px] text-muted-foreground hover:text-foreground"
                  @click.prevent="openSkill(skill.id)"
                >
                  {{ skill.sourceName }} / {{ skill.pathLabel }}
                </button>
              </div>
            </label>
          </div>
        </div>
      </template>
    </div>
  </ScrollArea>
</template>
