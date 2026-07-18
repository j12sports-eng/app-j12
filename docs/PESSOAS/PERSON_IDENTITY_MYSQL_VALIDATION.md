# Validação MySQL Isolada da Identidade

## Estado observado

Em 18/07/2026 a capacidade local foi classificada como `UNAVAILABLE`: Docker, cliente/serviço MySQL e listeners nas portas 3306–3315 não foram encontrados. Nenhuma conexão foi aberta e nenhuma variável `DB_*` existente foi utilizada. Todas as evidências físicas permanecem `NOT_EXECUTED`.

## Ambiente opcional

O Compose dedicado usa MySQL 8.4, publica somente em `127.0.0.1:33317`, usa `tmpfs` e não integra deploy, PM2, Nginx ou homologação.

```powershell
$env:IDENTITY_MYSQL_ROOT_PASSWORD='<LOCAL_SYNTHETIC_SECRET>'
$env:IDENTITY_MYSQL_PASSWORD='<LOCAL_SYNTHETIC_SECRET>'
$env:IDENTITY_MYSQL_HOST='127.0.0.1'
$env:IDENTITY_MYSQL_PORT='33317'
$env:IDENTITY_MYSQL_USER='j12_identity_validator'
$env:IDENTITY_MYSQL_DATABASE='j12_identity_validation'
docker compose -f infra/mysql/docker-compose.identity-validation.yml up -d
docker compose -f infra/mysql/docker-compose.identity-validation.yml ps
node backend/scripts/validate-person-identity-mysql.js preflight --confirm-local --database=j12_identity_validation
node backend/scripts/validate-person-identity-mysql.js full --confirm-local --confirm-empty --database=j12_identity_validation --batch-size=5
node backend/scripts/validate-person-identity-mysql.js cleanup --confirm-local --confirm-cleanup --database=j12_identity_validation
docker compose -f infra/mysql/docker-compose.identity-validation.yml logs --no-color
docker compose -f infra/mysql/docker-compose.identity-validation.yml down -v
```

Não salve secrets no repositório. O executor aceita somente loopback, schema `j12_identity_validation[_sufixo]`, variáveis `IDENTITY_MYSQL_*` e confirmação explícita. A foundation SQL e a migration A.4 são reutilizadas diretamente. Cleanup exige marcador de propriedade.

## Checklist físico pendente

- registrar versão, engine, charset e collation;
- validar quatro colunas nullable, quatro índices comuns e ausência de unique;
- usar apenas fixtures sintéticas para múltiplos lotes, inválidos, zeros à esquerda, duplicidade, drift e múltiplos `NULL`;
- validar repository create/update/null explícito;
- validar retomada, status e down em estados vazio, populado e parcial;
- registrar medições agregadas e cleanup;
- alimentar o gate sem flexibilizar critérios.

Até essa execução, o resultado correto é `ENVIRONMENT_UNAVAILABLE`.
