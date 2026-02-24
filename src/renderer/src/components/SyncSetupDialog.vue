<script setup lang="ts">
import { ref, watch } from "vue";
import { useSkills } from "@/composables/useSkills";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Cloud, ExternalLink } from "lucide-vue-next";

const store = useSkills();
const repoUrl = ref("");
const step = ref<"input" | "done">("input");

watch(
  () => store.syncSetupOpen.value,
  (open) => {
    if (open) {
      repoUrl.value = "";
      step.value = "input";
    }
  },
);

async function handleSetup() {
  const url = repoUrl.value.trim();
  if (!url) return;
  await store.setPersonalRepoFromUrl(url);
  if (store.personalRepo.value?.configured) {
    step.value = "done";
  }
}

function close() {
  store.syncSetupOpen.value = false;
}

function openGitHub() {
  store.openExternal("https://github.com/new");
}
</script>

<template>
  <Dialog
    :open="store.syncSetupOpen.value"
    @update:open="(open: boolean) => { if (!open) close(); }"
  >
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Setup Sync</DialogTitle>
        <DialogDescription>
          Connect a GitHub repository to sync your skills and collections across machines.
        </DialogDescription>
      </DialogHeader>

      <template v-if="step === 'input'">
        <div class="space-y-4">
          <div>
            <label for="sync-repo-url" class="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
              Repository URL
            </label>
            <div class="flex gap-2">
              <Input
                id="sync-repo-url"
                v-model="repoUrl"
                placeholder="https://github.com/you/my-skills"
                @keydown.enter.prevent="handleSetup"
              />
              <Button
                size="sm"
                :disabled="store.busy.value || !repoUrl.trim()"
                @click="handleSetup"
              >
                Connect
              </Button>
            </div>
          </div>

          <Card>
            <CardContent class="p-4 space-y-2">
              <p class="text-xs text-muted-foreground">
                Enter the URL of an existing GitHub repository. The app will clone it and use it to store your skills and collections.
              </p>
              <Button variant="link" size="sm" class="h-auto p-0 text-xs" @click="openGitHub">
                <ExternalLink class="h-3 w-3" />
                Create a new repository on GitHub
              </Button>
            </CardContent>
          </Card>
        </div>
      </template>

      <template v-else>
        <div class="flex flex-col items-center gap-4 py-6">
          <Cloud class="h-10 w-10 text-emerald-500" />
          <div class="text-center space-y-1">
            <p class="text-sm font-medium">Sync is ready</p>
            <p class="text-xs text-muted-foreground">
              Your personal repository is connected. Use the Sync button in the header to push and pull changes.
            </p>
          </div>
        </div>
      </template>

      <DialogFooter>
        <Button variant="outline" @click="close">
          {{ step === 'done' ? 'Close' : 'Cancel' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
