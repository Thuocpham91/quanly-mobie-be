# Build Docker Image, Transfer to Server, and Auto-Start Container
param (
    [string]$ImageName     = "quanly-mobile-be-service",
    [string]$Tag           = "latest",
    [string]$ServerHost    = "103.72.97.86",
    [string]$ServerUser    = "root",
    [int]   $ServerPort    = 24700,
    [string]$ServerPath    = "/root/quanly-mobie/quanly-mobie-be-service",
    [string]$ContainerName = "quanly-mobile-be-service"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  🚀 BUILD -> TRANSFER -> DEPLOY TO SERVER" -ForegroundColor Cyan
Write-Host "  Server  : $ServerUser@$ServerHost`:$ServerPort" -ForegroundColor Cyan
Write-Host "  Path    : $ServerPath" -ForegroundColor Cyan
Write-Host "  Image   : $ImageName`:$Tag" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Cấu hình SSH chung chống đơ/treo kết nối
$SshOptions = @(
    "-p", $ServerPort,
    "-o", "StrictHostKeyChecking=no",
    "-o", "UserKnownHostsFile=/dev/null",
    "-o", "ConnectTimeout=10",
    "-o", "ServerAliveInterval=15",
    "-o", "ServerAliveCountMax=3"
)

# ─────────────────────────────────────────────
# STEP 1: Check Docker daemon
# ─────────────────────────────────────────────
Write-Host "`n[1/5] Checking Docker daemon..." -ForegroundColor Yellow
docker info > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker is running." -ForegroundColor Green

# ─────────────────────────────────────────────
# STEP 2: Build Docker Image
# ─────────────────────────────────────────────
$FullImage = "$ImageName`:$Tag"
Write-Host "`n[2/5] Building Docker image '$FullImage' for linux/amd64..." -ForegroundColor Yellow
docker build --platform linux/amd64 -t $FullImage .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Image built: $FullImage" -ForegroundColor Green

# ─────────────────────────────────────────────
# STEP 3: Export image to .tar.gz and upload via SCP
# ─────────────────────────────────────────────
$TarFile = "$ImageName.tar"
$CompressedTarFile = "$ImageName.tar.gz"
Write-Host "`n[3/5] Saving image to $TarFile..." -ForegroundColor Yellow
docker save -o $TarFile $FullImage

if (-not (Test-Path $TarFile)) {
    Write-Host "❌ Failed to export image to $TarFile" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Image exported to $TarFile" -ForegroundColor Green

Write-Host "`nCompressing archive for stable transfer..." -ForegroundColor Gray
tar -czf $CompressedTarFile -C (Get-Location)$TarFile
if (-not (Test-Path $CompressedTarFile)) {
    Write-Host "❌ Failed to compress image archive" -ForegroundColor Red
    exit 1
}

Write-Host "`nEnsuring remote directory exists: $ServerPath" -ForegroundColor Gray
ssh @SshOptions "$ServerUser@$ServerHost" "mkdir -p $ServerPath"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Cannot connect via SSH to server! Check IP, Port or SSH Key." -ForegroundColor Red
    Remove-Item -Force $TarFile -ErrorAction SilentlyContinue
    Remove-Item -Force $CompressedTarFile -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "`nUploading $CompressedTarFile to server (Port:$ServerPort) via SCP..." -ForegroundColor Yellow

$maxRetries = 3
$retryCount = 0
$uploadSuccess = $false

while (-not $uploadSuccess -and $retryCount -lt $maxRetries) {
    $retryCount++
    if ($retryCount -gt 1) {
        Write-Host "⚠️ Thử lại lần $retryCount/$maxRetries sau 3 giây..." -ForegroundColor DarkYellow
        Start-Sleep -Seconds 3
    }

    scp -P $ServerPort -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 -o ServerAliveInterval=15 $CompressedTarFile "${ServerUser}@${ServerHost}:${ServerPath}/"

    if ($LASTEXITCODE -eq 0) {
        $uploadSuccess = $true
    }
}

if (-not $uploadSuccess) {
    Write-Host "❌ SCP upload failed! Kiểm tra kết nối mạng hoặc SSH Key." -ForegroundColor Red
    Remove-Item -Force $TarFile -ErrorAction SilentlyContinue
    Remove-Item -Force $CompressedTarFile -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "✅ Upload completed." -ForegroundColor Green

# Clean up local archives
Remove-Item -Force $TarFile -ErrorAction SilentlyContinue
Remove-Item -Force $CompressedTarFile -ErrorAction SilentlyContinue
Write-Host "🧹 Local archives removed." -ForegroundColor Gray

# ─────────────────────────────────────────────
# STEP 4: Load Docker image on server
# ─────────────────────────────────────────────
Write-Host "`n[4/5] Loading Docker image on server..." -ForegroundColor Yellow
$loadCmd = "cd $ServerPath && tar -xzf $CompressedTarFile && docker load -i $TarFile && rm -f $CompressedTarFile $TarFile"
ssh @SshOptions "$ServerUser@$ServerHost" $loadCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to load image on server." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Image loaded on server." -ForegroundColor Green

# ─────────────────────────────────────────────
# STEP 5: Restart / Start container via docker compose
# ─────────────────────────────────────────────
Write-Host "`n[5/5] Starting container '$ContainerName' on server..." -ForegroundColor Yellow

$composeCmd = "cd $ServerPath && docker compose up -d --no-build --force-recreate $ContainerName"
ssh @SshOptions "$ServerUser@$ServerHost" $composeCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ docker compose failed. Trying fallback (docker rm & docker run)..." -ForegroundColor DarkYellow
    $fallbackCmd = "docker rm -f $ContainerName 2>/dev/null; cd $ServerPath && docker compose up -d $ContainerName"
    ssh @SshOptions "$ServerUser@$ServerHost" $fallbackCmd
}

# Kiểm tra trạng thái thực tế của Container
$checkCmd = "docker ps --filter name=$ContainerName --format '{{.Status}}'"
$status = ssh @SshOptions "$ServerUser@$ServerHost" $checkCmd

if ($status -and ($status -like "*Up*")) {
    Write-Host "✅ Container '$ContainerName' is running! ($status)" -ForegroundColor Green
} else {
    Write-Host "❌ Container status check failed or Container is stopped." -ForegroundColor Red
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  🎉 Deployment Complete!" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan