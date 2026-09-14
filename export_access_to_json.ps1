param(
    [string]$dbPath = "D:\Vendor_Soft\Data\C012627.accdb",
    [string]$outputPath = "C:\Users\Admin\.gemini\antigravity-ide\scratch\vendor_soft_app\vendorsoft_imported_data.json"
)

Write-Host "Connecting to Access Database: $dbPath ..."
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
try {
    $conn.Open()
} catch {
    Write-Host "ERROR: Could not open database. $($_.Exception.Message)"
    exit 1
}

$data = @{
    exportDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    appName = "VendorSoft"
    version = "1.0"
    source = $dbPath
    data = @{
        firms = @()
        items = @()
        routes = @()
        salesmen = @()
        collectionMen = @()
        customers = @()
        vacations = @()
        bills = @()
        payments = @()
    }
}

# 1. Firm Profile (Com_mast)
Write-Host "1. Extracting Company Profile (Com_mast)..."
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT TOP 1 * FROM [Com_mast]"
$r = $cmd.ExecuteReader()
if ($r.Read()) {
    $firm = @{
        id = "primary"
        name = if ($r["com_name"] -ne [DBNull]::Value) { $r["com_name"].ToString().Trim() } else { "Vendor Soft Agency" }
        ownerName = if ($r["Prop_name"] -ne [DBNull]::Value) { $r["Prop_name"].ToString().Trim() } else { "" }
        address = "$($r['com_add1']) $($r['com_add2']) $($r['city'])".Trim()
        phone = if ($r["phone1"] -ne [DBNull]::Value) { $r["phone1"].ToString().Trim() } else { "" }
        upiId = if ($r["upid"] -ne [DBNull]::Value -and -not [string]::IsNullOrWhiteSpace($r["upid"].ToString())) { $r["upid"].ToString().Trim() } else { "vendor@upi" }
        gstNo = if ($r["Reg_no"] -ne [DBNull]::Value) { $r["Reg_no"].ToString().Trim() } else { "" }
    }
    $data.data.firms += $firm
}
$r.Close()

# 2. Items / Newspapers (Item_mast)
Write-Host "2. Extracting Newspapers & Items (Item_mast)..."
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT * FROM [Item_mast] ORDER BY [Item_code]"
$r = $cmd.ExecuteReader()
$seenItemCodes = @{}
while ($r.Read()) {
    $itemCode = [int]$r["Item_code"]
    $itemName = if ($r["Item_name"] -ne [DBNull]::Value) { $r["Item_name"].ToString().Trim() } else { "Item $itemCode" }
    $sName = if ($r["Sname"] -ne [DBNull]::Value) { $r["Sname"].ToString().Trim() } else { "IT$itemCode" }
    
    if ($seenItemCodes.ContainsKey($sName)) {
        $sName = "$sName-$itemCode"
        if ($itemName -eq "MINT" -and $itemCode -eq 13) {
            $itemName = "MINT (2)"
        }
    }
    $seenItemCodes[$sName] = $true

    # Day 1 = Sunday, Day 2 = Monday, ... Day 7 = Saturday
    $mrp1 = if ($r["mrp1"] -ne [DBNull]::Value -and [double]$r["mrp1"] -gt 0) { [double]$r["mrp1"] } else { 5.0 }
    $mrp2 = if ($r["mrp2"] -ne [DBNull]::Value -and [double]$r["mrp2"] -gt 0) { [double]$r["mrp2"] } else { $mrp1 }
    $mrp3 = if ($r["mrp3"] -ne [DBNull]::Value -and [double]$r["mrp3"] -gt 0) { [double]$r["mrp3"] } else { $mrp2 }
    $mrp4 = if ($r["mrp4"] -ne [DBNull]::Value -and [double]$r["mrp4"] -gt 0) { [double]$r["mrp4"] } else { $mrp2 }
    $mrp5 = if ($r["mrp5"] -ne [DBNull]::Value -and [double]$r["mrp5"] -gt 0) { [double]$r["mrp5"] } else { $mrp2 }
    $mrp6 = if ($r["mrp6"] -ne [DBNull]::Value -and [double]$r["mrp6"] -gt 0) { [double]$r["mrp6"] } else { $mrp2 }
    $mrp7 = if ($r["mrp7"] -ne [DBNull]::Value -and [double]$r["mrp7"] -gt 0) { [double]$r["mrp7"] } else { $mrp2 }

    $ptr1 = if ($r["ptr1"] -ne [DBNull]::Value -and [double]$r["ptr1"] -gt 0) { [double]$r["ptr1"] } else { [Math]::Round($mrp1 * 0.7, 2) }
    $ptr2 = if ($r["ptr2"] -ne [DBNull]::Value -and [double]$r["ptr2"] -gt 0) { [double]$r["ptr2"] } else { [Math]::Round($mrp2 * 0.7, 2) }
    $ptr3 = if ($r["ptr3"] -ne [DBNull]::Value -and [double]$r["ptr3"] -gt 0) { [double]$r["ptr3"] } else { [Math]::Round($mrp3 * 0.7, 2) }
    $ptr4 = if ($r["ptr4"] -ne [DBNull]::Value -and [double]$r["ptr4"] -gt 0) { [double]$r["ptr4"] } else { [Math]::Round($mrp4 * 0.7, 2) }
    $ptr5 = if ($r["ptr5"] -ne [DBNull]::Value -and [double]$r["ptr5"] -gt 0) { [double]$r["ptr5"] } else { [Math]::Round($mrp5 * 0.7, 2) }
    $ptr6 = if ($r["ptr6"] -ne [DBNull]::Value -and [double]$r["ptr6"] -gt 0) { [double]$r["ptr6"] } else { [Math]::Round($mrp6 * 0.7, 2) }
    $ptr7 = if ($r["ptr7"] -ne [DBNull]::Value -and [double]$r["ptr7"] -gt 0) { [double]$r["ptr7"] } else { [Math]::Round($mrp7 * 0.7, 2) }

    $data.data.items += @{
        id = $itemCode
        code = $sName
        name = $itemName
        type = "daily"
        defaultRate = $mrp2
        sundayRate = $mrp1
        monthlyRate = 0
        commRate = 15
        status = "active"
        dayRates = @{
            sun = @{ sale = $mrp1; purchase = $ptr1 }
            mon = @{ sale = $mrp2; purchase = $ptr2 }
            tue = @{ sale = $mrp3; purchase = $ptr3 }
            wed = @{ sale = $mrp4; purchase = $ptr4 }
            thu = @{ sale = $mrp5; purchase = $ptr5 }
            fri = @{ sale = $mrp6; purchase = $ptr6 }
            sat = @{ sale = $mrp7; purchase = $ptr7 }
        }
    }
}
$r.Close()

# 3. Salesmen (Salesman_Master)
Write-Host "3. Extracting Salesmen (Salesman_Master)..."
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT * FROM [Salesman_Master] WHERE [Salesman_code] > 0 ORDER BY [Salesman_code]"
$r = $cmd.ExecuteReader()
while ($r.Read()) {
    $smCode = [int]$r["Salesman_code"]
    $smName = if ($r["Salesman_name"] -ne [DBNull]::Value) { $r["Salesman_name"].ToString().Trim() } else { "Salesman $smCode" }
    $mobile = if ($r["Mobile"] -ne [DBNull]::Value) { $r["Mobile"].ToString().Trim() } else { "" }
    $data.data.salesmen += @{
        id = $smCode
        name = $smName
        mobile = $mobile
        commission = ""
        notes = ""
    }
}
$r.Close()

# 4. Collection Men (Collect_Master)
Write-Host "4. Extracting Collection Staff (Collect_Master)..."
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT * FROM [Collect_Master] WHERE [collection_code] > 0 ORDER BY [collection_code]"
$r = $cmd.ExecuteReader()
while ($r.Read()) {
    $cmCode = [int]$r["collection_code"]
    $cmName = if ($r["collection_name"] -ne [DBNull]::Value) { $r["collection_name"].ToString().Trim() } else { "Collection Staff $cmCode" }
    $mobile = if ($r["mobile"] -ne [DBNull]::Value) { $r["mobile"].ToString().Trim() } else { "" }
    $data.data.collectionMen += @{
        id = $cmCode
        name = $cmName
        mobile = $mobile
        commission = ""
        notes = ""
    }
}
$r.Close()

# 5. Delivery Routes (Lines A to H from Salescode)
Write-Host "5. Creating Delivery Lines (Lines A to H)..."
$routeLetters = @("A", "B", "C", "D", "E", "F", "G", "H")
$routeMap = @{}
$rId = 1
foreach ($let in $routeLetters) {
    $routeMap[$let] = $rId
    $defaultSm = switch ($let) {
        "A" { 1 }
        "B" { 2 }
        "C" { 3 }
        "D" { 1 }
        "E" { 7 }
        "F" { 6 }
        "G" { 1 }
        "H" { 13 }
        Default { 1 }
    }
    $data.data.routes += @{
        id = $rId
        code = "L-$let"
        name = "લાઇન $let (Line $let)"
        salesmanId = $defaultSm
        collectionManId = $rId
    }
    $rId++
}
# General line for others
$routeMap["OTHER"] = $rId
$data.data.routes += @{
    id = $rId
    code = "L-GEN"
    name = "સામાન્ય લાઇન (General Line)"
    salesmanId = 1
    collectionManId = 1
}

# 6. Customer Subscriptions Mapping (Cust_Child) with EXACT Day Mapping
Write-Host "6. Mapping Subscriptions from Cust_Child with day1..day7 to sun..sat..."
# Day 1 = Sunday, Day 2 = Monday, Day 3 = Tuesday, Day 4 = Wednesday, Day 5 = Thursday, Day 6 = Friday, Day 7 = Saturday
$custSubMap = @{}
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT cust_no, item_code, day1, day2, day3, day4, day5, day6, day7 FROM [Cust_Child] WHERE LCase(Trim([status])) = 'yes' ORDER BY cust_no, item_code"
$r = $cmd.ExecuteReader()

while ($r.Read()) {
    $cNo = [int]$r["cust_no"]
    $itCode = [int]$r["item_code"]

    $days = @()
    if ($r["day1"] -eq $true) { $days += "sun" }  # રવિવાર
    if ($r["day2"] -eq $true) { $days += "mon" }  # સોમવાર
    if ($r["day3"] -eq $true) { $days += "tue" }  # મંગળવાર
    if ($r["day4"] -eq $true) { $days += "wed" }  # બુધવાર
    if ($r["day5"] -eq $true) { $days += "thu" }  # ગુરુવાર
    if ($r["day6"] -eq $true) { $days += "fri" }  # શુક્રવાર
    if ($r["day7"] -eq $true) { $days += "sat" }  # શનિવાર

    # Fallback to all days if none checked
    if ($days.Count -eq 0) {
        $days = @("sun", "mon", "tue", "wed", "thu", "fri", "sat")
    }

    if (-not $custSubMap.ContainsKey($cNo)) {
        $custSubMap[$cNo] = @{}
    }
    $custSubMap[$cNo]["$itCode"] = $days
}
$r.Close()

# 7. Customers (Ac_Mast WHERE status = 'Yes')
Write-Host "7. Extracting Customers (ONLY status = 'Yes')..."
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT * FROM [Ac_Mast] WHERE [ac_type] = 'Customer' AND LCase(Trim([status])) = 'yes' ORDER BY [salescode], [vouch_no], [cust_no]"
$r = $cmd.ExecuteReader()

$importedCustCount = 0
while ($r.Read()) {
    $cNo = [int]$r["cust_no"]
    $cName = if ($r["custName"] -ne [DBNull]::Value) { $r["custName"].ToString().Trim() } else { "Customer $cNo" }
    $add1 = if ($r["add1"] -ne [DBNull]::Value) { $r["add1"].ToString().Trim() } else { "" }
    $add2 = if ($r["add2"] -ne [DBNull]::Value) { $r["add2"].ToString().Trim() } else { "" }
    $city = if ($r["city"] -ne [DBNull]::Value) { $r["city"].ToString().Trim() } else { "" }
    $address = "$add1 $add2 $city".Trim()

    $mobile = if ($r["mobile_no"] -ne [DBNull]::Value) { $r["mobile_no"].ToString().Trim() } else { "" }
    $salesmanId = if ($r["sm_code"] -ne [DBNull]::Value -and [int]$r["sm_code"] -gt 0) { [int]$r["sm_code"] } else { 1 }
    $collManId = if ($r["cm_code"] -ne [DBNull]::Value -and [int]$r["cm_code"] -gt 0) { [int]$r["cm_code"] } else { 1 }

    $salescode = if ($r["salescode"] -ne [DBNull]::Value) { $r["salescode"].ToString().Trim() } else { "" }
    $areacode = if ($r["areacode"] -ne [DBNull]::Value) { $r["areacode"].ToString().Trim() } else { "" }

    # Route from salescode prefix (A, B, C...)
    $lineLetter = if ($salescode.Length -gt 0) { $salescode.Substring(0, 1).ToUpper() } else { "OTHER" }
    $routeId = if ($routeMap.ContainsKey($lineLetter)) { $routeMap[$lineLetter] } else { $routeMap["OTHER"] }

    # Delivery sequence from salescode digits or vouch_no
    $deliverySeq = 1
    $scMatch = [System.Text.RegularExpressions.Regex]::Match($salescode, '\d+')
    if ($scMatch.Success) {
        $deliverySeq = [int]$scMatch.Value
    } elseif ($r["vouch_no"] -ne [DBNull]::Value -and [int]$r["vouch_no"] -gt 0) {
        $deliverySeq = [int]$r["vouch_no"]
    }

    # Collection sequence from areacode digits or deliverySeq
    $collSeq = $deliverySeq
    $acMatch = [System.Text.RegularExpressions.Regex]::Match($areacode, '\d+')
    if ($acMatch.Success) {
        $collSeq = [int]$acMatch.Value
    }

    $openBal = if ($r["open_bal"] -ne [DBNull]::Value) { [double]$r["open_bal"] } else { 0.0 }
    $clBal = if ($r["cl_balance"] -ne [DBNull]::Value) { [double]$r["cl_balance"] } else { $openBal }
    $delCharge = if ($r["del_charge"] -ne [DBNull]::Value) { [double]$r["del_charge"] } else { 0.0 }

    $fixBillStr = if ($r["Fix_bill"] -ne [DBNull]::Value) { $r["Fix_bill"].ToString().Trim() } else { "No" }
    $billingType = if ($fixBillStr -eq "Yes") { "fixed" } else { "daily" }

    # Subscriptions object { "1": ["sun", "mon"...], "4": ["sun"] }
    $subsObj = if ($custSubMap.ContainsKey($cNo)) {
        $custSubMap[$cNo]
    } else {
        @{}
    }

    $custObj = [PSCustomObject]@{
        id = $cNo
        code = "C-$cNo"
        name = $cName
        routeId = $routeId
        salesmanId = $salesmanId
        collectionManId = $collManId
        sequenceNo = $deliverySeq
        collectionSequence = $collSeq
        address = $address
        mobile = $mobile
        whatsapp = $mobile
        subscriptions = $subsObj
        openingBalance = $openBal
        currentBalance = $clBal
        delCharge = $delCharge
        billingType = $billingType
        fixedMonthlyAmount = 0.0
        status = "active"
    }

    $data.data.customers += $custObj
    $importedCustCount++
}
$r.Close()
$conn.Close()

Write-Host "Converting data to JSON..."
$jsonContent = $data | ConvertTo-Json -Depth 10

Write-Host "Saving to JSON: $outputPath ..."
[System.IO.File]::WriteAllText($outputPath, $jsonContent, [System.Text.Encoding]::UTF8)

Write-Host "`nSUCCESS! Extracted:"
Write-Host "- $($data.data.firms.Count) Firm Profile"
Write-Host "- $($data.data.items.Count) Newspapers/Items"
Write-Host "- $($data.data.routes.Count) Delivery Lines"
Write-Host "- $($data.data.salesmen.Count) Hawkers / Salesmen"
Write-Host "- $($data.data.collectionMen.Count) Collection Men"
Write-Host "- $importedCustCount Active Customers (status='Yes')"
