import { describe, it, expect } from "bun:test";
import { shouldSkipSkillScanDir, isInsideAnyTarget, newTargetStatus } from "./scanner";
import { resolve } from "path";

describe("scanner.ts testing (issue 002)", () => {
    describe("shouldSkipSkillScanDir", () => {
        it("should return true for ignored directories", () => {
            expect(shouldSkipSkillScanDir("node_modules")).toBeTrue();
            expect(shouldSkipSkillScanDir(".git")).toBeTrue();
        });

        it("should return false for valid directories", () => {
            expect(shouldSkipSkillScanDir("src")).toBeFalse();
            expect(shouldSkipSkillScanDir("test")).toBeFalse();
        });
    });

    describe("isInsideAnyTarget", () => {
        it("should be true if source is inside a target directory", () => {
            const target = resolve("/target/dir");
            expect(isInsideAnyTarget(resolve("/target/dir/sub"), [target])).toBeTrue();
        });

        it("should be false if source is outside targets", () => {
            const target = resolve("/target/dir");
            expect(isInsideAnyTarget(resolve("/other/dir"), [target])).toBeFalse();
        });
    });

    describe("newTargetStatus", () => {
        it("should initialize default status map for targets", () => {
            const status = newTargetStatus(["/t1", "/t2"]);
            expect(status["/t1"]).toBe("not-installed");
            expect(status["/t2"]).toBe("not-installed");
        });
    });
});
