<script setup lang="ts">
import { ref } from "vue";
import { useSkills } from "@/composables/useSkills";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { FolderOpen, Trash2 } from "lucide-vue-next";

const store = useSkills();
const settingsGroup = ref<"ides" | "personal">("ides");
const personalUrl = ref("");

async function handleSetPersonalRepo() {
  const url = personalUrl.value.trim();
  if (!url) return;
  await store.setPersonalRepoFromUrl(url);
  personalUrl.value = "";
}
</script>

<template>
  <div class="flex h-full">
    <!-- Left panel -->
    <aside class="w-80 border-r shrink-0 flex flex-col min-h-0">
      <div class="p-3 pb-2">
        <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Settings</span>

        <!-- Group toggle -->
        <div class="flex mt-3 rounded-lg border overflow-hidden">
          <button
            class="flex-1 text-sm py-2 transition-colors cursor-pointer"
            :class="settingsGroup === 'ides' ? 'bg-accent font-medium' : 'hover:bg-accent/50'"
            @click="settingsGroup = 'ides'"
          >
            IDE Config
          </button>
          <button
            class="flex-1 text-sm py-2 transition-colors cursor-pointer"
            :class="settingsGroup === 'personal' ? 'bg-accent font-medium' : 'hover:bg-accent/50'"
            @click="settingsGroup = 'personal'"
          >
            Personal Repo
          </button>
        </div>
      </div>

      <!-- IDE list -->
      <ScrollArea v-if="settingsGroup === 'ides'" class="flex-1 min-h-0">
        <div v-if="store.settings.value.length === 0" class="px-4 py-8 text-center text-sm text-muted-foreground">
          No IDEs discovered.
        </div>
        <button
          v-for="setting in store.settings.value"
          :key="setting.id"
          class="w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors cursor-pointer"
          :class="setting.id === store.selected.setting ? 'bg-accent' : 'hover:bg-accent/50'"
          @click="store.selected.setting = setting.id"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium">{{ setting.name }}</span>
            <Badge
              :variant="!setting.isDetected ? 'secondary' : setting.isTarget ? 'default' : 'warning'"
              class="text-[10px]"
            >
              {{ !setting.isDetected ? 'not detected' : setting.isTarget ? 'enabled' : 'disabled' }}
            </Badge>
          </div>
          <p class="text-xs text-muted-foreground mt-0.5 truncate">{{ setting.targetPath }}</p>
        </button>
      </ScrollArea>

      <div v-else class="p-3 text-xs text-muted-foreground">
        Configure where adopted unmanaged skills are moved and auto-committed.
      </div>
    </aside>

    <!-- Right panel -->
    <section class="flex-1 min-w-0 min-h-0">
      <ScrollArea class="h-full">
        <div class="p-5">
          <!-- IDE settings -->
          <template v-if="settingsGroup === 'ides'">
            <div v-if="!store.selectedSetting.value" class="text-center py-16 text-sm text-muted-foreground">
              Select a target IDE to configure.
            </div>
            <template v-else>
              <h2 class="text-lg font-semibold mb-1">{{ store.selectedSetting.value.name }}</h2>
              <p class="text-sm text-muted-foreground mb-4">
                {{ store.selectedSetting.value.isDetected ? 'Detected locally.' : 'Not detected locally.' }}
              </p>

              <div class="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2 text-sm mb-5">
                <span class="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Status</span>
                <span>{{ store.selectedSetting.value.isTarget ? 'Enabled' : 'Disabled' }}</span>
                <span class="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Path</span>
                <span class="break-all">{{ store.selectedSetting.value.targetPath }}</span>
              </div>

              <div class="flex items-center gap-3 mb-5">
                <Switch
                  :checked="store.selectedSetting.value.isTarget"
                  :disabled="store.busy.value"
                  @update:checked="store.toggleTarget(store.selectedSetting.value!.id)"
                />
                <span class="text-sm">{{ store.selectedSetting.value.isTarget ? 'Enabled — new skills will be symlinked here' : 'Disabled — skills will not be installed here' }}</span>
              </div>

              <Card>
                <CardContent class="p-4">
                  <p class="text-xs text-muted-foreground">
                    Turning off an IDE prevents new skills from being symlinked there. Existing symlinks are not removed.
                  </p>
                </CardContent>
              </Card>
            </template>
          </template>

          <!-- Personal repo settings -->
          <template v-else>
            <h2 class="text-lg font-semibold mb-1">Personal Skills Repository</h2>
            <p class="text-sm text-muted-foreground mb-5">
              Used when adopting unmanaged skills. Adopted skills are moved to <code class="bg-muted px-1 rounded">&lt;repo&gt;/skills</code> and committed automatically.
            </p>

            <div class="mb-5">
              <label class="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">GitHub Repository URL</label>
              <div class="flex gap-2">
                <Input v-model="personalUrl" placeholder="https://github.com/owner/repo" @keydown.enter="handleSetPersonalRepo" />
                <Button size="sm" :disabled="store.busy.value || !personalUrl.trim()" @click="handleSetPersonalRepo">
                  Use Repo
                </Button>
              </div>
            </div>

            <div class="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2 text-sm mb-5">
              <span class="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Status</span>
              <span>{{ store.personalRepo.value?.configured ? 'Configured' : 'Not configured' }}</span>
              <span class="text-muted-foreground text-xs uppercase tracking-wider pt-0.5">Path</span>
              <span class="break-all">{{ store.personalRepo.value?.path || '-' }}</span>
            </div>

            <div v-if="store.personalRepo.value?.configured" class="flex gap-2 mb-5">
              <Button
                variant="outline"
                size="sm"
                :disabled="!store.personalRepo.value.exists"
                @click="store.openPath(store.personalRepo.value!.path)"
              >
                <FolderOpen class="h-3.5 w-3.5" />
                Open Path
              </Button>
              <Button variant="outline" size="sm" :disabled="store.busy.value" @click="store.clearPersonalRepo()">
                <Trash2 class="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>

            <Card>
              <CardContent class="p-4">
                <p class="text-xs text-muted-foreground">
                  The URL is added to sources if needed. If already present, that source is reused.
                </p>
              </CardContent>
            </Card>
          </template>
        </div>
      </ScrollArea>
    </section>
  </div>
</template>
