import { describe, it, expect } from "bun:test";
import { normalizeRepoUrl } from "./export";

describe("export.ts testing (issue 010)", () => {
    describe("normalizeRepoUrl", () => {
        it("should normalize github ssh URLs", () => {
            expect(normalizeRepoUrl("git@github.com:owner/repo.git")).toBe("https://github.com/owner/repo");
            expect(normalizeRepoUrl("git@github.com:owner/repo")).toBe("https://github.com/owner/repo");
        });
        it("should normalize http/https URLs", () => {
            expect(normalizeRepoUrl("https://github.com/owner/repo.git")).toBe("https://github.com/owner/repo");
            expect(normalizeRepoUrl("http://github.com/owner/repo/")).toBe("http://github.com/owner/repo");
        });
        it("should return unchanged if invalid URL", () => {
            expect(normalizeRepoUrl("not_a_url")).toBe("not_a_url");
        });
    });
});
