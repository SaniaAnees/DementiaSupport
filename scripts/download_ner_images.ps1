# Download real Wikimedia Commons photos for 6 NER curriculum packs.
# Shared staples are copied from Assam pack. Run from repo root:
#   powershell -File scripts/download_ner_images.ps1

$ErrorActionPreference = 'Stop'
$ua = 'MindCareCurriculumBot/1.0 (educational; local cache; contact via project)'
$root = Join-Path $PSScriptRoot '..' | Resolve-Path
$asDir = Join-Path $root 'public/assets/curriculum/as'

function Get-Commons([string]$FileName, [string]$Dest) {
  $uri = "https://commons.wikimedia.org/wiki/Special:FilePath/$([uri]::EscapeDataString($FileName))?width=960"
  Write-Host "GET $FileName -> $Dest"
  try {
    Invoke-WebRequest -Uri $uri -OutFile $Dest -UserAgent $ua -MaximumRedirection 8 -TimeoutSec 90
    $bytes = [System.IO.File]::ReadAllBytes($Dest)
    if ($bytes.Length -lt 2000) { throw "too small ($($bytes.Length) bytes)" }
    # Accept JPEG or PNG magic
    $ok = ($bytes[0] -eq 0xFF -and $bytes[1] -eq 0xD8) -or ($bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50)
    if (-not $ok) { throw "not an image (sig $($bytes[0]) $($bytes[1]))" }
    Write-Host "  OK $([math]::Round($bytes.Length/1kb)) KB"
  } catch {
    Write-Host "  FAIL $_"
    if (Test-Path $Dest) { Remove-Item $Dest -Force }
  }
}

function Copy-Shared([string]$DestDir) {
  foreach ($f in @('rice.jpg','tea_cup.jpg','bicycle.jpg','book.jpg')) {
    $src = Join-Path $asDir $f
    if (Test-Path $src) {
      Copy-Item $src (Join-Path $DestDir $f) -Force
      Write-Host "COPY $f -> $DestDir"
    }
  }
}

# state -> localFile -> Commons File: name (without File: prefix)
$maps = @{
  ml = @{
    'living_root.jpg' = 'Living root bridges of Nongriat village in East Khasi Hills district, Meghalaya JEG7388.jpg'
    'waterfall.jpg'   = 'NohKaLikai Falls V2 Wiki.jpg'
    'shillong.jpg'    = 'SHAD SUK MYNSIEM (DANCE FESTIVAL).jpg'
    'morning.jpg'     = 'NohKaLikai Falls V2 Wiki.jpg'
    'evening.jpg'     = 'Living root bridges of Nongriat village in East Khasi Hills district, Meghalaya JEG7388.jpg'
    'home.jpg'        = 'Khasi Traditional attire with a Khoh.jpg'
    'wangala.jpg'     = 'SHAD SUK MYNSIEM (DANCE FESTIVAL).jpg'
    'jainsem.jpg'     = 'Khasi Traditional attire with a Khoh.jpg'
    'ryndia.jpg'      = 'Khasi Traditional attire with an Orange Poncho.jpg'
    'jadoh.jpg'       = 'Jadoh (Meghalaya.JPG'
  }
  mn = @{
    'loktak.jpg'   = 'Loktak Lake Manipur 11.jpg'
    'sangai.jpg'   = 'Sangai at the Keibullamjao National Park, Manipur.jpg'
    'yaoshang.jpg' = 'Manipur During the Yaosang or holi.jpg'
    'phanek.jpg'   = 'Kids in Traditional Attire.jpg'
    'innaphi.jpg'  = 'Manipur During Yaosang.jpg'
    'eromba.jpg'   = 'Assamese Thali.jpg'
    'morning.jpg'  = 'Loktak Lake Manipur 11.jpg'
    'evening.jpg'  = 'Sangai at the Keibullamjao National Park, Manipur.jpg'
    'home.jpg'     = 'Visiting the Kangla Fort.jpg'
  }
  nl = @{
    'hornbill.jpg'    = 'Naga Morung entrance Nagaland’s Hornbill Festival 2019.jpg'
    'dzukou.jpg'      = 'Astonishing beauty of the Dzuko Valley in Manipur-Nagaland border.jpg'
    'naga_shawl.jpg'  = 'Naga traditional shawl.jpg'
    'moatsu.jpg'      = 'Naga folk dance988.jpg'
    'smoked_pork.jpg' = 'Assamese Thali.jpg'
    'axone.jpg'       = 'Assamese Thali.jpg'
    'morning.jpg'     = 'Naga folk dance988.jpg'
    'evening.jpg'     = 'Astonishing beauty of the Dzuko Valley in Manipur-Nagaland border.jpg'
    'home.jpg'        = 'Naga Morung entrance Nagaland’s Hornbill Festival 2019.jpg'
  }
  mz = @{
    'chapchar_kut.jpg' = 'CHAPCHAR KUT 2013.jpg'
    'phawngpui.jpg'    = 'Hlimen Park, Aizawl.jpg'
    'puan.jpg'         = 'Mizo girls in Mizo traditional dress.jpg'
    'hnipui.jpg'       = 'Mizoram State Museum - 12.jpg'
    'bai.jpg'          = 'Assamese Thali.jpg'
    'reiek.jpg'        = 'Park entrance in Hmuifang in Mizoram India. - panoramio.jpg'
    'morning.jpg'      = 'Hlimen Park, Aizawl.jpg'
    'evening.jpg'      = 'Park entrance in Hmuifang in Mizoram India. - panoramio.jpg'
    'home.jpg'         = 'Mizoram State Museum - 12.jpg'
  }
  tr = @{
    'ujjayanta.jpg' = 'The Ujjayanta Palace.jpg'
    'neermahal.jpg' = 'Neermahal, Tripura Agartala, India.jpg'
    'kharchi.jpg'   = 'Temple of 14 gods-Tripura.jpg'
    'risha.jpg'     = 'Mizo girls in Mizo traditional dress.jpg'
    'pachra.jpg'    = 'Mizoram State Museum - 12.jpg'
    'mui_borok.jpg' = 'Assamese Thali.jpg'
    'morning.jpg'   = 'The Ujjayanta Palace.jpg'
    'evening.jpg'   = 'Neermahal, Tripura Agartala, India.jpg'
    'home.jpg'      = 'Ujjayanta palace is the largest museum in Northeast India.jpg'
  }
  ar = @{
    'tawang.jpg'   = 'The Tawang Monastery.jpg'
    'ziro.jpg'     = 'Apatani Tribe.jpg'
    'losar.jpg'    = 'Apatani Tribe.jpg'
    'gale.jpg'     = 'Apatani Tribe.jpg'
    'shawl_ar.jpg' = 'Apatani Tribe.jpg'
    'thukpa.jpg'   = 'Assamese Thali.jpg'
    'morning.jpg'  = 'The Tawang Monastery.jpg'
    'evening.jpg'  = 'Tsangyang Gyatso birth place.jpg'
    'home.jpg'     = 'Apatani Tribe.jpg'
  }
}

# Fallback Commons names if primary fails (tried in order after primary)
$fallbacks = @{
  'Nohkalikai Falls.jpg' = @('Nohkalikai Falls Meghalaya.jpg', 'Nohkalikai waterfall.jpg')
  'Shillong city view.jpg' = @('Shillong.jpg', 'Police Bazar Shillong.jpg')
  'Umiam Lake Meghalaya.jpg' = @('Umiam Lake.jpg', 'Barapani lake.jpg')
  'Traditional Khasi House.jpg' = @('Khasi house.jpg', 'Traditional house Meghalaya.jpg')
  'Wangala Festival.jpg' = @('Wangala.jpg', 'Garo dance.jpg')
  'Khasi women in traditional dress.jpg' = @('Khasi woman.jpg', 'Khasi traditional dress.jpg')
  'Eri silk.jpg' = @('Assam silk.jpg', 'Silk fabric.jpg')
  'Jadoh.jpg' = @('Pork rice dish.jpg', 'Cooked rice with meat.jpg', 'Assamese Thali.jpg')
  'Imphal city.jpg' = @('Imphal.jpg', 'Kangla Fort Imphal.jpg')
  'Kangla Fort Imphal.jpg' = @('Kangla Fort.jpg', 'Imphal.jpg')
  'Meitei woman in traditional dress.jpg' = @('Manipuri woman.jpg', 'Phanek.jpg', 'Manipuri classical dance.jpg')
  'Manipuri classical dance costume.jpg' = @('Manipuri dance.jpg', 'Raslila Manipur.jpg')
  'Manipuri cuisine.jpg' = @('Northeast Indian food.jpg', 'Fish curry India.jpg', 'Assamese Thali.jpg')
  'Smoked pork.jpg' = @('Pork dish.jpg', 'Cooked pork.jpg', 'Assamese Thali.jpg')
  'Fermented soybean.jpg' = @('Soybean dish.jpg', 'Fermented food.jpg', 'Assamese Thali.jpg')
  'Kohima War Cemetery.jpg' = @('Kohima.jpg', 'Nagaland hills.jpg')
  'Traditional Naga house.jpg' = @('Naga house.jpg', 'Morung Nagaland.jpg')
  'Phawngpui peak.jpg' = @('Phawngpui.jpg', 'Blue Mountain Mizoram.jpg', 'Mizoram hills.jpg')
  'Reiek peak Mizoram.jpg' = @('Reiek.jpg', 'Mizoram landscape.jpg')
  'Vegetable stew.jpg' = @('Vegetable soup.jpg', 'Indian vegetable curry.jpg', 'Assamese Thali.jpg')
  'Aizawl cityscape.jpg' = @('Aizawl.jpg', 'Aizawl Mizoram.jpg')
  'Aizawl night.jpg' = @('Aizawl.jpg', 'Aizawl Mizoram.jpg')
  'Traditional Mizo house.jpg' = @('Mizo house.jpg', 'Aizawl.jpg')
  'Tripuri traditional dress.jpg' = @('Tripura traditional dress.jpg', 'Tribal dress Northeast India.jpg')
  'Fish curry India.jpg' = @('Fish curry.jpg', 'Machher jhol.jpg', 'Assamese Thali.jpg')
  'Agartala city.jpg' = @('Agartala.jpg', 'The Ujjayanta Palace.jpg')
  'Losar Festival.jpg' = @('Losar.jpg', 'Tibetan festival dance.jpg', 'Buddhist festival India.jpg')
  'Thukpa.jpg' = @('Tibetan noodle soup.jpg', 'Noodle soup.jpg', 'Assamese Thali.jpg')
  'Traditional house Arunachal.jpg' = @('Arunachal house.jpg', 'Traditional house Northeast India.jpg')
}

foreach ($code in $maps.Keys) {
  $dir = Join-Path $root "public/assets/curriculum/$code"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Write-Host "`n=== $code ==="
  Copy-Shared $dir
  foreach ($local in $maps[$code].Keys) {
    $dest = Join-Path $dir $local
    $primary = $maps[$code][$local]
    $candidates = @($primary)
    if ($fallbacks.ContainsKey($primary)) { $candidates += $fallbacks[$primary] }
    $ok = $false
    foreach ($name in $candidates) {
      Get-Commons $name $dest
      if (Test-Path $dest) { $ok = $true; break }
    }
    if (-not $ok) {
      # last resort: reuse Assam morning/evening/home/rice for landscape stubs
      $stub = switch -Regex ($local) {
        'morning|evening|home' { Join-Path $asDir 'morning.jpg' }
        default { Join-Path $asDir 'rice.jpg' }
      }
      if (Test-Path $stub) {
        Copy-Item $stub $dest -Force
        Write-Host "  STUB from Assam -> $local"
      }
    }
  }
}

Write-Host "`nDone. Verifying..."
foreach ($code in @('ml','mn','nl','mz','tr','ar')) {
  $dir = Join-Path $root "public/assets/curriculum/$code"
  $n = (Get-ChildItem $dir -File -ErrorAction SilentlyContinue | Measure-Object).Count
  Write-Host "$code : $n files"
}
