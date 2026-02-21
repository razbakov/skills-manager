<script setup lang="ts">
import { TooltipTrigger } from "radix-vue";
</script>

<template>
  <TooltipTrigger as-child>
    <slot />
  </TooltipTrigger>
</template>
