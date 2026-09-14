$raw = Get-Content -Raw -Path "vendorsoft_imported_data.json" | ConvertFrom-Json
Write-Host "Customers count: $($raw.data.customers.Count)"

$nonArray = 0
$invalidSeq = 0
foreach ($c in $raw.data.customers) {
    if ($c.subscriptions -isnot [System.Array]) {
        $nonArray++
    }
    if ($c.sequenceNo -is [PSCustomObject] -or $c.sequenceNo -le 0) {
        $invalidSeq++
    }
}
Write-Host "Non-array subscriptions: $nonArray"
Write-Host "Invalid sequenceNo: $invalidSeq"

$dupCodes = $raw.data.items | Group-Object code | Where-Object { $_.Count -gt 1 }
Write-Host "Duplicate item codes: $($dupCodes.Count)"

$sumBal = ($raw.data.customers | Measure-Object -Property currentBalance -Sum).Sum
Write-Host "Total Customer Balance: Rs. $sumBal"

$activeWithPapers = $raw.data.customers | Where-Object { $_.status -eq "active" -and $_.subscriptions.Count -gt 0 }
Write-Host "Active customers with papers: $($activeWithPapers.Count)"
