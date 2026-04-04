#!/usr/bin/env bash
set -euo pipefail

# auto_make_git.sh
# Controlla se ci sono modifiche (unstaged o staged). Se esistono, esegue `make git`.
# Pensato per essere eseguito in loop con `watch -n <sec>` o da un job cron.

cd "$(dirname "$0")"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Non sono in un repository git. Esco." >&2
  exit 1
fi

timestamp() { date +"%Y-%m-%d %H:%M:%S"; }

has_changes=0

# check unstaged changes
if ! git diff --quiet --; then
  echo "$(timestamp) - Unstaged changes detected"
  has_changes=1
fi

# check staged (indexed) changes
if ! git diff --cached --quiet --; then
  echo "$(timestamp) - Staged changes detected"
  has_changes=1
fi

if [ "$has_changes" -eq 0 ]; then
  echo "$(timestamp) - No changes detected. Nothing to do."
  exit 0
fi

echo "$(timestamp) - Running 'make git'..."
if make git; then
  echo "$(timestamp) - make git completed successfully."
else
  echo "$(timestamp) - make git failed." >&2
  exit 2
fi
