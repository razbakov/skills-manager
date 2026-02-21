<script setup lang="ts">
import { DialogRoot } from "radix-vue";

const props = defineProps<{ open?: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();
</script>

<template>
  <DialogRoot :open="props.open" @update:open="emit('update:open', $event)">
    <slot />
  </DialogRoot>
</template>
