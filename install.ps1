# install.ps1 - deploy the dsh-discipline presets into ~/.dsh/.agent-presets/
#
# Usage:  .\install.ps1          (installs into $HOME/.dsh)
#         .\install.ps1 -DshHome C:\custom\dsh
#
# After installing: restart dsh (or open a new session) and pick a preset in
# the picker. Existing presets with the same id are overwritten.
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

foreach ($preset in "planner", "builder", "surgeon", "advisor") {
  $from = Join-Path $src $preset
  $to = Join-Path $dest $preset
  if (-not (Test-Path $from)) { throw "preset dir missing: $from" }
  # Remove first: Copy-Item -Recurse into an existing directory would nest
  # the source as a child ($to\$preset) instead of replacing it.
  if (Test-Path $to) {
    Remove-Item -Recurse -Force $to
    Write-Host "replacing existing preset: $preset"
  }
  Copy-Item -Recurse $from $to
  Write-Host "installed $preset -> $to"
}

Write-Host ""
Write-Host "Done. Restart dsh (or open a new session) and pick a preset:"
Write-Host "  planner  (Architect, read-only) | builder (TDD) | surgeon (minimal fixes) | advisor (reviewer, read-only)"
