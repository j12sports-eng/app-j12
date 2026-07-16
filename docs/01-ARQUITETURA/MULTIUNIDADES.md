# Arquitetura Multiunidades

---

# Objetivo

Este documento define a arquitetura Multiunidades da J12 Sports ERP 3.0.

O objetivo é permitir que a plataforma administre múltiplas unidades operacionais utilizando uma única base tecnológica, preservando a independência operacional de cada unidade e permitindo visão consolidada da empresa.

A arquitetura foi projetada para suportar a expansão da J12 Sports sem necessidade de alterações estruturais.

---

# Conceito

A plataforma utiliza uma arquitetura Multiunidades nativa.

Cada unidade possui identidade própria, porém compartilha:

- Plataforma
- Usuários
- Segurança
- APIs
- Componentes
- Infraestrutura

Ao mesmo tempo, cada unidade possui seus próprios dados operacionais.

---

# Estrutura Hierárquica

```text
J12 Sports
│
├── Arena J12
│
├── J12 / Nacional Academy
│
└── J12 / Santa Marina
```

A arquitetura permite adicionar novas unidades sem impacto no sistema existente.

---

# Unidades Atuais

## Arena J12

Tipo:

Sede Administrativa.

Modalidades:

- Futsal
- Vôlei

Serviços:

- Escola esportiva
- Locação de quadras
- Eventos
- Festivais
- Campeonatos

Características:

- Administração central
- Centro financeiro
- Unidade principal

---

## J12 / Nacional Academy

Modalidade:

- Society

Serviço:

- Escola esportiva

Características:

- Operação em espaço parceiro
- Gestão integrada ao ERP

---

## J12 / Santa Marina

Modalidade:

- Futsal

Serviço:

- Escola esportiva

Características:

- Operação em espaço parceiro
- Gestão integrada ao ERP

---

# Estrutura de Dados

Cada registro operacional deverá possuir vínculo com uma unidade.

Exemplos:

- Aluno
- Professor
- Funcionário
- Turma
- Agenda
- Mensalidade
- Cobrança
- Pagamento
- Evento
- Campeonato
- Patrocinador

Isso permitirá consultas específicas e consolidadas.

---

# Escopos de Visualização

A plataforma trabalhará com quatro níveis de visualização.

## 1. Corporativo

Visualiza todas as unidades.

Utilizado por:

- Administrador
- Diretoria

---

## 2. Unidade

Visualiza apenas uma unidade.

Utilizado por:

- Coordenadores
- Gestores locais

---

## 3. Modalidade

Visualiza apenas uma modalidade da unidade selecionada.

Exemplos:

- Futsal
- Society
- Vôlei

---

## 4. Turma

Visualiza apenas uma turma específica.

Utilizado principalmente por professores.

---

# Centro de Comando

O Centro de Comando deverá permitir alternância entre escopos.

Exemplos:

Visão Corporativa

↓

Todas as unidades

---

Visão Arena J12

↓

Somente Arena J12

---

Visão Nacional Academy

↓

Somente Nacional Academy

---

Visão Santa Marina

↓

Somente Santa Marina

---

Essa alternância deverá refletir automaticamente em todos os indicadores.

---

# Permissões

Cada usuário poderá possuir um escopo diferente.

Exemplos:

Administrador

↓

Todas as unidades

---

Coordenador Arena

↓

Arena J12

---

Professor

↓

Somente suas turmas

---

Financeiro

↓

Unidades autorizadas

---

# Crescimento

A arquitetura suporta:

- Novas unidades
- Novas modalidades
- Novos gestores
- Novos serviços

Sem necessidade de alterações estruturais.

---

# Futuras Expansões

A arquitetura foi preparada para suportar:

- Franquias
- Novas cidades
- Novos estados
- Operação nacional

A expansão ocorrerá apenas através de configuração, mantendo a mesma base do sistema.

---

# Benefícios

A arquitetura Multiunidades proporciona:

- Escalabilidade
- Organização
- Segurança
- Relatórios por unidade
- Indicadores por unidade
- Dashboard consolidado
- Crescimento sustentável

---

# Diretrizes

Toda nova unidade deverá possuir:

- Identificador único
- Configurações próprias
- Agenda própria
- Professores vinculados
- Modalidades vinculadas
- Serviços configuráveis

A inclusão de uma nova unidade não deverá exigir alterações no código-fonte do ERP.

---

## Histórico de Alterações

| Versão | Data | Descrição |
|--------|------|-----------|
| 3.0 | Julho/2026 | Definição oficial da arquitetura Multiunidades da J12 Sports ERP. |