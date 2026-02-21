<script setup lang="ts">
import { TooltipContent, TooltipPortal } from "radix-vue";
</script>

<template>
  <TooltipPortal>
    <TooltipContent class="z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95" :side-offset="4">
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>
