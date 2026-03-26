$ErrorActionPreference = "Stop"

$nodeDir = "C:\Program Files\nodejs"
$npmCmd = Join-Path $nodeDir "npm.cmd"
$npxCmd = Join-Path $nodeDir "npx.cmd"

if (-not (Test-Path $npmCmd) -or -not (Test-Path $npxCmd)) {
  throw "Node.js not found at '$nodeDir'. Install Node.js LTS first."
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ([string]::IsNullOrWhiteSpace($userPath)) {
  $userPath = $nodeDir
} elseif ($userPath -notmatch [regex]::Escape($nodeDir)) {
  $userPath = "$userPath;$nodeDir"
}
[Environment]::SetEnvironmentVariable("Path", $userPath, "User")

$profilePath = $PROFILE
$profileDir = Split-Path -Parent $profilePath
if (-not (Test-Path $profileDir)) {
  New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}
if (-not (Test-Path $profilePath)) {
  New-Item -ItemType File -Path $profilePath -Force | Out-Null
}

$profileContent = Get-Content $profilePath -Raw
$marker = "# DatLe Node wrappers"
$wrapperBlock = @"
# DatLe Node wrappers
function npm { & "$npmCmd" @args }
function npx { & "$npxCmd" @args }
"@

if ($profileContent -notmatch [regex]::Escape($marker)) {
  Add-Content -Path $profilePath -Value "`r`n$wrapperBlock"
}

$env:Path = "$nodeDir;$env:Path"

try {
  if ((Get-ExecutionPolicy -Scope CurrentUser) -eq "Undefined") {
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
  }
} catch {
  Write-Warning "Could not set CurrentUser execution policy. You can continue using npm.cmd."
}

. $PROFILE

Write-Host "Node shell fix applied."
Write-Host "node version: $(node -v)"
Write-Host "npm version: $(npm -v)"
Write-Host "Close and reopen terminal windows to apply user PATH globally."
