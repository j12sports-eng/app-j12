$ErrorActionPreference = "Stop"

function Stop-PortProcess {
  param([int]$Port, [string]$Label)

  $processId = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess

  if (-not $processId) {
    Write-Output "$Label nao estava rodando na porta $Port."
    return
  }

  Stop-Process -Id $processId -Force
  Write-Output "$Label parado na porta $Port (PID $processId)."
}

Stop-PortProcess -Port 3000 -Label "Frontend"
Stop-PortProcess -Port 4001 -Label "Backend"
