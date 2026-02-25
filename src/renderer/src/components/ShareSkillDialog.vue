<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { RuntimeAvailability, SkillViewModel } from "@/types";
import { useSkills } from "@/composables/useSkills";
import { buildSkillShareCommand } from "@/lib/share-command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-vue-next";

const props = defineProps<{
  open: boolean;
  skill: SkillViewModel | null;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
}>();

const store = useSkills();
const copied = ref(false);
const runtimeAvailability = ref<RuntimeAvailability | null>(null);
const checkingRuntime = ref(false);

const repoUrl = computed(() => {
  const value = props.skill?.repoUrl?.trim();
  return value || null;
});

const installName = computed(() => {
  const value = props.skill?.installName?.trim()
    || props.skill?.pathLabel?.trim()
    || props.skill?.name?.trim();
  return value || null;
});

const shareCommand = computed(() => {
  return buildSkillShareCommand({
    repoUrl: repoUrl.value,
    installName: installName.value,
    pathLabel: props.skill?.pathLabel,
    name: props.skill?.name,
  });
});

const noRuntimeAvailable = computed(() => {
  const availability = runtimeAvailability.value;
  if (!availability) return false;
  return !availability.npm && !availability.npx && !availability.bunx;
});

const missingGit = computed(() => {
  const availability = runtimeAvailability.value;
  if (!availability) return false;
  return !availability.git;
});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    copied.value = false;
    runtimeAvailability.value = null;
    checkingRuntime.value = true;
    void store.getRuntimeAvailability().then((availability) => {
      runtimeAvailability.value = availability;
      checkingRuntime.value = false;
    });
  },
);

async function copyCommand() {
  if (!shareCommand.value) return;
  await navigator.clipboard.writeText(shareCommand.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}

function close() {
  emit("update:open", false);
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="(v: boolean) => { if (!v) close(); }"
  >
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Share Skill</DialogTitle>
        <DialogDescription>
          Anyone can install this skill with the command below.
        </DialogDescription>
      </DialogHeader>

      <div v-if="shareCommand" class="space-y-3">
        <div class="rounded-md border bg-muted/50 px-3 py-2">
          <p class="text-[11px] uppercase tracking-wider text-muted-foreground">Origin</p>
          <button
            class="mt-1 break-all text-left text-xs text-blue-700 underline underline-offset-2 transition hover:text-blue-800 cursor-pointer"
            @click="store.openExternal(repoUrl!)"
          >
            {{ repoUrl }}
          </button>
        </div>
        <div
          class="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2.5 font-mono text-sm select-all cursor-pointer"
          @click="copyCommand"
        >
          <code class="flex-1 break-all">{{ shareCommand }}</code>
          <Button variant="ghost" size="icon" class="h-7 w-7 shrink-0" @click.stop="copyCommand">
            <Check v-if="copied" class="h-3.5 w-3.5 text-emerald-500" />
            <Copy v-else class="h-3.5 w-3.5" />
          </Button>
        </div>
        <p v-if="checkingRuntime" class="text-xs text-muted-foreground">
          Checking command prerequisites...
        </p>
        <div
          v-if="!checkingRuntime && noRuntimeAvailable"
          class="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          No command runtime found (`npm`, `npx`, `bunx`). Install Node.js
          (`npm`/`npx`) or Bun before running this command.
        </div>
        <div
          v-if="!checkingRuntime && missingGit"
          class="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          <code>git</code> is not available. Install Git before running this command.
        </div>
      </div>

      <div v-else class="py-6 text-center text-sm text-muted-foreground">
        This skill has no repository origin URL, so a share command is unavailable.
      </div>

      <DialogFooter>
        <Button variant="outline" @click="close">Close</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
