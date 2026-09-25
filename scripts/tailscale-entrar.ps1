# Coloca o contêiner do Tailscale Funnel na sua conta usando uma CHAVE DE AUTENTICACAO (sem link de login e sem cookies).
#
# 1) No painel do Tailscale: Settings > Keys > Generate auth key  (https://login.tailscale.com/admin/settings/keys)
#    Copie a chave (comeca com "tskey-auth-").
# 2) Rode, na raiz do projeto:   powershell -File scripts\tailscale-entrar.ps1
#    e cole a chave no campo que aparecer (o texto NAO fica visivel). Ela e' gravada so' no .env.production, que
#    nunca vai para o Git.
$ErrorActionPreference = "Continue"
$envFile = ".env.production"
if (-not (Test-Path $envFile)) { Write-Host "Nao achei $envFile. Rode na raiz do projeto." -ForegroundColor Red; exit 1 }

$segura = Read-Host "Cole a chave de autenticacao do Tailscale (nao aparece na tela)" -AsSecureString
$chave = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)).Trim()
if ($chave -notmatch '^tskey-[A-Za-z0-9-]{20,}$') {
  Write-Host "Isso nao parece uma chave do Tailscale (deve comecar com 'tskey-')." -ForegroundColor Red; exit 1
}

# grava/atualiza a linha TS_AUTHKEY= sem mexer no resto do arquivo
$linhas = Get-Content $envFile
if ($linhas -match '^TS_AUTHKEY=') { $linhas = $linhas | ForEach-Object { if ($_ -match '^TS_AUTHKEY=') { "TS_AUTHKEY=$chave" } else { $_ } } }
else { $linhas += "TS_AUTHKEY=$chave" }
Set-Content -Path $envFile -Value $linhas -Encoding ascii
Write-Host "Chave gravada em $envFile." -ForegroundColor Green

Write-Host "Recriando o contêiner do Tailscale..."
docker compose --env-file $envFile -f docker-compose.prod.yml --profile funnel up -d --force-recreate tailscale 2>&1 | Select-String "Started|Created|error"

$s = "tailscale --socket=/tmp/tailscaled.sock"
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep 4
  $st = (cmd /c "docker exec quiztech-tailscale $s status 2>&1") | Out-String
  if ($st -and $st -notmatch "Logged out" -and $st -notmatch "failed to connect") { break }
}
Write-Host ""
Write-Host $st.Trim()
Write-Host ""
(cmd /c "docker exec quiztech-tailscale $s funnel status 2>&1") | Out-String | Write-Host
