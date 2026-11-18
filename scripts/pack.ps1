# pack.ps1 — build, verify and install a LOCAL DSH plugin into the desktop profile.
#
# Generic version of dsh-panel-pins' proven pipeline. Copy into your plugin's
# scripts\ directory and edit the CONFIG block below.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\pack.ps1 [-SkipInstall]
#
# WHY THIS EXISTS (every step guards a real past accident):
#   - A manual unpack+copy once flattened the tgz's lib/ + locale/ subdirectories
#     into the package root while package.json exports still pointed at
#     ./lib/client.js — the host verification then failed and the plugin never
#     activated. Steps 2 & 4 verify every exports target against the tarball
#     AND the installed tree, making that class of accident impossible.
#   - pnpm-lock.yaml holds dozens of integrity lines; a whole-file regex once
#     risked corrupting other packages. Step 5b is block-scoped
#     ('  <name>@file:' opens a block, first non-indented line closes it).
#   - PS 5.1 turns npm's stderr notices into NativeCommandError under
#     $ErrorActionPreference='Stop'. The npm call is routed through cmd.
#
# AFTER INSTALL: restart the DeepSeek Harness desktop app — browser-half ES
# modules are cached; only the host half hot-reloads via the patch-file touch.

param(
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'

# ---- CONFIG: edit these three lines per plugin ------------------------------
$PluginName = 'dsh-panel-pins'                                   # package name
$PluginDir  = Split-Path -Parent $PSScriptRoot                  # repo root = parent of scripts\
$DistDir    = 'D:\code\.dist'                                   # where tgz files land
# Profile paths are standard; change only if your setup differs.
$Profile    = Join-Path $env:USERPROFILE '.dsh\profiles\desktop'
# -----------------------------------------------------------------------------

$Dest      = Join-Path $Profile ('node_modules\' + $PluginName)
$Node      = 'C:\Users\wanglong\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'

# ---- read package version ---------------------------------------------------
$pkg = Get-Content (Join-Path $PluginDir 'package.json') -Raw | ConvertFrom-Json
$version = $pkg.version
$Tgz        = Join-Path $DistDir ("local-{0}-{1}.tgz" -f $PluginName, $version)
$TgzNpmName = Join-Path $DistDir ("{0}-{1}.tgz" -f $PluginName, $version)   # npm pack's own output name
Write-Host "== $PluginName v$version ==" -ForegroundColor Cyan

# ---- 1. npm pack (via cmd: npm's stderr notices must not become PS errors) --
if (-not (Test-Path $DistDir)) { New-Item -ItemType Directory -Force -Path $DistDir | Out-Null }
Push-Location $PluginDir
try {
    if (Test-Path $Tgz) { Remove-Item $Tgz -Force }
    if (Test-Path $TgzNpmName) { Remove-Item $TgzNpmName -Force }
    cmd /c "`"$Node`" `"$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js`" pack --pack-destination `"$DistDir`" >NUL 2>&1"
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $TgzNpmName)) {
        throw "npm pack failed (exit=$LASTEXITCODE, expected=$TgzNpmName)"
    }
    # Normalize to the local- prefix the desktop profile's package.json references.
    Move-Item $TgzNpmName $Tgz
} finally { Pop-Location }
Write-Host "[1/5] packed -> $Tgz ($([math]::Round((Get-Item $Tgz).Length/1KB,1)) KB)"

# ---- exports verification helper (shared by steps 2 & 4) --------------------
# Pattern exports ("./locale/*.json"): the directory must exist and be non-empty.
function Test-ExportsTree($pkgObj, $root, $failures) {
    $pkgObj.exports.PSObject.Properties | ForEach-Object {
        $val = $_.Value
        if ($val -like '*\**') {
            $dirPart = ($val -replace '\*[^\./]*\.(js|json|svg)$', '') -replace '^\./', ''
            if (-not (Test-Path (Join-Path $root $dirPart)) -or
                (Get-ChildItem (Join-Path $root $dirPart) -File -ErrorAction SilentlyContinue).Count -eq 0) {
                $script:missing += $_.Name + ' -> ' + $val
            }
        } else {
            if (-not (Test-Path (Join-Path $root $val))) { $script:missing += $_.Name + ' -> ' + $val }
        }
    }
    # The bundle patch is load-bearing for activation — must be in the tree too.
    $patchRel = $pkgObj.dsh.bundle.patch.TrimStart('./')
    if (-not (Test-Path (Join-Path $root $patchRel))) {
        $script:missing += 'dsh.bundle.patch -> ' + $pkgObj.dsh.bundle.patch
    }
}

$tmp = Join-Path $env:TEMP ("dsh-pack-" + [guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
    # ---- 2. unpack + exports verification -----------------------------------
    tar -xzf $Tgz -C $tmp
    if ($LASTEXITCODE -ne 0) { throw "tar extract failed" }
    # npm pack may or may not wrap in package/ — detect.
    $src = Join-Path $tmp 'package'
    if (-not (Test-Path $src)) { $src = $tmp }

    $script:missing = @()
    Test-ExportsTree $pkg $src $null
    if ($script:missing.Count -gt 0) {
        throw ("exports verification FAILED against tarball:`n  " + ($script:missing -join "`n  "))
    }
    Write-Host "[2/5] tarball structure OK (all exports targets + bundle patch present)"
    if ($SkipInstall) { Write-Host '[-]  -SkipInstall: stopping before install.'; return }

    # ---- 3. remove-then-copy (breaks pnpm store hardlinks) ------------------
    if (-not (Test-Path (Join-Path $Profile 'package.json'))) { throw "desktop profile not found: $Profile" }
    if (Test-Path $Dest) {
        Get-ChildItem $Dest -Recurse -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item $Dest -Recurse -Force -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    Copy-Item (Join-Path $src '*') $Dest -Recurse -Force
    Write-Host "[3/5] installed -> $Dest"

    # ---- 4. verify INSTALLED tree -------------------------------------------
    $script:missing = @()
    Test-ExportsTree $pkg $Dest $null
    if ($script:missing.Count -gt 0) {
        throw ("installed-tree verification FAILED (flattened copy?):`n  " + ($script:missing -join "`n  "))
    }
    Write-Host "[4/5] installed tree OK (structure matches exports)"

    # ---- 5. integrity + version sync: tgz vs package.json / pnpm-lock.yaml --
    $sha = ([string](& $Node -e "const c=require('crypto'),fs=require('fs');const h=c.createHash('sha512');h.update(fs.readFileSync(process.argv[1]));console.log(h.digest('base64'))" $Tgz)).Trim()

    # 5a. profile package.json specifier: bump file:.../local-...-<oldver>.tgz
    $pf = Join-Path $Profile 'package.json'
    $ptxt = [IO.File]::ReadAllText($pf)
    if ($ptxt -match ('local-' + [regex]::Escape($PluginName) + '-(\d+\.\d+\.\d+)\.tgz') -and $Matches[1] -ne $version) {
        $ptxt = $ptxt -replace ('local-' + [regex]::Escape($PluginName) + '-[\d\.]+\.tgz'), ("local-$PluginName-$version.tgz")
        Copy-Item $pf "$pf.bak-dpp" -Force
        [IO.File]::WriteAllText($pf, $ptxt, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "[5a] profile package.json specifier -> v$version (backup: .bak-dpp)"
    }

    # 5b. pnpm-lock.yaml: version strings + integrity, BLOCK-SCOPED.
    $lock = Join-Path $Profile 'pnpm-lock.yaml'
    $openMarker = '  ' + $PluginName + '@file:'
    $tarballToken = 'local-' + $PluginName + '-'
    $lines = [IO.File]::ReadAllLines($lock)
    $inBlock = $false
    $changed = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match [regex]::Escape($tarballToken) -and $lines[$i] -notmatch [regex]::Escape($version)) {
            $lines[$i] = $lines[$i] -replace ($tarballToken + '[\d\.]+\.tgz'), ("$tarballToken$version.tgz")
            $changed = $true
        }
        if ($lines[$i] -like ($openMarker + '*')) { $inBlock = $true; continue }
        if ($inBlock -and $lines[$i] -match '^\S') { $inBlock = $false }
        if ($inBlock -and $lines[$i] -match 'resolution: \{integrity: sha512-[^,]+,') {
            if ($lines[$i] -notlike "*$sha*") {
                $lines[$i] = $lines[$i] -replace 'integrity: sha512-[^,]+,', ('integrity: sha512-' + $sha + ',')
                $changed = $true
            }
        }
    }
    if ($changed) {
        Copy-Item $lock "$lock.bak-dpp" -Force
        [IO.File]::WriteAllLines($lock, $lines)
        Write-Host "[5b] pnpm-lock.yaml synced (version + integrity; backup: .bak-dpp)"
    } else {
        Write-Host "[5b] pnpm-lock.yaml already current"
    }

    # ---- 5c. .modules.yaml @file: pointer ------------------------------------
    # PLAYBOOK §8: pack.ps1 historically synced package.json + lock only; the
    # .modules.yaml pointer kept the old tgz and pnpm's startup re-lay rolled
    # the install tree BACK after every restart. Same scoped replace as 5b.
    $modPath = Join-Path $Profile 'node_modules\.modules.yaml'
    if (Test-Path $modPath) {
        $mod = [IO.File]::ReadAllText($modPath)
        if ($mod -match ('local-' + [regex]::Escape($PluginName) + '-[\d\.-]+\.tgz') -and $mod -notlike "*local-$PluginName-$version.tgz*") {
            $mod = $mod -replace ('local-' + [regex]::Escape($PluginName) + '-[\d\.-]+\.tgz'), ("local-$PluginName-$version.tgz")
            Copy-Item $modPath "$modPath.bak-dpp" -Force
            [IO.File]::WriteAllText($modPath, $mod, (New-Object System.Text.UTF8Encoding($false)))
            Write-Host "[5c] .modules.yaml pointer -> v$version (backup: .bak-dpp)"
        } else {
            Write-Host "[5c] .modules.yaml already current"
        }
    }
    # ---- 6. host-half hot reload nudge --------------------------------------
    $patch = Join-Path $Profile 'cordis.patch.yml'
    $stamp = $PluginName + '-v' + $version + ' ' + (Get-Date -Format 'yyyyMMdd-HHmmss')
    $txt = [IO.File]::ReadAllText($patch)
    if ($txt -notlike "*$stamp*") {
        [IO.File]::WriteAllText($patch, $txt.TrimEnd() + "`r`n# $stamp`r`n", (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "[+]  cordis.patch.yml touched -> host half reloads (browser half needs an app restart)"
    }

    # ---- 7. post-install safety gate (2026-11-16 incident) -------------------
    # PS 5.1 `Set-Content -Encoding UTF8` writes a BOM; the desktop host's
    # readProfileManifest JSON.parse does NOT tolerate BOM and the whole app
    # dies with "Unexpected token '\ufeff'" at boot. Every file this script
    # (or a manual fallback run) touched must be verified BOM-free AND
    # Node-parseable BEFORE declaring success.
    $manifest = Join-Path $Profile 'package.json'
    $bytes = [IO.File]::ReadAllBytes($manifest)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        Write-Host "[7] BOM found on profile package.json — rewriting BOM-less" -ForegroundColor Yellow
        $clean = [IO.File]::ReadAllText($manifest)
        [IO.File]::WriteAllText($manifest, $clean, (New-Object System.Text.UTF8Encoding($false)))
    }
    & $Node -e "try { JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log('[7] profile package.json: Node JSON.parse OK'); process.exit(0) } catch (e) { console.error('[7] FATAL: profile package.json unparseable: ' + e.message); process.exit(1) }" $manifest
    if ($LASTEXITCODE -ne 0) { throw 'post-install safety gate failed: profile package.json is not valid JSON for the host' }
    Write-Host "== DONE v$version — restart the desktop app to load the new client half ==" -ForegroundColor Green
} finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
