import { describe, it, expect } from "bun:test";
import {
    cleanupBrokenTargetSymlinks,
    cleanupInvalidSourceEntries,
    normalizedGitHubUrl,
    parseGitHubRepoUrl,
} from "./actions";
import {
    lstatSync,
    mkdtempSync,
    mkdirSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { Config } from "./types";

describe("actions.ts testing (issue 003)", () => {
    describe("parseGitHubRepoUrl", () => {
        it("should parse valid GitHub URLs", () => {
            expect(parseGitHubRepoUrl("https://github.com/test/repo.git")).toEqual({
                owner: "test",
                repo: "repo",
                canonicalUrl: "https://github.com/test/repo",
                sourceName: "repo@test"
            });
        });

        it("should parse skills.sh marketplace URLs", () => {
            expect(parseGitHubRepoUrl("https://skills.sh/wondelai/skills/design-sprint")).toEqual({
                owner: "wondelai",
                repo: "skills",
                canonicalUrl: "https://github.com/wondelai/skills",
                sourceName: "skills@wondelai"
            });
        });

        it("should parse encoded marketplace URLs with embedded GitHub links", () => {
            expect(
                parseGitHubRepoUrl(
                    "https://example.com/skill?repo=https%3A%2F%2Fgithub.com%2Fopenai%2Fskills%2Ftree%2Fmain"
                )
            ).toEqual({
                owner: "openai",
                repo: "skills",
                canonicalUrl: "https://github.com/openai/skills",
                sourceName: "skills@openai"
            });
        });

        it("should return null for invalid URLs", () => {
            expect(parseGitHubRepoUrl("https://example.com")).toBeNull();
        });
    });

    describe("normalizedGitHubUrl", () => {
        it("should return normalized lowercase URL", () => {
            expect(normalizedGitHubUrl("https://github.com/Test/Repo.git")).toBe("https://github.com/test/repo");
            expect(normalizedGitHubUrl(undefined)).toBeNull();
        });
    });

    describe("cleanupBrokenTargetSymlinks", () => {
        it("should remove broken symlinks from targets and .disabled", () => {
            const root = mkdtempSync(join(tmpdir(), "skills-manager-actions-"));
            try {
                const targetPath = join(root, "target");
                const disabledPath = join(targetPath, ".disabled");
                const sourcePath = join(root, "source", "valid-skill");
                const missingActivePath = join(root, "missing", "active");
                const missingDisabledPath = join(root, "missing", "disabled");

                mkdirSync(targetPath, { recursive: true });
                mkdirSync(disabledPath, { recursive: true });
                mkdirSync(sourcePath, { recursive: true });
                writeFileSync(join(sourcePath, "SKILL.md"), "---\nname: Valid Skill\n---\n");

                const validLink = join(targetPath, "valid-skill");
                const brokenActiveLink = join(targetPath, "broken-active");
                const brokenDisabledLink = join(disabledPath, "broken-disabled");

                symlinkSync(sourcePath, validLink);
                symlinkSync(missingActivePath, brokenActiveLink);
                symlinkSync(missingDisabledPath, brokenDisabledLink);

                const config: Config = {
                    sources: [],
                    targets: [targetPath],
                    disabledSources: [],
                    personalSkillsRepoPrompted: false,
                };

                const removed = cleanupBrokenTargetSymlinks(config);
                expect(removed).toBe(2);
                expect(() => lstatSync(validLink)).not.toThrow();
                expect(() => lstatSync(brokenActiveLink)).toThrow();
                expect(() => lstatSync(brokenDisabledLink)).toThrow();
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });

        it("should return 0 when target directories do not exist", () => {
            const config: Config = {
                sources: [],
                targets: [join(tmpdir(), "non-existent-target")],
                disabledSources: [],
                personalSkillsRepoPrompted: false,
            };

            expect(cleanupBrokenTargetSymlinks(config)).toBe(0);
        });
    });

    describe("cleanupInvalidSourceEntries", () => {
        it("should remove missing, broken, and non-directory sources", () => {
            const root = mkdtempSync(join(tmpdir(), "skills-manager-sources-"));
            try {
                const validSource = join(root, "valid-source");
                const validSourceTarget = join(root, "valid-target");
                const validSourceSymlink = join(root, "valid-source-link");
                const brokenSourceSymlink = join(root, "broken-source-link");
                const missingSource = join(root, "missing-source");
                const fileSource = join(root, "not-a-directory.txt");

                mkdirSync(validSource, { recursive: true });
                mkdirSync(validSourceTarget, { recursive: true });
                symlinkSync(validSourceTarget, validSourceSymlink);
                symlinkSync(join(root, "missing-target"), brokenSourceSymlink);
                writeFileSync(fileSource, "not a directory");

                const config: Config = {
                    sources: [
                        { name: "valid", path: validSource },
                        { name: "valid-link", path: validSourceSymlink },
                        { name: "broken-link", path: brokenSourceSymlink },
                        { name: "missing", path: missingSource },
                        { name: "file", path: fileSource },
                    ],
                    targets: [],
                    disabledSources: [validSource, brokenSourceSymlink, missingSource, fileSource],
                    personalSkillsRepo: missingSource,
                    personalSkillsRepoPrompted: false,
                };

                const result = cleanupInvalidSourceEntries(config);

                expect(result.removedSources).toBe(3);
                expect(result.removedDisabledSources).toBe(3);
                expect(result.clearedPersonalRepo).toBeTrue();
                expect(config.sources.map((source) => source.path)).toEqual([validSource, validSourceSymlink]);
                expect(config.disabledSources).toEqual([validSource]);
                expect(config.personalSkillsRepo).toBeUndefined();
                expect(config.personalSkillsRepoPrompted).toBeTrue();
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });

        it("should leave valid entries unchanged", () => {
            const root = mkdtempSync(join(tmpdir(), "skills-manager-sources-"));
            try {
                const sourcePath = join(root, "source");
                mkdirSync(sourcePath, { recursive: true });

                const config: Config = {
                    sources: [{ name: "source", path: sourcePath }],
                    targets: [],
                    disabledSources: [sourcePath],
                    personalSkillsRepo: sourcePath,
                    personalSkillsRepoPrompted: false,
                };

                const result = cleanupInvalidSourceEntries(config);

                expect(result).toEqual({
                    removedSources: 0,
                    removedDisabledSources: 0,
                    clearedPersonalRepo: false,
                });
                expect(config.sources.map((source) => source.path)).toEqual([sourcePath]);
                expect(config.disabledSources).toEqual([sourcePath]);
                expect(config.personalSkillsRepo).toBe(sourcePath);
                expect(config.personalSkillsRepoPrompted).toBeFalse();
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });
    });
});
