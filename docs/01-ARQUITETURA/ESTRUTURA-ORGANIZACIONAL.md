# Estrutura Organizacional

---

# Objetivo

Este documento define a estrutura organizacional da J12 Sports dentro da arquitetura do ERP.

Seu objetivo é padronizar a organização da empresa, suas unidades, modalidades, serviços e futuras expansões, servindo como base para permissões, filtros, relatórios, indicadores e crescimento do sistema.

---

# Organização Geral

A J12 Sports ERP foi projetada para administrar uma empresa composta por múltiplas unidades operacionais.

Cada unidade possui autonomia operacional, porém compartilha a mesma plataforma de gestão.

```text
J12 Sports
│
├── Arena J12 (Sede)
├── J12 / Nacional Academy
└── J12 / Santa Marina
```

---

# Empresa

A J12 Sports representa a entidade principal do ERP.

É responsável pela administração de todas as unidades, usuários, operações financeiras, indicadores estratégicos e configurações corporativas.

---

# Unidade 1 — Arena J12

## Tipo

Sede Administrativa e Operacional.

## Modalidades

- Futsal
- Vôlei

## Serviços

- Escola esportiva
- Locação de quadras (mensalistas)
- Locação de quadras (avulsos)
- Eventos
- Festivais
- Campeonatos

## Estrutura

- Administração
- Recepção
- Quadra
- Vestiários
- Lanchonete (módulo futuro)

## Características

A Arena J12 é a unidade principal da empresa.

Toda gestão administrativa da J12 Sports é centralizada nesta unidade.

---

# Unidade 2 — J12 / Nacional Academy

## Modalidade

- Society

## Serviços

- Escola esportiva

## Características

A unidade opera exclusivamente com treinamentos de Society.

A infraestrutura pertence ao parceiro, sendo utilizada apenas para realização das aulas.

---

# Unidade 3 — J12 / Santa Marina

## Modalidade

- Futsal

## Serviços

- Escola esportiva

## Características

A unidade opera exclusivamente com treinamentos de Futsal.

A infraestrutura pertence ao parceiro, sendo utilizada apenas para realização das aulas.

---

# Instituto Jessiquinha J12

## Status

Planejado para versão futura.

O Instituto compartilhará a sede física da Arena J12, porém será tratado como um domínio independente dentro do ERP.

Características previstas:

- Gestão própria
- Financeiro independente
- Projetos sociais
- Patrocinadores institucionais
- Prestação de contas
- Alunos bolsistas
- Turmas sociais
- Relatórios específicos

A operação do Instituto não deverá interferir na gestão comercial da J12 Sports.

---

# Modalidades

O ERP suporta múltiplas modalidades.

Atualmente:

- Futsal
- Society
- Vôlei

A arquitetura permite inclusão de novas modalidades sem alterações estruturais.

---

# Estrutura Hierárquica

```text
Empresa
│
├── Unidade
│   ├── Modalidade
│   │   ├── Turma
│   │   │   ├── Professor
│   │   │   ├── Alunos
│   │   │   └── Responsáveis
│   │   └── Agenda
│   └── Serviços
│
└── Administração Corporativa
```

---

# Serviços Operacionais

Cada unidade pode oferecer um ou mais serviços.

Exemplos:

- Escola esportiva
- Locação de quadras
- Eventos
- Festivais
- Campeonatos

A arquitetura permite adicionar novos serviços futuramente.

---

# Patrocínios

O ERP contempla um módulo específico para gestão de patrocinadores.

Inicialmente serão administrados os patrocinadores comerciais da J12 Sports.

Características:

- Contratos
- Vigência
- Cobranças
- Recebimentos
- Exposição da marca
- Portal do Patrocinador

Os patrocínios do Instituto serão tratados em um domínio independente.

---

# Usuários

A plataforma contempla diferentes perfis de usuários.

- Administrador
- Gestor
- Financeiro
- Coordenador
- Professor
- Funcionário
- Aluno
- Responsável
- Patrocinador

Cada perfil possui permissões específicas.

---

# Multiunidades

Todas as informações do sistema deverão possuir vínculo com uma unidade.

Isso permitirá:

- Relatórios por unidade
- Indicadores por unidade
- Financeiro por unidade
- Agenda por unidade
- Professores por unidade
- Alunos por unidade

Também será possível consolidar informações de todas as unidades no Centro de Comando.

---

# Centro de Comando

O Centro de Comando apresentará indicadores em dois níveis:

## Corporativo

Visão consolidada da J12 Sports.

## Unidade

Visão individual de cada unidade.

Isso permitirá análises estratégicas e operacionais.

---

# Escalabilidade

A arquitetura foi planejada para suportar:

- Novas unidades
- Novas modalidades
- Novos serviços
- Novos portais
- Novos modelos de negócio

Sem necessidade de alterações estruturais.

---

# Diretrizes Arquiteturais

Toda nova unidade deverá:

- Possuir identificação própria.
- Possuir configurações próprias.
- Possuir agenda própria.
- Possuir professores vinculados.
- Possuir modalidades vinculadas.
- Compartilhar a mesma plataforma ERP.

---

## Histórico de Alterações

| Versão | Data | Descrição |
|--------|------|-----------|
| 3.0 | Julho/2026 | Criação da Estrutura Organizacional da J12 Sports ERP. |