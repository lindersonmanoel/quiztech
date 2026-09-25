# Mostra o endereco PUBLICO ATUAL do QUIZ TECH (tunel de demonstracao da Cloudflare) e o copia para a area de
# transferencia. O endereco muda toda vez que o tunel reinicia; este comando descobre o novo.
# Uso (na raiz do projeto):  powershell -File scripts\endereco-publico.ps1
# docker escreve os logs no canal de erro; por isso nao usamos "Stop" aqui.
$ErrorActionPreference = "Continue"

# 1) Tailscale Funnel (endereco FIXO): se estiver ativo, e' este.
$socket = "tailscale --socket=/tmp/tailscaled.sock"
if (docker ps --format "{{.Names}}" | Select-String -SimpleMatch "quiztech-tailscale") {
  $f = (cmd /c "docker exec quiztech-tailscale $socket funnel status 2>&1") | Out-String
  if ($f -match 'https://[a-z0-9.-]+\.ts\.net') {
    $url = $Matches[0]
    Write-Host ""
    Write-Host "Endereco publico FIXO do QUIZ TECH (Tailscale Funnel):" -ForegroundColor Cyan
    Write-Host "  $url" -ForegroundColor Green
    Set-Clipboard -Value $url
    Write-Host "  copiado para a area de transferencia. Este endereco nao muda quando o Docker reinicia."
    exit 0
  }
}

# 2) Sem Funnel: tunel de demonstracao da Cloudflare (endereco temporario).
$container = "quiztech-demo-tunnel"
if (-not (docker ps --format "{{.Names}}" | Select-String -SimpleMatch $container)) {
  Write-Host "O tunel nao esta rodando. Suba com:" -ForegroundColor Yellow
  Write-Host "  docker compose --env-file .env.production -f docker-compose.prod.yml --profile demo up -d"
  exit 1
}

$log = (cmd /c "docker logs $container 2>&1") | Out-String
$enderecos = [regex]::Matches($log, 'https://[a-z0-9-]+\.trycloudflare\.com') | ForEach-Object Value
if (-not $enderecos) {
  Write-Host "Ainda nao ha endereco no log do tunel. Aguarde alguns segundos e tente de novo." -ForegroundColor Yellow
  exit 1
}
$url = $enderecos | Select-Object -Last 1   # o ultimo e' o vigente

Write-Host ""
Write-Host "Endereco publico do QUIZ TECH:" -ForegroundColor Cyan
Write-Host "  $url" -ForegroundColor Green
try {
  $saude = Invoke-RestMethod "$url/api/health/ready" -TimeoutSec 20
  $versao = Invoke-RestMethod "$url/api/version" -TimeoutSec 20
  Write-Host ("  no ar: API {0}, banco {1} | versao {2} ({3})" -f $saude.status, $saude.banco, $versao.version, $versao.commit)
} catch {
  Write-Host "  (o endereco existe, mas ainda nao respondeu; pode levar alguns segundos)" -ForegroundColor Yellow
}
Set-Clipboard -Value $url
Write-Host "  copiado para a area de transferencia."
Write-Host ""
Write-Host "Lembrete: este endereco muda se o tunel reiniciar. Instale o app no celular so' depois de ter um endereco fixo." -ForegroundColor DarkGray
