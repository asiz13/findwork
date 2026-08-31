param(
  [string]$DataFile = (Join-Path $PSScriptRoot 'recruitment_data.json'),
  [string]$HtmlFile = '',
  [switch]$Open
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($HtmlFile)) {
  $HtmlFile = (Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.html' -File | Select-Object -First 1).FullName
}
$dataText = [System.IO.File]::ReadAllText($DataFile, [System.Text.Encoding]::UTF8)
$data = $dataText | ConvertFrom-Json
$payload = $data | ConvertTo-Json -Depth 20 -Compress
$html = [System.IO.File]::ReadAllText($HtmlFile, [System.Text.Encoding]::UTF8)
$pattern = 'const EMBEDDED_DATA = \{.*?\};'
$replacement = "const EMBEDDED_DATA = $payload;"
$match = [regex]::Match($html, $pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
if (!$match.Success) { throw 'EMBEDDED_DATA placeholder was not found.' }
$updated = [regex]::Replace($html, $pattern, $replacement, [System.Text.RegularExpressions.RegexOptions]::Singleline)
[System.IO.File]::WriteAllText($HtmlFile, $updated, [System.Text.UTF8Encoding]::new($false))
if ($updated -eq $html) { Write-Output "No changes needed for $HtmlFile" } else { Write-Output "Injected $($data.records.Count) records into $HtmlFile" }
if ($Open) { Start-Process -FilePath $HtmlFile }
