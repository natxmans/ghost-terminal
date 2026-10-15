# Fabrique le paquet du jeu pour itch.io / Game Jolt : dist/ghost-terminal-web.zip
# (index.html a la racine du ZIP, comme le demandent ces plateformes).
# Utilisation : powershell -ExecutionPolicy Bypass -File outils\paquet-itch.ps1

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$racine = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $racine "dist"
New-Item -ItemType Directory -Force $dist | Out-Null

$fichiers = @(
  "index.html", "style.css", "security.js", "icons.js", "filtre.js", "mots.js", "snippets.js", "highlight.js",
  "effects.js", "story.js", "survie.js", "app.js", "sw.js", "manifest.webmanifest"
)
$fichiers += Get-ChildItem (Join-Path $racine "icons") -File | ForEach-Object { "icons/" + $_.Name }

$zip = Join-Path $dist "ghost-terminal-web.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }

# On ecrit le ZIP a la main pour avoir des chemins avec "/" (Compress-Archive met des "\",
# que certains sites decompressent mal).
$flux = [System.IO.File]::Open($zip, [System.IO.FileMode]::Create)
$archive = New-Object System.IO.Compression.ZipArchive($flux, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($f in $fichiers) {
    $source = Join-Path $racine $f
    if (-not (Test-Path $source)) { throw "Fichier manquant : $f" }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $source, $f, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally {
  $archive.Dispose()
  $flux.Dispose()
}

$taille = [math]::Round((Get-Item $zip).Length / 1KB)
"Paquet pret : $zip ($taille Ko, $($fichiers.Count) fichiers)"
