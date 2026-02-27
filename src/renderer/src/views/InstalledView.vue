<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ChevronDown, ChevronRight, FolderClosed, FolderOpen, Plus } from "lucide-vue-next";
import { useSkills } from "@/composables/useSkills";
import SkillDetail from "@/components/SkillDetail.vue";
import SkillGroupDetail from "@/components/SkillGroupDetail.vue";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SkillViewModel } from "@/types";

const store = useSkills();
const creatingGroup = ref(false);
const newGroupName = ref("");
const collapsedGroups = reactive<Record<string, boolean>>({});

const installedById = computed(() => {
  const byId = new Map<string, SkillViewModel>();
  for (const skill of store.snapshot.value?.skills ?? []) {
    byId.set(skill.id, skill);
  }
  return byId;
});

const groupedSkills = computed(() => {
  return store.skillGroups.value
    .map((group) => {
      const members = group.skillIds
        .map((skillId) => installedById.value.get(skillId))
        .filter((skill): skill is SkillViewModel => !!skill);
      return { group, members };
    })
    .filter((entry) => {
      if (!store.queries.installed.trim()) {
        return true;
      }
      return entry.members.length > 0;
    });
});

const hasVisibleSkills = computed(() =>
  store.queries.installed.trim()
    ? groupedSkills.value.some((entry) => entry.members.length > 0)
    : groupedSkills.value.length > 0,
);

function isCollapsed(groupName: string): boolean {
  return collapsedGroups[groupName] !== false;
}

function toggleCollapsed(groupName: string) {
  collapsedGroups[groupName] = !isCollapsed(groupName);
}

function selectSkill(skillId: string) {
  const skill = store.snapshot.value?.skills.find((entry) => entry.id === skillId);
  if (!skill) return;

  if (skill.installed) {
    store.selected.installed = skillId;
    store.selected.installedGroup = null;
    return;
  }

  store.jumpToSkill(skill.id);
}

function selectGroup(groupName: string) {
  store.selected.installedGroup = groupName;
}

async function handleCreateGroup() {
  const result = await store.createSkillGroup(newGroupName.value);
  if (result.ok) {
    const createdName = (result.result as any)?.groupName;
    if (typeof createdName === "string" && createdName.trim()) {
      store.selected.installedGroup = createdName;
    }
    creatingGroup.value = false;
    newGroupName.value = "";
  }
}

function startCreatingGroup() {
  creatingGroup.value = true;
}

function cancelCreatingGroup() {
  creatingGroup.value = false;
  newGroupName.value = "";
}

function toggleGroupActive(groupName: string, active: boolean) {
  void store.toggleSkillGroup(groupName, active);
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex min-h-0 flex-1">
      <aside class="flex min-h-0 w-[22rem] shrink-0 flex-col border-r">
        <div class="p-3 pb-2">
          <div class="mb-2 flex items-center justify-between">
            <span class="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Installed Skills
            </span>
            <span class="text-xs text-muted-foreground">
              {{ store.installedSkills.value.length }}/{{ store.snapshot.value?.installedSkills?.length ?? 0 }}
            </span>
          </div>
          <Input
            data-search-input
            :model-value="store.queries.installed"
            placeholder="Search skills..."
            @update:model-value="store.queries.installed = $event"
          />
        </div>

        <ScrollArea class="flex-1 min-h-0">
          <div v-if="!hasVisibleSkills" class="px-4 py-8 text-center text-sm text-muted-foreground">
            No skills match your search.
          </div>

          <div v-for="entry in groupedSkills" :key="entry.group.name" class="border-b border-border/40">
            <div
              class="flex items-center gap-2 px-2.5 py-2"
              :class="store.selected.installedGroup === entry.group.name ? 'bg-accent/70' : ''"
            >
              <button
                class="rounded p-0.5 text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
                @click="toggleCollapsed(entry.group.name)"
              >
                <ChevronRight v-if="isCollapsed(entry.group.name)" class="h-3.5 w-3.5" />
                <ChevronDown v-else class="h-3.5 w-3.5" />
              </button>

              <input
                type="checkbox"
                class="h-4 w-4 rounded border-border"
                :checked="entry.group.active"
                :disabled="store.busy.value"
                @click.stop
                @change="toggleGroupActive(entry.group.name, ($event.target as HTMLInputElement).checked)"
              />

              <button
                class="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                @click="selectGroup(entry.group.name)"
              >
                <FolderOpen v-if="entry.group.active" class="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                <FolderClosed v-else class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span class="truncate text-sm font-semibold">{{ entry.group.name }}</span>
              </button>

              <div class="flex items-center gap-1">
                <span
                  v-if="entry.group.isAuto"
                  class="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700"
                >
                  Auto
                </span>
                <span class="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                  {{ entry.group.skillCount }}
                </span>
              </div>
            </div>

            <div v-if="!isCollapsed(entry.group.name)" class="pb-1">
              <button
                v-for="skill in entry.members"
                :key="`${entry.group.name}-${skill.id}`"
                :data-selected="skill.id === store.selected.installed ? 'true' : undefined"
                class="block w-full cursor-pointer px-8 py-1.5 text-left transition-colors"
                :class="[
                  skill.id === store.selected.installed && !store.selected.installedGroup
                    ? 'bg-accent'
                    : 'hover:bg-accent/50',
                  entry.group.active || entry.group.isAuto ? '' : 'opacity-45',
                ]"
                @click="selectSkill(skill.id)"
              >
                <div class="truncate text-sm">{{ skill.name }}</div>
                <p class="truncate text-[11px] text-muted-foreground">{{ skill.sourceName }} / {{ skill.pathLabel }}</p>
              </button>
            </div>
          </div>

        </ScrollArea>

        <div class="border-t p-3">
          <Button
            v-if="!creatingGroup"
            variant="outline"
            size="sm"
            class="w-full"
            :disabled="store.busy.value"
            @click="startCreatingGroup"
          >
            <Plus class="h-3.5 w-3.5" />
            New Collection
          </Button>

          <div v-else class="space-y-2">
            <Input
              v-model="newGroupName"
              placeholder="Collection name"
              @keydown.enter.prevent="handleCreateGroup"
              @keydown.escape.prevent="cancelCreatingGroup"
            />
            <div class="flex gap-2">
              <Button size="sm" class="flex-1" :disabled="store.busy.value || !newGroupName.trim()" @click="handleCreateGroup">
                Create
              </Button>
              <Button variant="outline" size="sm" class="flex-1" :disabled="store.busy.value" @click="cancelCreatingGroup">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <section class="min-h-0 min-w-0 flex-1">
        <SkillGroupDetail
          v-if="store.selected.installedGroup"
          :group-name="store.selected.installedGroup"
        />
        <SkillDetail
          v-else
          :skill="store.selectedInstalledSkill.value"
          mode="installed"
        />
      </section>
    </div>
  </div>
</template>
