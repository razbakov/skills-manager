import { onMounted, onUnmounted } from "vue";
import type { TabId } from "@/types";

const TAB_IDS: TabId[] = ["skills", "sources", "recommendations", "settings"];

interface KeyboardOptions {
  getActiveTab: () => TabId;
  setActiveTab: (tab: TabId) => void;
  focusSearch: () => void;
  moveSelection: (delta: number) => void;
  triggerPrimaryAction: () => void;
  isImportOpen: () => boolean;
  closeImport: () => void;
}

function isTextInput(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function useKeyboard(options: KeyboardOptions) {
  function handler(event: KeyboardEvent) {
    // Import modal escape
    if (options.isImportOpen()) {
      if (event.key === "Escape") {
        options.closeImport();
        event.preventDefault();
      }
      return;
    }

    // Ctrl/Cmd + 1-4 for tabs
    if ((event.ctrlKey || event.metaKey) && ["1", "2", "3", "4"].includes(event.key)) {
      const index = Number(event.key) - 1;
      options.setActiveTab(TAB_IDS[index]);
      event.preventDefault();
      return;
    }

    // Ctrl/Cmd + F for search
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
      options.focusSearch();
      event.preventDefault();
      return;
    }

    // / for search (when not in text input)
    if (event.key === "/" && !isTextInput(event.target)) {
      options.focusSearch();
      event.preventDefault();
      return;
    }

    // Arrow keys — always navigate the list, even from search input
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      options.moveSelection(event.key === "ArrowDown" ? 1 : -1);
      // Blur search input so focus follows the selected item
      if (isTextInput(event.target)) {
        (event.target as HTMLElement).blur();
      }
      event.preventDefault();
      return;
    }

    // Enter for primary action (when not in text input)
    if (event.key === "Enter" && !isTextInput(event.target)) {
      options.triggerPrimaryAction();
      event.preventDefault();
      return;
    }
  }

  onMounted(() => window.addEventListener("keydown", handler));
  onUnmounted(() => window.removeEventListener("keydown", handler));
}
