<script setup lang="ts">
import { useSkills } from "@/composables/useSkills";
import SkillList from "@/components/SkillList.vue";
import SkillDetail from "@/components/SkillDetail.vue";

const store = useSkills();
</script>

<template>
  <div class="flex h-full">
    <aside class="w-80 border-r shrink-0 min-h-0">
      <SkillList
        label="Available Skills"
        :skills="store.availableSkills.value"
        :selected-id="store.selected.available"
        :query="store.queries.available"
        :total-count="store.snapshot.value?.availableSkills?.length ?? 0"
        @select="store.selected.available = $event"
        @update:query="store.queries.available = $event"
      />
    </aside>
    <section class="flex-1 min-w-0 min-h-0">
      <SkillDetail :skill="store.selectedAvailableSkill.value" mode="available" />
    </section>
  </div>
</template>
