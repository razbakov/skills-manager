<script setup lang="ts">
import { computed } from "vue";
import { useSkills } from "@/composables/useSkills";
import { getSkillLibraryStatus } from "@/composables/useSearch";
import SkillDetail from "@/components/SkillDetail.vue";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const store = useSkills();

const selectedLibrarySkillId = computed(
  () => store.selectedSkill.value?.id ?? store.selected.skills,
);

const detailMode = computed<"installed" | "available">(() =>
  store.selectedSkill.value?.installed ? "installed" : "available",
);

const totalCount = computed(() => store.snapshot.value?.skills.length ?? 0);

function filteredCountLabel(): string {
  const shown = store.librarySkills.value.length;
  const total = totalCount.value;
  if (shown === total) return `${total} total`;
  return `${shown}/${total}`;
}

function statusBadge(skill: { installed: boolean; disabled: boolean }): {
  label: "Enabled" | "Disabled" | "Available";
  variant: "default" | "secondary" | "warning";
} {
  const status = getSkillLibraryStatus(skill);
  if (status === "enabled") return { label: "Enabled", variant: "default" };
  if (status === "disabled") return { label: "Disabled", variant: "warning" };
  return { label: "Available", variant: "secondary" };
}
</script>

<template>
  <div class="flex min-h-0 h-full flex-1">
    <aside class="flex min-h-0 w-96 shrink-0 flex-col border-r">
      <div class="space-y-2 p-3 pb-2">
        <div class="mb-2 flex items-center justify-between">
          <span class="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Skills Library
          </span>
          <span class="text-xs text-muted-foreground">{{ filteredCountLabel() }}</span>
        </div>

        <Input
          data-search-input
          :model-value="store.queries.skills"
          placeholder="Search skills..."
          @update:model-value="store.queries.skills = $event"
        />

        <div class="grid grid-cols-2 gap-2">
          <select
            v-model="store.libraryFilters.status"
            class="h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">All</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
            <option value="available">Available</option>
          </select>

          <select
            v-model="store.libraryFilters.sourceName"
            class="h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">All sources</option>
            <option
              v-for="sourceName in store.librarySources.value"
              :key="`source-${sourceName}`"
              :value="sourceName"
            >
              {{ sourceName }}
            </option>
          </select>
        </div>
      </div>

      <ScrollArea class="flex-1 min-h-0">
        <div
          v-if="store.librarySkills.value.length === 0"
          class="px-4 py-8 text-center text-sm text-muted-foreground"
        >
          No skills match your filters.
        </div>

        <button
          v-for="skill in store.librarySkills.value"
          :key="skill.id"
          :data-selected="skill.id === selectedLibrarySkillId ? 'true' : undefined"
          class="w-full cursor-pointer border-b border-border/50 px-3 py-2.5 text-left transition-colors"
          :class="skill.id === selectedLibrarySkillId ? 'bg-accent' : 'hover:bg-accent/50'"
          @click="store.selectSkill(skill.id)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="truncate text-sm font-medium">{{ skill.name }}</span>
            <Badge :variant="statusBadge(skill).variant" class="shrink-0 text-[10px]">
              {{ statusBadge(skill).label }}
            </Badge>
          </div>
          <p class="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {{ skill.description || '(no description)' }}
          </p>
          <p class="mt-0.5 text-[11px] text-muted-foreground/70">
            {{ skill.sourceName }} / {{ skill.pathLabel }}
          </p>
        </button>
      </ScrollArea>
    </aside>

    <section class="min-h-0 min-w-0 flex-1">
      <SkillDetail :skill="store.selectedSkill.value" :mode="detailMode" />
    </section>
  </div>
</template>
