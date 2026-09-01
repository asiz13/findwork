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
  @{ Company='飞书 · 27届校招表'; Type='外部渠道'; Domain='my.feishu.cn'; Home='https://my.feishu.cn/wiki/UdAtwwZlJiULwskzEe5cSYJZnMe?table=tbl1eASN11JYwTo8&view=vewJRfkcoh'; SourceType='channel' },
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
  ,@{ Company='银行招聘网'; Type='行业渠道'; Domain='yinhangzhaopin.com'; Home='http://www.yinhangzhaopin.com/'; SourceType='channel' }
  ,@{ Company='医药英才网'; Type='行业渠道'; Domain='healthr.com'; Home='https://www.healthr.com/'; SourceType='channel' }
  ,@{ Company='中国汽车人才网'; Type='行业渠道'; Domain='carjob.com.cn'; Home='http://www.carjob.com.cn/'; SourceType='channel' }
  ,@{ Company='中公金融人'; Type='行业渠道'; Domain='jinrongren.net'; Home='https://m.jinrongren.net/'; SourceType='channel' }
  ,@{ Company='北极星招聘'; Type='行业渠道'; Domain='bjx.com.cn'; Home='https://hr.bjx.com.cn/'; SourceType='channel' }
  ,@{ Company='浙江人才网'; Type='地方渠道'; Domain='zjrc.com'; Home='https://www.zjrc.com/'; SourceType='channel' }
  ,@{ Company='山东人才网'; Type='地方渠道'; Domain='sdrc.com.cn'; Home='https://sdrc.com.cn/'; SourceType='channel' }
  ,@{ Company='四川人才网'; Type='地方渠道'; Domain='scrc168.com'; Home='https://www.scrc168.com/'; SourceType='channel' }
  ,@{ Company='广西人才网'; Type='地方渠道'; Domain='gxrc.com'; Home='https://www.gxrc.com/'; SourceType='channel' }
  ,@{ Company='应届生求职网'; Type='综合渠道'; Domain='yingjiesheng.com'; Home='https://www.yingjiesheng.com/'; SourceType='channel' }
  ,@{ Company='前程无忧'; Type='综合渠道'; Domain='51job.com'; Home='https://www.51job.com/'; SourceType='channel' }
  ,@{ Company='BOSS直聘'; Type='综合渠道'; Domain='zhipin.com'; Home='https://www.zhipin.com/'; SourceType='channel' }
  ,@{ Company='智联招聘'; Type='综合渠道'; Domain='zhaopin.com'; Home='https://www.zhaopin.com/'; SourceType='channel' }
  ,@{ Company='实习僧'; Type='综合渠道'; Domain='shixiseng.com'; Home='https://www.shixiseng.com/'; SourceType='channel' }
  ,@{ Company='猎聘'; Type='综合渠道'; Domain='liepin.com'; Home='https://www.liepin.com/'; SourceType='channel' }
  ,@{ Company='拉勾网'; Type='综合渠道'; Domain='lagou.com'; Home='https://www.lagou.com/'; SourceType='channel' }
  ,@{ Company='牛客网'; Type='求职社区'; Domain='nowcoder.com'; Home='https://www.nowcoder.com/'; SourceType='channel' }
  ,@{ Company='海投网'; Type='综合渠道'; Domain='haitou.cc'; Home='https://www.haitou.cc/'; SourceType='channel' }
  ,@{ Company='刺猬实习'; Type='求职社区'; Domain='ciwei.net'; Home='https://www.ciwei.net/'; SourceType='channel' }
  ,@{ Company='国家公务员局'; Type='政府渠道'; Domain='scs.gov.cn'; Home='http://www.scs.gov.cn/'; SourceType='channel' }
  ,@{ Company='高校人才网'; Type='高校渠道'; Domain='gaoxiaojob.com'; Home='https://www.gaoxiaojob.com/'; SourceType='channel' }
  ,@{ Company='国聘网'; Type='政府渠道'; Domain='iguopin.com'; Home='https://www.iguopin.com/'; SourceType='channel' }
  ,@{ Company='24365国家大学生就业服务平台'; Type='政府渠道'; Domain='ncss.cn'; Home='https://job.ncss.cn/'; SourceType='channel' }
  ,@{ Company='中智招聘'; Type='央国企渠道'; Domain='ciicsjob.com'; Home='https://www.ciicsjob.com/'; SourceType='channel' }
  ,@{ Company='中国烟草招聘系统'; Type='政府渠道'; Domain='tobacco.gov.cn'; Home='http://www.tobacco.gov.cn/'; SourceType='channel' }
  ,@{ Company='宝洁（中国）有限公司'; Type='外企'; Domain='pgcareers.com'; Home='https://www.pgcareers.com/' }
  ,@{ Company='LinkedIn'; Type='综合渠道'; Domain='linkedin.com'; Home='https://www.linkedin.com/jobs/' ; SourceType='channel' }
  ,@{ Company='Indeed'; Type='综合渠道'; Domain='indeed.com'; Home='https://www.indeed.com/' ; SourceType='channel' }
  ,@{ Company='德科招聘'; Type='综合渠道'; Domain='fescod.com'; Home='https://www.fescod.com/' ; SourceType='channel' }
  ,@{ Company='就业在线'; Type='政府渠道'; Domain='jobonline.cn'; Home='https://www.jobonline.cn/' ; SourceType='channel' }
  ,@{ Company='北京人才网'; Type='地方渠道'; Domain='bjrc.com.cn'; Home='http://www.bjrc.com.cn/' ; SourceType='channel' }
  ,@{ Company='上海外服'; Type='地方渠道'; Domain='fsq.com.cn'; Home='https://www.fsg.com.cn/' ; SourceType='channel' }
  ,@{ Company='广东人才网'; Type='地方渠道'; Domain='gdrc.com'; Home='https://www.gdrc.com/' ; SourceType='channel' }
  ,@{ Company='赛氪网'; Type='求职社区'; Domain='saikr.com'; Home='https://www.saikr.com/' ; SourceType='channel' }
  ,@{ Company='脉脉'; Type='求职社区'; Domain='maimai.cn'; Home='https://maimai.cn/' ; SourceType='channel' }
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
  $explicit = Get-Group $text '(?:工作地点|工作城市|招聘城市|工作地|任职地点|就业地点)[：: ]{0,3}([^。；;，,\s]{2,20})'
  if ($explicit) {
    foreach ($city in $cities) { if ($explicit -match [regex]::Escape($city)) { return $city } }
    foreach ($province in $provinces) { if ($explicit -match [regex]::Escape($province)) { return $province } }
  }
  return ''
}

function Get-Major([string]$text) {
  $keys = @('计算机类','软件工程','信息与通信工程','电子信息类','电气工程','机械工程','自动化','土木工程','建筑学','交通运输','能源动力','化学工程','材料类','财务管理','会计学','经济学','金融学','工商管理','人力资源管理','法学','汉语言文学','新闻传播','市场营销','统计学','数学类','物理学','外国语言文学')
  $hit = @($keys | Where-Object { $text -match [regex]::Escape($_) })
  if ($hit.Count) { return ($hit -join '、') }
  return Get-Group $text '(?:专业要求|所需专业|专业类别)[：: ]{0,3}([^。；;]{2,80})'
}

function Get-Education([string]$text) {
  return Get-Group $text '(?:学历要求|学历条件|学历)[：: ]{0,3}([^。；;]{2,40})'
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

function Get-Company([string]$title, [string]$text, $source) {
  if ($source.SourceType -ne 'channel') { return $source.Company }
  $combined = "$title $text"
  $name = Get-Group $combined '(?:公司名称|单位名称|招聘单位|招聘企业|企业名称)[：: ]{0,3}([^。；;，,]{2,60})'
  if (!$name) { $name = Get-Group $title '(?:^|[【\[])([^【】\[\]｜|—-]{2,45})(?:招聘|校招|校园招聘|秋招)' }
  if (!$name) { $name = Get-Group $title '([^｜|—-]{2,45})(?:2027|2027届)' }
  $name = ($name -replace '^\s*广告\s*','' -replace '(?:2027|2027届|27届|2026|2026届|校园招聘|校招|秋招).*$','').Trim()
  if ($name -and $name.Length -ge 3 -and $name -notmatch '招聘网|人才网|直聘|招聘平台|求职网|海外优青|银行$' -and $name -match '公司|集团|科技|物流|电子|汽车|能源|通信|建设|工程|医药|学院|大学|医院|制造|化工|机械|电气|股份|投资|外服|人寿|证券|基金|保险|地产|物业|旅游|邮') { return $name }
  return ''
}

function Add-DetailRecord($list, $source, [string]$url, [string]$title, [string]$text, [bool]$verified) {
  if (!$text -or $text -match $exclude -or $text -notmatch '2027|2027届' -or $text -notmatch $include) { return }
  if ($source.SourceType -eq 'channel' -and "$title $url" -notmatch '2027|27届|秋招|校招|校园') { return }
  $position = if ($source.SourceType -eq 'channel') { Get-Group $text '(?:岗位名称|招聘岗位|职位名称)[：: ]{0,3}([^。；;]{2,60})' } else { Get-JobTitle $title $text }
  if ($position -and $position.Length -lt 2) { $position = '' }
  $salary = Get-Salary $text
  $start = Get-Group $text '(?:报名开始|开始报名|网申开始|投递开始)[：: ]{0,3}(20\d{2}[年./-]\d{1,2}[月./-]\d{1,2}日?)'
  $end = Get-Group $text '(?:报名截止|截止时间|网申截止|投递截止)[：: ]{0,3}(20\d{2}[年./-]\d{1,2}[月./-]\d{1,2}日?)'
  $published = Get-Group $text '(?:发布时间|发布日期|公告日期|发布于)[：: ]{0,3}(20\d{2}[年./-]\d{1,2}[月./-]\d{1,2}日?)'
  $company = Get-Company $title $text $source
  if (!$company) { return }
  $record = [pscustomobject]@{
    id = 'job-' + ([guid]::NewGuid().ToString('N'))
    company = $company
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
    sourceType = if ($source.SourceType) { $source.SourceType } else { 'company-official' }
  }
  if ($record.company) { [void]$list.Add($record) }
}

$existing = [System.IO.File]::ReadAllText($DataFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$records = [System.Collections.Generic.List[object]]::new()
foreach ($old in @($existing.records)) {
  if ($old.company -and $old.url -and $old.sourceType -ne 'channel' -and $old.position -notmatch '校园招聘信息入口|招聘官网') { [void]$records.Add($old) }
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
  if ($source.SourceType -eq 'channel') {
    try {
      $channel = Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri $source.Home -TimeoutSec 25
      $links = [regex]::Matches($channel.Content, '(?is)<a\b[^>]*href=["'']([^"'']+)["''][^>]*>(.*?)</a>')
      $seenLinks = [System.Collections.Generic.HashSet[string]]::new()
      foreach ($link in $links) {
        $label = [regex]::Replace($link.Groups[2].Value, '<[^>]+>', ' ') -replace '\s+', ' '
        $href = [System.Net.WebUtility]::HtmlDecode($link.Groups[1].Value)
        if (!$href -or $href -match '^javascript:|^#' -or "$label $href" -notmatch '2027|校园招聘|秋招|校招|招聘公告|招聘启事') { continue }
        try { $detail = ([uri]::new([uri]$source.Home, $href)).AbsoluteUri } catch { continue }
        if (!$seenLinks.Add($detail)) { continue }
        try {
          $page = Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri $detail -TimeoutSec 20
          Add-DetailRecord $records $source $detail $label (Get-CleanText $page.Content) $false
        } catch { }
        if ($seenLinks.Count -ge 12) { break }
      }
    } catch { Write-Output "Skipped channel crawl: $($source.Home)" }
  }
}

$deduped = @($records | Group-Object { "$($_.company)|$($_.position)|$($_.city)|$($_.url)" } | ForEach-Object { $_.Group[0] })
$output = [pscustomobject]@{
  generatedAt = (Get-Date).ToString('o')
  scope = '全国'
  notice = '全国 2027 届校园招聘抓取：保留公司名明确的岗位明细和招聘公告，岗位未公布时留空；排除社会招聘、社招、实习和兼职；工资、专业、学历、城市、起止时间只在原公告明确写出时记录。官方官网优先，渠道网站用于发现线索。'
  records = @($deduped)
}
[System.IO.File]::WriteAllText($DataFile, ($output | ConvertTo-Json -Depth 20), [System.Text.UTF8Encoding]::new($false))
& (Join-Path $PSScriptRoot 'update_dashboard.ps1') -DataFile $DataFile
Write-Output "Collected $($deduped.Count) nationwide records (jobs and recruitment notices)"
