import { jsPDF } from "jspdf";
import type { Contrato } from "./contratos-store";

/**
 * Gera o PDF do contrato seguindo layout jurídico:
 * cabeçalho da J12, corpo com quebra automática, rodapé com paginação.
 */
export function gerarContratoPDF(c: Contrato): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56; // 0.78"
  const maxW = pageW - margin * 2;

  let y = margin;

  function drawHeader() {
    // Faixa laranja
    doc.setFillColor(255, 69, 0);
    doc.rect(0, 0, pageW, 36, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("J12 SPORTS", margin, 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      "CNPJ 28.665.452/0001-01 — Av. Paula Ferreira, 3262, Pirituba, SP",
      pageW - margin,
      24,
      {
        align: "right",
      },
    );
    doc.setTextColor(20, 20, 20);
  }

  function drawFooter(pageNum: number, totalPages: number) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Contrato J12 — ${c.alunoNome}`, margin, pageH - 24);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageW - margin, pageH - 24, { align: "right" });
    doc.setTextColor(20, 20, 20);
  }

  function ensureSpace(h: number) {
    if (y + h > pageH - margin) {
      doc.addPage();
      drawHeader();
      y = 56 + 16;
    }
  }

  drawHeader();
  y = 56 + 16;

  const lines = c.conteudo.split("\n");

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, "");
    if (!line) {
      y += 6;
      continue;
    }

    // Heurística de formatação
    const isTitle = /^(CONTRATO DE MATRÍCULA J12)$/.test(line);
    const isSection = /^(I|II|III|IV|V|VI|VII|VIII|IX|X)\s+—/.test(line);
    const isClausula = /^Cláusula\s/.test(line);
    const isParagrafo = /^Parágrafo\s/.test(line);
    const isPlanoHeader = /^PLANO J12$/.test(line);
    const isBullet = /^•\s/.test(line);

    if (isTitle) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      ensureSpace(22);
      doc.text(line, pageW / 2, y, { align: "center" });
      y += 22;
      // linha decorativa
      doc.setDrawColor(255, 69, 0);
      doc.setLineWidth(1.2);
      doc.line(margin, y - 4, pageW - margin, y - 4);
      y += 8;
      continue;
    }

    if (isSection) {
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      ensureSpace(16);
      doc.text(line, margin, y);
      y += 14;
      continue;
    }

    if (isClausula || isPlanoHeader) {
      y += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      ensureSpace(14);
      doc.text(line, margin, y);
      y += 13;
      continue;
    }

    doc.setFont("helvetica", isParagrafo ? "italic" : "normal");
    doc.setFontSize(10);

    const indent = isBullet ? 14 : 0;
    const wrapped = doc.splitTextToSize(line, maxW - indent);
    for (const w of wrapped) {
      ensureSpace(13);
      doc.text(w, margin + indent, y);
      y += 13;
    }
    y += 2;
  }

  // Bloco de assinatura
  y += 18;
  ensureSpace(110);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.6);
  doc.line(margin, y, margin + 240, y);
  doc.line(pageW - margin - 240, y, pageW - margin, y);
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("CONTRATANTE / RESPONSÁVEL", margin, y);
  doc.text("J12 SPORTS LTDA", pageW - margin - 240, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.text(c.responsavel.nome || "—", margin, y);
  doc.text("CNPJ 28.665.452/0001-01", pageW - margin - 240, y);
  y += 12;
  if (c.responsavel.cpf) {
    doc.text(`CPF ${c.responsavel.cpf}`, margin, y);
    y += 12;
  }

  if (c.assinatura) {
    y += 10;
    ensureSpace(60);
    doc.setFillColor(255, 247, 240);
    doc.setDrawColor(255, 69, 0);
    doc.roundedRect(margin, y, maxW, 56, 6, 6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 69, 0);
    doc.text("✓ ASSINATURA ELETRÔNICA REGISTRADA", margin + 12, y + 16);
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Assinado por: ${c.assinatura.nome} (CPF ${c.assinatura.cpf})`, margin + 12, y + 30);
    doc.text(
      `Data/Hora: ${new Date(c.assinatura.assinadoEm).toLocaleString("pt-BR")} — IP ${c.assinatura.ip} — ${c.assinatura.dispositivo}`,
      margin + 12,
      y + 44,
    );
    doc.text(
      "Aceite digital com validade jurídica nos termos da MP nº 2.200-2/2001.",
      margin + 12,
      y + 56 - 4,
    );
    y += 64;
  }

  // Numeração final
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(i, total);
  }

  return doc;
}

export function baixarContratoPDF(c: Contrato) {
  const doc = gerarContratoPDF(c);
  const safe = c.alunoNome.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  doc.save(`contrato_j12_${safe}_${c.id}.pdf`);
}
