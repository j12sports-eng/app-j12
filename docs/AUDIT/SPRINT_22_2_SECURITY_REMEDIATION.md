# Sprint 22.2 - Remediação e gates

## Alterações implementadas

1. PM2 produção e HML apontam para `backend/server.js`.
2. Recuperação de senha retorna resposta uniforme e não expõe token em produção.
3. Login, recuperação, reset e primeiro acesso têm limite dedicado configurável.
4. Cadastro privado de professores exige perfil gerencial também nas leituras.
5. Professor só consulta/altera presença em turma atribuída e aluno vinculado por turma ou matrícula ativa.
6. Testes focados validam composition root, proteção de reset, privacidade, ownership e JWT.

## Configuração

- `AUTH_RATE_LIMIT_WINDOW_MS`: padrão 900000 ms.
- `AUTH_RATE_LIMIT_MAX`: padrão 10.
- `RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX`: proteção geral existente.
- `JWT_SECRET` e `JWT_EXPIRES`: obrigatórios; valores nunca devem ser versionados.

## Bloqueios externos

- Rotacionar/revogar certificado e chave Banco Inter rastreados; depois remover artefatos do Git e avaliar saneamento do histórico por procedimento aprovado.
- Confirmar TLS/HSTS, IP real e `trust proxy` na topologia Nginx/VPS.
- Executar webhook, replay, Pix e n8n apenas em HML isolada.
- Executar E2E com usuários distintos e banco controlado.

## Próximas ações internas

- Implementar revogação persistida/versionamento de JWT.
- Atualizar dependências vulneráveis em PR isolado, sem major upgrade automático.
- Expandir inventário executável para todas as rotas legadas.
- Remover logs versionados após revisão de PII e definir rotação.

Nenhuma credencial foi alterada, nenhuma integração externa foi chamada e a Sprint 22.3 não foi iniciada.
