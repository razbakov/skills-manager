import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

export function getAppVersion(): string {
    try {
        const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
        const pkg = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
        return pkg.version || "unknown";
    } catch {
        return "unknown";
    }
}

export function updateApp(): { updated: boolean; message: string; version: string } {
    const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

    const pullResult = spawnSync("git", ["pull"], { cwd: appRoot, encoding: "utf-8" });
    if (pullResult.error) {
        throw new Error(`Git pull failed: ${pullResult.error.message}`);
    }
    const stdout = pullResult.stdout?.trim() || "";
    const alreadyUpToDate = stdout.includes("Already up to date.") || stdout.includes("Already up-to-date.");

    const version = getAppVersion();

    if (alreadyUpToDate) {
        return { updated: false, message: "App is already up to date.", version };
    }

    const installResult = spawnSync("bun", ["install"], { cwd: appRoot, encoding: "utf-8", stdio: "ignore" });
    if (installResult.error) {
        throw new Error(`bun install failed: ${installResult.error.message}`);
    }

    return { updated: true, message: "App updated successfully.", version: getAppVersion() };
}
