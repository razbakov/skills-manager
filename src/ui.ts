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
import { spawnSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { isAbsolute, join, relative, resolve } from "path";
import type { Config, Skill } from "./types";
import { installSkill, uninstallSkill, disableSkill, enableSkill, addGitHubSource } from "./actions";
import { findKitchenSource } from "./config";
import { scan } from "./scanner";
import {
  defaultInstalledSkillsExportPath,
  exportInstalledSkills as exportInstalledSkillsManifest,
} from "./export";

export async function startUI(config: Config) {
  let skills = await scan(config);
  const kitchenSource = findKitchenSource(config);
  const resolvedKitchenRoot = kitchenSource ? resolve(kitchenSource.path) : null;

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
    const displayName = s.disabled ? `${s.name} (disabled)` : s.name;
    return {
      name: displayName,
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

  interface SourceListEntry {
    name: string;
    path: string;
    recursive: boolean;
    repoUrl?: string;
  }

  const sourceRepoUrlCache = new Map<string, string | null>();

  function normalizeRepoUrl(raw: string): string {
    const trimmed = raw.trim();
    const githubSsh = trimmed.match(/^[^@]+@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
    if (githubSsh) {
      return `https://github.com/${githubSsh[1]}/${githubSsh[2]}`;
    }

    try {
      const parsed = new URL(trimmed);
      if ((parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.pathname.endsWith(".git")) {
        parsed.pathname = parsed.pathname.replace(/\.git$/i, "");
      }
      return parsed.toString().replace(/\/$/, "");
    } catch {
      return trimmed;
    }
  }

  function getRepoUrl(sourcePath: string): string | null {
    const absolutePath = resolve(sourcePath);
    if (sourceRepoUrlCache.has(absolutePath)) {
      return sourceRepoUrlCache.get(absolutePath) ?? null;
    }

    const result = spawnSync(
      "git",
      ["-C", absolutePath, "remote", "get-url", "origin"],
      { encoding: "utf-8" },
    );

    if (result.error || result.status !== 0) {
      sourceRepoUrlCache.set(absolutePath, null);
      return null;
    }

    const rawUrl = result.stdout?.toString().trim();
    if (!rawUrl) {
      sourceRepoUrlCache.set(absolutePath, null);
      return null;
    }

    const repoUrl = normalizeRepoUrl(rawUrl);
    sourceRepoUrlCache.set(absolutePath, repoUrl);
    return repoUrl;
  }

  function getDisplayedSources(): SourceListEntry[] {
    const rows: SourceListEntry[] = [];
    const seenPaths = new Set<string>();

    if (resolvedKitchenRoot && existsSync(resolvedKitchenRoot)) {
      try {
        for (const entry of readdirSync(resolvedKitchenRoot, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          if (entry.name.startsWith(".")) continue;

          const sourcePath = resolve(join(resolvedKitchenRoot, entry.name));
          if (seenPaths.has(sourcePath)) continue;
          seenPaths.add(sourcePath);
          rows.push({
            name: entry.name,
            path: sourcePath,
            recursive: true,
            repoUrl: getRepoUrl(sourcePath) ?? undefined,
          });
        }
      } catch {
        // Ignore inaccessible directories and fall back to configured sources.
      }
    }

    for (const source of config.sources) {
      const sourcePath = resolve(source.path);
      if (resolvedKitchenRoot && sourcePath === resolvedKitchenRoot) continue;
      if (seenPaths.has(sourcePath)) continue;

      seenPaths.add(sourcePath);
      rows.push({
        name: source.name,
        path: sourcePath,
        recursive: source.recursive ?? false,
        repoUrl: getRepoUrl(sourcePath) ?? undefined,
      });
    }

    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }

  function formatSourceOption(source: SourceListEntry) {
    const sourceRef = source.repoUrl || source.path;
    return {
      name: source.name,
      description: sourceRef,
      value: source,
    };
  }

  // --- Build static layout ---

  const initialInstalled = installedSkills().map(formatInstalledOption);
  const initialAvailable = availableSkills().map(formatAvailableOption);
  const initialSources = getDisplayedSources().map(formatSourceOption);
  const statusMessage = `d:toggle disable  u:uninstall  e:export  ←/→:switch  q:quit  (${initialInstalled.length} installed)`;

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
          { name: "Sources", description: "" },
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
        Box(
          { id: "sources-view", flexDirection: "column", flexGrow: 1, visible: false },
          Text({
            id: "sources-url-label",
            content: "GitHub repository URL",
            fg: "#888888",
          }),
          Input({
            id: "sources-url-input",
            width: "100%" as any,
            placeholder: "https://github.com/owner/repo",
            backgroundColor: "#1a1a1a",
            focusedBackgroundColor: "#2a2a2a",
            textColor: "#FFFFFF",
            cursorColor: "#00FF00",
          }),
          Text({
            id: "sources-add-source-label",
            content: "Add Source (press Enter)",
            fg: "#666666",
          }),
          Select({
            id: "sources-select",
            width: "100%" as any,
            height: "100%" as any,
            options: initialSources,
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
  const sourcesViewR = find<any>("sources-view");
  const installedSearchInputR = find<InputRenderable>("installed-search-input");
  const installedSelectR = find<SelectRenderable>("installed-select");
  const availableSelectR = find<SelectRenderable>("available-select");
  const availableSearchInputR = find<InputRenderable>("available-search-input");
  const sourcesUrlInputR = find<InputRenderable>("sources-url-input");
  const sourcesSelectR = find<SelectRenderable>("sources-select");
  const statusR = find<TextRenderable>("status");

  // --- State ---

  const TAB_COUNT = 3;
  let currentTab = 0;
  let installedSearchQuery = "";
  let availableSearchQuery = "";
  let sourcesUrl = "";
  let transientStatusMessage: string | null = null;
  let transientStatusTimer: ReturnType<typeof setTimeout> | null = null;

  function isCurrentTabInputFocused(): boolean {
    if (currentTab === 0) return installedSearchInputR.focused;
    if (currentTab === 1) return availableSearchInputR.focused;
    return sourcesUrlInputR.focused;
  }

  function isPlainPrintableKey(key: any): boolean {
    if (key.ctrl || key.meta || key.option) return false;
    if (typeof key.sequence !== "string" || key.sequence.length !== 1) return false;

    const charCode = key.sequence.charCodeAt(0);
    return charCode >= 32 && charCode !== 127;
  }

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

  function refreshSourcesList() {
    sourcesSelectR.options = getDisplayedSources().map(formatSourceOption);
  }

  function updateStatus() {
    if (transientStatusMessage) {
      statusR.content = transientStatusMessage;
      return;
    }

    if (currentTab === 0) {
      const count = searchInstalledSkills(installedSearchQuery).length;
      statusR.content = `d:toggle disable  u:uninstall  e:export  ←/→:switch  q:quit  (${count} installed)`;
    } else if (currentTab === 1) {
      const count = searchAvailableSkills(availableSearchQuery).length;
      statusR.content = `Enter:install  ←/→:switch  q:quit  (${count} available)`;
    } else {
      statusR.content = `Enter:Add Source  ←/→:switch  q:quit  (${getDisplayedSources().length} sources)`;
    }
  }

  function switchTab(tabIndex: number, syncTabs: boolean = true) {
    const safeIndex = Math.max(0, Math.min(TAB_COUNT - 1, tabIndex));
    currentTab = safeIndex;
    if (syncTabs && tabsR.getSelectedIndex() !== safeIndex) {
      tabsR.setSelectedIndex(safeIndex);
    }

    if (safeIndex === 0) {
      installedViewR.visible = true;
      availableViewR.visible = false;
      sourcesViewR.visible = false;
      refreshInstalledList(installedSearchQuery);
      installedSearchInputR.focus();
    } else if (safeIndex === 1) {
      installedViewR.visible = false;
      availableViewR.visible = true;
      sourcesViewR.visible = false;
      refreshAvailableList(availableSearchQuery);
      availableSearchInputR.focus();
    } else {
      installedViewR.visible = false;
      availableViewR.visible = false;
      sourcesViewR.visible = true;
      refreshSourcesList();
      sourcesUrlInputR.focus();
    }

    updateStatus();
  }

  async function rescan() {
    skills = await scan(config);
  }

  async function installSelectedSkill(skill: Skill | undefined) {
    if (!skill) {
      showTransientStatus("No skill selected to install.", 1500);
      return;
    }

    try {
      showTransientStatus(`Installing ${skill.name}...`, 0);
      installSkill(skill, config);
      await rescan();
      refreshAvailableList(availableSearchQuery);
      refreshInstalledList(installedSearchQuery);
      showTransientStatus(`Installed ${skill.name}.`, 1600);
    } catch (err: any) {
      showTransientStatus(`Install failed: ${err?.message || "Unknown error"}`, 2600);
    }
  }

  function exportInstalledSkillsToFile() {
    try {
      const outputPath = exportInstalledSkillsManifest(skills, defaultInstalledSkillsExportPath());
      const installedCount = skills.filter((skill) => skill.installed).length;
      showTransientStatus(
        `Exported ${installedCount} installed skill${installedCount === 1 ? "" : "s"} to ${outputPath}.`,
        3200,
      );
    } catch (err: any) {
      showTransientStatus(`Export failed: ${err?.message || "Unknown error"}`, 3200);
    }
  }

  async function addSourceFromInput() {
    const repoUrl = sourcesUrl.trim();
    if (!repoUrl) {
      showTransientStatus("Enter a GitHub repository URL.", 2200);
      return;
    }

    try {
      showTransientStatus("Adding source...", 0);
      const source = addGitHubSource(repoUrl, config);
      await rescan();
      refreshSourcesList();
      refreshAvailableList(availableSearchQuery);
      sourcesUrl = "";
      sourcesUrlInputR.value = "";
      showTransientStatus(`Added source ${source.name}.`, 1800);
    } catch (err: any) {
      showTransientStatus(err?.message || "Could not add source.", 3200);
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
        : Math.max(1, Math.floor(tabsR.width / TAB_COUNT));

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

  sourcesUrlInputR.on(InputRenderableEvents.INPUT, (value: string) => {
    sourcesUrl = value;
  });

  availableSelectR.on(SelectRenderableEvents.ITEM_SELECTED, (_index: number, option: any) => {
    void installSelectedSkill(option?.value as Skill | undefined);
  });

  renderer.keyInput.on("keypress", async (key: any) => {
    const isTypingInInput = isCurrentTabInputFocused() && isPlainPrintableKey(key);

    if ((key.ctrl && key.name === "q") || (key.name === "q" && !isTypingInInput)) {
      renderer.destroy();
      process.exit(0);
    }

    if (key.name === "left") {
      switchTab(currentTab - 1);
      return;
    }

    if (key.name === "right") {
      switchTab(currentTab + 1);
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

    if (currentTab === 2 && key.name === "down") {
      if (!sourcesSelectR.focused) {
        sourcesSelectR.setSelectedIndex(sourcesSelectR.getSelectedIndex() + 1);
      }
      return;
    }

    if (currentTab === 2 && key.name === "up") {
      if (!sourcesSelectR.focused) {
        sourcesSelectR.setSelectedIndex(sourcesSelectR.getSelectedIndex() - 1);
      }
      return;
    }

    if (currentTab === 1 && (key.name === "return" || key.name === "enter" || key.name === "kpenter")) {
      const option = availableSelectR.getSelectedOption() as any;
      await installSelectedSkill(option?.value as Skill | undefined);
      return;
    }

    if (currentTab === 2 && (key.name === "return" || key.name === "enter" || key.name === "kpenter")) {
      await addSourceFromInput();
      return;
    }

    if (currentTab === 0) {
      if (!isTypingInInput && key.name === "d") {
        const option = installedSelectR.getSelectedOption() as any;
        if (option?.value) {
          try {
            const skill = option.value as Skill;
            const skillName = skill.name;
            const wasDisabled = skill.disabled;

            if (wasDisabled) {
              enableSkill(skill, config);
            } else {
              disableSkill(skill, config);
            }
            await rescan();
            refreshInstalledList(installedSearchQuery);
            showTransientStatus(`${wasDisabled ? "Enabled" : "Disabled"} ${skillName}.`, 1800);
          } catch (err: any) {
            showTransientStatus(`Toggle failed: ${err?.message || "Unknown error"}`, 2600);
          }
        }
      }

      if (!isTypingInInput && key.name === "u") {
        const option = installedSelectR.getSelectedOption() as any;
        if (option?.value) {
          try {
            const skill = option.value as Skill;
            uninstallSkill(skill, config);
            await rescan();
            refreshInstalledList(installedSearchQuery);
            updateStatus();
          } catch (err: any) {
            showTransientStatus(`Uninstall failed: ${err?.message || "Unknown error"}`, 2600);
          }
        }
      }

      if (!isTypingInInput && key.name === "e") {
        exportInstalledSkillsToFile();
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

    if (currentTab === 2 && key.name === "escape") {
      sourcesUrl = "";
      sourcesUrlInputR.value = "";
      updateStatus();
    }
  });

  // Set initial focus
  installedSearchInputR.focus();
  updateStatus();
}
