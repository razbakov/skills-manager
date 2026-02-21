<script setup lang="ts">
import { ProgressRoot, ProgressIndicator } from "radix-vue";

defineProps<{ modelValue?: number }>();
</script>

<template>
  <ProgressRoot class="relative h-2 w-full overflow-hidden rounded-full bg-primary/20" :model-value="modelValue">
    <ProgressIndicator class="h-full w-full flex-1 bg-primary transition-all" :style="{ transform: `translateX(-${100 - (modelValue ?? 0)}%)` }" />
  </ProgressRoot>
</template>
