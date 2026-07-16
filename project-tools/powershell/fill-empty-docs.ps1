Clear-Host

$docs = Get-ChildItem -Path "docs" -Recurse -Filter "*.md"

$total = 0
$updated = 0
$ignored = 0

foreach ($doc in $docs) {

    $total++

    try {

        $content = Get-Content -LiteralPath $doc.FullName -Raw -ErrorAction Stop

        if ([string]::IsNullOrWhiteSpace($content)) {

            $title = $doc.BaseName.Replace("-", " ")

            $template = @"
# $title

---

## Objetivo

Descrever o objetivo deste documento.

---

## Escopo

Definir o escopo deste documento.

---

## Visão Geral

Adicionar uma visão geral do assunto.

---

## Estrutura

Descrever a estrutura relacionada.

---

## Regras

Adicionar regras de negócio ou regras técnicas.

---

## Boas Práticas

-

---

## Anti-Padrões

-

---

## Exemplos

Adicionar exemplos quando necessário.

---

## Referências

Relacionar documentos complementares.

---

## Histórico de Alterações

| Versão | Data | Descrição |
|--------|------|-----------|
| 1.0 | $(Get-Date -Format "dd/MM/yyyy") | Documento criado automaticamente. |

"@

            Set-Content `
                -LiteralPath $doc.FullName `
                -Value $template `
                -Encoding UTF8

            Write-Host "✔ Preenchido: $($doc.FullName)" -ForegroundColor Green

            $updated++
        }
        else {

            Write-Host "• Ignorado: $($doc.Name)" -ForegroundColor DarkGray

            $ignored++
        }

    }
    catch {

        Write-Host "✖ Erro: $($doc.FullName)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " DOCUMENTAÇÃO PADRONIZADA" -ForegroundColor White
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Arquivos encontrados : $total"
Write-Host "Preenchidos          : $updated" -ForegroundColor Green
Write-Host "Ignorados            : $ignored" -ForegroundColor Yellow
Write-Host ""