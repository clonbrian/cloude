<#
    update-skill.ps1  -  unzip -> overwrite -> verify -> commit -> push

    Usage:
        .\update-skill.ps1
        .\update-skill.ps1 -Zip C:\path\to\bonus-event-ops.zip
        .\update-skill.ps1 -DryRun

    Picks the newest bonus-event-ops*.zip in Downloads automatically.
    ASCII-only on purpose: Windows PowerShell 5.1 misreads UTF-8 without BOM.
#>
param(
    [string]$Zip,
    [string]$Repo = "$env:USERPROFILE\Desktop\Claude",
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
function Say($msg, $color = 'Gray') { Write-Host $msg -ForegroundColor $color }

if (-not $Zip) {
    $cand = Get-ChildItem "$env:USERPROFILE\Downloads\bonus-event-ops*.zip" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $cand) { Say "No bonus-event-ops*.zip found in Downloads. Use -Zip to specify." Red; exit 1 }
    $Zip = $cand.FullName
}
if (-not (Test-Path $Zip))         { Say "File not found: $Zip" Red; exit 1 }
if (-not (Test-Path "$Repo\.git")) { Say "Not a git repo: $Repo" Red; exit 1 }

Say "zip  : $Zip"  Cyan
Say "repo : $Repo" Cyan

$tmp = Join-Path $env:TEMP ("skillupd_" + [guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

$code = 0
try {
    Expand-Archive -Path $Zip -DestinationPath $tmp -Force
    $src  = Join-Path $tmp 'bonus-event-ops'
    $dest = Join-Path $Repo '.claude\skills\bonus-event-ops'
    if (-not (Test-Path $src))  { Say "zip has no bonus-event-ops folder - wrong file?" Red; $code = 1; return }
    if (-not (Test-Path $dest)) { Say "Destination missing: $dest" Red; $code = 1; return }

    # Resolve to the canonical long path first: $env:TEMP can be an 8.3 short
    # name (BRIANW~1) while FullName is expanded (BrianWuX1C), which breaks
    # naive Substring arithmetic on the prefix.
    $srcRoot = (Get-Item $src).FullName
    $changed = @()
    Get-ChildItem $srcRoot -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($srcRoot.Length + 1)
        $old = Join-Path $dest $rel
        $newHash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
        $oldHash = if (Test-Path $old) { (Get-FileHash $old -Algorithm SHA256).Hash } else { '' }
        if ($newHash -ne $oldHash) {
            $tag = if ($oldHash) { 'MOD' } else { 'NEW' }
            $changed += $rel
            Say ("  [{0}] {1}" -f $tag, $rel) White
        }
    }

    if ($changed.Count -eq 0) { Say "`nNothing changed. No commit needed." Green; return }
    Say "`n$($changed.Count) file(s) changed" Yellow

    if ($DryRun) { Say "[DryRun] stopping here - nothing copied, nothing committed." Magenta; return }

    Copy-Item "$srcRoot\*" $dest -Recurse -Force
    Say "Files copied." Green

    # Clean up COMMIT_MSG.txt if an earlier manual unzip dropped it in the
    # skills folder. It lives at the zip root and never belongs in the repo.
    $stray = Join-Path $Repo '.claude\skills\COMMIT_MSG.txt'
    if (Test-Path $stray) { Remove-Item $stray -Force; Say "Removed stray COMMIT_MSG.txt" Yellow }

    $msgFile = Join-Path $tmp 'COMMIT_MSG.txt'
    if (-not (Test-Path $msgFile)) {
        $msgFile = Join-Path $tmp 'auto_msg.txt'
        $body = "skill: update bonus-event-ops`n`nChanged files:`n" +
                (($changed | ForEach-Object { "- $_" }) -join "`n")
        [IO.File]::WriteAllText($msgFile, $body, (New-Object Text.UTF8Encoding $false))
    }

    Push-Location $Repo
    try {
        git add -- ".claude/skills/bonus-event-ops"
        $staged = git diff --cached --name-only
        if (-not $staged) { Say "git reports no staged changes. Skipping commit." Yellow; return }

        Say "`nCommit message:" Yellow
        Get-Content $msgFile -Encoding UTF8 | ForEach-Object { Say "  $_" DarkGray }

        git -c "core.quotepath=false" commit -F $msgFile
        if ($LASTEXITCODE -ne 0) { Say "commit failed" Red; $code = 1; return }

        # Flag anything else pending so it does not sit unnoticed
        $other = git status --porcelain | Where-Object { $_ -notmatch 'skills/bonus-event-ops' }
        if ($other) {
            Say "`nOther uncommitted changes in this repo (not touched by this script):" Yellow
            $other | ForEach-Object { Say "  $_" DarkYellow }
        }

        git push
        if ($LASTEXITCODE -ne 0) {
            Say "`npush failed - the commit exists, run 'git push' again later." Red
            $code = 1; return
        }
        Say "`nDone." Green
        git log --oneline -1
    }
    finally { Pop-Location }
}
finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
exit $code
