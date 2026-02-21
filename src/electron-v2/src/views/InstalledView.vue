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
        label="Installed Skills"
        :skills="store.installedSkills.value"
        :selected-id="store.selected.installed"
        :query="store.queries.installed"
        :total-count="store.snapshot.value?.installedSkills?.length ?? 0"
        @select="store.selected.installed = $event"
        @update:query="store.queries.installed = $event"
      />
    </aside>
    <section class="flex-1 min-w-0 min-h-0">
      <SkillDetail :skill="store.selectedInstalledSkill.value" mode="installed" />
    </section>
  </div>
</template>
