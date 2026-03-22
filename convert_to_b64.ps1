$logosDir = "logos"
$outputFile = "logos_temp.txt"
if (Test-Path $outputFile) { Remove-Item $outputFile }

$logos = Get-ChildItem $logosDir -File | Where-Object { $_.Extension -match "png|jpg|jpeg" }
$results = @()

foreach ($logo in $logos) {
    try {
        $bytes = [IO.File]::ReadAllBytes($logo.FullName)
        $b64 = [Convert]::ToBase64String($bytes)
        $ext = $logo.Extension.ToLower()
        $mime = if ($ext -eq ".png") { "image/png" } else { "image/jpeg" }
        $results += "$($logo.Name)|$mime|$b64"
    } catch {
        Write-Warning "No se pudo procesar $($logo.Name): $_"
    }
}

$results | Out-File -FilePath $outputFile -Encoding utf8
Write-Host "Proceso completado. Datos guardados en $outputFile"
