<script setup lang="ts">
import { useSkills } from "@/composables/useSkills";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Play, ExternalLink } from "lucide-vue-next";
import type { RecommendationItem } from "@/types";

const store = useSkills();

function confidenceVariant(c: string): "default" | "secondary" | "warning" {
  if (c === "high") return "default";
  if (c === "medium") return "secondary";
  return "warning";
}

function usageVariant(u: string): "default" | "secondary" | "warning" {
  if (u === "used") return "default";
  if (u === "low-use") return "secondary";
  return "warning";
}

function formatStage(stage: string): string {
  if (!stage || stage === "idle") return "Idle";
  return stage.split("-").filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}
</script>

<template>
  <div class="flex h-full">
    <!-- Left panel -->
    <aside class="w-80 border-r shrink-0 flex flex-col min-h-0">
      <div class="p-3 pb-2">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recommendations</span>
          <span class="text-xs text-muted-foreground">{{ store.recommendations.data?.items?.length ?? 0 }} generated</span>
        </div>
        <div class="flex items-center gap-2 mb-3">
          <select
            :value="store.recommendations.mode"
            class="flex-1 h-8 rounded-md border border-input bg-transparent px-2 text-sm cursor-pointer"
            @change="store.recommendations.mode = ($event.target as HTMLSelectElement).value as any"
          >
            <option value="standard">Standard</option>
            <option value="explore-new">Explore New</option>
          </select>
          <Button size="sm" :disabled="store.busy.value || store.recommendations.loading" @click="store.loadRecommendations()">
            <Play class="h-3.5 w-3.5" />
            Generate
          </Button>
        </div>

        <!-- Progress -->
        <div v-if="store.recommendations.loading" class="space-y-2 mb-3 p-3 rounded-lg border bg-muted/50">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>{{ formatStage(store.recommendations.progress.stage) }}</span>
            <span>{{ store.recommendations.progress.percent }}%</span>
          </div>
          <Progress :model-value="store.recommendations.progress.percent" />
          <p class="text-xs text-muted-foreground">{{ store.recommendations.progress.message }}</p>
        </div>
      </div>

      <ScrollArea class="flex-1 min-h-0">
        <div v-if="(store.recommendations.data?.items?.length ?? 0) === 0 && !store.recommendations.loading" class="px-4 py-8 text-center text-sm text-muted-foreground">
          No recommendations yet. Click Generate.
        </div>
        <button
          v-for="rec in store.recommendations.data?.items ?? []"
          :key="rec.skillId"
          :data-selected="rec.skillId === store.selected.recommendation ? 'true' : undefined"
          class="w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors cursor-pointer"
          :class="rec.skillId === store.selected.recommendation ? 'bg-accent' : 'hover:bg-accent/50'"
          @click="store.selected.recommendation = rec.skillId"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium truncate">{{ rec.skillName }}</span>
            <div class="flex items-center gap-1 shrink-0">
              <Badge :variant="usageVariant(rec.usageStatus)" class="text-[10px]">{{ rec.usageStatus }}</Badge>
              <Badge :variant="confidenceVariant(rec.confidence)" class="text-[10px]">{{ rec.confidence }}</Badge>
            </div>
          </div>
          <p class="text-xs text-muted-foreground mt-0.5 line-clamp-2">{{ rec.reason || rec.description }}</p>
        </button>
      </ScrollArea>
    </aside>

    <!-- Right panel -->
    <section class="flex-1 min-w-0 min-h-0">
      <ScrollArea class="h-full">
        <div class="p-5">
          <div v-if="!store.selectedRecommendation.value" class="text-center py-16 text-sm text-muted-foreground">
            <Sparkles class="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p>Generate recommendations to see skill suggestions.</p>
          </div>

          <template v-else>
            <h2 class="text-lg font-semibold mb-1">{{ store.selectedRecommendation.value.skillName }}</h2>
            <p class="text-sm text-muted-foreground mb-4">
              {{ store.recommendations.data?.historySummary
                ? `${store.recommendations.data.historySummary.totalQueries} queries across ${store.recommendations.data.historySummary.uniqueSessions} sessions.`
                : '' }}
            </p>

            <!-- Metadata -->
            <div class="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2 text-sm mb-5">
              <span class="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Usage</span>
              <span>{{ store.selectedRecommendation.value.usageStatus }}</span>
              <span class="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Confidence</span>
              <span>{{ store.selectedRecommendation.value.confidence }}</span>
              <span class="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Evidence</span>
              <span>{{ store.selectedRecommendation.value.evidenceSource }}</span>
              <span class="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Matches</span>
              <span>{{ store.selectedRecommendation.value.matchedSessions }} sessions, {{ store.selectedRecommendation.value.matchedQueries }} queries</span>
            </div>

            <!-- Actions -->
            <div class="flex gap-2 mb-5">
              <Button variant="outline" size="sm" @click="store.jumpToSkill(store.selectedRecommendation.value!.skillId)">
                <ExternalLink class="h-3.5 w-3.5" />
                Open Skill
              </Button>
              <Button
                size="sm"
                :disabled="store.busy.value"
                @click="store.installSkill(store.selectedRecommendation.value!.skillId)"
              >
                Install
              </Button>
            </div>

            <Separator class="mb-5" />

            <h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Why this fit</h3>
            <p class="text-sm text-foreground/80 mb-5">{{ store.selectedRecommendation.value.reason || '-' }}</p>

            <h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">How to invoke</h3>
            <Card class="mb-5">
              <CardContent class="p-3">
                <pre class="text-xs whitespace-pre-wrap">{{ store.selectedRecommendation.value.trigger || '-' }}</pre>
              </CardContent>
            </Card>

            <h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Example from history</h3>
            <Card>
              <CardContent class="p-3">
                <pre class="text-xs whitespace-pre-wrap">{{ store.selectedRecommendation.value.exampleQuery || '-' }}</pre>
              </CardContent>
            </Card>
          </template>
        </div>
      </ScrollArea>
    </section>
  </div>
</template>
