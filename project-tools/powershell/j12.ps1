param(
    [Parameter(Position=0)]
    [string]$Command,

    [Parameter(Position=1)]
    [string]$Argument
)

$Root = Split-Path $PSScriptRoot -Parent

function Show-Help {

    Clear-Host

    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "        J12 SPORTS ERP TOOLKIT"
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "Documentação" -ForegroundColor Yellow
    Write-Host "  docs"

    Write-Host ""
    Write-Host "Backups" -ForegroundColor Yellow
    Write-Host "  backup"

    Write-Host ""
    Write-Host "Relatórios" -ForegroundColor Yellow
    Write-Host "  report"

    Write-Host ""
    Write-Host "Criadores" -ForegroundColor Yellow
    Write-Host "  module"
    Write-Host "  portal"
    Write-Host "  sprint"

    Write-Host ""
    Write-Host "Qualidade" -ForegroundColor Yellow
    Write-Host "  validate"

    Write-Host ""
}

switch ($Command) {

    "docs" {

        & "$PSScriptRoot\fill-empty-docs.ps1"

    }

    "backup" {

        & "$PSScriptRoot\backup-project.ps1"

    }

    "report" {

        & "$PSScriptRoot\project-report.ps1"

    }

    "module" {

        & "$PSScriptRoot\create-module.ps1" $Argument

    }

    "portal" {

        & "$PSScriptRoot\create-portal.ps1" $Argument

    }

    "sprint" {

        & "$PSScriptRoot\create-sprint.ps1"

    }

    "validate" {

        & "$PSScriptRoot\validate-docs.ps1"

    }

    default {

        Show-Help

    }

}