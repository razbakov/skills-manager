<script setup lang="ts">
import { computed, ref, watch } from "vue";
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
import { Check, Copy } from "lucide-vue-next";

const props = defineProps<{
  open: boolean;
  collectionName: string;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
}>();

const store = useSkills();
const copied = ref(false);

const githubPath = computed(() => {
  const url = store.personalRepo.value?.repoUrl;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\//, "").replace(/\.git$/i, "");
  } catch {
    return null;
  }
});

const shareCommand = computed(() => {
  if (!githubPath.value || !props.collectionName) return null;
  return `npx -y skill-mix ${githubPath.value}/${props.collectionName}.json`;
});

watch(
  () => props.open,
  (open) => {
    if (open) copied.value = false;
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
        <DialogTitle>Share Collection</DialogTitle>
        <DialogDescription>
          Anyone can install this collection with the command below.
        </DialogDescription>
      </DialogHeader>

      <div v-if="shareCommand" class="space-y-3">
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
        <p class="text-xs text-muted-foreground">
          Make sure you sync first so the latest changes are pushed to GitHub.
        </p>
      </div>

      <div v-else class="py-6 text-center text-sm text-muted-foreground">
        Configure a personal repository to share collections.
      </div>

      <DialogFooter>
        <Button variant="outline" @click="close">Close</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
