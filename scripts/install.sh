#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${SKILLS_MANAGER_REPO_URL:-https://github.com/razbakov/skills-manager.git}"
INSTALL_DIR="${SKILLS_MANAGER_HOME:-$HOME/.skills-manager}"
BRANCH="${SKILLS_MANAGER_BRANCH:-main}"
BUN_INSTALL_SCRIPT_URL="${SKILLS_MANAGER_BUN_INSTALL_SCRIPT_URL:-https://bun.sh/install}"

has_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1
}

require_cmd() {
  local cmd="$1"
  if ! has_cmd "$cmd"; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

bun_root_dir() {
  if [ -n "${BUN_INSTALL:-}" ]; then
    printf "%s\n" "${BUN_INSTALL%/}"
    return
  fi

  printf "%s\n" "$HOME/.bun"
}

bun_bin_dir() {
  printf "%s/bin\n" "$(bun_root_dir)"
}

resolve_bun_cmd() {
  if has_cmd bun; then
    command -v bun
    return 0
  fi

  local fallback_bun
  fallback_bun="$(bun_bin_dir)/bun"
  if [ -x "$fallback_bun" ]; then
    printf "%s\n" "$fallback_bun"
    return 0
  fi

  return 1
}

show_path_instructions() {
  local target_dir="$1"
  local shell_name
  shell_name="$(basename "${SHELL:-}")"

  echo "Add it to PATH permanently:"
  case "$shell_name" in
    zsh)
      echo "  echo 'export PATH=\"$target_dir:\$PATH\"' >> \"$HOME/.zshrc\""
      echo "  source \"$HOME/.zshrc\""
      ;;
    bash)
      local rc_file="$HOME/.bashrc"
      if [ ! -f "$rc_file" ] && [ -f "$HOME/.bash_profile" ]; then
        rc_file="$HOME/.bash_profile"
      fi
      echo "  echo 'export PATH=\"$target_dir:\$PATH\"' >> \"$rc_file\""
      echo "  source \"$rc_file\""
      ;;
    fish)
      echo "  fish_add_path \"$target_dir\""
      ;;
    *)
      echo "  export PATH=\"$target_dir:\$PATH\""
      ;;
  esac
}

ensure_bun() {
  if resolve_bun_cmd >/dev/null 2>&1; then
    return
  fi

  echo "Bun not found. Installing Bun..."
  if has_cmd curl; then
    curl -fsSL "$BUN_INSTALL_SCRIPT_URL" | bash
  elif has_cmd wget; then
    wget -qO- "$BUN_INSTALL_SCRIPT_URL" | bash
  else
    echo "Missing curl or wget. One of them is required to auto-install Bun." >&2
    exit 1
  fi

  if ! resolve_bun_cmd >/dev/null 2>&1; then
    echo "Bun installation completed, but bun is still unavailable in this shell." >&2
    show_path_instructions "$(bun_bin_dir)"
    exit 1
  fi
}

ensure_path_contains_dir() {
  local target_dir="$1"
  case ":$PATH:" in
    *":$target_dir:"*) return ;;
  esac

  export PATH="$target_dir:$PATH"
  echo "Added $target_dir to PATH for this install session."
  show_path_instructions "$target_dir"
}

check_install_dir() {
  local parent_dir
  parent_dir="$(dirname "$INSTALL_DIR")"

  mkdir -p "$parent_dir"
  if [ ! -w "$parent_dir" ]; then
    echo "Install parent directory is not writable: $parent_dir" >&2
    exit 1
  fi
}

require_cmd git
ensure_bun
check_install_dir

BUN_CMD="$(resolve_bun_cmd)"
ensure_path_contains_dir "$(dirname "$BUN_CMD")"

if [ -e "$INSTALL_DIR" ] && [ ! -d "$INSTALL_DIR/.git" ]; then
  echo "Install path exists but is not a git checkout: $INSTALL_DIR" >&2
  echo "Set SKILLS_MANAGER_HOME to another directory and retry." >&2
  exit 1
fi

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating skills-manager in $INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch --depth 1 origin "$BRANCH"
  if git -C "$INSTALL_DIR" show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git -C "$INSTALL_DIR" checkout "$BRANCH"
  else
    git -C "$INSTALL_DIR" checkout -b "$BRANCH" "origin/$BRANCH"
  fi
  git -C "$INSTALL_DIR" pull --ff-only origin "$BRANCH"
else
  echo "Cloning skills-manager into $INSTALL_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

echo "Installing dependencies and global command"
(
  cd "$INSTALL_DIR"
  "$BUN_CMD" install
  "$BUN_CMD" src/index.ts --install
)

SKILLS_BIN_DIR="$(bun_bin_dir)"
SKILLS_CMD_PATH="$SKILLS_BIN_DIR/skills"
ensure_path_contains_dir "$SKILLS_BIN_DIR"

if has_cmd skills && [ "$(command -v skills)" = "$SKILLS_CMD_PATH" ]; then
  echo "Setup complete. Run: skills"
  exit 0
fi

if [ -L "$SKILLS_CMD_PATH" ] || [ -x "$SKILLS_CMD_PATH" ]; then
  if has_cmd skills; then
    echo "Setup complete, but 'skills' on PATH points to $(command -v skills)."
    echo "Your new install is at: $SKILLS_CMD_PATH"
  else
    echo "Setup complete, but 'skills' is not currently on your PATH."
  fi
  show_path_instructions "$SKILLS_BIN_DIR"
  echo "You can run it now via: $SKILLS_CMD_PATH"
  exit 0
fi

echo "Setup complete, but the global command could not be located at $SKILLS_CMD_PATH."
echo "Run this manually to inspect the install state:"
echo "  \"$BUN_CMD\" \"$INSTALL_DIR/src/index.ts\" --install"
