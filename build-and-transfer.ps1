# Build Docker Image, Transfer to Server, and Auto-Start Container
param (
    [string]$ImageName    = "quanly-mobile-be-service",
    [string]$Tag          = "latest",
    [string]$ServerHost   = "103.72.97.86",
    [string]$ServerUser   = "root",
    [int]   $ServerPort   = 24700,
    [string]$ServerPath   = "/root/quanly-mobie/quanly-mobie-be-service",
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
# STEP 3: Export image to .tar and Upload via SCP
# ─────────────────────────────────────────────
$TarFile = "$ImageName.tar"
Write-Host "`n[3/5] Saving image to $TarFile..." -ForegroundColor Yellow
docker save -o $TarFile $FullImage

if (-not (Test-Path $TarFile)) {
    Write-Host "❌ Failed to export image to $TarFile" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Image exported to $TarFile" -ForegroundColor Green

Write-Host "`nEnsuring remote directory exists: $ServerPath" -ForegroundColor Gray
ssh -p $ServerPort "$ServerUser@$ServerHost" "mkdir -p $ServerPath"

Write-Host "`nUploading $TarFile to server (Port: $ServerPort)..." -ForegroundColor Yellow
scp -P $ServerPort $TarFile "$ServerUser@$ServerHost`:$ServerPath/$TarFile"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ SCP upload failed! Check your SSH connection and credentials." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Upload completed." -ForegroundColor Green

# Clean up local .tar
Remove-Item -Force $TarFile -ErrorAction SilentlyContinue
Write-Host "🧹 Local $TarFile removed." -ForegroundColor Gray

# ─────────────────────────────────────────────
# STEP 4: Load Docker image on server
# ─────────────────────────────────────────────
Write-Host "`n[4/5] Loading Docker image on server..." -ForegroundColor Yellow
ssh -p $ServerPort "$ServerUser@$ServerHost" "docker load -i $ServerPath/$TarFile && rm -f $ServerPath/$TarFile"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to load image on server." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Image loaded on server." -ForegroundColor Green

# ─────────────────────────────────────────────
# STEP 5: Restart / Start container via docker compose
# ─────────────────────────────────────────────
Write-Host "`n[5/5] Starting container '$ContainerName' on server..." -ForegroundColor Yellow
ssh -p $ServerPort "$ServerUser@$ServerHost" "cd $ServerPath && docker compose up -d --no-build --force-recreate $ContainerName"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Container '$ContainerName' is now running!" -ForegroundColor Green
} else {
    Write-Host "⚠️  docker compose failed. Trying docker restart as fallback..." -ForegroundColor DarkYellow
    ssh -p $ServerPort "$ServerUser@$ServerHost" "docker restart $ContainerName"
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  🎉 Deployment Complete!" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
