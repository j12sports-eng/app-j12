-- Sprint 27.17A.3 — diagnóstico agregado e somente leitura (MySQL 8+).
-- Não retorna CPF, e-mail, telefone, nome ou qualquer valor original.
-- A normalização SQL é aproximação diagnóstica; o contrato autoritativo é o
-- módulo JavaScript person-identity-normalizer.js.

SHOW CREATE TABLE people;
SHOW INDEX FROM people;
SHOW CREATE TABLE person_profiles;
SHOW INDEX FROM person_profiles;

SELECT
  COUNT(*) AS total_people,
  SUM(cpf IS NULL OR TRIM(cpf) = '') AS cpf_absent,
  SUM(cpf IS NOT NULL AND TRIM(cpf) <> '') AS cpf_present,
  SUM(
    cpf IS NOT NULL
    AND TRIM(cpf) <> ''
    AND cpf REGEXP '^[0-9. -]+$'
    AND CHAR_LENGTH(REGEXP_REPLACE(cpf, '[. -]', '')) = 11
  ) AS cpf_approximately_normalizable,
  SUM(
    cpf IS NOT NULL
    AND TRIM(cpf) <> ''
    AND NOT (
      cpf REGEXP '^[0-9. -]+$'
      AND CHAR_LENGTH(REGEXP_REPLACE(cpf, '[. -]', '')) = 11
    )
  ) AS cpf_incompatible,
  SUM(email IS NULL OR TRIM(email) = '') AS email_absent,
  SUM(email IS NOT NULL AND TRIM(email) <> '') AS email_present,
  SUM(telefone IS NULL OR TRIM(telefone) = '') AS phone_absent,
  SUM(telefone IS NOT NULL AND TRIM(telefone) <> '') AS phone_present,
  SUM(celular IS NULL OR TRIM(celular) = '') AS mobile_absent,
  SUM(celular IS NOT NULL AND TRIM(celular) <> '') AS mobile_present
FROM people;

-- Quantidade de grupos e Pessoas afetadas por CPF normalizado repetido.
SELECT
  COUNT(*) AS duplicate_cpf_groups,
  COALESCE(SUM(group_size), 0) AS people_in_duplicate_cpf_groups
FROM (
  SELECT COUNT(*) AS group_size
  FROM people
  WHERE cpf IS NOT NULL
    AND TRIM(cpf) <> ''
    AND cpf REGEXP '^[0-9. -]+$'
    AND CHAR_LENGTH(REGEXP_REPLACE(cpf, '[. -]', '')) = 11
  GROUP BY REGEXP_REPLACE(cpf, '[. -]', '')
  HAVING COUNT(*) > 1
) AS duplicate_cpf_summary;

-- Contatos compartilhados são métricas de contato, não duplicidade de Pessoa.
SELECT COUNT(*) AS shared_email_groups
FROM (
  SELECT COUNT(*) AS group_size
  FROM people
  WHERE email IS NOT NULL AND TRIM(email) <> ''
  GROUP BY LOWER(TRIM(email))
  HAVING COUNT(*) > 1
) AS shared_email_summary;

SELECT COUNT(*) AS shared_phone_groups
FROM (
  SELECT COUNT(*) AS group_size
  FROM people
  WHERE telefone IS NOT NULL
    AND TRIM(telefone) <> ''
    AND telefone REGEXP '^\\+?[0-9(). -]+$'
  GROUP BY CONCAT(
    CASE WHEN LEFT(TRIM(telefone), 1) = '+' THEN '+' ELSE '' END,
    REGEXP_REPLACE(telefone, '[^0-9]', '')
  )
  HAVING COUNT(*) > 1
) AS shared_phone_summary;

SELECT COUNT(*) AS shared_mobile_groups
FROM (
  SELECT COUNT(*) AS group_size
  FROM people
  WHERE celular IS NOT NULL
    AND TRIM(celular) <> ''
    AND celular REGEXP '^\\+?[0-9(). -]+$'
  GROUP BY CONCAT(
    CASE WHEN LEFT(TRIM(celular), 1) = '+' THEN '+' ELSE '' END,
    REGEXP_REPLACE(celular, '[^0-9]', '')
  )
  HAVING COUNT(*) > 1
) AS shared_mobile_summary;

-- Variações de representação sem expor o valor agrupador.
SELECT COUNT(*) AS cpf_format_variation_groups
FROM (
  SELECT COUNT(DISTINCT BINARY cpf) AS representation_count
  FROM people
  WHERE cpf IS NOT NULL
    AND TRIM(cpf) <> ''
    AND cpf REGEXP '^[0-9. -]+$'
    AND CHAR_LENGTH(REGEXP_REPLACE(cpf, '[. -]', '')) = 11
  GROUP BY REGEXP_REPLACE(cpf, '[. -]', '')
  HAVING COUNT(DISTINCT BINARY cpf) > 1
) AS cpf_format_variations;

SELECT COUNT(*) AS email_format_variation_groups
FROM (
  SELECT COUNT(DISTINCT BINARY email) AS representation_count
  FROM people
  WHERE email IS NOT NULL AND TRIM(email) <> ''
  GROUP BY LOWER(TRIM(email))
  HAVING COUNT(DISTINCT BINARY email) > 1
) AS email_format_variations;

-- Perfis duplicados agregados, sem listar Pessoa ou tipo individual.
SELECT
  COUNT(*) AS duplicate_profile_groups,
  COALESCE(SUM(group_size), 0) AS profiles_in_duplicate_groups,
  COALESCE(SUM(active_count > 1), 0) AS groups_with_multiple_active_profiles,
  COALESCE(SUM(status_count > 1), 0) AS groups_with_status_conflict
FROM (
  SELECT
    COUNT(*) AS group_size,
    SUM(LOWER(TRIM(status)) IN ('ativo', 'active')) AS active_count,
    COUNT(DISTINCT LOWER(TRIM(status))) AS status_count
  FROM person_profiles
  GROUP BY person_id, LOWER(TRIM(profile_type))
  HAVING COUNT(*) > 1
) AS duplicate_profile_summary;

EXPLAIN SELECT id, cpf, email, telefone, celular, ativo
FROM people
WHERE id > ''
ORDER BY id ASC
LIMIT 500;
