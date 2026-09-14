$connStr = 'Provider=Microsoft.ACE.OLEDB.16.0;Data Source=D:\Vendor_Soft\Data\C012627.accdb'
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT TOP 1 * FROM [Cust_Child]"
$reader = $cmd.ExecuteReader()
$table = $reader.GetSchemaTable()
Write-Host "=== TABLE: Cust_Child ==="
foreach ($row in $table.Rows) {
    Write-Host "$($row['ColumnName']) ($($row['DataType'].Name))"
}
$reader.Close()

$cmd2 = $conn.CreateCommand()
$cmd2.CommandText = "SELECT TOP 3 * FROM [Cust_Child]"
$r2 = $cmd2.ExecuteReader()
while ($r2.Read()) {
    Write-Host "Row: cust_no=$($r2['cust_no']), item_code=$($r2['item_code']), qty=$($r2['qty'])"
}
$r2.Close()

$conn.Close()
