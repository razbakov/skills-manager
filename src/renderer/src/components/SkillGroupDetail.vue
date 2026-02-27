<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ChevronRight, Pencil, Save, Share2, Trash2, Upload, X } from "lucide-vue-next";
import { useSkills } from "@/composables/useSkills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import ShareCollectionDialog from "./ShareCollectionDialog.vue";

const props = defineProps<{
  groupName: string | null;
}>();

const store = useSkills();
const editingName = ref(false);
const draftName = ref("");
const shareOpen = ref(false);
const collapsedOwners = ref<Record<string, boolean>>({});
const editingMembers = ref(false);
const draftMemberIds = ref<Set<string>>(new Set());

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

interface OwnerRepoGroup {
  key: string;
  label: string;
  skills: Array<(typeof installedSkills.value)[number]>;
}

function ownerRepoFromSkill(skill: (typeof installedSkills.value)[number]): string {
  const repoUrl = (skill.repoUrl || "").trim();
  if (repoUrl) {
    const normalized = repoUrl.replace(/\.git$/i, "");
    const match = normalized.match(/github\.com[:/]([^/]+)\/([^/#]+)/i);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
  }

  const sourceName = (skill.sourceName || "").trim();
  if (!sourceName) return "Unknown source";
  const parts = sourceName.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return sourceName;
}

const installedSkillsByOwnerRepo = computed<OwnerRepoGroup[]>(() => {
  const grouped = new Map<string, OwnerRepoGroup>();
  for (const skill of installedSkills.value) {
    const ownerRepo = ownerRepoFromSkill(skill);
    const key = ownerRepo.toLowerCase();
    const existing = grouped.get(key);
    if (existing) {
      existing.skills.push(skill);
      continue;
    }
    grouped.set(key, {
      key,
      label: ownerRepo,
      skills: [skill],
    });
  }

  const groups = Array.from(grouped.values()).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );

  for (const entry of groups) {
    entry.skills.sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, {
        sensitivity: "base",
        numeric: true,
      }),
    );
  }

  return groups;
});

const memberSkillIds = computed(() => new Set(group.value?.skillIds ?? []));
const installedSkillIds = computed(
  () => new Set(installedSkills.value.map((skill) => skill.id)),
);
const allSkillsById = computed(() => {
  const byId = new Map<string, (typeof installedSkills.value)[number]>();
  for (const skill of store.snapshot.value?.skills ?? []) {
    byId.set(skill.id, skill);
  }
  return byId;
});
const syncedNotInstalledMembers = computed(() => {
  if (!group.value) return [] as Array<{
    id: string;
    name: string;
    description: string;
    known: boolean;
  }>;

  return group.value.skillIds
    .filter((skillId) => !installedSkillIds.value.has(skillId))
    .map((skillId) => {
      const known = allSkillsById.value.get(skillId);
      if (known) {
        return {
          id: skillId,
          name: known.name,
          description: known.description || "",
          known: true,
        };
      }

      const parts = skillId.split(/[\\/]/).filter(Boolean);
      const fallback = parts[parts.length - 1] || skillId;
      return {
        id: skillId,
        name: fallback,
        description: "",
        known: false,
      };
    });
});

watch(
  () => group.value?.name,
  (name) => {
    draftName.value = name ?? "";
    editingName.value = false;
    editingMembers.value = false;
  },
  { immediate: true },
);

watch(
  () => installedSkillsByOwnerRepo.value.map((entry) => entry.key),
  (keys) => {
    const keySet = new Set(keys);
    const next: Record<string, boolean> = {};
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(collapsedOwners.value, key)) {
        next[key] = collapsedOwners.value[key] === true;
      } else {
        next[key] = true;
      }
    }
    for (const key of Object.keys(collapsedOwners.value)) {
      if (!keySet.has(key)) continue;
      if (!(key in next)) {
        next[key] = collapsedOwners.value[key];
      }
    }
    collapsedOwners.value = next;
  },
  { immediate: true },
);

function openSkill(skillId: string) {
  const skill = store.snapshot.value?.skills.find((entry) => entry.id === skillId);
  if (!skill) return;

  if (skill.installed) {
    store.selected.installed = skillId;
    store.selected.installedGroup = null;
    return;
  }

  store.jumpToSkill(skillId);
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


function isOwnerCollapsed(ownerKey: string): boolean {
  return collapsedOwners.value[ownerKey] === true;
}

function toggleOwnerCollapsed(ownerKey: string) {
  collapsedOwners.value = {
    ...collapsedOwners.value,
    [ownerKey]: !isOwnerCollapsed(ownerKey),
  };
}

function enterEditMembers() {
  draftMemberIds.value = new Set(memberSkillIds.value);
  editingMembers.value = true;
}

function cancelEditMembers() {
  editingMembers.value = false;
  draftMemberIds.value = new Set();
}

function toggleDraftMember(skillId: string) {
  const next = new Set(draftMemberIds.value);
  if (next.has(skillId)) {
    next.delete(skillId);
  } else {
    next.add(skillId);
  }
  draftMemberIds.value = next;
}

function draftOwnerGroupChecked(ownerGroup: OwnerRepoGroup): boolean {
  return ownerGroup.skills.length > 0 && ownerGroup.skills.every((s) => draftMemberIds.value.has(s.id));
}

function draftOwnerGroupIndeterminate(ownerGroup: OwnerRepoGroup): boolean {
  const count = ownerGroup.skills.filter((s) => draftMemberIds.value.has(s.id)).length;
  return count > 0 && count < ownerGroup.skills.length;
}

function toggleDraftOwnerGroup(ownerGroup: OwnerRepoGroup, checked: boolean) {
  const next = new Set(draftMemberIds.value);
  for (const skill of ownerGroup.skills) {
    if (checked) {
      next.add(skill.id);
    } else {
      next.delete(skill.id);
    }
  }
  draftMemberIds.value = next;
}

async function saveEditMembers() {
  if (!group.value) return;
  const original = memberSkillIds.value;
  const draft = draftMemberIds.value;

  const toAdd = [...draft].filter((id) => !original.has(id));
  const toRemove = [...original].filter((id) => !draft.has(id));

  for (const id of toAdd) {
    const result = await store.updateSkillGroupMembership(group.value.name, id, true);
    if (!result.ok) return;
  }
  for (const id of toRemove) {
    const result = await store.updateSkillGroupMembership(group.value.name, id, false);
    if (!result.ok) return;
  }

  editingMembers.value = false;
  draftMemberIds.value = new Set();
}

function exportGroup() {
  if (!group.value) return;
  if (group.value.isAuto) {
    void store.exportInstalled();
    return;
  }
  void store.exportSkillGroup(group.value.name);
}

async function shareGroup() {
  if (!group.value) return;
  await store.syncRepo();
  shareOpen.value = true;
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
              v-if="!group.isAuto && store.personalRepo.value?.configured"
              variant="outline"
              size="sm"
              :disabled="store.busy.value || store.syncing.value"
              @click="shareGroup"
            >
              <Share2 class="h-3.5 w-3.5" />
              Share
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
          <div class="flex items-center justify-between border-b px-3 py-2">
            <span class="text-xs uppercase tracking-wider text-muted-foreground">Collection Members</span>
            <div v-if="!group.isAuto" class="flex gap-2">
              <template v-if="editingMembers">
                <Button size="sm" :disabled="store.busy.value" @click="saveEditMembers">
                  <Save class="h-3.5 w-3.5" />
                  Save
                </Button>
                <Button variant="outline" size="sm" :disabled="store.busy.value" @click="cancelEditMembers">
                  <X class="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </template>
              <Button v-else variant="outline" size="sm" :disabled="store.busy.value" @click="enterEditMembers">
                <Pencil class="h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          </div>

          <!-- View mode: only member skills -->
          <template v-if="!editingMembers">
            <div v-if="memberSkillIds.size === 0" class="px-4 py-6 text-center text-sm text-muted-foreground">
              No skills in this collection.
            </div>
            <div v-else>
              <template v-for="ownerGroup in installedSkillsByOwnerRepo" :key="`view-owner-${ownerGroup.key}`">
                <template v-if="ownerGroup.skills.some((s) => memberSkillIds.has(s.id))">
                  <div class="border-b border-border/70 last:border-b-0">
                    <div class="px-3 py-2 text-xs font-semibold text-muted-foreground">{{ ownerGroup.label }}</div>
                    <div class="mx-3 mb-2 overflow-hidden rounded-md border border-border/60 bg-muted/20">
                      <template v-for="skill in ownerGroup.skills" :key="skill.id">
                        <div
                          v-if="memberSkillIds.has(skill.id)"
                          class="flex items-start gap-3 border-b border-border/50 px-3 py-2 last:border-b-0"
                        >
                          <div class="min-w-0 flex-1">
                            <button class="text-left text-sm font-medium hover:text-foreground" @click="openSkill(skill.id)">
                              {{ skill.name }}
                            </button>
                            <div class="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                              {{ skill.description || "(no description)" }}
                            </div>
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>
                </template>
              </template>
            </div>
          </template>

          <!-- Edit mode: all skills with checkboxes -->
          <template v-else>
            <div
              v-for="ownerGroup in installedSkillsByOwnerRepo"
              :key="`edit-owner-${ownerGroup.key}`"
              class="border-b border-border/70 last:border-b-0"
            >
              <div class="flex items-center gap-2 px-3 py-2.5">
                <button
                  class="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-accent"
                  :aria-label="isOwnerCollapsed(ownerGroup.key) ? `Expand ${ownerGroup.label}` : `Collapse ${ownerGroup.label}`"
                  @click="toggleOwnerCollapsed(ownerGroup.key)"
                >
                  <ChevronRight
                    class="h-3.5 w-3.5 transition-transform"
                    :class="isOwnerCollapsed(ownerGroup.key) ? '' : 'rotate-90'"
                  />
                </button>
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-border"
                  :checked="draftOwnerGroupChecked(ownerGroup)"
                  :indeterminate.prop="draftOwnerGroupIndeterminate(ownerGroup)"
                  :disabled="store.busy.value || ownerGroup.skills.length === 0"
                  @click.stop
                  @change="toggleDraftOwnerGroup(ownerGroup, ($event.target as HTMLInputElement).checked)"
                />
                <div class="min-w-0 flex-1">
                  <div class="truncate text-xs font-semibold text-muted-foreground">{{ ownerGroup.label }}</div>
                </div>
                <Badge variant="secondary" class="text-[10px]">
                  {{ ownerGroup.skills.filter((s) => draftMemberIds.has(s.id)).length }}/{{ ownerGroup.skills.length }}
                </Badge>
              </div>

              <div
                v-if="!isOwnerCollapsed(ownerGroup.key)"
                class="mx-3 mb-2 ml-11 overflow-hidden rounded-md border border-border/60 bg-muted/20"
              >
                <label
                  v-for="skill in ownerGroup.skills"
                  :key="skill.id"
                  class="flex cursor-pointer items-start gap-3 border-b border-border/50 px-3 py-2 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    class="mt-0.5 h-4 w-4 rounded border-border"
                    :checked="draftMemberIds.has(skill.id)"
                    :disabled="store.busy.value"
                    @change="toggleDraftMember(skill.id)"
                  />
                  <div class="min-w-0 flex-1">
                    <button class="text-left text-sm font-medium hover:text-foreground" @click.prevent="openSkill(skill.id)">
                      {{ skill.name }}
                    </button>
                    <div class="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                      {{ skill.description || "(no description)" }}
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </template>

          <template v-if="syncedNotInstalledMembers.length > 0">
            <div class="border-t border-border px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
              Synced (Not Installed)
            </div>
            <div class="divide-y">
              <div
                v-for="member in syncedNotInstalledMembers"
                :key="`synced-${member.id}`"
                class="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium text-muted-foreground">{{ member.name }}</div>
                  <div class="whitespace-pre-wrap break-words text-xs text-muted-foreground/90">
                    {{ member.description || "(no description)" }}
                  </div>
                </div>
                <div class="shrink-0">
                  <Button
                    v-if="member.known"
                    size="sm"
                    variant="outline"
                    :disabled="store.busy.value"
                    @click="store.installSkill(member.id)"
                  >
                    Install
                  </Button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </template>
    </div>

    <ShareCollectionDialog
      :open="shareOpen"
      :collection-name="group?.name ?? ''"
      @update:open="shareOpen = $event"
    />
  </ScrollArea>
</template>
