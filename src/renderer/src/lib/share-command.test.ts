import { describe, expect, it } from "vitest";
import { buildSkillShareCommand, shellEscape } from "./share-command";

describe("shellEscape", () => {
  it("returns simple tokens unchanged", () => {
    expect(shellEscape("https://github.com/acme/repo")).toBe("https://github.com/acme/repo");
    expect(shellEscape("workflow-tool")).toBe("workflow-tool");
  });

  it("quotes values with whitespace", () => {
    expect(shellEscape("two words")).toBe("'two words'");
  });

  it("escapes single quotes", () => {
    expect(shellEscape("it's")).toBe("'it'\\''s'");
  });
});

describe("buildSkillShareCommand", () => {
  it("builds command from repo and install name", () => {
    expect(
      buildSkillShareCommand({
        repoUrl: "https://github.com/acme/repo",
        installName: "workflow",
      }),
    ).toBe("npx -y skill-mix https://github.com/acme/repo/workflow");
  });

  it("falls back to path label when install name is missing", () => {
    expect(
      buildSkillShareCommand({
        repoUrl: "https://github.com/acme/repo",
        pathLabel: "lint-fix",
      }),
    ).toBe("npx -y skill-mix https://github.com/acme/repo/lint-fix");
  });

  it("falls back to skill name when install name and path are missing", () => {
    expect(
      buildSkillShareCommand({
        repoUrl: "https://github.com/acme/repo",
        name: "research-helper",
      }),
    ).toBe("npx -y skill-mix https://github.com/acme/repo/research-helper");
  });

  it("strips trailing slash from repo url", () => {
    expect(
      buildSkillShareCommand({
        repoUrl: "https://github.com/acme/repo/",
        installName: "workflow",
      }),
    ).toBe("npx -y skill-mix https://github.com/acme/repo/workflow");
  });

  it("returns null without repo url", () => {
    expect(
      buildSkillShareCommand({
        installName: "workflow",
      }),
    ).toBeNull();
  });

  it("returns null without any skill identifier", () => {
    expect(
      buildSkillShareCommand({
        repoUrl: "https://github.com/acme/repo",
      }),
    ).toBeNull();
  });

  it("encodes install name in url path", () => {
    expect(
      buildSkillShareCommand({
        repoUrl: "https://github.com/acme/repo",
        installName: "two words",
      }),
    ).toBe("npx -y skill-mix https://github.com/acme/repo/two%20words");
  });

  it("quotes full source when repo contains whitespace", () => {
    expect(
      buildSkillShareCommand({
        repoUrl: "https://github.com/acme/repo name",
        installName: "workflow",
      }),
    ).toBe("npx -y skill-mix 'https://github.com/acme/repo name/workflow'");
  });
});
