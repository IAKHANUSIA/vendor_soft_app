# ==============================================================================
# Vendor Soft - WhatsApp 1-Click Auto Dispatcher (PowerShell Desktop Automator)
# ==============================================================================

param(
    [string]$MonthYear = "2026-09",
    [int]$DelaySeconds = 3
)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Vendor Soft - WhatsApp Auto Dispatcher Active" -ForegroundColor Green
Write-Host "  Month: $MonthYear | Delay: $DelaySeconds sec" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan

$wsh = New-Object -ComObject Wscript.Shell

# Check if data file exists
$dataFile = Join-Path $PSScriptRoot "vendorsoft_imported_data.json"
if (-not (Test-Path $dataFile)) {
    Write-Host "⚠️ Data file not found: $dataFile" -ForegroundColor Red
    Exit
}

$jsonData = Get-Content $dataFile -Raw | ConvertFrom-Json
$customers = $jsonData.customers

Write-Host "Loaded $($customers.Count) customers." -ForegroundColor Cyan
Write-Host "Press [Y] to start dispatching or [N] to cancel..." -ForegroundColor Yellow

# Loop and dispatch
$sentCount = 0
foreach ($cust in $customers) {
    $mob = $cust.mobile
    if (-not $mob -or $mob.Length -lt 10) {
        continue
    }

    $cleanMob = $mob -replace "[^0-9]", ""
    if ($cleanMob.Length -gt 10) {
        $cleanMob = $cleanMob.Substring($cleanMob.Length - 10)
    }

    $custName = [uri]::EscapeDataString($cust.name)
    $msg = "PERFECT NEWSPAPER SUPPLIERS%0A----------------------------%0A%F0%9F%93%B0 *Customer Monthly Bill*%0A%F0%9F%91%A4 Name: $custName%0A%F0%9F%93%B8 View Bill: http://localhost:5055/view_bill.html?cust=$custName%26billNo=$($cust.custNo)%26m=$MonthYear%0A----------------------------"
    
    $waUrl = "whatsapp://send?phone=91$cleanMob&text=$msg"

    Write-Host "[$($sentCount + 1)] Sending to: $($cust.name) ($cleanMob)..." -ForegroundColor Green
    Start-Process $waUrl
    Start-Sleep -Seconds $DelaySeconds

    # Automatically press Enter in WhatsApp Desktop window
    $wsh.SendKeys("{ENTER}")
    Start-Sleep -Milliseconds 800

    $sentCount++
}

Write-Host "🎉 Finished! Successfully dispatched $sentCount bills." -ForegroundColor Green
