param(
  [string]$TaskName = 'AutumnRecruitmentWorkbench-Daily-0800'
)

$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'collect_jobs.ps1'
$html = (Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.html' -File | Select-Object -First 1).FullName
$action = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$script`""

schtasks.exe /Create /TN $TaskName /SC DAILY /ST 08:00 /TR $action /F | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Task registration failed with exit code $LASTEXITCODE" }
Write-Output "Created daily 08:00 task: $TaskName"
