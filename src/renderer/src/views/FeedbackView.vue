<script setup lang="ts">
import { computed } from "vue";
import { ArrowLeft } from "lucide-vue-next";
import { useSkills } from "@/composables/useSkills";
import FeedbackReportWorkspace from "@/components/FeedbackReportWorkspace.vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const store = useSkills();

const skill = computed(() => store.selectedFeedbackSkill.value);
</script>

<template>
  <div class="h-full flex flex-col min-h-0 bg-background">
    <header class="border-b px-4 py-3 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 min-w-0">
        <Button variant="outline" size="sm" @click="store.closeFeedback()">
          <ArrowLeft class="h-3.5 w-3.5" />
          Back
        </Button>
        <Badge v-if="skill" variant="secondary" class="max-w-[18rem] truncate">{{ skill.name }}</Badge>
      </div>
      <p class="text-xs text-muted-foreground hidden md:block">Select an AI reply in dialogue and submit report</p>
    </header>

    <div class="flex-1 min-h-0">
      <FeedbackReportWorkspace v-if="skill" :skill="skill" />
      <div v-else class="h-full flex items-center justify-center text-sm text-muted-foreground">
        Select a skill and use Report issue.
      </div>
    </div>
  </div>
</template>
