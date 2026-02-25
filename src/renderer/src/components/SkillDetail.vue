<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useSkills } from "@/composables/useSkills";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import ShareSkillDialog from "@/components/ShareSkillDialog.vue";
import {
  Pencil,
  Trash2,
  Power,
  PowerOff,
  ArrowRightLeft,
  Sparkles,
  FileText,
  Gauge,
  Share2,
} from "lucide-vue-next";
import type {
  SkillViewModel,
  SkillReviewSnapshot,
} from "@/types";

const props = defineProps<{
  skill: SkillViewModel | null;
  mode: "installed" | "available";
}>();

const store = useSkills();
const markdown = ref("Select a skill to preview SKILL.md.");
const loadingMd = ref(false);
const detailTab = ref<"preview" | "review">("preview");
const selectedGroupToAdd = ref("");
const shareDialogOpen = ref(false);

watch(
  () => props.skill?.id,
  async (id) => {
    detailTab.value = "preview";
    selectedGroupToAdd.value = "";
    shareDialogOpen.value = false;
    if (!id) {
      markdown.value = "Select a skill to preview SKILL.md.";
      return;
    }
    loadingMd.value = true;
    const markdownPromise = store.getSkillMarkdown(id);
    void store.loadSkillReview(id);
    markdown.value = await markdownPromise;
    loadingMd.value = false;
  },
  { immediate: true },
);

const addableGroups = computed(() => {
  const grouped = new Set(props.skill?.groupNames ?? []);
  return store.skillGroups.value
    .filter((group) => !group.isAuto)
    .map((group) => group.name)
    .filter((name) => !grouped.has(name));
});

function formatInstalledIdes(skill: SkillViewModel): string {
  if (!skill.targetLabels?.length) return "-";
  const count = store.configuredTargetCount.value;
  const allInstalled = count > 1 && skill.targetLabels.length === count && skill.targetLabels.every((t) => t.status === "installed");
  if (allInstalled) return "All IDEs";
  return skill.targetLabels.map((t) => (t.status === "disabled" ? `${t.name} (disabled)` : t.name)).join(", ");
}

const currentReview = computed<SkillReviewSnapshot | null>(() => {
  const skillId = props.skill?.id;
  if (!skillId) return null;
  return store.skillReviews.bySkillId[skillId] ?? null;
});

const isReviewingCurrentSkill = computed(() => {
  const skillId = props.skill?.id;
  if (!skillId) return false;
  return store.skillReviews.loadingSkillId === skillId;
});

function reviewBadgeVariant(scoreFive: number): "default" | "secondary" | "warning" {
  if (scoreFive >= 4.2) return "default";
  if (scoreFive >= 3.2) return "secondary";
  return "warning";
}

function formatOverallScoreFive(scoreFive: number): string {
  return Math.max(0, Math.min(5, scoreFive)).toFixed(1);
}

function verdictLabel(verdict: SkillReviewSnapshot["verdict"]): string {
  if (verdict === "ready-to-use") return "Ready to use";
  if (verdict === "needs-targeted-fixes") return "Needs targeted fixes";
  return "Needs rethink";
}

function overallToneClass(scoreFive: number): string {
  if (scoreFive >= 4.2) {
    return "bg-emerald-50 text-emerald-900 border-emerald-200";
  }
  if (scoreFive >= 3.2) {
    return "bg-amber-50 text-amber-900 border-amber-200";
  }
  return "bg-rose-50 text-rose-900 border-rose-200";
}

function verdictToneClass(verdict: SkillReviewSnapshot["verdict"]): string {
  if (verdict === "ready-to-use") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (verdict === "needs-targeted-fixes") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-rose-100 text-rose-800";
}

function dimensionToneClass(score: number): string {
  if (score >= 4.5) return "bg-emerald-100 text-emerald-800";
  if (score >= 3.5) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

function openReviewTab(skillId: string) {
  detailTab.value = "review";
  store.reviewSkill(skillId);
}

async function addCurrentSkillToGroup(skillId: string) {
  const groupName = selectedGroupToAdd.value.trim();
  if (!groupName) return;

  const result = await store.updateSkillGroupMembership(groupName, skillId, true);
  if (result.ok) {
    selectedGroupToAdd.value = "";
  }
}

function removeCurrentSkillFromGroup(skillId: string, groupName: string) {
  void store.updateSkillGroupMembership(groupName, skillId, false);
}
</script>

<template>
  <ScrollArea class="h-full">
    <div class="p-5">
      <!-- Empty state -->
      <div v-if="!skill" class="flex flex-col items-center justify-center py-16 text-center">
        <div class="text-muted-foreground text-sm">
          {{ mode === 'installed' ? 'Select an installed skill to manage it.' : 'Select a skill to install.' }}
        </div>
      </div>

      <!-- Skill detail -->
      <template v-else>
        <div class="mb-5">
          <h2 class="text-lg font-semibold">{{ skill.name }}</h2>
          <p class="text-sm text-muted-foreground mt-1">{{ skill.description || '(no description)' }}</p>
        </div>

        <!-- Metadata -->
        <div class="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2 text-sm mb-5">
          <span class="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Source</span>
          <span>{{ skill.sourceName }}</span>
          <span class="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Origin</span>
          <div>
            <button
              v-if="skill.repoUrl"
              class="break-all text-left text-xs text-blue-700 underline underline-offset-2 transition hover:text-blue-800 cursor-pointer"
              @click="store.openExternal(skill.repoUrl)"
            >
              {{ skill.repoUrl }}
            </button>
            <span v-else class="text-xs text-muted-foreground">No repository URL</span>
          </div>
          <span class="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Path</span>
          <span class="break-all">{{ skill.pathLabel }}</span>
          <template v-if="mode === 'installed' && store.configuredTargetCount.value > 1">
            <span class="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">IDEs</span>
            <span>{{ formatInstalledIdes(skill) }}</span>
          </template>
          <template v-if="mode === 'installed'">
            <span class="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Collections</span>
            <div>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="groupName in skill.groupNames"
                  :key="`group-${groupName}`"
                  class="rounded-full border px-2 py-0.5 text-xs text-foreground/85 transition-colors hover:bg-accent"
                  :disabled="store.busy.value"
                  @click="removeCurrentSkillFromGroup(skill.id, groupName)"
                >
                  {{ groupName }} x
                </button>
                <span v-if="!skill.groupNames.length" class="text-xs text-muted-foreground">None</span>
              </div>

              <div class="mt-2 flex max-w-sm items-center gap-2">
                <select
                  v-model="selectedGroupToAdd"
                  class="h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  :disabled="store.busy.value || addableGroups.length === 0"
                >
                  <option value="">+ Add to collection</option>
                  <option v-for="groupName in addableGroups" :key="`add-${groupName}`" :value="groupName">
                    {{ groupName }}
                  </option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="store.busy.value || !selectedGroupToAdd"
                  @click="addCurrentSkillToGroup(skill.id)"
                >
                  Add
                </Button>
              </div>
            </div>
          </template>
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap gap-2 mb-5">
          <Button variant="outline" size="sm" @click="store.editSkill(skill.id)">
            <Pencil class="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="isReviewingCurrentSkill || store.busy.value"
            @click="openReviewTab(skill.id)"
          >
            <Sparkles class="h-3.5 w-3.5" />
            {{ isReviewingCurrentSkill ? 'Reviewing...' : 'Review' }}
          </Button>
          <Button variant="outline" size="sm" @click="shareDialogOpen = true">
            <Share2 class="h-3.5 w-3.5" />
            Share
          </Button>

          <template v-if="mode === 'installed'">
            <Button
              v-if="skill.unmanaged"
              size="sm"
              :disabled="store.busy.value"
              @click="store.adoptSkill(skill.id)"
            >
              <ArrowRightLeft class="h-3.5 w-3.5" />
              Adopt
            </Button>
            <Button
              v-else
              variant="outline"
              size="sm"
              :disabled="store.busy.value"
              @click="skill.disabled ? store.enableSkill(skill.id) : store.disableSkill(skill.id)"
            >
              <component :is="skill.disabled ? Power : PowerOff" class="h-3.5 w-3.5" />
              {{ skill.disabled ? 'Enable' : 'Disable' }}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              :disabled="store.busy.value"
              @click="store.uninstallSkill(skill.id)"
            >
              <Trash2 class="h-3.5 w-3.5" />
              Uninstall
            </Button>
          </template>

          <template v-else>
            <Button size="sm" :disabled="store.busy.value" @click="store.installSkill(skill.id)">
              Install
            </Button>
          </template>
        </div>

        <Separator class="mb-5" />

        <div class="mb-4 rounded-xl border bg-muted/30 p-1 inline-flex gap-1">
          <button
            class="px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
            :class="
              detailTab === 'preview'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="detailTab = 'preview'"
          >
            <FileText class="h-3.5 w-3.5" />
            <span>SKILL.md</span>
          </button>
          <button
            class="px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
            :class="
              detailTab === 'review'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="detailTab = 'review'"
          >
            <Sparkles class="h-3.5 w-3.5" />
            <span>AI Review</span>
            <Badge
              v-if="currentReview"
              :variant="reviewBadgeVariant(currentReview.overallScoreFive)"
              class="text-[10px]"
            >
              {{ formatOverallScoreFive(currentReview.overallScoreFive) }}
            </Badge>
          </button>
        </div>

        <template v-if="detailTab === 'preview'">
          <Card>
            <CardContent class="p-4 !pt-4">
              <pre
                v-if="!loadingMd"
                class="text-xs leading-relaxed whitespace-pre-wrap text-foreground/80 max-h-[32rem] overflow-auto"
              >{{ markdown }}</pre>
              <p v-else class="text-xs text-muted-foreground">Loading SKILL.md...</p>
            </CardContent>
          </Card>
        </template>

        <template v-else>
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Review</h3>
          </div>

          <div v-if="isReviewingCurrentSkill" class="text-sm text-muted-foreground mb-3">
            Running AI review...
          </div>

          <div v-if="!currentReview && !isReviewingCurrentSkill" class="text-sm text-muted-foreground">
            Run Review to generate multi-dimension feedback for this skill.
          </div>

          <template v-if="currentReview">
            <Card class="border-border mb-4">
              <CardContent class="p-4 md:p-5 !pt-4 md:!pt-5">
                <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div class="min-w-0">
                    <p class="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Runtime Verdict</p>
                    <div class="inline-flex items-center gap-2 mb-2">
                      <Badge class="text-[11px] font-medium" :class="verdictToneClass(currentReview.verdict)">
                        {{ verdictLabel(currentReview.verdict) }}
                      </Badge>
                    </div>
                    <p class="text-sm text-foreground/80 leading-relaxed">{{ currentReview.summary }}</p>
                  </div>
                  <div
                    class="shrink-0 rounded-xl border px-4 py-3 min-w-28 text-center"
                    :class="overallToneClass(currentReview.overallScoreFive)"
                  >
                    <div class="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider mb-1">
                      <Gauge class="h-3.5 w-3.5" />
                      Score
                    </div>
                    <p class="text-2xl font-semibold leading-none">{{ formatOverallScoreFive(currentReview.overallScoreFive) }}</p>
                    <p class="text-[11px] opacity-80 mt-1">out of 5</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card class="border-border mb-4">
              <CardContent class="p-4 !pt-4">
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div>
                    <p class="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                      Primary Blocker
                    </p>
                    <p class="text-sm font-medium text-foreground leading-relaxed">
                      {{ currentReview.mostCriticalIssue.statement }}
                    </p>
                    <p class="text-xs text-foreground/75 leading-relaxed mt-2">
                      {{ currentReview.mostCriticalIssue.whyItMatters }}
                    </p>
                  </div>
                  <div>
                    <p class="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                      Top Actions
                    </p>
                    <ol class="space-y-1.5">
                      <li
                        v-for="fix in currentReview.prioritizedFixes.slice(0, 3)"
                        :key="fix.id"
                        class="text-xs text-foreground/85 leading-relaxed"
                      >
                        P{{ fix.priority }} - {{ fix.title }}
                      </li>
                      <li
                        v-if="!currentReview.prioritizedFixes.length"
                        class="text-xs text-muted-foreground"
                      >
                        No targeted actions provided.
                      </li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div class="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-4">
              <Card v-for="dimension in currentReview.dimensions" :key="dimension.id" class="border-border">
                <CardContent class="p-4 !pt-4">
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm font-medium">{{ dimension.label }}</span>
                    <span
                      class="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      :class="dimensionToneClass(dimension.score)"
                    >
                      {{ dimension.score }}/5
                    </span>
                  </div>
                  <p class="text-xs text-foreground/75 leading-relaxed mt-2">{{ dimension.summary }}</p>
                </CardContent>
              </Card>
            </div>

            <Card class="border-border">
              <CardContent class="p-4 !pt-4">
                <details class="group">
                  <summary class="text-xs text-muted-foreground cursor-pointer list-none flex items-center justify-between">
                    <span class="uppercase tracking-wider">Show Detailed Analysis</span>
                    <span class="text-[11px] group-open:hidden">Expand</span>
                    <span class="text-[11px] hidden group-open:inline">Collapse</span>
                  </summary>

                  <div class="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-3">
                    <div class="rounded-lg border border-border/70 px-3 py-3">
                      <p class="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                        Failure Mode Predictions
                      </p>
                      <div class="space-y-2">
                        <div
                          v-for="mode in currentReview.failureModePredictions"
                          :key="mode.id"
                          class="text-xs text-foreground/85 leading-relaxed"
                        >
                          <p>{{ mode.prediction }}</p>
                          <p class="text-[11px] text-muted-foreground mt-1">
                            Impact {{ mode.impact }} | Confidence {{ mode.confidence }}
                          </p>
                        </div>
                        <p
                          v-if="!currentReview.failureModePredictions.length"
                          class="text-xs text-muted-foreground"
                        >
                          No detailed failure predictions.
                        </p>
                      </div>
                    </div>

                    <div class="rounded-lg border border-border/70 px-3 py-3">
                      <p class="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                        Rewrite Proposals
                      </p>
                      <div class="space-y-2">
                        <div
                          v-for="fix in currentReview.prioritizedFixes"
                          :key="`${fix.id}-details`"
                          class="text-xs leading-relaxed"
                        >
                          <p class="font-medium text-foreground">P{{ fix.priority }} - {{ fix.title }}</p>
                          <p class="text-foreground/75 mt-1">{{ fix.rationale }}</p>
                          <p class="text-foreground/90 mt-1">{{ fix.proposedRewrite }}</p>
                        </div>
                        <p
                          v-if="!currentReview.prioritizedFixes.length"
                          class="text-xs text-muted-foreground"
                        >
                          No rewrite proposals.
                        </p>
                      </div>
                    </div>
                  </div>
                </details>
              </CardContent>
            </Card>
          </template>
        </template>

        <ShareSkillDialog
          :open="shareDialogOpen"
          :skill="skill"
          @update:open="shareDialogOpen = $event"
        />
      </template>
    </div>
  </ScrollArea>
</template>
