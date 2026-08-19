# install.ps1 - deploy the deepseek-harness-discipline presets into ~/.dsh/.agent-presets/
#
# Usage:  .\install.ps1          (installs into $HOME/.dsh)
#         .\install.ps1 -DshHome C:\custom\dsh
#
# After installing: restart dsh (or open a new session) and pick a preset in
# the picker. Existing presets with the same id are NOT deleted — the previous
# version is preserved under <dest>/_backup/<timestamp>/<preset> before the
# fresh copy is installed, so a broken install can always be reverted.
# NOTE: this file is intentionally ASCII-only so it parses in every
# PowerShell version regardless of BOM handling.

param(
  [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME ".dsh" })
)

$ErrorActionPreference = "Stop"

$src = Join-Path $PSScriptRoot "presets"
if (-not (Test-Path $src)) {
  throw "presets/ not found next to install.ps1 - run from the repo root"
}

$dest = Join-Path $DshHome ".agent-presets"
New-Item -ItemType Directory -Force $dest | Out-Null

foreach ($preset in "planner", "builder", "surgeon", "advisor", "design", "scribe", "tester", "hunter") {
  $from = Join-Path $src $preset
  $to = Join-Path $dest $preset
  if (-not (Test-Path $from)) { throw "preset dir missing: $from" }
  # Never delete the previous preset: preserve it under _backup/<timestamp>/<preset>
  # so a bad install can be reverted. The timestamp means repeated install runs
  # each keep their own backup instead of overwriting each other. The target
  # dir must be gone (or moved) first, otherwise Copy-Item -Recurse would nest
  # the source as a child ($to\$preset).
  if (Test-Path $to) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $bak = Join-Path (Join-Path $dest "_backup") (Join-Path $stamp $preset)
    New-Item -ItemType Directory -Force (Split-Path -Parent $bak) | Out-Null
    Move-Item -Path $to -Destination $bak
    Write-Host "replacing existing preset: $preset"
    Write-Host "  previous version backed up to: $bak"
  }
  Copy-Item -Recurse $from $to
  Write-Host "installed $preset -> $to"
}

Write-Host ""
Write-Host "Done. Restart dsh (or open a new session) and pick a preset:"
Write-Host "  planner (Architect, read-only) | builder (TDD) | surgeon (minimal fixes) | advisor (reviewer, read-only)"
Write-Host "  design (UI/UX) | scribe (docs) | tester (coverage) | hunter (sweep, read-only)"
