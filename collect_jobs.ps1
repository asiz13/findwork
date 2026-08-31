param(
  [string]$DataFile = (Join-Path $PSScriptRoot 'recruitment_data.json')
)

$ErrorActionPreference = 'Stop'
$headers = @{ 'User-Agent' = 'Mozilla/5.0 (compatible; AutumnRecruitmentWorkbench/1.0)' }
$include = '2027|2027届|校园招聘|秋季招聘|秋招|应届毕业生|高校毕业生|campus|graduate'
$exclude = '社会招聘|社会人才|社招|实习|兼职|intern|social recruitment'
$cities = @('北京','上海','广州','深圳','武汉','杭州','南京','苏州','成都','重庆','西安','天津','济南','青岛','郑州','长沙','合肥','厦门','福州','东莞','宁波','佛山','沈阳','大连','哈尔滨','长春','南昌','昆明','贵阳','太原','石家庄','南宁','海口','兰州','乌鲁木齐','呼和浩特','银川','西宁','拉萨','珠海','无锡','常州','嘉兴','绍兴','惠州','中山','温州','烟台','洛阳','襄阳','宜昌','绵阳','芜湖','赣州')
$provinces = @('北京','上海','广东','江苏','浙江','湖北','湖南','四川','重庆','陕西','山东','河南','河北','天津','安徽','福建','江西','辽宁','吉林','黑龙江','云南','贵州','山西','广西','甘肃','新疆','内蒙古','海南','宁夏','青海','西藏')

# These are first-party campus/recruitment domains. Search is used only to discover
# detail pages; the saved link always points to the company or official source page.
$sources = @(
  @{ Company='华为技术有限公司'; Type='民企'; Domain='huawei.com'; Home='https://career.huawei.com/' },
  @{ Company='腾讯科技（深圳）有限公司'; Type='民企'; Domain='join.qq.com'; Home='https://join.qq.com/' },
  @{ Company='字节跳动有限公司'; Type='民企'; Domain='jobs.bytedance.com'; Home='https://jobs.bytedance.com/campus/' },
  @{ Company='阿里巴巴（中国）网络技术有限公司'; Type='民企'; Domain='campus.alibaba.com'; Home='https://campus.alibaba.com/' },
  @{ Company='宁德时代新能源科技股份有限公司'; Type='民企'; Domain='catl.com'; Home='https://campus.catl.com/' },
  @{ Company='比亚迪股份有限公司'; Type='民企'; Domain='byd.com'; Home='https://job.byd.com/' },
  @{ Company='美的集团股份有限公司'; Type='民企'; Domain='midea.com'; Home='https://careers.midea.com/' },
  @{ Company='海尔集团公司'; Type='民企'; Domain='haier.com'; Home='https://maker.haier.com/' },
  @{ Company='京东集团'; Type='民企'; Domain='jd.com'; Home='https://campus.jd.com/' },
  @{ Company='顺丰控股股份有限公司'; Type='民企'; Domain='sf-express.com'; Home='https://campus.sf-express.com/' },
  @{ Company='小米科技有限责任公司'; Type='民企'; Domain='xiaomi.com'; Home='https://hr.xiaomi.com/' },
  @{ Company='国家电网有限公司'; Type='央企'; Domain='sgcc.com.cn'; Home='https://zhaopin.sgcc.com.cn/' },
  @{ Company='中国石油天然气集团有限公司'; Type='央企'; Domain='cnpc.com.cn'; Home='https://zhaopin.cnpc.com.cn/' },
  @{ Company='中国石油化工集团有限公司'; Type='央企'; Domain='sinopec.com'; Home='https://job.sinopec.com/' },
  @{ Company='中国建筑集团有限公司'; Type='央企'; Domain='cscec.com'; Home='https://job.cscec.com/' },
  @{ Company='中国中车集团有限公司'; Type='央企'; Domain='crrcgc.cc'; Home='https://job.crrc.com/' },
  @{ Company='中国移动通信集团有限公司'; Type='央企'; Domain='chinamobile.com'; Home='https://job.10086.cn/' },
  @{ Company='中国电信集团有限公司'; Type='央企'; Domain='chinatelecom.com.cn'; Home='https://campus.chinatelecom.com.cn/' },
  @{ Company='国家能源投资集团有限责任公司'; Type='央企'; Domain='chnenergy.com.cn'; Home='https://zhaopin.chnenergy.com.cn/' },
  @{ Company='招商局集团有限公司'; Type='央企'; Domain='cmhk.com'; Home='https://campus.cmhk.com/' },
  @{ Company='中铁大桥局集团有限公司'; Type='国企'; Domain='crec4.com'; Home='https://www.crec4.com/' },
  @{ Company='上汽集团股份有限公司'; Type='国企'; Domain='saicmotor.com'; Home='https://campus.saicmotor.com/' },
  @{ Company='上海电气集团股份有限公司'; Type='国企'; Domain='shanghai-electric.com'; Home='https://www.shanghai-electric.com/' },
  @{ Company='西门子（中国）有限公司'; Type='外企'; Domain='siemens.com.cn'; Home='https://www.siemens.com/cn/zh/company/jobs.html' },
  @{ Company='博世（中国）投资有限公司'; Type='外企'; Domain='bosch.com.cn'; Home='https://www.bosch.com.cn/careers/' },
  @{ Company='施耐德电气（中国）有限公司'; Type='外企'; Domain='se.com'; Home='https://www.se.com/cn/zh/about-us/careers/' }
)

function Get-CleanText([string]$html) {
  $text = [regex]::Replace($html, '(?is)<script.*?</script>|<style.*?</style>|<[^>]+>', ' ')
  return [System.Net.WebUtility]::HtmlDecode(($text -replace '\s+', ' ')).Trim()
}

function Get-Group([string]$text, [string]$pattern) {
  $match = [regex]::Match($text, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($match.Success) { return $match.Groups[1].Value.Trim() }
  return ''
}

function Get-City([string]$text) {
  foreach ($city in $cities) { if ($text -match [regex]::Escape($city)) { return $city } }
  foreach ($province in $provinces) { if ($text -match [regex]::Escape($province)) { return $province } }
  return ''
}

function Get-Major([string]$text) {
  $keys = @('计算机类','软件工程','信息与通信工程','电子信息类','电气工程','机械工程','自动化','土木工程','建筑学','交通运输','能源动力','化学工程','材料类','财务管理','会计学','经济学','金融学','工商管理','人力资源管理','法学','汉语言文学','新闻传播','市场营销','统计学','数学类','物理学','外国语言文学')
  $hit = @($keys | Where-Object { $text -match [regex]::Escape($_) })
  if ($hit.Count) { return ($hit -join '、') }
  return Get-Group $text '(?:专业要求|所需专业|专业类别)[：: ]{0,3}([^。；;]{2,80})'
}

function Get-Education([string]$text) {
  $hit = @('博士','硕士研究生','研究生','本科','大专','专科') | Where-Object { $text -match $_ }
  if ($hit.Count) { return ($hit -join ' / ') }
  return Get-Group $text '(本科及以上|硕士及以上|研究生及以上|大专及以上)'
}

function Get-Salary([string]$text) {
  $patterns = @(
    '(\d+(?:\.\d+)?)\s*[万万元]\s*(?:/年|每年|年薪)',
    '(\d+(?:\.\d+)?)\s*[-至~]\s*(\d+(?:\.\d+)?)\s*[千kK万万元]',
    '(\d{4,6})\s*[-至~]\s*(\d{4,6})\s*元'
  )
  foreach ($pattern in $patterns) {
    $m = [regex]::Match($text, $pattern)
    if ($m.Success) {
      $raw = $m.Value
      $numbers = @($m.Groups | Where-Object {$_.Success -and $_.Name -match '^\d+$'} | ForEach-Object {[double]$_.Value})
      $min = 0
      if ($raw -match '万') { $min = [int]($numbers[0] * 10000 / 12) }
      elseif ($raw -match '[千kK]') { $min = [int]($numbers[0] * 1000) }
      else { $min = [int]$numbers[0] }
      return [pscustomobject]@{ Text = $raw; Min = $min }
    }
  }
  return [pscustomobject]@{ Text = ''; Min = $null }
}

function Get-JobTitle([string]$title, [string]$text) {
  $clean = [System.Net.WebUtility]::HtmlDecode($title).Trim()
  $clean = $clean -replace '\s*[-|｜].*$', ''
  if ($clean -and $clean -notmatch '招聘首页|招聘官网|校园招聘|招聘信息|人才招聘|职位列表|招聘\s*启动|校招\s*启动|招聘公告') { return $clean }
  $fromText = Get-Group $text '(?:岗位名称|招聘岗位|职位名称)[：: ]{0,3}([^。；;]{2,60})'
  return $fromText
}

function Add-DetailRecord($list, $source, [string]$url, [string]$title, [string]$text, [bool]$verified) {
  if (!$text -or $text -match $exclude -or $text -notmatch '2027|2027届' -or $text -notmatch $include) { return }
  $position = Get-JobTitle $title $text
  if ($position -and $position.Length -lt 2) { $position = '' }
  $salary = Get-Salary $text
  $start = Get-Group $text '(?:报名开始|开始报名|网申开始|投递开始)[：: ]{0,3}(20\d{2}[年./-]\d{1,2}[月./-]\d{1,2}日?)'
  $end = Get-Group $text '(?:报名截止|截止时间|网申截止|投递截止)[：: ]{0,3}(20\d{2}[年./-]\d{1,2}[月./-]\d{1,2}日?)'
  $published = Get-Group $text '(?:发布时间|发布日期|公告日期|发布于)[：: ]{0,3}(20\d{2}[年./-]\d{1,2}[月./-]\d{1,2}日?)'
  $record = [pscustomobject]@{
    id = 'job-' + ([guid]::NewGuid().ToString('N'))
    company = $source.Company
    position = $position
    recordType = if ($position) { '岗位明细' } else { '招聘公告' }
    major = Get-Major $text
    city = Get-City $text
    category = $source.Type
    education = Get-Education $text
    startDate = $start
    deadline = $end
    salaryText = $salary.Text
    salaryMin = $salary.Min
    source = $source.Domain
    publishedAt = $published
    url = $url
    verified = $verified
    sourceType = 'company-official'
  }
  if ($record.company) { [void]$list.Add($record) }
}

$existing = [System.IO.File]::ReadAllText($DataFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$records = [System.Collections.Generic.List[object]]::new()
foreach ($old in @($existing.records)) {
  if ($old.company -and $old.url -and $old.position -notmatch '校园招聘信息入口|招聘官网') { [void]$records.Add($old) }
}

foreach ($source in $sources) {
  try {
    $homePage = Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri $source.Home -TimeoutSec 25
    $homeText = Get-CleanText $homePage.Content
    # Some official ATS pages render the job list in an embedded JSON blob.
    # ByteDance exposes 2027 graduate project roles this way.
    $embedded = [regex]::Matches($homePage.Content, '(?is)"keywords"\s*:\s*"([^"]{2,120})"')
    foreach ($hit in $embedded) {
      $keyword = [System.Net.WebUtility]::HtmlDecode($hit.Groups[1].Value) -replace '\\"', '"'
      if ($keyword -match '工程师|研究员|产品|运营|设计|开发|算法|数据|经理') {
        Add-DetailRecord $records $source $source.Home $keyword ($homeText + ' 面向 2027 届毕业生 校园招聘') $true
      }
    }
  } catch { Write-Output "Skipped official home: $($source.Home) :: $($_.Exception.Message)" }
  $queries = @("site:$($source.Domain) 2027届 校园招聘", "site:$($source.Domain) 2027 秋招 招聘岗位", "site:$($source.Domain) campus graduate recruitment 2027")
  foreach ($query in $queries) {
    try {
      $searchUri = 'https://www.bing.com/search?q=' + [uri]::EscapeDataString($query)
      $search = Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri $searchUri -TimeoutSec 25
      $items = [regex]::Matches($search.Content, '(?is)<li\s+class="b_algo".*?</li>')
      foreach ($item in $items) {
        $href = Get-Group $item.Value 'href="([^"]+)"'
        $title = Get-Group $item.Value '<h2.*?>(.*?)</h2>'
        $title = [regex]::Replace($title, '<[^>]+>', ' ')
        if (!$href -or $href -notmatch [regex]::Escape($source.Domain)) { continue }
        try {
          $page = Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri $href -TimeoutSec 25
          $text = Get-CleanText $page.Content
          Add-DetailRecord $records $source $href $title $text $true
        } catch { Write-Output "Skipped detail: $href" }
      }
    } catch { Write-Output "Skipped search: $query :: $($_.Exception.Message)" }
  }
}

$deduped = @($records | Group-Object { "$($_.company)|$($_.position)|$($_.city)|$($_.url)" } | ForEach-Object { $_.Group[0] })
$output = [pscustomobject]@{
  generatedAt = (Get-Date).ToString('o')
  scope = '全国'
  notice = '全国岗位级抓取结果：仅保留具体公司和岗位，排除社会招聘、社招、实习和泛入口页；工资只在原公告明确写出时记录。'
  records = @($deduped)
}
[System.IO.File]::WriteAllText($DataFile, ($output | ConvertTo-Json -Depth 20), [System.Text.UTF8Encoding]::new($false))
& (Join-Path $PSScriptRoot 'update_dashboard.ps1') -DataFile $DataFile
Write-Output "Collected $($deduped.Count) concrete nationwide job records"
