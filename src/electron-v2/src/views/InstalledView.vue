<script setup lang="ts">
import { useSkills } from "@/composables/useSkills";
import SkillList from "@/components/SkillList.vue";
import SkillDetail from "@/components/SkillDetail.vue";

const store = useSkills();
</script>

<template>
  <div class="flex h-full flex-col">
    <section class="border-b bg-muted/20 px-4 py-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl">
        <div class="rounded-lg border bg-background px-3 py-2">
          <p class="text-[10px] uppercase tracking-wider text-muted-foreground">Enabled Skills</p>
          <p class="text-xl font-semibold leading-none mt-1">
            {{ store.activeBudgetSummary.value.enabledCount }}
          </p>
        </div>
        <div class="rounded-lg border bg-background px-3 py-2">
          <p class="text-[10px] uppercase tracking-wider text-muted-foreground">Estimated Tokens</p>
          <p class="text-xl font-semibold leading-none mt-1">
            {{ store.activeBudgetSummary.value.estimatedTokens }}
          </p>
          <p class="text-[11px] text-muted-foreground mt-1">
            Estimated with {{ store.activeBudgetSummary.value.method }}.
          </p>
        </div>
      </div>
    </section>

    <div class="flex flex-1 min-h-0">
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
  </div>
</template>
