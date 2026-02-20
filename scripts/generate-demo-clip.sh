#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/setup-demo-env.sh"
mkdir -p "$ROOT_DIR/demo/output"
vhs "$ROOT_DIR/demo/skills-manager-demo.tape"

echo "Generated: $ROOT_DIR/demo/output/skills-manager-demo.mp4"
