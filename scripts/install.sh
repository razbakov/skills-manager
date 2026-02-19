#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${SKILLS_MANAGER_REPO_URL:-https://github.com/razbakov/skills-manager.git}"
INSTALL_DIR="${SKILLS_MANAGER_HOME:-$HOME/.skills-manager}"
BRANCH="${SKILLS_MANAGER_BRANCH:-main}"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

require_cmd git
require_cmd bun

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
  bun install
  bun src/index.ts --install
)

echo "Setup complete. Run: skills"
