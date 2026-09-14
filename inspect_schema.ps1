$connStr = 'Provider=Microsoft.ACE.OLEDB.16.0;Data Source=D:\Vendor_Soft\Data\C012627.accdb'
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

function InspectTable($t) {
    Write-Host "`n=== TABLE: $t ==="
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT TOP 1 * FROM [$t]"
    $reader = $cmd.ExecuteReader()
    $table = $reader.GetSchemaTable()
    foreach ($row in $table.Rows) {
        Write-Host "$($row['ColumnName']) ($($row['DataType'].Name))"
    }
    $reader.Close()
}

InspectTable "Com_mast"
InspectTable "Item_mast"
InspectTable "Collect_Master"
InspectTable "Salesman_Master"
InspectTable "Ac_Mast"

$conn.Close()
