# Menu do Sistema

---

# Objetivo

Este documento define oficialmente a estrutura de navegação da J12 Sports ERP 3.0.

O objetivo é padronizar os módulos disponíveis, seus submenus, perfis de acesso e responsabilidades, garantindo consistência entre a arquitetura do sistema e a interface apresentada aos usuários.

Toda inclusão, remoção ou reorganização de menus deverá ser refletida neste documento antes da implementação.

---

# Estrutura Geral

A navegação da plataforma é organizada por macroáreas.

```text
Centro de Comando

Operação

Comercial

Esportivo

Plataforma
```

---

# Centro de Comando

Objetivo:

Apresentar uma visão executiva da empresa.

Submenus:

- Dashboard Executivo
- Indicadores
- Business Intelligence
- Alertas
- Relatórios Gerenciais

Perfis:

- Administrador
- Gestor

Status:

Em desenvolvimento

---

# Operação

## Pessoas

Submenus

- Alunos
- Responsáveis
- Professores
- Funcionários

---

## Turmas

Submenus

- Turmas
- Agenda
- Frequência
- Avaliações

---

## Modalidades

Submenus

- Futsal
- Society
- Vôlei

Novas modalidades poderão ser adicionadas futuramente sem alteração estrutural.

---

# Comercial

## Financeiro

Submenus

- Mensalidades
- Cobranças
- Recebimentos
- Fluxo de Caixa
- DRE
- Conciliação

---

## Contratos

Submenus

- Contratos de Alunos
- Contratos de Patrocínio
- Contratos de Locação

---

## Locações

Submenus

- Quadras
- Reservas
- Mensalistas
- Avulsos

---

## Patrocínios

Submenus

- Empresas
- Contratos
- Cobranças
- Recebimentos
- Portal do Patrocinador

---

# Esportivo

## Eventos

Submenus

- Festivais
- Aniversários
- Clínicas
- Eventos Especiais

---

## Campeonatos

Submenus

- Campeonatos
- Categorias
- Equipes
- Jogos
- Classificação
- Estatísticas

---

# Plataforma

## Portais

Submenus

- Portal do Aluno
- Portal do Responsável
- Portal do Professor
- Portal do Funcionário
- Portal do Patrocinador

---

## Configurações

Submenus

- Empresa
- Unidades
- Modalidades
- Usuários
- Perfis
- Permissões
- Parâmetros

---

## Integrações

Submenus

- Gateways de Pagamento
- WhatsApp
- BotConversa
- n8n
- APIs Bancárias

---

## Auditoria

Submenus

- Logs
- Auditoria
- Histórico
- Monitoramento

---

# Funcionalidades Futuras

Os módulos abaixo fazem parte do roadmap e não integram a versão 3.0.

## Instituto Jessiquinha J12

Submenus previstos:

- Projetos
- Alunos
- Turmas
- Patrocinadores
- Prestação de Contas
- Relatórios

---

## Lanchonete

Submenus previstos:

- PDV
- Estoque
- Produtos
- Comandas
- Financeiro

---

# Diretrizes

Todos os módulos deverão possuir:

- Permissões próprias.
- Rotas independentes.
- APIs específicas.
- Componentes reutilizáveis.
- Documentação própria.

Nenhum submenu deverá depender diretamente de outro módulo para funcionar.

---

# Evolução da Navegação

A arquitetura permite adicionar novos módulos sem reorganizar a estrutura principal do sistema.

Toda nova funcionalidade deverá ser vinculada a uma das macroáreas existentes.

Caso seja necessária uma nova macroárea, deverá ser criada uma RFC antes da implementação.

---

## Histórico de Alterações

| Versão | Data | Descrição |
|--------|------|-----------|
| 3.0 | Julho/2026 | Definição oficial da estrutura de navegação da J12 Sports ERP. |