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
import { getSourcesRootPath } from "./config";
import { scan } from "./scanner";
import {
  defaultInstalledSkillsExportPath,
  exportInstalledSkills as exportInstalledSkillsManifest,
} from "./export";

export async function startUI(config: Config) {
  let skills = await scan(config);
  const resolvedSourcesRoot = resolve(getSourcesRootPath(config));

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useMouse: true,
  });

  // --- Helpers ---

  function installedSkills(): Skill[] {
    return sortSkillsByName(skills.filter((s) => s.installed));
  }

  function availableSkills(): Skill[] {
    return sortSkillsByName(skills.filter((s) => !s.installed));
  }

  function sortSkillsByName(list: Skill[]): Skill[] {
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
        numeric: true,
      }),
    );
  }

  function getSourceRelativePath(skill: Skill): string {
    const rel = relative(resolvedSourcesRoot, resolve(skill.sourcePath));
    if (!isAbsolute(rel) && !rel.startsWith("..")) return rel || ".";

    return skill.sourcePath;
  }

  function isPathWithin(path: string, root: string): boolean {
    const rel = relative(root, path);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  }

  function formatInstalledOption(s: Skill) {
    const skillDescription = s.description || "(no description)";
    const displayName = s.disabled ? `${s.name} (disabled)` : s.name;
    return {
      name: displayName,
      description: `${getSourceRelativePath(s)} — ${skillDescription}`,
      value: s,
    };
  }

  function formatAvailableOption(s: Skill) {
    return {
      name: s.name,
      description: `${getSourceRelativePath(s)} — ${s.description || "(no description)"}`,
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

    if (existsSync(resolvedSourcesRoot)) {
      try {
        for (const entry of readdirSync(resolvedSourcesRoot, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          if (entry.name.startsWith(".")) continue;

          const sourcePath = resolve(join(resolvedSourcesRoot, entry.name));
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
      if (sourcePath === resolvedSourcesRoot) continue;
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

  function getSourceSkillCounts(source: SourceListEntry): { installed: number; total: number } {
    const sourceSkills = getSkillsForSource(source);
    const installedCount = sourceSkills.filter((skill) => skill.installed).length;
    return { installed: installedCount, total: sourceSkills.length };
  }

  function getSkillsForSource(source: SourceListEntry): Skill[] {
    const sourceRoot = resolve(source.path);
    const matchedSkills = skills.filter((skill) => {
      const skillPath = resolve(skill.sourcePath);
      if (!isPathWithin(skillPath, sourceRoot)) return false;

      if (source.recursive) return true;

      const rel = relative(sourceRoot, skillPath);
      return rel === "" || (!rel.includes("/") && !rel.includes("\\"));
    });
    return sortSkillsByName(matchedSkills);
  }

  function getSourceSkillRelativePath(source: SourceListEntry, skill: Skill): string {
    const rel = relative(resolve(source.path), resolve(skill.sourcePath));
    return rel || ".";
  }

  function formatSourcePackageSkillOption(source: SourceListEntry, skill: Skill) {
    const statusPrefix = skill.installed ? (skill.disabled ? "[-]" : "[x]") : "[ ]";
    return {
      name: `${statusPrefix} ${skill.name}`,
      description: `${getSourceSkillRelativePath(source, skill)} — ${skill.description || "(no description)"}`,
      value: skill,
    };
  }

  function formatSourceOption(source: SourceListEntry) {
    const sourceRef = source.repoUrl || source.path;
    const counts = getSourceSkillCounts(source);
    return {
      name: `${source.name} (${counts.installed} of ${counts.total})`,
      description: sourceRef,
      value: source,
    };
  }

  // --- Build static layout ---

  const initialInstalled = installedSkills().map(formatInstalledOption);
  const initialAvailable = availableSkills().map(formatAvailableOption);
  const initialSourceEntries = getDisplayedSources();
  const initialSources = initialSourceEntries.map(formatSourceOption);
  const initialSourcePackage = initialSourceEntries[0];
  const initialSourcePackageSkills = initialSourcePackage
    ? getSkillsForSource(initialSourcePackage).map((skill) =>
        formatSourcePackageSkillOption(initialSourcePackage, skill),
      )
    : [];
  const initialSourcePackageCounts = initialSourcePackage
    ? getSourceSkillCounts(initialSourcePackage)
    : { installed: 0, total: 0 };
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
          Box(
            { id: "sources-browser-view", flexDirection: "column", flexGrow: 1 },
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
              content: "Type URL + Enter to add, or Enter on list to open package",
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
          Box(
            { id: "sources-package-view", flexDirection: "column", flexGrow: 1, visible: false },
            Text({
              id: "sources-package-title",
              content: initialSourcePackage
                ? `${initialSourcePackage.name} (${initialSourcePackageCounts.installed} of ${initialSourcePackageCounts.total})`
                : "Package details",
              fg: "#FFFFFF",
            }),
            Text({
              id: "sources-package-meta",
              content: initialSourcePackage
                ? (initialSourcePackage.repoUrl || initialSourcePackage.path)
                : "No source selected.",
              fg: "#888888",
            }),
            Text({
              id: "sources-package-help",
              content: "Esc: back to sources",
              fg: "#666666",
            }),
            Select({
              id: "sources-package-select",
              width: "100%" as any,
              height: "100%" as any,
              options: initialSourcePackageSkills,
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
  const sourcesBrowserViewR = find<any>("sources-browser-view");
  const sourcesPackageViewR = find<any>("sources-package-view");
  const sourcesUrlInputR = find<InputRenderable>("sources-url-input");
  const sourcesSelectR = find<SelectRenderable>("sources-select");
  const sourcesPackageTitleR = find<TextRenderable>("sources-package-title");
  const sourcesPackageMetaR = find<TextRenderable>("sources-package-meta");
  const sourcesPackageSelectR = find<SelectRenderable>("sources-package-select");
  const statusR = find<TextRenderable>("status");

  // --- State ---

  const TAB_COUNT = 3;
  let currentTab = 0;
  let installedSearchQuery = "";
  let availableSearchQuery = "";
  let sourcesUrl = "";
  let sourcesPackageOpen = false;
  let selectedSourceInPackage: SourceListEntry | undefined;
  let transientStatusMessage: string | null = null;
  let transientStatusTimer: ReturnType<typeof setTimeout> | null = null;

  function isCurrentTabInputFocused(): boolean {
    if (currentTab === 0) return installedSearchInputR.focused;
    if (currentTab === 1) return availableSearchInputR.focused;
    if (sourcesPackageOpen) return false;
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
      sourceRelativePath: getSourceRelativePath(skill),
      sourcePath: skill.sourcePath,
      sourceName: skill.sourceName,
      installName: skill.installName || "",
    }));

    const fuse = new Fuse(searchable, {
      keys: ["name", "description", "sourceRelativePath", "sourcePath", "sourceName", "installName"],
      threshold: 0.4,
    });

    return sortSkillsByName(fuse.search(query).map((r) => r.item.skill));
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
      sourceRelativePath: getSourceRelativePath(skill),
      sourcePath: skill.sourcePath,
      sourceName: skill.sourceName,
      installName: skill.installName || "",
    }));

    const fuse = new Fuse(searchable, {
      keys: ["name", "description", "sourceRelativePath", "sourcePath", "sourceName", "installName"],
      threshold: 0.4,
    });

    return sortSkillsByName(fuse.search(query).map((r) => r.item.skill));
  }

  function refreshAvailableList(query: string = "") {
    const filtered = searchAvailableSkills(query);
    availableSelectR.options = filtered.map(formatAvailableOption);
  }

  function refreshSourcePackageDetails() {
    if (!selectedSourceInPackage) {
      sourcesPackageTitleR.content = "Package details";
      sourcesPackageMetaR.content = "No source selected.";
      sourcesPackageSelectR.options = [];
      return;
    }

    const counts = getSourceSkillCounts(selectedSourceInPackage);
    const prevIndex = sourcesPackageSelectR.getSelectedIndex();
    const sourceSkills = getSkillsForSource(selectedSourceInPackage);
    const options = sourceSkills.map((skill) =>
      formatSourcePackageSkillOption(selectedSourceInPackage!, skill),
    );
    sourcesPackageTitleR.content =
      `${selectedSourceInPackage.name} (${counts.installed} of ${counts.total})`;
    sourcesPackageMetaR.content = selectedSourceInPackage.repoUrl || selectedSourceInPackage.path;
    sourcesPackageSelectR.options = options;

    if (options.length === 0) {
      return;
    }

    const nextIndex = Math.max(0, Math.min(prevIndex, options.length - 1));
    sourcesPackageSelectR.setSelectedIndex(nextIndex);
  }

  function openSourcePackage(source: SourceListEntry | undefined) {
    if (!source) {
      showTransientStatus("No source selected.", 1800);
      return;
    }

    selectedSourceInPackage = source;
    sourcesPackageOpen = true;
    sourcesBrowserViewR.visible = false;
    sourcesPackageViewR.visible = true;
    refreshSourcePackageDetails();
    sourcesPackageSelectR.focus();
    updateStatus();
  }

  function closeSourcePackage() {
    sourcesPackageOpen = false;
    sourcesPackageViewR.visible = false;
    sourcesBrowserViewR.visible = true;
    refreshSourcesList();
    sourcesUrlInputR.focus();
    updateStatus();
  }

  function refreshSourcesList() {
    const prevIndex = sourcesSelectR.getSelectedIndex();
    const sourceEntries = getDisplayedSources();
    sourcesSelectR.options = sourceEntries.map(formatSourceOption);

    if (sourceEntries.length === 0) {
      selectedSourceInPackage = undefined;
      return;
    }

    const nextIndex = Math.max(0, Math.min(prevIndex, sourceEntries.length - 1));
    sourcesSelectR.setSelectedIndex(nextIndex);
    selectedSourceInPackage = sourceEntries[nextIndex];
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
      if (sourcesPackageOpen) {
        statusR.content = "Esc:back  ↑/↓:browse  ←/→:switch  q:quit";
      } else {
        statusR.content = `Enter:open/add source  ←/→:switch  q:quit  (${getDisplayedSources().length} sources)`;
      }
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
      if (sourcesPackageOpen) {
        sourcesBrowserViewR.visible = false;
        sourcesPackageViewR.visible = true;
        refreshSourcePackageDetails();
        sourcesPackageSelectR.focus();
      } else {
        sourcesPackageViewR.visible = false;
        sourcesBrowserViewR.visible = true;
        refreshSourcesList();
        sourcesUrlInputR.focus();
      }
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

  sourcesSelectR.on(SelectRenderableEvents.SELECTION_CHANGED, (_index: number, option: any) => {
    selectedSourceInPackage = option?.value as SourceListEntry | undefined;
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
      if (sourcesPackageOpen) {
        if (!sourcesPackageSelectR.focused) {
          sourcesPackageSelectR.setSelectedIndex(sourcesPackageSelectR.getSelectedIndex() + 1);
        }
      } else if (!sourcesSelectR.focused) {
        sourcesSelectR.setSelectedIndex(sourcesSelectR.getSelectedIndex() + 1);
      }
      return;
    }

    if (currentTab === 2 && key.name === "up") {
      if (sourcesPackageOpen) {
        if (!sourcesPackageSelectR.focused) {
          sourcesPackageSelectR.setSelectedIndex(sourcesPackageSelectR.getSelectedIndex() - 1);
        }
      } else if (!sourcesSelectR.focused) {
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
      if (sourcesPackageOpen) {
        return;
      }

      if (sourcesUrl.trim()) {
        await addSourceFromInput();
        return;
      }

      const option = sourcesSelectR.getSelectedOption() as any;
      openSourcePackage(option?.value as SourceListEntry | undefined);
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
      if (sourcesPackageOpen) {
        closeSourcePackage();
        return;
      }
      sourcesUrl = "";
      sourcesUrlInputR.value = "";
      updateStatus();
    }
  });

  // Set initial focus
  installedSearchInputR.focus();
  updateStatus();
}
