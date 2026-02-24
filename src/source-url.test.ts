import { describe, expect, it } from "bun:test";
import {
  extractGitHubRepoUrl,
  parseGitHubRepoUrl,
  resolveGitHubRepoUrl,
} from "./source-url";

describe("source-url.ts", () => {
  describe("extractGitHubRepoUrl", () => {
    it("extracts canonical repo URL from a markdown link", () => {
      const text = "[repo](https://github.com/openai/skills/tree/main/something)";
      expect(extractGitHubRepoUrl(text)).toBe("https://github.com/openai/skills");
    });
  });

  describe("parseGitHubRepoUrl", () => {
    it("parses skills.sh source links", () => {
      expect(
        parseGitHubRepoUrl("https://skills.sh/wondelai/skills/design-sprint"),
      ).toEqual({
        owner: "wondelai",
        repo: "skills",
        canonicalUrl: "https://github.com/wondelai/skills",
        sourceName: "skills@wondelai",
      });
    });
  });

  describe("resolveGitHubRepoUrl", () => {
    it("resolves repository URL from marketplace HTML", async () => {
      const fetchStub: typeof fetch = async () =>
        new Response(
          "<a href=\"https://github.com/wondelai/skills/tree/main/skills/design-sprint\">source</a>",
          {
            status: 200,
            headers: { "content-type": "text/html" },
          },
        );

      const parsed = await resolveGitHubRepoUrl(
        "https://example-marketplace.dev/skills/design-sprint",
        fetchStub,
      );

      expect(parsed).toEqual({
        owner: "wondelai",
        repo: "skills",
        canonicalUrl: "https://github.com/wondelai/skills",
        sourceName: "skills@wondelai",
      });
    });

    it("returns null when marketplace page has no repository links", async () => {
      const fetchStub: typeof fetch = async () =>
        new Response("<html><body>No repo link</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });

      const parsed = await resolveGitHubRepoUrl(
        "https://example-marketplace.dev/skills/no-repo",
        fetchStub,
      );

      expect(parsed).toBeNull();
    });
  });
});
