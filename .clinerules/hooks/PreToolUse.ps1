# Cline PreToolUse hook (Windows). Delegates to the shared Node guard.
try {
    $OutputEncoding = New-Object System.Text.UTF8Encoding $false
    $guard = Join-Path $PSScriptRoot '..\..\.cline\guards\secret-guard.mjs'

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Output '{"cancel": true, "errorMessage": "Secret guard needs Node.js on PATH. Install Node 22 or fix PATH, then retry."}'
        exit 0
    }

    $payload = [Console]::In.ReadToEnd()
    $result = ($payload | & node $guard) -join ''
    if ([string]::IsNullOrWhiteSpace($result)) { throw 'guard returned no output' }
    Write-Output $result
}
catch {
    $msg = $_.Exception.Message -replace '["\\]', "'"
    Write-Output ('{"cancel": true, "errorMessage": "Secret guard failed on Windows: ' + $msg + '"}')
}
exit 0
