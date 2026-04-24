import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, FileSignature, PencilLine, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FormaAssinaturaProfessor, Professor } from "@/lib/professores-store";
import {
  getProfessorModalidadesLabel,
  getProfessorUnidadesLabel,
  professoresStore,
} from "@/lib/professores-store";
import { SignatureCanvasField } from "./SignatureCanvasField";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  professor: Professor | null;
}

export function ProfessorContractSignatureModal({ open, onOpenChange, professor }: Props) {
  const [nomeAssinante, setNomeAssinante] = useState("");
  const [cpfAssinante, setCpfAssinante] = useState("");
  const [method, setMethod] = useState<FormaAssinaturaProfessor>("Canvas");
  const [aceite, setAceite] = useState(false);
  const [canvasValue, setCanvasValue] = useState("");
  const [digitadaValue, setDigitadaValue] = useState("");

  useEffect(() => {
    if (!open || !professor) return;
    setNomeAssinante(professor.nome);
    setCpfAssinante(professor.cpf);
    setMethod("Canvas");
    setAceite(false);
    setCanvasValue("");
    setDigitadaValue(professor.nome);
  }, [open, professor]);

  const readyToSign = useMemo(() => {
    if (!nomeAssinante.trim() || !cpfAssinante.trim() || !aceite) return false;
    if (method === "Canvas") return Boolean(canvasValue);
    if (method === "Digitada") return Boolean(digitadaValue.trim());
    return true;
  }, [aceite, canvasValue, cpfAssinante, digitadaValue, method, nomeAssinante]);

  if (!professor || professor.contrato.status === "Não gerado") return null;

  function confirmSignature() {
    if (!readyToSign) {
      toast.error("Preencha os dados e conclua a assinatura antes de confirmar.");
      return;
    }

    const signaturePayload = {
      nomeAssinante: nomeAssinante.trim(),
      cpfAssinante: cpfAssinante.trim(),
      formaAssinatura: method,
      representacaoAssinatura:
        method === "Canvas"
          ? canvasValue
          : method === "Digitada"
            ? digitadaValue.trim()
            : "Aceite eletronico",
    } as const;

    const result = professoresStore.signContract(professor.id, signaturePayload);

    if (!result.ok) {
      toast.error(result.reason);
      return;
    }

    toast.success("Contrato do professor assinado com sucesso.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-primary/20 bg-[#070b14] text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileSignature className="h-5 w-5 text-primary" />
            Assinatura digital do contrato
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Revise o contrato, confirme seus dados e escolha o mesmo padrao de aceite digital usado
            no contrato do aluno.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1.05fr_1.35fr]">
          <div className="space-y-4 rounded-3xl border border-primary/20 bg-[#0b1120] p-5">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-primary/80">
                Resumo do contrato
              </div>
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="font-semibold text-white">{professor.nome}</div>
                <div className="mt-1 text-slate-400">#{professor.contrato.numeroContrato}</div>
                <div className="mt-3 space-y-2 text-slate-300">
                  <div>Tipo: {professor.tipoContrato}</div>
                  <div>Modalidades: {getProfessorModalidadesLabel(professor) || "A definir"}</div>
                  <div>Unidades: {getProfessorUnidadesLabel(professor) || "A definir"}</div>
                  <div>
                    Valor:{" "}
                    {professor.valorContrato.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </div>
                  <div>Pagamento: {professor.formaPagamentoProfessor}</div>
                  <div>
                    Inicio:{" "}
                    {new Date(`${professor.dataInicioContrato}T00:00:00`).toLocaleDateString(
                      "pt-BR",
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="nome-assinante" className="text-slate-200">
                  Nome do assinante
                </Label>
                <Input
                  id="nome-assinante"
                  value={nomeAssinante}
                  onChange={(e) => setNomeAssinante(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf-assinante" className="text-slate-200">
                  CPF do assinante
                </Label>
                <Input
                  id="cpf-assinante"
                  value={cpfAssinante}
                  onChange={(e) => setCpfAssinante(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-primary/20 bg-[#0b1120] p-5">
            <Tabs
              value={method}
              onValueChange={(value) => setMethod(value as FormaAssinaturaProfessor)}
            >
              <TabsList className="grid h-auto grid-cols-3 bg-white/5">
                <TabsTrigger value="Canvas" className="gap-2">
                  <PencilLine className="h-4 w-4" />
                  Canvas
                </TabsTrigger>
                <TabsTrigger value="Digitada" className="gap-2">
                  <Type className="h-4 w-4" />
                  Digitada
                </TabsTrigger>
                <TabsTrigger value="Aceite" className="gap-2">
                  <BadgeCheck className="h-4 w-4" />
                  Aceite
                </TabsTrigger>
              </TabsList>

              <TabsContent value="Canvas">
                <SignatureCanvasField value={canvasValue} onChange={setCanvasValue} />
              </TabsContent>

              <TabsContent value="Digitada">
                <div className="space-y-3 rounded-2xl border border-primary/20 bg-[#0b1120] p-4">
                  <Label htmlFor="assinatura-digitada" className="text-slate-200">
                    Assinatura digitada
                  </Label>
                  <Input
                    id="assinatura-digitada"
                    value={digitadaValue}
                    onChange={(e) => setDigitadaValue(e.target.value)}
                    placeholder="Digite o nome como assinatura"
                  />
                  <div className="rounded-2xl border border-dashed border-primary/25 bg-slate-950 px-4 py-6 text-center">
                    <div
                      className="text-3xl text-primary"
                      style={{ fontFamily: '"Brush Script MT", cursive' }}
                    >
                      {digitadaValue || "Sua assinatura aparecera aqui"}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="Aceite">
                <div className="rounded-2xl border border-primary/20 bg-[#0b1120] p-4 text-sm text-slate-300">
                  <p>
                    Ao escolher aceite eletronico simples, voce confirma que leu, compreendeu e
                    aceita integralmente o contrato do professor, reconhecendo sua validade juridica
                    no ambiente digital.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <label className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-white/5 p-4 text-sm text-slate-300">
              <Checkbox
                checked={aceite}
                onCheckedChange={(value) => setAceite(value === true)}
                className="mt-0.5"
              />
              <span>
                Confirmo que revisei os termos, autorizo o registro da minha assinatura digital e
                aceito o contrato do professor nas condicoes apresentadas pela J12.
              </span>
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={confirmSignature}
            disabled={!readyToSign}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Confirmar assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
