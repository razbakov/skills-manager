<script setup lang="ts">
import { ref, watch } from "vue";
import { useSkills } from "@/composables/useSkills";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pencil, Trash2, Power, PowerOff, ArrowRightLeft } from "lucide-vue-next";
import type { SkillViewModel } from "@/types";

const props = defineProps<{
  skill: SkillViewModel | null;
  mode: "installed" | "available";
}>();

const store = useSkills();
const markdown = ref("Select a skill to preview SKILL.md.");
const loadingMd = ref(false);

watch(
  () => props.skill?.id,
  async (id) => {
    if (!id) {
      markdown.value = "Select a skill to preview SKILL.md.";
      return;
    }
    loadingMd.value = true;
    markdown.value = await store.getSkillMarkdown(id);
    loadingMd.value = false;
  },
  { immediate: true },
);

function formatInstalledIdes(skill: SkillViewModel): string {
  if (!skill.targetLabels?.length) return "-";
  const count = store.configuredTargetCount.value;
  const allInstalled = count > 1 && skill.targetLabels.length === count && skill.targetLabels.every((t) => t.status === "installed");
  if (allInstalled) return "All IDEs";
  return skill.targetLabels.map((t) => (t.status === "disabled" ? `${t.name} (disabled)` : t.name)).join(", ");
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
          <span class="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Path</span>
          <span class="break-all">{{ skill.pathLabel }}</span>
          <template v-if="mode === 'installed' && store.configuredTargetCount.value > 1">
            <span class="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">IDEs</span>
            <span>{{ formatInstalledIdes(skill) }}</span>
          </template>
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap gap-2 mb-5">
          <Button variant="outline" size="sm" @click="store.editSkill(skill.id)">
            <Pencil class="h-3.5 w-3.5" />
            Edit
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

        <!-- SKILL.md Preview -->
        <div>
          <h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">SKILL.md Preview</h3>
          <Card>
            <CardContent class="p-4">
              <pre class="text-xs leading-relaxed whitespace-pre-wrap text-foreground/80 max-h-80 overflow-auto">{{ markdown }}</pre>
            </CardContent>
          </Card>
        </div>
      </template>
    </div>
  </ScrollArea>
</template>
