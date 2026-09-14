$connStr = 'Provider=Microsoft.ACE.OLEDB.16.0;Data Source=D:\Vendor_Soft\Data\C012627.accdb'
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
try {
    $conn.Open()
    Write-Host "SUCCESS: Connected to C012627.accdb!"
    $schema = $conn.GetSchema('Tables')
    $tables = $schema | Where-Object { $_.TABLE_TYPE -eq 'TABLE' } | Select-Object -ExpandProperty TABLE_NAME
    Write-Host "TABLES:"
    $tables | ForEach-Object { Write-Host "- $_" }
    $conn.Close()
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}
