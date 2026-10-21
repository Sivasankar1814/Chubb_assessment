# Builds the project (skipping tests) and starts every service in its own window, in dependency order.
# Usage:  .\scripts\start-all.ps1            (H2, in-memory)
#         .\scripts\start-all.ps1 -Profile mysql
param([string]$Profile = "")

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
& "$root\mvnw.cmd" -q -DskipTests install
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Build failed" }
Pop-Location

$extra = @()
if ($Profile) { $extra += "--spring.profiles.active=$Profile" }

function Start-Service-Window($name, $waitSeconds) {
    $jar = "$root\$name\target\$name-1.0.0.jar"
    Start-Process -FilePath "java" -ArgumentList (@("-jar", $jar) + $extra) -WindowStyle Minimized
    Write-Host "Started $name"
    Start-Sleep -Seconds $waitSeconds
}

Start-Service-Window "user-service" 8
Start-Service-Window "claim-service" 5
Start-Service-Window "workload-service" 5
Start-Service-Window "api-gateway" 0

Write-Host "Gateway Swagger: http://localhost:8080/swagger-ui.html"
