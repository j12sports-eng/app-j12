import { useState } from "react";
import { useNotificacoesAluno } from "@/hooks/useNotificacoesAluno";

export function NotificationBell() {
  const [aberto, setAberto] = useState(false);

  const { notificacoes, marcarComoLida } = useNotificacoesAluno();

  const naoLidas = notificacoes.filter((item) => !item.lida).length;

  return (
    <div
      style={{
        position: "relative",
      }}
    >
      <button
        onClick={() => setAberto(!aberto)}
        style={{
          background: "transparent",
          border: "none",
          color: "white",
          fontSize: "28px",
          cursor: "pointer",
          position: "relative",
        }}
      >
        🔔
        {naoLidas > 0 && (
          <div
            style={{
              position: "absolute",
              top: "-5px",
              right: "-8px",
              background: "#dc2626",
              color: "white",
              borderRadius: "999px",
              minWidth: "22px",
              height: "22px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: "bold",
              padding: "0 6px",
            }}
          >
            {naoLidas}
          </div>
        )}
      </button>

      {aberto && (
        <div
          style={{
            position: "absolute",
            top: "45px",
            right: 0,
            width: "360px",
            background: "#18181b",
            border: "1px solid #333",
            borderRadius: "20px",
            padding: "20px",
            zIndex: 999,
            maxHeight: "500px",
            overflowY: "auto",
          }}
        >
          <h3
            style={{
              color: "#ff6600",
              marginBottom: "20px",
            }}
          >
            Notificações
          </h3>

          {notificacoes.length === 0 && (
            <p
              style={{
                color: "#777",
              }}
            >
              Nenhuma notificação
            </p>
          )}

          {notificacoes.map((item) => (
            <div
              key={item.id}
              style={{
                padding: "15px",
                borderRadius: "12px",
                background: item.lida ? "#111" : "#222",
                marginBottom: "15px",
                border: item.lida ? "1px solid #222" : "1px solid #ff6600",
              }}
            >
              <strong
                style={{
                  color: "white",
                }}
              >
                {item.titulo}
              </strong>

              <p
                style={{
                  color: "#bbb",
                  marginTop: "8px",
                  marginBottom: "12px",
                  fontSize: "14px",
                }}
              >
                {item.mensagem}
              </p>

              {!item.lida && (
                <button
                  onClick={() => marcarComoLida(item.id)}
                  style={{
                    background: "#ff6600",
                    color: "black",
                    border: "none",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  Marcar como lida
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
