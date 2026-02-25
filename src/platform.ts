import { existsSync, readFileSync } from "fs";

export function isWslEnvironment(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.WSL_DISTRO_NAME || env.WSL_INTEROP) {
    return true;
  }

  if (platform !== "linux") {
    return false;
  }

  const procVersionPath = "/proc/version";
  if (!existsSync(procVersionPath)) {
    return false;
  }

  try {
    const value = readFileSync(procVersionPath, "utf-8").toLowerCase();
    return value.includes("microsoft") || value.includes("wsl");
  } catch {
    return false;
  }
}

export function shouldUseWslForInstall(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return platform === "win32" && !isWslEnvironment(platform, env);
}
