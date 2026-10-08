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

Write-Host "`nUploading $CompressedTarFile to server (Port:$ServerPort) via SSH stream fallback..." -ForegroundColor Yellow

$maxRetries = 3
$uploadSuccess = $false
$transferAttempt = 0
$remoteArchivePath = "$ServerPath/$CompressedTarFile"
$remoteTarPath = "$ServerPath/$TarFile"

while (-not $uploadSuccess -and $transferAttempt -lt $maxRetries) {
    $transferAttempt++
    if ($transferAttempt -gt 1) {
        Write-Host "⚠️ Thử lại lần $transferAttempt/$maxRetries sau 3 giây..." -ForegroundColor DarkYellow
        Start-Sleep -Seconds 3
    }

    Write-Host "  [Transfer attempt $transferAttempt/$maxRetries] Using SSH stream upload..." -ForegroundColor Gray
    $remoteWriteCmd = "mkdir -p '$ServerPath' && cd '$ServerPath' && cat > '$CompressedTarFile' && tar -xzf '$CompressedTarFile' && docker load -i '$TarFile' && rm -f '$CompressedTarFile' '$TarFile'"
    $sshArguments = "-p $ServerPort -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 $ServerUser@$ServerHost `"$remoteWriteCmd`""
    $sshInfo = New-Object System.Diagnostics.ProcessStartInfo
    $sshInfo.FileName = "ssh.exe"
    $sshInfo.Arguments = $sshArguments
    $sshInfo.UseShellExecute = $false
    $sshInfo.RedirectStandardInput = $true
    $sshInfo.RedirectStandardOutput = $true
    $sshInfo.RedirectStandardError = $true
    $sshProcess = New-Object System.Diagnostics.Process
    $sshProcess.StartInfo = $sshInfo

    try {
        [void]$sshProcess.Start()
        $stdoutTask = $sshProcess.StandardOutput.ReadToEndAsync()
        $stderrTask = $sshProcess.StandardError.ReadToEndAsync()
        $archiveStream = [System.IO.File]::OpenRead($CompressedTarFile)
        try {
            $archiveStream.CopyTo($sshProcess.StandardInput.BaseStream)
        } finally {
            $archiveStream.Dispose()
            $sshProcess.StandardInput.Close()
        }
        $sshProcess.WaitForExit()
        $sshOutput = $stdoutTask.Result
        $sshError = $stderrTask.Result
        if ($sshOutput) { Write-Host $sshOutput.Trim() }
        if ($sshError) { Write-Host $sshError.Trim() -ForegroundColor DarkYellow }
        $uploadSuccess = $sshProcess.ExitCode -eq 0
    } catch {
        Write-Host "  SSH stream transfer error: $($_.Exception.Message)" -ForegroundColor DarkYellow
    } finally {
        $sshProcess.Dispose()
    }

    if (-not $uploadSuccess) {
        Write-Host "  SSH stream transfer failed; retrying with SCP as fallback..." -ForegroundColor DarkYellow
        scp -P $ServerPort -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 -o ServerAliveInterval=15 $CompressedTarFile "${ServerUser}@${ServerHost}:${ServerPath}/" | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $uploadSuccess = $true
        }
    }
}

if (-not $uploadSuccess) {
    Write-Host "❌ Upload failed on both SSH stream and SCP. Kiểm tra kết nối mạng hoặc SSH Key." -ForegroundColor Red
    Remove-Item -Force $TarFile -ErrorAction SilentlyContinue
    Remove-Item -Force $CompressedTarFile -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "✅ Image transfer completed." -ForegroundColor Green

$ProxyConfig = "nginx/vhost.d/apimobie.chuyendoisovn.com.vn"
$RemoteProxyConfig = "$ServerPath/apimobie.chuyendoisovn.com.vn"
if (Test-Path $ProxyConfig) {
    Write-Host "`nUploading Nginx upload/timeout configuration..." -ForegroundColor Yellow
    ssh @SshOptions "$ServerUser@$ServerHost" "mkdir -p $ServerPath/nginx"
    scp -P $ServerPort -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 $ProxyConfig "${ServerUser}@${ServerHost}:$RemoteProxyConfig"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to upload Nginx vhost configuration." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Nginx configuration uploaded." -ForegroundColor Green
} else {
    Write-Host "⚠️ Nginx vhost configuration not found at '$ProxyConfig'; skipping proxy update." -ForegroundColor DarkYellow
}

# Clean up local archives
Remove-Item -Force $TarFile -ErrorAction SilentlyContinue
Remove-Item -Force $CompressedTarFile -ErrorAction SilentlyContinue
Write-Host "🧹 Local archives removed." -ForegroundColor Gray

# ─────────────────────────────────────────────
# STEP 4: Load Docker image on server
# ─────────────────────────────────────────────
Write-Host "`n[4/5] Loading Docker image on server..." -ForegroundColor Yellow
$loadCmd = "cd '$ServerPath' && if [ -f '$CompressedTarFile' ]; then tar -xzf '$CompressedTarFile' && docker load -i '$TarFile' && rm -f '$CompressedTarFile' '$TarFile'; fi && docker image inspect '${ImageName}:${Tag}' >/dev/null"
ssh @SshOptions "$ServerUser@$ServerHost" $loadCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to validate image on server." -ForegroundColor Red
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

if (Test-Path $ProxyConfig) {
    $proxyConfigCmd = "docker cp $RemoteProxyConfig nginx-proxy:/etc/nginx/vhost.d/apimobie.chuyendoisovn.com.vn && docker restart nginx-proxy && sleep 3 && docker exec nginx-proxy nginx -t && docker exec nginx-proxy nginx -T 2>&1 | grep -q 'client_max_body_size 100m;'"
    Write-Host "`nApplying Nginx upload/timeout configuration..." -ForegroundColor Yellow
    ssh @SshOptions "$ServerUser@$ServerHost" $proxyConfigCmd
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to apply/verify Nginx vhost configuration." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Nginx config regenerated, validated, and upload limit verified." -ForegroundColor Green
} else {
    Write-Host "⚠️ Nginx configuration unchanged; no local vhost file was available." -ForegroundColor DarkYellow
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