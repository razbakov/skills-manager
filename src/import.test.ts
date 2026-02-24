import { describe, it, expect } from "bun:test";
import { parseGitHubRepoUrl } from "./import";

describe("import.ts testing (issue 010)", () => {
    describe("parseGitHubRepoUrl", () => {
        it("should parse ssh URLs", () => {
            expect(parseGitHubRepoUrl("git@github.com:owner/repo.git")).toEqual({
                owner: "owner",
                repo: "repo",
                canonicalUrl: "https://github.com/owner/repo",
                sourceName: "repo@owner"
            });
        });

        it("should parse https URLs", () => {
            expect(parseGitHubRepoUrl("https://github.com/owner/repo")).toEqual({
                owner: "owner",
                repo: "repo",
                canonicalUrl: "https://github.com/owner/repo",
                sourceName: "repo@owner"
            });
            expect(parseGitHubRepoUrl("https://www.github.com/owner/repo.git")).toEqual({
                owner: "owner",
                repo: "repo",
                canonicalUrl: "https://github.com/owner/repo",
                sourceName: "repo@owner"
            });
        });

        it("should parse marketplace URLs", () => {
            expect(parseGitHubRepoUrl("https://skills.sh/wondelai/skills/design-sprint")).toEqual({
                owner: "wondelai",
                repo: "skills",
                canonicalUrl: "https://github.com/wondelai/skills",
                sourceName: "skills@wondelai"
            });
        });

        it("should return null for invalid URLs", () => {
            expect(parseGitHubRepoUrl("invalid_url")).toBeNull();
            expect(parseGitHubRepoUrl("https://gitlab.com/owner/repo")).toBeNull();
        });
    });
});
