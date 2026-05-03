import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { financeiroStore, formatBRL, type Transacao } from "@/lib/financeiro-store";
import { toast } from "sonner";

type Forma = NonNullable<Transacao["formaPagamento"]>;

const FORMAS: Array<{ v: Forma; label: string }> = [
  { v: "pix", label: "PIX" },
  { v: "cartao", label: "Cartão" },
  { v: "dinheiro", label: "Dinheiro" },
  { v: "boleto", label: "Boleto" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Lista a baixar. 1 item = baixa manual, N itens = baixa em lote. */
  transacoes: Transacao[];
}

export function BaixaDialog({ open, onOpenChange, transacoes }: Props) {
  const [forma, setForma] = useState<Forma>("pix");
  const [saving, setSaving] = useState(false);

  const total = transacoes.reduce((acc, t) => acc + t.valor, 0);
  const isLote = transacoes.length > 1;

  async function confirmar() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 250));
    try {
      if (isLote) {
        const n = financeiroStore.baixarLote(
          transacoes.map((t) => t.id),
          forma,
        );
        toast.success(`${n} cobrança${n === 1 ? "" : "s"} baixada${n === 1 ? "" : "s"}`);
      } else if (transacoes[0]) {
        financeiroStore.baixar(transacoes[0].id, forma);
        toast.success("Cobrança baixada");
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isLote ? "Baixa automática" : "Baixar cobrança"}</DialogTitle>
          <DialogDescription>
            {isLote
              ? `Marcar ${transacoes.length} cobranças como pagas hoje.`
              : transacoes[0]?.alunoNome + " — " + transacoes[0]?.descricao}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <div className="text-xs text-muted-foreground">Total a receber</div>
          <div className="text-2xl font-bold text-success">{formatBRL(total)}</div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Forma de pagamento</div>
          <div className="grid grid-cols-2 gap-2">
            {FORMAS.map((f) => (
              <button
                key={f.v}
                type="button"
                onClick={() => setForma(f.v)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  forma === f.v
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card hover:bg-accent/10"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={saving || transacoes.length === 0}
            className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60 hover:opacity-90"
          >
            {saving ? "Confirmando..." : "Confirmar baixa"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
