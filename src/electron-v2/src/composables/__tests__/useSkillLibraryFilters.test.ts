import { describe, it, expect } from "vitest";
import { filterSkillLibrary, getSkillLibraryStatus } from "../useSearch";
import type { SkillViewModel } from "../../types";

function skill(overrides: Partial<SkillViewModel> & { name: string }): SkillViewModel {
  const { name, ...rest } = overrides;
  return {
    id: name,
    name,
    description: "",
    sourcePath: `/skills/${name}`,
    sourceName: "default-source",
    pathLabel: name,
    installName: "",
    installed: false,
    disabled: false,
    partiallyInstalled: false,
    unmanaged: false,
    targetLabels: [],
    groupNames: [],
    ...rest,
  };
}

const skills: SkillViewModel[] = [
  skill({
    name: "alpha-enabled",
    installed: true,
    disabled: false,
    sourceName: "core/source",
    description: "alpha helper",
  }),
  skill({
    name: "beta-disabled",
    installed: true,
    disabled: true,
    sourceName: "core/source",
    description: "beta helper",
  }),
  skill({
    name: "gamma-available",
    installed: false,
    sourceName: "community/source",
    description: "gamma helper",
  }),
  skill({
    name: "delta-enabled",
    installed: true,
    disabled: false,
    sourceName: "community/source",
    description: "delta helper",
  }),
];

describe("getSkillLibraryStatus", () => {
  it("returns enabled for installed non-disabled skills", () => {
    expect(getSkillLibraryStatus(skills[0])).toBe("enabled");
  });

  it("returns disabled for installed disabled skills", () => {
    expect(getSkillLibraryStatus(skills[1])).toBe("disabled");
  });

  it("returns available for not installed skills", () => {
    expect(getSkillLibraryStatus(skills[2])).toBe("available");
  });
});

describe("filterSkillLibrary", () => {
  it("returns all skills in deterministic alphabetical order with all filters cleared", () => {
    const result = filterSkillLibrary(skills, {
      query: "",
      status: "all",
      sourceName: "",
    });
    expect(result.map((item) => item.name)).toEqual([
      "alpha-enabled",
      "beta-disabled",
      "delta-enabled",
      "gamma-available",
    ]);
  });

  it("filters enabled skills only", () => {
    const result = filterSkillLibrary(skills, {
      query: "",
      status: "enabled",
      sourceName: "",
    });
    expect(result.map((item) => item.name)).toEqual([
      "alpha-enabled",
      "delta-enabled",
    ]);
  });

  it("filters disabled skills only", () => {
    const result = filterSkillLibrary(skills, {
      query: "",
      status: "disabled",
      sourceName: "",
    });
    expect(result.map((item) => item.name)).toEqual(["beta-disabled"]);
  });

  it("filters available skills only", () => {
    const result = filterSkillLibrary(skills, {
      query: "",
      status: "available",
      sourceName: "",
    });
    expect(result.map((item) => item.name)).toEqual(["gamma-available"]);
  });

  it("filters by source name", () => {
    const result = filterSkillLibrary(skills, {
      query: "",
      status: "all",
      sourceName: "community/source",
    });
    expect(result.map((item) => item.name)).toEqual([
      "delta-enabled",
      "gamma-available",
    ]);
  });

  it("combines query, status, and source filters", () => {
    const result = filterSkillLibrary(skills, {
      query: "delta",
      status: "enabled",
      sourceName: "community/source",
    });
    expect(result.map((item) => item.name)).toEqual(["delta-enabled"]);
  });

  it("returns no matches when combined filters exclude all skills", () => {
    const result = filterSkillLibrary(skills, {
      query: "gamma",
      status: "enabled",
      sourceName: "core/source",
    });
    expect(result).toEqual([]);
  });
});
