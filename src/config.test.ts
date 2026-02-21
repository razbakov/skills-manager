import { describe, it, expect } from "bun:test";
import { expandTilde } from "./config";
import { homedir } from "os";

describe("config.ts testing (issue 008)", () => {
    describe("expandTilde", () => {
        it("should expand ~ to homedir", () => {
            const home = homedir();
            expect(expandTilde("~")).toBe(home);
            expect(expandTilde("~/test")).toBe(`${home}/test`);
        });

        it("should leave paths without ~ intact", () => {
            expect(expandTilde("/var/log/test")).toBe("/var/log/test");
            expect(expandTilde("relative/path")).toBe("relative/path");
        });
    });
});
