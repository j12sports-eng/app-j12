-- Sprint 27.17A.4.1 - read-only operational evidence for the CPF uniqueness gate.
-- Run only in an explicitly authorized, non-production MySQL schema without real PII.
-- The output contains schema metadata and aggregate counts only.

SELECT VERSION() AS mysql_version;

SHOW CREATE TABLE people;
SHOW INDEX FROM people;
SHOW TABLE STATUS LIKE 'people';

SELECT
  COLUMN_NAME,
  DATA_TYPE,
  CHARACTER_MAXIMUM_LENGTH,
  IS_NULLABLE,
  CHARACTER_SET_NAME,
  COLLATION_NAME,
  ORDINAL_POSITION
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'people'
  AND COLUMN_NAME IN (
    'cpf',
    'email',
    'telefone',
    'celular',
    'cpf_normalized',
    'email_normalized',
    'telefone_normalized',
    'celular_normalized'
  )
ORDER BY ORDINAL_POSITION;

SELECT
  INDEX_NAME,
  NON_UNIQUE,
  INDEX_TYPE,
  GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS indexed_columns,
  MAX(CARDINALITY) AS approximate_cardinality
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'people'
GROUP BY INDEX_NAME, NON_UNIQUE, INDEX_TYPE
ORDER BY INDEX_NAME;

SELECT
  COUNT(*) AS total_records,
  SUM(cpf_normalized IS NULL) AS cpf_normalized_null_records,
  SUM(cpf_normalized IS NOT NULL) AS cpf_normalized_present_records,
  SUM(cpf_normalized IS NOT NULL AND cpf_normalized NOT REGEXP '^[0-9]{11}$')
    AS cpf_normalized_invalid_records,
  SUM(NULLIF(TRIM(cpf), '') IS NOT NULL AND cpf_normalized IS NULL)
    AS cpf_source_present_normalized_null_records
FROM people;

SELECT
  COUNT(*) AS duplicate_groups,
  COALESCE(SUM(group_size), 0) AS duplicate_records
FROM (
  SELECT COUNT(*) AS group_size
  FROM people
  WHERE cpf_normalized IS NOT NULL
  GROUP BY cpf_normalized
  HAVING COUNT(*) > 1
) AS duplicate_cpf_groups;

SELECT
  COUNT(*) AS records_with_all_normalized_contacts_null
FROM people
WHERE cpf_normalized IS NULL
  AND email_normalized IS NULL
  AND telefone_normalized IS NULL
  AND celular_normalized IS NULL;

SELECT
  COUNT(*) AS inactive_records,
  SUM(ativo = 1) AS active_records
FROM people;

EXPLAIN
SELECT id
FROM people
WHERE cpf_normalized = '00000000000'
LIMIT 2;
