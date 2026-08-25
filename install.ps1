# install.ps1 - deploy the deepseek-harness-discipline presets into ~/.dsh/.agent-presets/
#
# Usage:  .\install.ps1          (installs into $HOME/.dsh)
#         .\install.ps1 -DshHome C:\custom\dsh
#         .\install.ps1 -KeepBackups 3   (keep the 3 newest backup stamps)
#
# After installing: restart dsh (or open a new session) and pick a preset in
# the picker. Existing presets with the same id are NOT deleted - the previous
# version is preserved under <dest>/_backup/<timestamp>/<preset> before the
# fresh copy is installed, so a broken install can always be reverted. Only
# the newest $KeepBackups backup stamps are kept (minimum 1); older stamps are
# pruned so repeated installs do not grow _backup without bound. Stamps carry
# milliseconds, so two installs within the same second never collide.
# NOTE: this file is intentionally ASCII-only so it parses in every
# PowerShell version regardless of BOM handling.

param(
  [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME ".dsh" }),
  [ValidateRange(1, 99)]
  [int]$KeepBackups = 5
)

$ErrorActionPreference = "Stop"

$src = Join-Path $PSScriptRoot "presets"
if (-not (Test-Path $src)) {
  throw "presets/ not found next to install.ps1 - run from the repo root"
}

$dest = Join-Path $DshHome ".agent-presets"
New-Item -ItemType Directory -Force $dest | Out-Null

foreach ($preset in "planner", "builder", "surgeon", "advisor", "design", "scribe", "tester", "hunter", "optimized") {
  $from = Join-Path $src $preset
  $to = Join-Path $dest $preset
  $bak = $null
  if (-not (Test-Path $from)) { throw "preset dir missing: $from" }
  # Never delete the previous preset: preserve it under _backup/<timestamp>/<preset>
  # so a bad install can be reverted. The timestamp means repeated install runs
  # each keep their own backup instead of overwriting each other. The target
  # dir must be gone (or moved) first, otherwise Copy-Item -Recurse would nest
  # the source as a child ($to\$preset).
  if (Test-Path $to) {
    # Milliseconds in the stamp: two installs within the same second must not
    # race on the same backup directory (Move-Item would throw on an existing
    # destination).
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
    $bak = Join-Path (Join-Path $dest "_backup") (Join-Path $stamp $preset)
    New-Item -ItemType Directory -Force (Split-Path -Parent $bak) | Out-Null
    Move-Item -Path $to -Destination $bak
    Write-Host "replacing existing preset: $preset"
    Write-Host "  previous version backed up to: $bak"
  }
  # Roll back so a failed copy mid-loop never leaves the preset absent.
  try {
    Copy-Item -Recurse $from $to -ErrorAction Stop
  } catch {
    if ($bak) {
      Move-Item -Path $bak -Destination $to
      Write-Warning "copy failed for $preset - previous version restored"
    }
    throw
  }
  Write-Host "installed $preset -> $to"
}

# Retention: keep only the newest $KeepBackups backup stamps (minimum 1, so
# the fresh backup from this run always survives). Stamp names are
# "yyyyMMdd-HHmmss-fff", so lexical order equals chronological order. Pruning
# runs after the install so the fresh backup from this run is always among the
# kept ones.
$bakRoot = Join-Path $dest "_backup"
if (Test-Path $bakRoot) {
  $stale = Get-ChildItem $bakRoot -Directory | Sort-Object Name -Descending | Select-Object -Skip $KeepBackups
  foreach ($d in $stale) {
    Remove-Item -Recurse -Force $d.FullName
    Write-Host "pruned old backup: $($d.Name)"
  }
}

Write-Host ""
Write-Host "Done. Restart dsh (or open a new session) and pick a preset:"
Write-Host "  planner (Architect, read-only) | builder (TDD) | surgeon (minimal fixes) | advisor (reviewer, read-only)"
Write-Host "  design (UI/UX) | scribe (docs) | tester (coverage) | hunter (sweep, read-only)"
Write-Host "  optimized (local variant: Android/Gradle coding agent - own persona, reduced guard fork)"
