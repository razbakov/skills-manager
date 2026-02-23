<script setup lang="ts">
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { SkillViewModel } from "@/types";

defineProps<{
  skills: SkillViewModel[];
  selectedId: string | null;
  query: string;
  totalCount: number;
  label: string;
}>();

defineEmits<{
  select: [id: string];
  "update:query": [value: string];
}>();

function getStatusBadge(skill: SkillViewModel): { label: string; variant: "default" | "secondary" | "warning" | "outline" } {
  if (!skill.installed) return { label: "available", variant: "secondary" };
  if (skill.unmanaged) return { label: "local", variant: "outline" };
  if (skill.disabled) return { label: "disabled", variant: "warning" };
  if (skill.partiallyInstalled) return { label: "partial", variant: "warning" };
  return { label: "installed", variant: "default" };
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="p-3 pb-2">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">{{ label }}</span>
        <span class="text-xs text-muted-foreground">
          {{ skills.length === totalCount ? `${totalCount} total` : `${skills.length}/${totalCount}` }}
        </span>
      </div>
      <Input
        data-search-input
        :model-value="query"
        placeholder="Search skills..."
        @update:model-value="$emit('update:query', $event)"
      />
    </div>
    <ScrollArea class="flex-1 min-h-0">
      <div v-if="skills.length === 0" class="px-4 py-8 text-center text-sm text-muted-foreground">
        No skills match your search.
      </div>
      <button
        v-for="skill in skills"
        :key="skill.id"
        :data-selected="skill.id === selectedId ? 'true' : undefined"
        class="w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors cursor-pointer"
        :class="skill.id === selectedId ? 'bg-accent' : 'hover:bg-accent/50'"
        @click="$emit('select', skill.id)"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-medium truncate">{{ skill.name }}</span>
          <Badge :variant="getStatusBadge(skill).variant" class="text-[10px] shrink-0">
            {{ getStatusBadge(skill).label }}
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground mt-0.5 line-clamp-1">{{ skill.description || '(no description)' }}</p>
        <p class="text-[11px] text-muted-foreground/70 mt-0.5">{{ skill.sourceName }} / {{ skill.pathLabel }}</p>
      </button>
    </ScrollArea>
  </div>
</template>
