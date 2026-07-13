# Place Dicht_Data2.csv into data/irt-sample after you download it from Kaggle.
# Usage (from any directory):
#   powershell -ExecutionPolicy Bypass -File scripts/irt_sandbox/place_dicht_csv.ps1
# Or with explicit source:
#   powershell -File scripts/irt_sandbox/place_dicht_csv.ps1 -Source "C:\Users\...\Downloads\Dicht_Data2.csv"

param(
  [string]$Source = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path (Join-Path $Root "package.json"))) {
  # fallback: script is under academy-assessment/scripts/irt_sandbox
  $Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
}
$DestDir = Join-Path $Root "data\irt-sample"
$Dest = Join-Path $DestDir "Dicht_Data2.csv"
New-Item -ItemType Directory -Force -Path $DestDir | Out-Null

function Find-Candidates {
  $names = @("Dicht_Data2.csv", "Dicht_Data2.CSV", "dicht_data2.csv")
  $roots = @(
    (Join-Path $env:USERPROFILE "Downloads"),
    (Join-Path $env:USERPROFILE "Desktop"),
    (Join-Path $env:USERPROFILE "Documents"),
    $DestDir,
    $PWD.Path
  )
  $hits = @()
  foreach ($r in $roots) {
    if (-not (Test-Path $r)) { continue }
    foreach ($n in $names) {
      $p = Join-Path $r $n
      if (Test-Path $p) { $hits += (Get-Item $p) }
    }
    # zip from kaggle
    Get-ChildItem $r -File -Filter "*dichotomous*" -ErrorAction SilentlyContinue | ForEach-Object { $hits += $_ }
    Get-ChildItem $r -File -Filter "*itemresponse*" -ErrorAction SilentlyContinue | ForEach-Object { $hits += $_ }
    Get-ChildItem $r -File -Filter "*Dicht*" -ErrorAction SilentlyContinue | ForEach-Object { $hits += $_ }
  }
  $hits | Sort-Object FullName -Unique
}

Write-Host "Dest: $Dest"
Write-Host ""

if ($Source -and (Test-Path $Source)) {
  $srcItem = Get-Item $Source
} else {
  $cands = Find-Candidates
  if (-not $cands -or $cands.Count -eq 0) {
    Write-Host "NO CANDIDATE FILE FOUND."
    Write-Host ""
    Write-Host "1) Open browser:"
    Write-Host "   https://www.kaggle.com/datasets/kshitiz05/dichotomousdataforitemresponsetheroy"
    Write-Host "2) Click Download (login may be required)"
    Write-Host "3) If you got a .zip, extract it"
    Write-Host "4) Re-run this script, or:"
    Write-Host "   Copy-Item 'PATH\TO\Dicht_Data2.csv' '$Dest' -Force"
    Write-Host ""
    Write-Host "Looking in Downloads/Desktop/Documents for *Dicht* ..."
    exit 2
  }

  Write-Host "Found candidates:"
  $i = 1
  foreach ($c in $cands) {
    Write-Host ("  [{0}] {1}  ({2} bytes)" -f $i, $c.FullName, $c.Length)
    $i++
  }

  # Prefer exact name csv, largest non-demo
  $csv = $cands | Where-Object { $_.Name -match '^Dicht_Data2\.csv$' -and $_.Length -gt 2000 } | Select-Object -First 1
  if (-not $csv) {
    $csv = $cands | Where-Object { $_.Extension -eq '.csv' -and $_.Name -notmatch 'DEMO' -and $_.Length -gt 2000 } | Sort-Object Length -Descending | Select-Object -First 1
  }
  if (-not $csv) {
    $zip = $cands | Where-Object { $_.Extension -eq '.zip' } | Select-Object -First 1
    if ($zip) {
      Write-Host "Extracting $($zip.FullName) ..."
      $tmp = Join-Path $env:TEMP ("dicht_unzip_" + [guid]::NewGuid().ToString("N"))
      New-Item -ItemType Directory -Path $tmp | Out-Null
      Expand-Archive -Path $zip.FullName -DestinationPath $tmp -Force
      $csv = Get-ChildItem $tmp -Recurse -Filter "Dicht_Data2.csv" | Select-Object -First 1
      if (-not $csv) {
        Write-Host "Zip extracted but Dicht_Data2.csv not inside."
        Get-ChildItem $tmp -Recurse | Select-Object FullName, Length
        exit 3
      }
    }
  }
  if (-not $csv) {
    Write-Host "Could not pick a CSV automatically. Pass -Source path."
    exit 4
  }
  $srcItem = $csv
}

if ($srcItem.Length -lt 2000) {
  Write-Host "WARNING: file is only $($srcItem.Length) bytes — may be DEMO/wrong file."
}

Copy-Item -LiteralPath $srcItem.FullName -Destination $Dest -Force
$final = Get-Item $Dest
Write-Host ""
Write-Host "OK placed:"
Write-Host ("  FullName : {0}" -f $final.FullName)
Write-Host ("  Length   : {0}" -f $final.Length)
Write-Host ""
Write-Host "Next:"
Write-Host "  cd $Root"
Write-Host "  python scripts/irt_sandbox/run_sandbox.py"
