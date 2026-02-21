<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from "radix-vue";

defineProps<{ checked?: boolean; disabled?: boolean }>();
defineEmits<{ "update:checked": [value: boolean] }>();
</script>

<template>
  <SwitchRoot
    :checked="checked"
    :disabled="disabled"
    class="peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
    @update:checked="$emit('update:checked', $event)"
  >
    <SwitchThumb class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
  </SwitchRoot>
</template>
