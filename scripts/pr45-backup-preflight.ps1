# PR #45 backup preflight: LOCAL, READ ONLY, NO DATABASE CONNECTION.
# Usage: powershell -NoProfile -File .\scripts\pr45-backup-preflight.ps1 -BackupFolder 'C:\path\to\backup'
# This checks presence, file sizes and SHA256. It NEVER uploads/export/restores data.
param(
  [Parameter(Mandatory=$true)][string]$BackupFolder
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $BackupFolder -PathType Container)) {
  throw 'Backup folder not found. Supply the exact local backup directory.'
}
$directory = (Resolve-Path -LiteralPath $BackupFolder).Path
$required = @('roles.sql', 'schema.sql', 'data.sql', 'auth_data.sql')
$rows = @()
foreach ($file in $required) {
  $fullPath = Join-Path $directory $file
  $exists = Test-Path -LiteralPath $fullPath -PathType Leaf
  $size = $null
  $hash = $null
  if ($exists) {
    $item = Get-Item -LiteralPath $fullPath
    $size = $item.Length
    if ($size -gt 32) { $hash = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash }
  }
  $rows += [pscustomobject]@{
    File = $file
    Exists = [bool]$exists
    Bytes = $size
    SHA256 = $hash
    LooksNonempty = [bool]($exists -and $size -gt 32)
  }
}
$allFiles = @(Get-ChildItem -LiteralPath $directory -File -Recurse -ErrorAction Stop)
$storageCandidates = @($allFiles | Where-Object { $_.FullName -match '[\\/]storage[\\/]' })
$backupManifest = Join-Path $directory 'BACKUP_MANIFEST.json'
$manifestPresent = Test-Path -LiteralPath $backupManifest -PathType Leaf
Write-Host 'PR45 backup file preflight - READ ONLY' -ForegroundColor Cyan
Write-Host ('Folder: ' + $directory)
$rows | Format-Table -AutoSize
Write-Host ('Backup manifest exists: ' + $manifestPresent)
Write-Host ('Files in a storage/ folder (possible object exports): ' + $storageCandidates.Count)
Write-Host 'These file checks DO NOT verify restoration, integrity of SQL content, Auth completeness, actual Storage bytes, or current-day freshness.' -ForegroundColor Yellow
Write-Host 'Do NOT upload SQL dumps or any secret credentials to GitHub or ChatGPT.' -ForegroundColor Yellow
if (@($rows | Where-Object { -not $_.LooksNonempty }).Count -gt 0) {
  Write-Host 'FILE PREFLIGHT: INCOMPLETE. Missing or suspiciously small required SQL files.' -ForegroundColor Red
  exit 2
}
Write-Host 'FILE PREFLIGHT: Minimum named SQL files present. RESTORE STILL NOT TESTED.' -ForegroundColor Green
exit 0
