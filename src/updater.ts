import { spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

function resolveAppRoot(): string {
    let current = dirname(fileURLToPath(import.meta.url));

    while (true) {
        if (existsSync(join(current, "package.json"))) {
            return current;
        }

        const parent = dirname(current);
        if (parent === current) {
            return dirname(fileURLToPath(import.meta.url));
        }

        current = parent;
    }
}

export function getAppVersion(): string {
    try {
        const appRoot = resolveAppRoot();
        const pkg = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
        return pkg.version || "unknown";
    } catch {
        return "unknown";
    }
}

interface CommandResult {
    stdout: string;
    stderr: string;
}

function resolveBunBinary(): string {
    const bunInstall = process.env.BUN_INSTALL?.trim();
    if (bunInstall) {
        const bunPath = resolve(bunInstall, "bin", "bun");
        if (existsSync(bunPath)) {
            return bunPath;
        }
    }

    const homeBunPath = join(homedir(), ".bun", "bin", "bun");
    if (existsSync(homeBunPath)) {
        return homeBunPath;
    }

    return "bun";
}

function runCommandOrThrow(
    command: string,
    args: string[],
    cwd: string,
    description: string,
): CommandResult {
    const result = spawnSync(command, args, { cwd, encoding: "utf-8" });
    if (result.error) {
        throw new Error(`${description}: ${result.error.message}`);
    }

    if (typeof result.status === "number" && result.status !== 0) {
        const stderr = result.stderr?.trim();
        const stdout = result.stdout?.trim();
        const details = stderr || stdout || `exit code ${result.status}`;
        throw new Error(`${description}: ${details}`);
    }

    if (result.signal) {
        throw new Error(`${description}: terminated by signal ${result.signal}`);
    }

    return {
        stdout: result.stdout?.trim() || "",
        stderr: result.stderr?.trim() || "",
    };
}

export function updateApp(): { updated: boolean; message: string; version: string } {
    const appRoot = resolveAppRoot();
    if (!existsSync(join(appRoot, ".git"))) {
        return {
            updated: false,
            message: "Auto-update is only available in a git checkout.",
            version: getAppVersion(),
        };
    }

    const pullResult = runCommandOrThrow("git", ["pull", "--ff-only"], appRoot, "Git pull failed");
    const pullOutput = `${pullResult.stdout}\n${pullResult.stderr}`.trim();
    const alreadyUpToDate =
        pullOutput.includes("Already up to date.") ||
        pullOutput.includes("Already up-to-date.");

    const version = getAppVersion();

    if (alreadyUpToDate) {
        return { updated: false, message: "App is already up to date.", version };
    }

    const bunBinary = resolveBunBinary();
    runCommandOrThrow(bunBinary, ["install"], appRoot, "bun install failed");
    runCommandOrThrow(
        bunBinary,
        ["x", "vite", "build"],
        join(appRoot, "src", "electron-v2"),
        "Frontend build failed",
    );

    return { updated: true, message: "App updated successfully.", version: getAppVersion() };
}
