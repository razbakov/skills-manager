<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useSkills } from "@/composables/useSkills";
import SkillList from "@/components/SkillList.vue";
import SkillDetail from "@/components/SkillDetail.vue";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const store = useSkills();
const newSetName = ref("");
const selectedSetName = ref("all");

const activeSetLabel = computed(
  () => store.activeSkillSet.value || "All Skills",
);

watch(
  () => store.activeSkillSet.value,
  (active) => {
    selectedSetName.value = active || "all";
  },
  { immediate: true },
);

async function handleCreateSet() {
  const result = await store.createSkillSet(newSetName.value);
  if (result?.ok) {
    newSetName.value = "";
  }
}

function handleApplySet(value: string) {
  selectedSetName.value = value || "all";
  void store.applySkillSet(value === "all" ? null : value);
}
</script>

<template>
  <div class="flex h-full flex-col">
    <section class="border-b bg-muted/20 px-4 py-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mb-3">
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

      <div class="rounded-lg border bg-background px-3 py-3">
        <div class="flex flex-wrap items-end gap-2 mb-2">
          <div class="flex-1 min-w-56">
            <label class="text-[11px] uppercase tracking-wider text-muted-foreground block mb-1">
              Create Set from Current Enabled Skills
            </label>
            <Input
              v-model="newSetName"
              placeholder="Set name (for example: Writing Core)"
              @keydown.enter.prevent="handleCreateSet"
            />
          </div>
          <Button size="sm" :disabled="store.busy.value || !newSetName.trim()" @click="handleCreateSet">
            Save Set
          </Button>
        </div>

        <div class="flex flex-wrap items-end gap-2">
          <div class="w-64 max-w-full">
            <label class="text-[11px] uppercase tracking-wider text-muted-foreground block mb-1">
              Active Set
            </label>
            <select
              class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              :value="selectedSetName"
              :disabled="store.busy.value"
              @change="handleApplySet(($event.target as HTMLSelectElement).value)"
            >
              <option value="all">All Skills</option>
              <option
                v-for="set in store.skillSets.value"
                :key="set.name"
                :value="set.name"
              >
                {{ set.name }} ({{ set.skillCount }})
              </option>
            </select>
          </div>
          <p class="text-xs text-muted-foreground pb-1">
            Current: <span class="font-medium text-foreground">{{ activeSetLabel }}</span>
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
