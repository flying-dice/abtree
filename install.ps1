#!/usr/bin/env pwsh
param(
  [String]$Version = "latest",
  [Switch]$NoPathUpdate = $false,
  [Switch]$DownloadWithoutCurl = $false
);

$Arch = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment').PROCESSOR_ARCHITECTURE
if ($Arch -ne "AMD64") {
  Write-Output "Install Failed:"
  Write-Output "abtree for Windows is currently only available for x86 64-bit.`n"
  return 1
}

$MinBuild = 17763;
$MinBuildName = "Windows 10 1809 / Windows Server 2019"

$WinVer = [System.Environment]::OSVersion.Version
if ($WinVer.Major -lt 10 -or ($WinVer.Major -eq 10 -and $WinVer.Build -lt $MinBuild)) {
  Write-Warning "abtree requires ${MinBuildName} or newer.`n"
  return 1
}

$ErrorActionPreference = "Stop"

# Registry-based env helpers — avoids SetEnvironmentVariable corrupting REG_EXPAND_SZ entries.
# Adapted from https://github.com/prefix-dev/pixi/pull/692
function Publish-Env {
  if (-not ("Win32.NativeMethods" -as [Type])) {
    Add-Type -Namespace Win32 -Name NativeMethods -MemberDefinition @"
[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
public static extern IntPtr SendMessageTimeout(
    IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam,
    uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
"@
  }
  $HWND_BROADCAST = [IntPtr] 0xffff
  $WM_SETTINGCHANGE = 0x1a
  $result = [UIntPtr]::Zero
  [Win32.NativeMethods]::SendMessageTimeout($HWND_BROADCAST,
    $WM_SETTINGCHANGE,
    [UIntPtr]::Zero,
    "Environment",
    2,
    5000,
    [ref] $result
  ) | Out-Null
}

function Write-Env {
  param([String]$Key, [String]$Value)
  $RegisterKey = Get-Item -Path 'HKCU:'
  $EnvRegisterKey = $RegisterKey.OpenSubKey('Environment', $true)
  if ($null -eq $Value) {
    $EnvRegisterKey.DeleteValue($Key)
  } else {
    $RegistryValueKind = if ($Value.Contains('%')) {
      [Microsoft.Win32.RegistryValueKind]::ExpandString
    } elseif ($EnvRegisterKey.GetValue($Key)) {
      $EnvRegisterKey.GetValueKind($Key)
    } else {
      [Microsoft.Win32.RegistryValueKind]::String
    }
    $EnvRegisterKey.SetValue($Key, $Value, $RegistryValueKind)
  }
  Publish-Env
}

function Get-Env {
  param([String] $Key)
  $RegisterKey = Get-Item -Path 'HKCU:'
  $EnvRegisterKey = $RegisterKey.OpenSubKey('Environment')
  $EnvRegisterKey.GetValue($Key, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
}

function Install-Abtree {
  param([string]$Version)

  $InstallDir = "$env:USERPROFILE\.local\bin"
  $ExePath = "${InstallDir}\abtree.exe"
  $TmpPath = "${InstallDir}\abtree.exe.tmp"

  $null = mkdir -Force $InstallDir

  try {
    Remove-Item $ExePath -Force
  } catch [System.Management.Automation.ItemNotFoundException] {
    # nothing to remove
  } catch [System.UnauthorizedAccessException] {
    $openProcesses = Get-Process -Name abtree -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $ExePath }
    if ($openProcesses.Count -gt 0) {
      Write-Output "Install Failed - abtree.exe is currently running. Please close it and try again."
      return 1
    }
    Write-Output "Install Failed - could not remove existing installation."
    Write-Output $_
    return 1
  } catch {
    Write-Output "Install Failed - could not remove existing installation."
    Write-Output $_
    return 1
  }

  $BaseURL = "https://github.com/flying-dice/abtree/releases"
  $URL = "$BaseURL/$(if ($Version -eq 'latest') { 'latest/download' } else { "download/$Version" })/abtree-windows-x64.exe"

  Write-Output "Downloading abtree..."
  Remove-Item -Force $TmpPath -ErrorAction SilentlyContinue

  if (-not $DownloadWithoutCurl) {
    curl.exe "-#SfLo" "$TmpPath" "$URL"
  }
  if ($DownloadWithoutCurl -or ($LASTEXITCODE -ne 0)) {
    Write-Warning "curl.exe failed (exit $LASTEXITCODE), trying Invoke-RestMethod..."
    try {
      $global:ProgressPreference = 'SilentlyContinue'
      Invoke-RestMethod -Uri $URL -OutFile $TmpPath
      $global:ProgressPreference = 'Continue'
    } catch {
      Write-Output "Install Failed - could not download $URL"
      return 1
    }
  }

  if (!(Test-Path $TmpPath)) {
    Write-Output "Install Failed - download did not produce a file. Did an antivirus delete it?`n"
    return 1
  }

  Move-Item $TmpPath $ExePath -Force

  $AbtreeVersion = "$(& $ExePath --version 2>&1)"
  if ($LASTEXITCODE -ne 0) {
    Write-Output "Install Failed - abtree.exe did not run correctly (exit $LASTEXITCODE).`n"
    return 1
  }

  $C_RESET = [char]27 + "[0m"
  $C_GREEN = [char]27 + "[1;32m"
  Write-Output "${C_GREEN}abtree ${AbtreeVersion} installed successfully!${C_RESET}"
  Write-Output "Binary: ${ExePath}`n"

  $hasExistingOther = $false
  try {
    $existing = Get-Command abtree -ErrorAction Stop
    if ($existing.Source -ne $ExePath) {
      Write-Warning "Another abtree.exe is already in PATH at $($existing.Source).`nTyping 'abtree' will not use what was just installed.`n"
      $hasExistingOther = $true
    }
  } catch {}

  if (-not $hasExistingOther) {
    $Path = (Get-Env -Key "Path") -split ';'
    if ($Path -notcontains $InstallDir) {
      if (-not $NoPathUpdate) {
        $Path += $InstallDir
        Write-Env -Key 'Path' -Value ($Path -join ';')
        $env:PATH = $Path -join ';'
        Write-Output "Added ${InstallDir} to PATH — restart your terminal to use abtree.`n"
      } else {
        Write-Output "Skipping PATH update. Add '${InstallDir}' manually.`n"
      }
    }
  }

  $LASTEXITCODE = 0
}

Install-Abtree -Version $Version
