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
import type { Config, Skill } from "./types";
import { installSkill, uninstallSkill, disableSkill, enableSkill } from "./actions";
import { scan } from "./scanner";

export async function startUI(config: Config) {
  let skills = scan(config);

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

  function formatInstalledOption(s: Skill) {
    const status = s.disabled ? " [disabled]" : "";
    return {
      name: `${s.name}${status}`,
      description: `${s.sourceName} — ${s.sourcePath}`,
      value: s,
    };
  }

  function formatAvailableOption(s: Skill) {
    return {
      name: s.name,
      description: `${s.sourceName} — ${s.description || "(no description)"}`,
      value: s,
    };
  }

  // --- Build static layout ---

  const initialInstalled = installedSkills().map(formatInstalledOption);
  const initialAvailable = availableSkills().map(formatAvailableOption);
  const statusMessage = `d:toggle disable  u:uninstall  Tab:switch  q:quit  (${initialInstalled.length} installed)`;

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
            selectedDescriptionColor: "#AAAAAA",
          }),
        ),
        Box(
          { id: "available-view", flexDirection: "column", flexGrow: 1, visible: false },
          Input({
            id: "search-input",
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
  const installedSelectR = find<SelectRenderable>("installed-select");
  const availableSelectR = find<SelectRenderable>("available-select");
  const searchInputR = find<InputRenderable>("search-input");
  const statusR = find<TextRenderable>("status");

  // --- State ---

  let currentTab = 0;
  let searchQuery = "";

  function refreshInstalledList() {
    installedSelectR.options = installedSkills().map(formatInstalledOption);
  }

  function refreshAvailableList(query: string = "") {
    const available = availableSkills();
    let filtered: Skill[];

    if (query.trim()) {
      const fuse = new Fuse(available, {
        keys: ["name", "description"],
        threshold: 0.4,
      });
      filtered = fuse.search(query).map((r) => r.item);
    } else {
      filtered = available;
    }

    availableSelectR.options = filtered.map(formatAvailableOption);
  }

  function updateStatus() {
    if (currentTab === 0) {
      const count = installedSkills().length;
      statusR.content = `d:toggle disable  u:uninstall  Tab:switch  q:quit  (${count} installed)`;
    } else {
      const available = availableSkills();
      const count = searchQuery
        ? new Fuse(available, { keys: ["name", "description"], threshold: 0.4 }).search(searchQuery).length
        : available.length;
      statusR.content = `Enter:install  Tab:switch  q:quit  (${count} available)`;
    }
  }

  function switchTab(tabIndex: number) {
    currentTab = tabIndex;
    tabsR.setSelectedIndex(tabIndex);

    if (tabIndex === 0) {
      installedViewR.visible = true;
      availableViewR.visible = false;
      refreshInstalledList();
      installedSelectR.focus();
    } else {
      installedViewR.visible = false;
      availableViewR.visible = true;
      refreshAvailableList(searchQuery);
      searchInputR.focus();
    }

    updateStatus();
  }

  function rescan() {
    skills = scan(config);
  }

  // --- Event handlers ---

  tabsR.on(TabSelectRenderableEvents.SELECTION_CHANGED, (_index: number) => {
    switchTab(_index);
  });

  searchInputR.on(InputRenderableEvents.INPUT, (value: string) => {
    searchQuery = value;
    refreshAvailableList(value);
    updateStatus();
  });

  availableSelectR.on(SelectRenderableEvents.ITEM_SELECTED, (_index: number, option: any) => {
    if (!option?.value) return;
    const skill = option.value as Skill;
    installSkill(skill, config);
    rescan();
    refreshAvailableList(searchQuery);
    updateStatus();
  });

  renderer.keyInput.on("keypress", (key: any) => {
    if (key.name === "q" && currentTab !== 1) {
      renderer.destroy();
      process.exit(0);
    }

    if (key.name === "tab") {
      switchTab(currentTab === 0 ? 1 : 0);
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
          refreshInstalledList();
          updateStatus();
        }
      }

      if (key.name === "u") {
        const option = installedSelectR.getSelectedOption() as any;
        if (option?.value) {
          const skill = option.value as Skill;
          uninstallSkill(skill, config);
          rescan();
          refreshInstalledList();
          updateStatus();
        }
      }
    }

    if (currentTab === 1 && key.name === "escape") {
      searchQuery = "";
      searchInputR.value = "";
      refreshAvailableList("");
      updateStatus();
    }
  });

  // Set initial focus
  installedSelectR.focus();
  updateStatus();
}
