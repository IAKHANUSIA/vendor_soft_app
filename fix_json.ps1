$content = [System.IO.File]::ReadAllText("$PSScriptRoot\vendorsoft_imported_data.json")
$fixed = $content.Replace('"id":  13,`r`n                                    "monthlyRate":  0,`r`n                                    "defaultRate":  6,`r`n                                    "sundayRate":  0,`r`n                                    "name":  "MINT",`r`n                                    "type":  "daily",`r`n                                    "commRate":  15,`r`n                                    "code":  "MINT"', '"id":  13,`r`n                                    "monthlyRate":  0,`r`n                                    "defaultRate":  6,`r`n                                    "sundayRate":  0,`r`n                                    "name":  "MINT (2)",`r`n                                    "type":  "daily",`r`n                                    "commRate":  15,`r`n                                    "code":  "MINT-2"')

if ($content -eq $fixed) {
    # Try regex
    $fixed = [System.Text.RegularExpressions.Regex]::Replace($content, '(?s)("id":\s*13,.*?"code":\s*)"MINT"', '${1}"MINT-2"')
}

[System.IO.File]::WriteAllText("$PSScriptRoot\vendorsoft_imported_data.json", $fixed, [System.Text.Encoding]::UTF8)
Write-Host "Updated item 13 code in vendorsoft_imported_data.json"
