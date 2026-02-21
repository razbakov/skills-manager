import { describe, it, expect } from "bun:test";
import {
    cleanupBrokenTargetSymlinks,
    normalizedGitHubUrl,
    parseGitHubRepoUrl,
} from "./actions";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, lstatSync } from "fs";
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
});
