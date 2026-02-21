<script setup lang="ts">
import { computed } from "vue";
import { buttonVariants } from "./variants";
import { cn } from "@/lib/utils";

interface Props {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  as?: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "default",
  size: "default",
  as: "button",
});

const classes = computed(() =>
  cn(buttonVariants({ variant: props.variant, size: props.size })),
);
</script>

<template>
  <component :is="as" :class="classes" :disabled="disabled">
    <slot />
  </component>
</template>
