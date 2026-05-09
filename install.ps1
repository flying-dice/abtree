$ErrorActionPreference = "Stop"

$Repo = "flying-dice/abtree"
$Asset = "abt-windows-x64.exe"
$BinName = "abt.exe"
$InstallDir = "$env:USERPROFILE\.local\bin"

$Url = "https://github.com/$Repo/releases/latest/download/$Asset"

Write-Host "Downloading $Asset..."
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Invoke-WebRequest -Uri $Url -OutFile "$InstallDir\$BinName" -UseBasicParsing

$UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($UserPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$UserPath;$InstallDir", "User")
    Write-Host "Added $InstallDir to PATH — restart your terminal."
}

Write-Host "Installed: $InstallDir\$BinName"
