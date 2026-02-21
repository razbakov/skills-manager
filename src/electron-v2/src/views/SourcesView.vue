<script setup lang="ts">
import { ref } from "vue";
import { useSkills } from "@/composables/useSkills";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FolderOpen, ExternalLink, Trash2, Power, PowerOff, Plus } from "lucide-vue-next";

const store = useSkills();
const sourceUrl = ref("");

async function handleAddSource() {
  const url = sourceUrl.value.trim();
  if (!url) return;
  await store.addSource(url);
  sourceUrl.value = "";
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") handleAddSource();
}
</script>

<template>
  <div class="flex h-full">
    <!-- Source list -->
    <aside class="w-80 border-r shrink-0 flex flex-col min-h-0">
      <div class="p-3 pb-2">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sources</span>
          <span class="text-xs text-muted-foreground">{{ store.sources.value.length }} total</span>
        </div>
      </div>
      <ScrollArea class="flex-1 min-h-0">
        <div v-if="store.sources.value.length === 0" class="px-4 py-8 text-center text-sm text-muted-foreground">
          No sources discovered.
        </div>
        <button
          v-for="source in store.sources.value"
          :key="source.id"
          :data-selected="source.id === store.selected.source ? 'true' : undefined"
          class="w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors cursor-pointer"
          :class="source.id === store.selected.source ? 'bg-accent' : 'hover:bg-accent/50'"
          @click="store.selected.source = source.id"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium truncate">{{ source.name }}</span>
            <div class="flex items-center gap-1 shrink-0">
              <Badge variant="secondary" class="text-[10px]">{{ source.installedCount }}/{{ source.totalCount }}</Badge>
              <Badge v-if="!source.enabled" variant="warning" class="text-[10px]">disabled</Badge>
            </div>
          </div>
          <p class="text-xs text-muted-foreground mt-0.5 truncate">{{ source.repoUrl || source.path }}</p>
        </button>
      </ScrollArea>
    </aside>

    <!-- Source detail -->
    <section class="flex-1 min-w-0 min-h-0">
      <ScrollArea class="h-full">
        <div class="p-5">
          <!-- Add source form -->
          <div class="mb-5">
            <label class="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Add Source Repository</label>
            <div class="flex gap-2">
              <Input v-model="sourceUrl" placeholder="https://github.com/owner/repo" @keydown="handleKeydown" />
              <Button size="sm" :disabled="store.busy.value || !sourceUrl.trim()" @click="handleAddSource">
                <Plus class="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          </div>

          <Separator class="mb-5" />

          <div v-if="!store.selectedSource.value" class="text-center py-12 text-sm text-muted-foreground">
            Select a source to see details.
          </div>

          <template v-else>
            <h2 class="text-lg font-semibold mb-1">
              {{ store.selectedSource.value.name }}
              <span class="text-sm font-normal text-muted-foreground ml-1">
                ({{ store.selectedSource.value.installedCount }}/{{ store.selectedSource.value.totalCount }})
              </span>
            </h2>
            <p class="text-sm text-muted-foreground mb-4 break-all">
              {{ store.selectedSource.value.repoUrl || store.selectedSource.value.path }}
            </p>

            <div class="flex flex-wrap gap-2 mb-5">
              <Button variant="outline" size="sm" @click="store.openPath(store.selectedSource.value!.path)">
                <FolderOpen class="h-3.5 w-3.5" />
                Open Path
              </Button>
              <Button
                v-if="store.selectedSource.value.repoUrl"
                variant="outline"
                size="sm"
                @click="store.openExternal(store.selectedSource.value!.repoUrl!)"
              >
                <ExternalLink class="h-3.5 w-3.5" />
                Open Repo
              </Button>
              <Button
                variant="outline"
                size="sm"
                :disabled="store.busy.value"
                @click="store.selectedSource.value!.enabled ? store.disableSource(store.selectedSource.value!.id) : store.enableSource(store.selectedSource.value!.id)"
              >
                <component :is="store.selectedSource.value.enabled ? PowerOff : Power" class="h-3.5 w-3.5" />
                {{ store.selectedSource.value.enabled ? 'Disable' : 'Enable' }}
              </Button>
              <Button variant="destructive" size="sm" :disabled="store.busy.value" @click="store.removeSource(store.selectedSource.value!.id)">
                <Trash2 class="h-3.5 w-3.5" />
                Remove
              </Button>
            </div>

            <!-- Skills in source -->
            <h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Skills in Source</h3>
            <Card class="mb-5">
              <CardContent class="p-0">
                <div v-if="store.selectedSource.value.skills.length === 0" class="px-4 py-6 text-center text-sm text-muted-foreground">
                  No skills in this source.
                </div>
                <div
                  v-for="skill in store.selectedSource.value.skills"
                  :key="skill.id"
                  class="flex items-center justify-between px-4 py-2.5 border-b border-border/50 last:border-0"
                >
                  <span class="text-sm">{{ skill.name }}</span>
                  <div class="flex items-center gap-2">
                    <Badge
                      :variant="skill.installed ? (skill.disabled ? 'warning' : 'default') : 'secondary'"
                      class="text-[10px]"
                    >
                      {{ skill.installed ? (skill.disabled ? 'disabled' : 'installed') : 'available' }}
                    </Badge>
                    <Button variant="ghost" size="sm" class="h-7 text-xs" @click="store.jumpToSkill(skill.id)">
                      Manage
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </template>

          <!-- Suggested sources -->
          <template v-if="store.suggestedSources.value.length > 0">
            <Separator class="mb-5" />
            <h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Suggested Sources</h3>
            <Card>
              <CardContent class="p-0">
                <div
                  v-for="source in store.suggestedSources.value"
                  :key="source.url"
                  class="flex items-center justify-between px-4 py-2.5 border-b border-border/50 last:border-0"
                >
                  <div class="min-w-0">
                    <p class="text-sm font-medium">{{ source.name }}</p>
                    <p class="text-xs text-muted-foreground truncate">{{ source.url }}</p>
                  </div>
                  <Button variant="outline" size="sm" class="shrink-0 ml-2" :disabled="store.busy.value" @click="store.addSource(source.url)">
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          </template>
        </div>
      </ScrollArea>
    </section>
  </div>
</template>
