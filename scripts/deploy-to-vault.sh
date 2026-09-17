#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$REPOSITORY_DIR/.taskmate-vault-path"
PROVIDED_PATH="${1:-}"
VAULT_PATH="${PROVIDED_PATH:-${TASKMATE_VAULT:-}}"

if [[ -z "$VAULT_PATH" && -f "$CONFIG_FILE" ]]; then
  IFS= read -r VAULT_PATH < "$CONFIG_FILE"
fi

if [[ -z "$VAULT_PATH" ]]; then
  echo "Vault path is required for the first deployment." >&2
  echo "Run: npm run deploy -- /absolute/path/to/your/vault" >&2
  exit 1
fi

VAULT_PATH="${VAULT_PATH%/}"
if [[ "$VAULT_PATH" != /* ]]; then
  echo "Vault path must be absolute: $VAULT_PATH" >&2
  exit 1
fi
if [[ ! -d "$VAULT_PATH" ]]; then
  echo "Vault directory does not exist: $VAULT_PATH" >&2
  exit 1
fi
if [[ ! -d "$VAULT_PATH/.obsidian" ]]; then
  echo "Not an Obsidian vault; .obsidian was not found: $VAULT_PATH" >&2
  exit 1
fi

DESTINATION="$VAULT_PATH/.obsidian/plugins/taskmate"
if [[ -L "$DESTINATION" ]]; then
  echo "Refusing to replace a symbolic-link destination: $DESTINATION" >&2
  exit 1
fi

cd -- "$REPOSITORY_DIR"
if [[ ! -d node_modules ]]; then
  echo "Installing locked dependencies..."
  npm ci
fi

echo "Checking and building TaskMate..."
npm run typecheck
npm test
npm run build

for FILE_NAME in main.js manifest.json styles.css; do
  if [[ ! -f "$REPOSITORY_DIR/$FILE_NAME" ]]; then
    echo "Build output is missing: $FILE_NAME" >&2
    exit 1
  fi
done

PLUGINS_DIR="$VAULT_PATH/.obsidian/plugins"
mkdir -p -- "$PLUGINS_DIR"
STAGING_DIR="$(mktemp -d "$PLUGINS_DIR/.taskmate-deploy.XXXXXX")"
trap 'rm -rf -- "$STAGING_DIR"' EXIT

cp -- main.js manifest.json styles.css "$STAGING_DIR/"
mkdir -p -- "$DESTINATION"
for FILE_NAME in main.js manifest.json styles.css; do
  mv -f -- "$STAGING_DIR/$FILE_NAME" "$DESTINATION/$FILE_NAME"
done

if [[ -n "$PROVIDED_PATH" ]]; then
  printf '%s\n' "$VAULT_PATH" > "$CONFIG_FILE"
fi
VERSION="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json | head -n 1)"

echo "TaskMate ${VERSION:-unknown} deployed to: $DESTINATION"
echo "Wait for Obsidian Sync to finish on Android, then disable and re-enable TaskMate to load the update."
