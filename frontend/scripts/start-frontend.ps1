# Starts the Angular dev server on http://localhost:4200. It proxies /api to the gateway on :8080,
# so start the backend first (..\backend-claim-management\scripts\start-all.ps1).
# Usage:  .\scripts\start-frontend.ps1   (from the frontend folder)
$root = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $default = "C:\Program Files\nodejs"
    if (Test-Path "$default\node.exe") { $env:Path = "$default;$env:Path" }
    else { throw "Node.js was not found. Install a supported LTS (see the README.md at the repository root) and reopen the terminal." }
}

Push-Location $root
try {
    if (-not (Test-Path "node_modules")) { npm ci }
    npm start
}
finally {
    Pop-Location
}
