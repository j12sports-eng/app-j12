# Modelo de Permissões

---

# Objetivo

Este documento define oficialmente o modelo de autenticação, autorização e permissões da J12 Sports ERP 3.0.

O objetivo é garantir segurança, flexibilidade e escalabilidade para atender o crescimento da empresa, permitindo controlar o acesso de usuários em diferentes unidades, modalidades e módulos.

---

# Princípios

O modelo de segurança segue os princípios:

- Menor privilégio (Least Privilege)
- Segregação de funções
- Controle por papéis (RBAC)
- Controle por escopo
- Auditoria de ações
- Segurança por padrão (Security by Default)

---

# Componentes do Modelo

O controle de acesso é composto por quatro elementos principais.

## Usuário

Representa a pessoa autenticada no sistema.

Exemplos:

- Funcionário
- Professor
- Gestor
- Financeiro
- Aluno
- Responsável
- Patrocinador

---

## Função (Role)

Define o conjunto de responsabilidades do usuário.

Exemplos:

- Administrador
- Gestor
- Coordenador
- Financeiro
- Professor
- Secretaria
- Funcionário
- Aluno
- Responsável
- Patrocinador

Um usuário poderá possuir uma ou mais funções.

---

## Escopo (Scope)

Define onde a função possui validade.

Escopos suportados:

- Corporativo
- Unidade
- Modalidade
- Turma

Exemplos:

Administrador Corporativo

↓

Todas as unidades

---

Professor

↓

Arena J12

↓

Futsal

↓

Turma Sub-11

---

Gestor

↓

J12 / Nacional Academy

---

Financeiro

↓

Arena J12

---

## Permissões

Representam as ações permitidas.

Permissões básicas:

- Visualizar
- Criar
- Editar
- Excluir

Permissões especiais:

- Aprovar
- Cancelar
- Exportar
- Importar
- Financeiro
- Auditoria
- Configuração
- Backup
- Deploy

Cada módulo poderá definir permissões adicionais.

---

# Estrutura do Modelo

```text
Usuário
│
├── Função
│
├── Escopo
│
└── Permissões
```

---

# Hierarquia de Escopos

```text
Corporativo
│
├── Unidade
│
├── Modalidade
│
└── Turma
```

Um escopo superior poderá visualizar informações dos níveis inferiores quando autorizado.

---

# Matriz Geral de Acesso

| Perfil | Escopo Padrão |
|---------|---------------|
| Administrador | Corporativo |
| Gestor | Unidade |
| Coordenador | Unidade |
| Financeiro | Unidade |
| Secretaria | Unidade |
| Professor | Turma |
| Funcionário | Unidade |
| Aluno | Próprio cadastro |
| Responsável | Dependentes |
| Patrocinador | Próprio contrato |

---

# Acesso aos Portais

## Portal do Aluno

Permissões:

- Consultar matrícula
- Frequência
- Financeiro
- Agenda
- Comunicados
- Biblioteca
- Conquistas

---

## Portal do Responsável

Permissões:

- Visualizar todos os dependentes
- Financeiro
- Boletos
- Pix
- Agenda
- Comunicados
- Pagamentos

---

## Portal do Professor

Permissões:

- Turmas
- Chamada
- Agenda
- Avaliações
- Planejamento
- Comunicados

---

## Portal do Funcionário

Permissões:

- Escalas
- Comunicados
- Documentos
- Solicitações internas

---

## Portal do Patrocinador

Permissões:

- Contrato
- Vigência
- Cobranças
- Pagamentos
- Comprovantes
- Relatórios
- Benefícios contratados
- Histórico financeiro

---

# Centro de Comando

O Centro de Comando respeitará automaticamente o escopo do usuário.

Exemplos:

Administrador

↓

Visualiza todas as unidades.

---

Gestor Arena J12

↓

Visualiza apenas Arena J12.

---

Professor

↓

Visualiza apenas suas turmas.

---

# Auditoria

Toda ação crítica deverá registrar:

- Usuário
- Data
- Hora
- IP
- Unidade
- Escopo
- Operação realizada

---

# Diretrizes

Nenhuma funcionalidade poderá depender exclusivamente do frontend para controle de acesso.

Toda autorização deverá ser validada pelo backend.

Novas permissões deverão ser documentadas antes da implementação.

Toda alteração no modelo de segurança deverá ser registrada através de ADR.

---

# Evolução

O modelo foi projetado para suportar:

- Novos perfis
- Novas unidades
- Novos portais
- Novos módulos
- Novas modalidades

Sem necessidade de alterações estruturais.

---

## Histórico de Alterações

| Versão | Data | Descrição |
|--------|------|-----------|
| 3.0 | Julho/2026 | Definição oficial do modelo de permissões da J12 Sports ERP. |