# Read-only A2 preflight. Run from the repository root with:
#   & .\scripts\payment_browser_versions.ps1
# These executable versions are discovery hints, NOT evidence that a payment
# was tested in a browser. Confirm the version in each browser's About page.
$ErrorActionPreference = 'Stop'

# Avoid Get-Command's PATH aliases: Windows can install each browser per-user
# or per-machine. Do not print local filesystem paths into review evidence.
$browsers = @(
    @{ Name = 'Chrome Stable'; Paths = @(
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "$env:PROGRAMFILES\Google\Chrome\Application\chrome.exe",
        "${env:PROGRAMFILES(X86)}\Google\Chrome\Application\chrome.exe"
    ) },
    @{ Name = 'Firefox Release'; Paths = @(
        "$env:PROGRAMFILES\Mozilla Firefox\firefox.exe",
        "${env:PROGRAMFILES(X86)}\Mozilla Firefox\firefox.exe",
        "$env:LOCALAPPDATA\Mozilla Firefox\firefox.exe"
    ) },
    @{ Name = 'Edge Stable'; Paths = @(
        "${env:PROGRAMFILES(X86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:PROGRAMFILES\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
    ) }
)

# OSVersion is safe to display; no environment file, browser profile, Stripe
# setting, URL, cookie or other payment material is opened by this script.
Write-Output "Windows build (process view): $([System.Environment]::OSVersion.Version)"
foreach ($browser in $browsers) {
    $found = @($browser.Paths | Where-Object {
        $_ -and (Test-Path -LiteralPath $_ -PathType Leaf)
    })
    if ($found.Count -eq 0) {
        Write-Output "$($browser.Name): not found in the usual install locations; install from the vendor or locate it manually."
        continue
    }
    foreach ($path in $found) {
        $file = Get-Item -LiteralPath $path
        Write-Output "$($browser.Name) candidate: $($file.VersionInfo.ProductVersion)"
    }
}
Write-Output 'Confirm Stable/Release channel and full version inside each browser before testing.'