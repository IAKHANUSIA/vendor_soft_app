using Microsoft.Extensions.FileProviders;
using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var fileOptions = new FileServerOptions
{
    FileProvider = new PhysicalFileProvider(Directory.GetCurrentDirectory()),
    RequestPath = "",
    EnableDefaultFiles = true
};
fileOptions.DefaultFilesOptions.DefaultFileNames.Clear();
fileOptions.DefaultFilesOptions.DefaultFileNames.Add("index.html");

app.UseFileServer(fileOptions);

// Endpoint to directly trigger Access DB extraction or return imported data
app.MapPost("/api/import-access", async (HttpContext context) =>
{
    var jsonPath = Path.Combine(Directory.GetCurrentDirectory(), "vendorsoft_imported_data.json");

    // Check if query has a custom path
    var customDb = context.Request.Query["path"].ToString();
    var scriptArgs = "-ExecutionPolicy Bypass -File .\\export_access_to_json.ps1";
    if (!string.IsNullOrWhiteSpace(customDb))
    {
        scriptArgs += $" -dbPath \"{customDb}\"";
    }

    try
    {
        var psi = new ProcessStartInfo("powershell", scriptArgs)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        var p = Process.Start(psi);
        if (p != null)
        {
            await p.WaitForExitAsync();
        }

        if (File.Exists(jsonPath))
        {
            var content = await File.ReadAllTextAsync(jsonPath);
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(content);
            return;
        }

        context.Response.StatusCode = 500;
        await context.Response.WriteAsync("{\"error\": \"Extraction failed\"}");
    }
    catch (Exception ex)
    {
        context.Response.StatusCode = 500;
        await context.Response.WriteAsync($"{{\"error\": \"{ex.Message}\"}}");
    }
});

Console.WriteLine("==================================================");
Console.WriteLine("  Vendor Soft (વેન્ડર સોફ્ટ) Local Server Active");
Console.WriteLine("  URL: http://localhost:5055");
Console.WriteLine("  Press Ctrl+C to stop the server.");
Console.WriteLine("==================================================");

app.Run("http://localhost:5055");
