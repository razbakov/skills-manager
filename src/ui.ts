import {
  createCliRenderer,
  Box,
  Text,
  Input,
  Select,
  TabSelect,
  SelectRenderableEvents,
  TabSelectRenderableEvents,
  InputRenderableEvents,
  type SelectRenderable,
  type TabSelectRenderable,
  type TextRenderable,
  type InputRenderable,
} from "@opentui/core";
import Fuse from "fuse.js";
import { isAbsolute, relative, resolve } from "path";
import type { Config, Skill } from "./types";
import { installSkill, uninstallSkill, disableSkill, enableSkill } from "./actions";
import { scan } from "./scanner";

export async function startUI(config: Config) {
  let skills = scan(config);
  const kitchenRoot =
    config.sources.find((source) => source.name.toLowerCase() === "kitchen")?.path ||
    config.sources.find((source) => source.path.includes("skills-kitchen"))?.path;
  const resolvedKitchenRoot = kitchenRoot ? resolve(kitchenRoot) : null;

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useMouse: true,
  });

  // --- Helpers ---

  function installedSkills(): Skill[] {
    return skills.filter((s) => s.installed);
  }

  function availableSkills(): Skill[] {
    return skills.filter((s) => !s.installed);
  }

  function getKitchenRelativePath(skill: Skill): string {
    if (!resolvedKitchenRoot) return skill.sourcePath;

    const rel = relative(resolvedKitchenRoot, resolve(skill.sourcePath));
    if (!isAbsolute(rel) && !rel.startsWith("..")) return rel || ".";

    return skill.sourcePath;
  }

  function formatInstalledOption(s: Skill) {
    const skillDescription = s.description || "(no description)";
    return {
      name: s.name,
      description: `${getKitchenRelativePath(s)} — ${skillDescription}`,
      value: s,
    };
  }

  function formatAvailableOption(s: Skill) {
    return {
      name: s.name,
      description: `${getKitchenRelativePath(s)} — ${s.description || "(no description)"}`,
      value: s,
    };
  }

  // --- Build static layout ---

  const initialInstalled = installedSkills().map(formatInstalledOption);
  const initialAvailable = availableSkills().map(formatAvailableOption);
  const statusMessage = `d:toggle disable  u:uninstall  ←/→:switch  q:quit  (${initialInstalled.length} installed)`;

  renderer.root.add(
    Box(
      {
        id: "main",
        flexDirection: "column",
        width: "100%" as any,
        height: "100%" as any,
        backgroundColor: "#111111",
      },
      TabSelect({
        id: "tabs",
        width: "100%" as any,
        height: 2,
        options: [
          { name: "Installed", description: "" },
          { name: "Available", description: "" },
        ],
        showDescription: false,
        showUnderline: true,
        selectedBackgroundColor: "#334455",
        selectedTextColor: "#FFFFFF",
        textColor: "#888888",
        backgroundColor: "#1a1a1a",
      }),
      Box(
        { id: "content", flexGrow: 1, flexDirection: "column" },
        Box(
          { id: "installed-view", flexDirection: "column", flexGrow: 1 },
          Input({
            id: "installed-search-input",
            width: "100%" as any,
            placeholder: "Search installed skills...",
            backgroundColor: "#1a1a1a",
            focusedBackgroundColor: "#2a2a2a",
            textColor: "#FFFFFF",
            cursorColor: "#00FF00",
          }),
          Select({
            id: "installed-select",
            width: "100%" as any,
            height: "100%" as any,
            options: initialInstalled,
            showDescription: true,
            showScrollIndicator: true,
            wrapSelection: true,
            backgroundColor: "#111111",
            selectedBackgroundColor: "#333366",
            selectedTextColor: "#FFFFFF",
            textColor: "#CCCCCC",
            descriptionColor: "#666666",
            selectedDescriptionColor: "#666666",
          }),
        ),
        Box(
          { id: "available-view", flexDirection: "column", flexGrow: 1, visible: false },
          Input({
            id: "available-search-input",
            width: "100%" as any,
            placeholder: "Search skills...",
            backgroundColor: "#1a1a1a",
            focusedBackgroundColor: "#2a2a2a",
            textColor: "#FFFFFF",
            cursorColor: "#00FF00",
          }),
          Select({
            id: "available-select",
            width: "100%" as any,
            height: "100%" as any,
            options: initialAvailable,
            showDescription: true,
            showScrollIndicator: true,
            wrapSelection: true,
            backgroundColor: "#111111",
            selectedBackgroundColor: "#333366",
            selectedTextColor: "#FFFFFF",
            textColor: "#CCCCCC",
            descriptionColor: "#666666",
            selectedDescriptionColor: "#AAAAAA",
          }),
        ),
      ),
      Box(
        {
          id: "status-bar",
          height: 1,
          width: "100%" as any,
          backgroundColor: "#1a1a1a",
          paddingLeft: 1,
          paddingRight: 1,
          flexDirection: "row",
        },
        Text({
          id: "status",
          content: statusMessage,
          fg: "#888888",
        }),
      ),
    ),
  );

  // --- Get renderable references (post-mount) ---

  function find<T>(id: string): T {
    return renderer.root.findDescendantById(id) as unknown as T;
  }

  // Use a small delay to ensure the tree has fully instantiated
  await new Promise((r) => setTimeout(r, 50));

  const tabsR = find<TabSelectRenderable>("tabs");
  const installedViewR = find<any>("installed-view");
  const availableViewR = find<any>("available-view");
  const installedSearchInputR = find<InputRenderable>("installed-search-input");
  const installedSelectR = find<SelectRenderable>("installed-select");
  const availableSelectR = find<SelectRenderable>("available-select");
  const availableSearchInputR = find<InputRenderable>("available-search-input");
  const statusR = find<TextRenderable>("status");

  // --- State ---

  let currentTab = 0;
  let installedSearchQuery = "";
  let availableSearchQuery = "";
  let transientStatusMessage: string | null = null;
  let transientStatusTimer: ReturnType<typeof setTimeout> | null = null;

  function showTransientStatus(message: string, durationMs: number = 1800) {
    transientStatusMessage = message;
    statusR.content = message;

    if (transientStatusTimer) {
      clearTimeout(transientStatusTimer);
      transientStatusTimer = null;
    }

    if (durationMs > 0) {
      transientStatusTimer = setTimeout(() => {
        transientStatusMessage = null;
        transientStatusTimer = null;
        updateStatus();
      }, durationMs);
    }
  }

  function searchInstalledSkills(query: string): Skill[] {
    const installed = installedSkills();
    if (!query.trim()) return installed;

    const searchable = installed.map((skill) => ({
      skill,
      name: skill.name,
      description: skill.description || "",
      kitchenPath: getKitchenRelativePath(skill),
      sourcePath: skill.sourcePath,
      sourceName: skill.sourceName,
      installName: skill.installName || "",
    }));

    const fuse = new Fuse(searchable, {
      keys: ["name", "description", "kitchenPath", "sourcePath", "sourceName", "installName"],
      threshold: 0.4,
    });

    return fuse.search(query).map((r) => r.item.skill);
  }

  function refreshInstalledList(query: string = "") {
    const filtered = searchInstalledSkills(query);
    installedSelectR.options = filtered.map(formatInstalledOption);
  }

  function searchAvailableSkills(query: string): Skill[] {
    const available = availableSkills();
    if (!query.trim()) return available;

    const searchable = available.map((skill) => ({
      skill,
      name: skill.name,
      description: skill.description || "",
      kitchenPath: getKitchenRelativePath(skill),
      sourcePath: skill.sourcePath,
      sourceName: skill.sourceName,
      installName: skill.installName || "",
    }));

    const fuse = new Fuse(searchable, {
      keys: ["name", "description", "kitchenPath", "sourcePath", "sourceName", "installName"],
      threshold: 0.4,
    });

    return fuse.search(query).map((r) => r.item.skill);
  }

  function refreshAvailableList(query: string = "") {
    const filtered = searchAvailableSkills(query);
    availableSelectR.options = filtered.map(formatAvailableOption);
  }

  function updateStatus() {
    if (transientStatusMessage) {
      statusR.content = transientStatusMessage;
      return;
    }

    if (currentTab === 0) {
      const count = searchInstalledSkills(installedSearchQuery).length;
      statusR.content = `d:toggle disable  u:uninstall  ←/→:switch  q:quit  (${count} installed)`;
    } else {
      const count = searchAvailableSkills(availableSearchQuery).length;
      statusR.content = `Enter:install  ←/→:switch  q:quit  (${count} available)`;
    }
  }

  function switchTab(tabIndex: number, syncTabs: boolean = true) {
    const safeIndex = Math.max(0, Math.min(1, tabIndex));
    currentTab = safeIndex;
    if (syncTabs && tabsR.getSelectedIndex() !== safeIndex) {
      tabsR.setSelectedIndex(safeIndex);
    }

    if (safeIndex === 0) {
      installedViewR.visible = true;
      availableViewR.visible = false;
      refreshInstalledList(installedSearchQuery);
      installedSearchInputR.focus();
    } else {
      installedViewR.visible = false;
      availableViewR.visible = true;
      refreshAvailableList(availableSearchQuery);
      availableSearchInputR.focus();
    }

    updateStatus();
  }

  function rescan() {
    skills = scan(config);
  }

  function installSelectedSkill(skill: Skill | undefined) {
    if (!skill) {
      showTransientStatus("No skill selected to install.", 1500);
      return;
    }

    try {
      showTransientStatus(`Installing ${skill.name}...`, 0);
      installSkill(skill, config);
      rescan();
      refreshAvailableList(availableSearchQuery);
      refreshInstalledList(installedSearchQuery);
      showTransientStatus(`Installed ${skill.name}.`, 1600);
    } catch (err: any) {
      showTransientStatus(`Install failed: ${err?.message || "Unknown error"}`, 2600);
    }
  }

  // --- Event handlers ---

  tabsR.on(TabSelectRenderableEvents.SELECTION_CHANGED, (index: number) => {
    switchTab(index, false);
  });

  (tabsR as any).onMouseDown = (event: any) => {
    if (event?.button !== 0) return;
    const localX = event.x - tabsR.x;
    if (localX < 0 || localX >= tabsR.width) return;

    const tabWidth =
      typeof (tabsR as any).getTabWidth === "function"
        ? (tabsR as any).getTabWidth()
        : Math.max(1, Math.floor(tabsR.width / 2));

    const clickedIndex = Math.floor(localX / tabWidth);
    switchTab(clickedIndex);
  };

  installedSearchInputR.on(InputRenderableEvents.INPUT, (value: string) => {
    installedSearchQuery = value;
    refreshInstalledList(value);
    updateStatus();
  });

  availableSearchInputR.on(InputRenderableEvents.INPUT, (value: string) => {
    availableSearchQuery = value;
    refreshAvailableList(value);
    updateStatus();
  });

  availableSelectR.on(SelectRenderableEvents.ITEM_SELECTED, (_index: number, option: any) => {
    installSelectedSkill(option?.value as Skill | undefined);
  });

  renderer.keyInput.on("keypress", (key: any) => {
    if (key.name === "q" && currentTab !== 1) {
      renderer.destroy();
      process.exit(0);
    }

    if (key.name === "left") {
      switchTab(0);
      return;
    }

    if (key.name === "right") {
      switchTab(1);
      return;
    }

    if (currentTab === 0 && key.name === "down") {
      if (!installedSelectR.focused) {
        installedSelectR.setSelectedIndex(installedSelectR.getSelectedIndex() + 1);
      }
      return;
    }

    if (currentTab === 0 && key.name === "up") {
      if (!installedSelectR.focused) {
        installedSelectR.setSelectedIndex(installedSelectR.getSelectedIndex() - 1);
      }
      return;
    }

    if (currentTab === 1 && key.name === "down") {
      if (!availableSelectR.focused) {
        availableSelectR.setSelectedIndex(availableSelectR.getSelectedIndex() + 1);
      }
      return;
    }

    if (currentTab === 1 && key.name === "up") {
      if (!availableSelectR.focused) {
        availableSelectR.setSelectedIndex(availableSelectR.getSelectedIndex() - 1);
      }
      return;
    }

    if (currentTab === 1 && (key.name === "return" || key.name === "enter" || key.name === "kpenter")) {
      const option = availableSelectR.getSelectedOption() as any;
      installSelectedSkill(option?.value as Skill | undefined);
      return;
    }

    if (currentTab === 0) {
      if (key.name === "d") {
        const option = installedSelectR.getSelectedOption() as any;
        if (option?.value) {
          const skill = option.value as Skill;
          if (skill.disabled) {
            enableSkill(skill, config);
          } else {
            disableSkill(skill, config);
          }
          rescan();
          refreshInstalledList(installedSearchQuery);
          updateStatus();
        }
      }

      if (key.name === "u") {
        const option = installedSelectR.getSelectedOption() as any;
        if (option?.value) {
          const skill = option.value as Skill;
          uninstallSkill(skill, config);
          rescan();
          refreshInstalledList(installedSearchQuery);
          updateStatus();
        }
      }
    }

    if (currentTab === 0 && key.name === "escape") {
      installedSearchQuery = "";
      installedSearchInputR.value = "";
      refreshInstalledList("");
      updateStatus();
    }

    if (currentTab === 1 && key.name === "escape") {
      availableSearchQuery = "";
      availableSearchInputR.value = "";
      refreshAvailableList("");
      updateStatus();
    }
  });

  // Set initial focus
  installedSearchInputR.focus();
  updateStatus();
}
