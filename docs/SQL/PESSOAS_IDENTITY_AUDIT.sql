-- Sprint 27.17A.1 — diagnóstico somente leitura do modelo de identidade.
-- MySQL 8+. Retorna apenas contagens e hashes SHA-256; não retorna PII integral.
-- Execute SHOW CREATE TABLE people e SHOW INDEX FROM people separadamente para
-- conferir drift do schema vivo. Esses comandos também são somente leitura.

SELECT 'people_total' AS classification, COUNT(*) AS quantity FROM people
UNION ALL
SELECT 'cpf_null_or_blank', COUNT(*) FROM people WHERE cpf IS NULL OR TRIM(cpf) = ''
UNION ALL
SELECT 'cpf_nonblank_not_11_digits', COUNT(*) FROM people
 WHERE cpf IS NOT NULL AND TRIM(cpf) <> ''
   AND CHAR_LENGTH(REGEXP_REPLACE(cpf, '[^0-9]', '')) <> 11
UNION ALL
SELECT 'email_null_or_blank', COUNT(*) FROM people WHERE email IS NULL OR TRIM(email) = ''
UNION ALL
SELECT 'phone_null_or_blank', COUNT(*) FROM people WHERE telefone IS NULL OR TRIM(telefone) = ''
UNION ALL
SELECT 'mobile_null_or_blank', COUNT(*) FROM people WHERE celular IS NULL OR TRIM(celular) = ''
UNION ALL
SELECT 'cpf_has_mask_or_space', COUNT(*) FROM people
 WHERE cpf IS NOT NULL AND TRIM(cpf) <> '' AND cpf <> REGEXP_REPLACE(cpf, '[^0-9]', '')
UNION ALL
SELECT 'email_has_outer_space', COUNT(*) FROM people WHERE email IS NOT NULL AND email <> TRIM(email)
UNION ALL
SELECT 'email_has_uppercase', COUNT(*) FROM people
 WHERE email IS NOT NULL AND BINARY email <> BINARY LOWER(email)
UNION ALL
SELECT 'phone_has_non_digits', COUNT(*) FROM people
 WHERE telefone IS NOT NULL AND TRIM(telefone) <> ''
   AND telefone <> REGEXP_REPLACE(telefone, '[^0-9]', '')
UNION ALL
SELECT 'mobile_has_non_digits', COUNT(*) FROM people
 WHERE celular IS NOT NULL AND TRIM(celular) <> ''
   AND celular <> REGEXP_REPLACE(celular, '[^0-9]', '');

-- Grupos duplicados: o hash permite correlacionar execuções sem revelar o valor.
SELECT 'cpf_normalized_duplicate' AS classification,
       SHA2(REGEXP_REPLACE(cpf, '[^0-9]', ''), 256) AS value_hash,
       COUNT(*) AS quantity
  FROM people
 WHERE cpf IS NOT NULL AND REGEXP_REPLACE(cpf, '[^0-9]', '') <> ''
 GROUP BY REGEXP_REPLACE(cpf, '[^0-9]', '')
HAVING COUNT(*) > 1
 ORDER BY quantity DESC, value_hash;

SELECT 'email_normalized_duplicate' AS classification,
       SHA2(LOWER(TRIM(email)), 256) AS value_hash,
       COUNT(*) AS quantity
  FROM people
 WHERE email IS NOT NULL AND TRIM(email) <> ''
 GROUP BY LOWER(TRIM(email))
HAVING COUNT(*) > 1
 ORDER BY quantity DESC, value_hash;

SELECT 'phone_normalized_duplicate' AS classification,
       SHA2(REGEXP_REPLACE(telefone, '[^0-9]', ''), 256) AS value_hash,
       COUNT(*) AS quantity
  FROM people
 WHERE telefone IS NOT NULL AND REGEXP_REPLACE(telefone, '[^0-9]', '') <> ''
 GROUP BY REGEXP_REPLACE(telefone, '[^0-9]', '')
HAVING COUNT(*) > 1
 ORDER BY quantity DESC, value_hash;

SELECT 'mobile_normalized_duplicate' AS classification,
       SHA2(REGEXP_REPLACE(celular, '[^0-9]', ''), 256) AS value_hash,
       COUNT(*) AS quantity
  FROM people
 WHERE celular IS NOT NULL AND REGEXP_REPLACE(celular, '[^0-9]', '') <> ''
 GROUP BY REGEXP_REPLACE(celular, '[^0-9]', '')
HAVING COUNT(*) > 1
 ORDER BY quantity DESC, value_hash;

-- Perfis repetidos para a mesma Pessoa/tipo, sem expor PII.
SELECT 'person_profile_duplicate' AS classification,
       SHA2(CONCAT(person_id, ':', LOWER(TRIM(profile_type))), 256) AS identity_hash,
       COUNT(*) AS quantity
  FROM person_profiles
 GROUP BY person_id, LOWER(TRIM(profile_type))
HAVING COUNT(*) > 1
 ORDER BY quantity DESC, identity_hash;

-- Totais agregados para contatos compartilhados (duplicidade não implica erro).
SELECT 'shared_email_groups' AS classification, COUNT(*) AS quantity
  FROM (
    SELECT LOWER(TRIM(email)) normalized_value
      FROM people
     WHERE email IS NOT NULL AND TRIM(email) <> ''
     GROUP BY LOWER(TRIM(email)) HAVING COUNT(*) > 1
  ) shared_emails
UNION ALL
SELECT 'shared_phone_groups', COUNT(*)
  FROM (
    SELECT REGEXP_REPLACE(telefone, '[^0-9]', '') normalized_value
      FROM people
     WHERE telefone IS NOT NULL AND REGEXP_REPLACE(telefone, '[^0-9]', '') <> ''
     GROUP BY REGEXP_REPLACE(telefone, '[^0-9]', '') HAVING COUNT(*) > 1
  ) shared_phones;
