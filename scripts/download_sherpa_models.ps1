# Download Sherpa ONNX streaming English model into Flutter assets.
#   powershell -ExecutionPolicy Bypass -File scripts/download_sherpa_models.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$OutDir = Join-Path $RepoRoot "apps\flutter\assets\models"
$Name = "sherpa-onnx-streaming-zipformer-en-2023-06-26"
$Url = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/$Name.tar.bz2"
$Tar = Join-Path $env:TEMP "$Name.tar.bz2"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$Dest = Join-Path $OutDir $Name

if (Test-Path (Join-Path $Dest "tokens.txt")) {
  Write-Host "Model already present: $Dest"
  exit 0
}

Write-Host "Downloading $Name ..."
Invoke-WebRequest -Uri $Url -OutFile $Tar -UseBasicParsing

Write-Host "Extracting ..."
Push-Location $OutDir
try {
  tar -xjf $Tar
} finally {
  Pop-Location
}

$tokens = Join-Path $Dest "tokens.txt"
if (-not (Test-Path $tokens)) {
  Write-Error "Extract failed - expected tokens.txt under $Dest"
  exit 1
}

Write-Host "OK: $Dest"
Write-Host "Next: cd apps/flutter then flutter pub get and flutter run"
