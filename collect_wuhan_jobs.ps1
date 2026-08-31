param(
  [string]$DataFile = (Join-Path $PSScriptRoot 'recruitment_data.json')
)

# Backward-compatible entry point. The workbench now collects nationwide jobs.
& (Join-Path $PSScriptRoot 'collect_jobs.ps1') -DataFile $DataFile
