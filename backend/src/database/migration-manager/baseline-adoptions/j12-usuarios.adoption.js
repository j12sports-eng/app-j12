"use strict";

/**
 * Documento declarativo inicial da fronteira legada.
 *
 * ATENÃ‡ÃƒO:
 * Este arquivo nÃ£o autoriza baseline nem escrita no banco.
 * A policy executÃ¡vel deve validar checksum, estrutura fÃ­sica e diferenÃ§as exatas.
 */
module.exports = Object.freeze({
  artifact: "j12_usuarios",
  classification: "LEGACY_AUTH_TABLE",
  owner: "AUTH_RUNTIME_LEGACY",
  migrationId: "20260712184500_create_auth_runtime_tables",
  status: "PENDING_FINAL_AUDIT",
  strategy: "LEGACY_ADOPTION",
  canonicalWritesAllowed: false,
  notes: Object.freeze([
    "Tabela preservada para compatibilidade com autenticaÃ§Ã£o existente.",
    "NÃ£o representa o contrato canÃ´nico de identidade e acesso.",
    "Novos mÃ³dulos canÃ´nicos nÃ£o podem depender diretamente dela.",
    "Nenhuma alteraÃ§Ã£o estrutural estÃ¡ autorizada por este manifesto."
  ])
});
