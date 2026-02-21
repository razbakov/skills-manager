import { describe, it, expect } from "bun:test";
import { parseGitHubRepoUrl, normalizedGitHubUrl } from "./actions";

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
});
