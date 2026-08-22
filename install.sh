#!/usr/bin/env bash
# install.sh - deploy the deepseek-harness-discipline presets into ~/.dsh/.agent-presets/
#
# Usage:  ./install.sh                    (installs into $HOME/.dsh)
#         DSH_HOME=/custom/dsh ./install.sh
#         KEEP_BACKUPS=3 ./install.sh     (keep the 3 newest backup stamps)
#
# After installing: restart dsh (or open a new session) and pick a preset in
# the picker. Existing presets with the same id are NOT deleted — the previous
# version is preserved under <dest>/_backup/<timestamp>/<preset> before the
# fresh copy is installed, so a broken install can always be reverted. Only
# the newest $KEEP_BACKUPS backup stamps are kept; older stamps are pruned so
# repeated installs do not grow _backup without bound. Stamps carry
# milliseconds where the platform's date supports them; the backup path is
# additionally bumped until free, so two installs within the same second
# never collide on any platform.

set -euo pipefail

DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
KEEP_BACKUPS="${KEEP_BACKUPS:-5}"
SRC="$(cd "$(dirname "$0")" && pwd)/presets"

if ! [[ "$KEEP_BACKUPS" =~ ^[0-9]+$ ]] || (( KEEP_BACKUPS < 1 || KEEP_BACKUPS > 99 )); then
  echo "KEEP_BACKUPS must be an integer 1..99 (got: $KEEP_BACKUPS)" >&2
  exit 2
fi

if [[ ! -d "$SRC" ]]; then
  echo "presets/ not found next to install.sh - run from the repo root" >&2
  exit 2
fi

DEST="$DSH_HOME/.agent-presets"
mkdir -p "$DEST"

for preset in planner builder surgeon advisor design scribe tester hunter; do
  from="$SRC/$preset"
  to="$DEST/$preset"
  if [[ ! -d "$from" ]]; then
    echo "preset dir missing: $from" >&2
    exit 2
  fi
  if [[ -e "$to" ]]; then
    # Millisecond fraction: GNU date supports %3N; BSD/macOS date does not and
    # would emit a literal, collapsing resolution to whole seconds. Normalize
    # to digits, then bump the fraction while the target exists so two
    # installs in the same second can never nest one backup inside another.
    ms="$(date +"%3N" 2>/dev/null || true)"
    case "$ms" in ''|*[!0-9]*) ms=0 ;; esac
    ms=$(( 10#$ms % 1000 ))
    while :; do
      stamp="$(date +"%Y%m%d-%H%M%S")-$(printf '%03d' "$ms")"
      [[ -e "$DEST/_backup/$stamp/$preset" ]] || break
      ms=$(( (ms + 1) % 1000 ))
      if (( ms == 0 )); then sleep 1; fi
    done
    bak="$DEST/_backup/$stamp/$preset"
    mkdir -p "$(dirname "$bak")"
    mv "$to" "$bak"
    echo "replacing existing preset: $preset"
    echo "  previous version backed up to: $bak"
  fi
  cp -r "$from" "$to"
  echo "installed $preset -> $to"
done

# Retention: keep only the newest $KEEP_BACKUPS backup stamps.
bakRoot="$DEST/_backup"
if [[ -d "$bakRoot" ]]; then
  mapfile -t stale < <(ls -1 "$bakRoot" 2>/dev/null | sort -r | tail -n +"$((KEEP_BACKUPS + 1))")
  for d in "${stale[@]}"; do
    [[ -n "$d" ]] || continue
    rm -rf "$bakRoot/$d"
    echo "pruned old backup: $d"
  done
fi

echo ""
echo "Done. Restart dsh (or open a new session) and pick a preset:"
echo "  planner (Architect, read-only) | builder (TDD) | surgeon (minimal fixes) | advisor (reviewer, read-only)"
echo "  design (UI/UX) | scribe (docs) | tester (coverage) | hunter (sweep, read-only)"
