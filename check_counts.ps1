$connStr = 'Provider=Microsoft.ACE.OLEDB.16.0;Data Source=D:\Vendor_Soft\Data\C012627.accdb'
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

function Get-TableCount($t) {
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT COUNT(*) FROM [$t]"
    $cnt = $cmd.ExecuteScalar()
    Write-Host "$t count = $cnt"
}

Get-TableCount "Com_mast"
Get-TableCount "Item_mast"
Get-TableCount "Salesman_Master"
Get-TableCount "Collect_Master"
Get-TableCount "Ac_Mast"
Get-TableCount "Cust_Child"
Get-TableCount "WA_App_detail"

$conn.Close()
