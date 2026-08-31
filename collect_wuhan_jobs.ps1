param(
  [string]$DataFile = (Join-Path $PSScriptRoot 'recruitment_data.json')
)

$ErrorActionPreference = 'Stop'
$sources = @(
  @{ Unit = '国务院国资委人事招聘专栏'; Name = '国务院国资委'; Url = 'http://www.sasac.gov.cn/n2588035/n2588320/index.html'; Category = '央企综合' },
  @{ Unit = '中国公共招聘网'; Name = '中国公共招聘网'; Url = 'https://job.mohrss.gov.cn/'; Category = '央企综合' },
  @{ Unit = '国聘网'; Name = '国聘网'; Url = 'https://www.guopinwang.com/'; Category = '央企综合' },
  @{ Unit = '中铁大桥局集团有限公司'; Name = '中铁大桥局集团官网'; Url = 'https://www.crec4.com/'; Category = '基建交通' },
  @{ Unit = '中交第二航务工程局有限公司'; Name = '中交二航局官网'; Url = 'https://www.cccc4.com/'; Category = '基建交通' },
  @{ Unit = '中国一冶集团有限公司'; Name = '中国一冶集团官网'; Url = 'https://www.cfmcc.com/'; Category = '基建制造' },
  @{ Unit = '中国电建集团湖北省电力勘测设计研究院有限公司'; Name = '湖北院官网'; Url = 'https://www.hepdi.com.cn/'; Category = '能源电力' },
  @{ Unit = '武汉地铁集团有限公司'; Name = '武汉地铁集团官网'; Url = 'https://www.whrt.gov.cn/'; Category = '城市运营' }
)
$include = '2027|\u6821\u56ed|\u5e94\u5c4a|\u6bd5\u4e1a\u751f|campus|graduate'
$exclude = '\u793e\u4f1a\u62db\u8058|\u793e\u62db|\u5b9e\u4e60|social|intern'
$existing = [System.IO.File]::ReadAllText($DataFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$records = @($existing.records)
$known = [System.Collections.Generic.HashSet[string]]::new()
$records | ForEach-Object { [void]$known.Add($_.url) }
$today = (Get-Date).ToString('yyyy-MM-dd')

foreach ($source in $sources) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $source.Url -TimeoutSec 25
    $matches = [regex]::Matches($response.Content, '(?is)<a\b[^>]*href\s*=\s*["'']([^"'']+)["''][^>]*>(.*?)</a>')
    foreach ($match in $matches) {
      $href = $match.Groups[1].Value.Trim()
      $label = [regex]::Replace($match.Groups[2].Value, '<[^>]+>', ' ')
      $label = [System.Net.WebUtility]::HtmlDecode($label).Trim()
      $haystack = "$label $href"
      if ($haystack -notmatch $include -or $haystack -match $exclude) { continue }
      try { $absolute = [uri]::new([uri]$source.Url, $href).AbsoluteUri } catch { continue }
      if (!$known.Add($absolute)) { continue }
      $records += [pscustomobject]@{
        id = 'live-' + ([guid]::NewGuid().ToString('N'))
        unit = $source.Unit
        project = $label
        category = $source.Category
        batch = '2027届秋招'
        deadline = ''
        source = $source.Name
        publishedAt = $today
        url = $absolute
        location = '武汉'
        verified = $true
      }
    }
  } catch {
    Write-Output "Skipped source: $($source.Url)"
  }
}

$output = [pscustomobject]@{
  generatedAt = (Get-Date).ToString('o')
  notice = '武汉地区官方招聘入口抓取结果。筛选规则：仅保留 2027 / 校园 / 应届 / 毕业生相关链接，并排除社会招聘、社招、实习；未公布截止时间保持为空。'
  records = @($records)
}
[System.IO.File]::WriteAllText($DataFile, ($output | ConvertTo-Json -Depth 20), [System.Text.UTF8Encoding]::new($false))
& (Join-Path $PSScriptRoot 'update_dashboard.ps1') -DataFile $DataFile
Write-Output "Collected $($records.Count) Wuhan records"
