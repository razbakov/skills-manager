<script setup lang="ts">
import { Separator as SeparatorRoot } from "radix-vue";

defineProps<{ orientation?: "horizontal" | "vertical" }>();
</script>

<template>
  <SeparatorRoot
    :orientation="orientation ?? 'horizontal'"
    class="shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px"
  />
</template>
