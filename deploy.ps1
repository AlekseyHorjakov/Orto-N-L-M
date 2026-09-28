$ErrorActionPreference = "Stop"

$SERVER = "root@62.113.98.161"
$SSH_KEY = "$HOME\.ssh\id_ed25519"

$PROJECT_ROOT = (Get-Location).Path
$BACKEND_LOCAL = Join-Path $PROJECT_ROOT "backend"
$FRONTEND_PROJECT = Join-Path $PROJECT_ROOT "frontend\ortona-ai"
$FRONTEND_LOCAL = Join-Path $FRONTEND_PROJECT "dist"

$BACKEND_REMOTE = "/opt/orto-n-backend"
$FRONTEND_REMOTE = "/opt/orto-n-frontend/dist"

$SSH_OPTS = @(
    "-i", $SSH_KEY,
    "-o", "StrictHostKeyChecking=no",
    "-o", "UserKnownHostsFile=$HOME\.ssh\known_hosts_ortona"
)

function Invoke-SSH {
    param(
        [string]$Command
    )

    & ssh @SSH_OPTS $SERVER $Command

    if ($LASTEXITCODE -ne 0) {
        throw "SSH завершился с ошибкой. Код: $LASTEXITCODE"
    }
}

function Invoke-SCP {
    param(
        [string]$LocalFile,
        [string]$RemoteFile
    )

    & scp @SSH_OPTS $LocalFile "${SERVER}:${RemoteFile}"

    if ($LASTEXITCODE -ne 0) {
        throw "SCP завершился с ошибкой. Код: $LASTEXITCODE"
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "        ORTONA AI FULL DEPLOY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ==================================================
# 1. BUILD FRONTEND
# ==================================================

Write-Host "[1/6] Сборка frontend..." -ForegroundColor Yellow

Push-Location $FRONTEND_PROJECT

try {
    npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "npm run build завершился с ошибкой."
    }
}
finally {
    Pop-Location
}

# ==================================================
# 2. PREPARE SERVER
# ==================================================

Write-Host "[2/6] Подготовка production..." -ForegroundColor Yellow

Invoke-SSH "mkdir -p $BACKEND_REMOTE $FRONTEND_REMOTE"

# Backend: удалить старые файлы, кроме production .env
Invoke-SSH "find $BACKEND_REMOTE -mindepth 1 -maxdepth 1 ! -name '.env' -exec rm -rf {} +"

# Frontend: полностью очистить старый dist
Invoke-SSH "find $FRONTEND_REMOTE -mindepth 1 -maxdepth 1 -exec rm -rf {} +"

# ==================================================
# 3. UPLOAD BACKEND
# ==================================================

Write-Host "[3/6] Загрузка backend..." -ForegroundColor Yellow

Get-ChildItem -LiteralPath $BACKEND_LOCAL -File -Force |
    Where-Object {
        $_.Name -ne ".env" -and
        $_.Name -ne "NUL"
    } |
    ForEach-Object {
        Write-Host "  -> $($_.Name)"
        Invoke-SCP $_.FullName $BACKEND_REMOTE
    }

# ==================================================
# 4. UPLOAD FRONTEND
# ==================================================

Write-Host "[4/6] Упаковка frontend..." -ForegroundColor Yellow

$FrontendZip = Join-Path $env:TEMP "ortona-frontend-$([guid]::NewGuid().ToString('N')).zip"

try {
    Compress-Archive `
        -Path (Join-Path $FRONTEND_LOCAL "*") `
        -DestinationPath $FrontendZip `
        -CompressionLevel Fastest

    if (-not (Test-Path $FrontendZip)) {
        throw "ZIP frontend не создан."
    }

    Write-Host "  -> Загрузка frontend..." -ForegroundColor Yellow

    Invoke-SCP $FrontendZip "/tmp/ortona-frontend.zip"

    Write-Host "  -> Распаковка frontend на сервере..." -ForegroundColor Yellow

    Invoke-SSH "cd $FRONTEND_REMOTE && unzip -oq /tmp/ortona-frontend.zip && rm -f /tmp/ortona-frontend.zip"
}
finally {
    if (Test-Path $FrontendZip) {
        Remove-Item $FrontendZip -Force -ErrorAction SilentlyContinue
    }
}

# ==================================================
# 5. REBUILD + RESTART BACKEND
# ==================================================

Write-Host "[5/6] Пересборка и перезапуск backend..." -ForegroundColor Yellow

Invoke-SSH "cd $BACKEND_REMOTE && docker compose build && docker compose up -d"

# ==================================================
# 6. DATABASE MIGRATION
# ==================================================

Write-Host "[6/6] Миграция БД (instruction_text, test_results, learned_instructions)..." -ForegroundColor Yellow

Invoke-SSH 'docker exec n8n-postgres-1 psql -U root -d orto_n -c "ALTER TABLE processes ADD COLUMN IF NOT EXISTS instruction_text TEXT;"'

Invoke-SSH 'docker exec n8n-postgres-1 psql -U root -d orto_n -c "CREATE TABLE IF NOT EXISTS test_results (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, process_id INTEGER NOT NULL REFERENCES processes(id) ON DELETE CASCADE, score INTEGER NOT NULL CHECK (score >= 0), total INTEGER NOT NULL CHECK (total > 0), percent INTEGER NOT NULL CHECK (percent BETWEEN 0 AND 100), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"'

Invoke-SSH 'docker exec n8n-postgres-1 psql -U root -d orto_n -c "CREATE INDEX IF NOT EXISTS idx_test_results_user ON test_results(user_id);"'

Invoke-SSH 'docker exec n8n-postgres-1 psql -U root -d orto_n -c "CREATE INDEX IF NOT EXISTS idx_test_results_process ON test_results(process_id);"'

Invoke-SSH 'docker exec n8n-postgres-1 psql -U root -d orto_n -c "CREATE TABLE IF NOT EXISTS learned_instructions (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, process_id INTEGER NOT NULL REFERENCES processes(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (user_id, process_id));"'

Invoke-SSH 'docker exec n8n-postgres-1 psql -U root -d orto_n -c "CREATE INDEX IF NOT EXISTS idx_learned_instructions_user ON learned_instructions(user_id);"'

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "        DEPLOY УСПЕШНО ЗАВЕРШЕН"
Write-Host "========================================" -ForegroundColor Green
Write-Host ""