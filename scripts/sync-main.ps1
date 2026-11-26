$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

$dirty = @(git status --porcelain)
if ($LASTEXITCODE -ne 0) { throw 'git status failed.' }
if ($dirty.Count -gt 0) {
  Write-Error "Uncommitted work exists. Preserve it before syncing main:`n$($dirty -join "`n")"
  exit 1
}

git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw 'git fetch origin failed.' }

git switch main
if ($LASTEXITCODE -ne 0) { throw 'git switch main failed.' }

git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw 'git pull --ff-only origin main failed.' }

$head = (git rev-parse HEAD).Trim()
$originMain = (git rev-parse origin/main).Trim()
if ($head -ne $originMain) {
  throw "Local main ($head) does not match origin/main ($originMain)."
}

$latestFinalTag = git tag --list 'admin-final-*' --sort=-creatordate | Select-Object -First 1
Write-Host "SAFE TO START: main is synchronized at $($head.Substring(0, 7))."
if ($latestFinalTag) { Write-Host "Latest confirmed production tag: $latestFinalTag" }
