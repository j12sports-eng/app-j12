/**
 * Modelo OFICIAL J12 SPORTS — Contrato de Matrícula 2026.
 * Variáveis dinâmicas no formato {{grupo.campo}} são substituídas
 * em tempo real por dados do aluno, responsável, plano e financeiro.
 */
export const CONTRATO_TEMPLATE_J12 = `CONTRATO DE MATRÍCULA J12

CONTRATADA: J12 SPORTS LTDA, inscrita no CNPJ nº 28.665.452/0001-01, localizada em São Paulo, com sede a Avenida Paula Ferreira, 3262, Pirituba – SP. CEP: 02916-000.

CONTRATANTE / RESPONSÁVEL: {{responsavel.nome}}, CPF nº: {{responsavel.cpf}}, Celular: {{responsavel.telefone}}, E-mail: {{responsavel.email}}, residente e domiciliado(a): {{responsavel.endereco}}.

Denominado(a) responsável (familiar do(a) aluno(a)).

Nome do(a) aluno(a): {{aluno.nome}}, nascido(a) em {{aluno.data_nascimento}}.

As partes identificadas acima têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas a seguir.

I — OBJETO DO CONTRATO

Cláusula 1ª — Objeto
O presente contrato tem por objeto a prestação de serviços pela J12 ao CLIENTE, referente à realização de aulas de futsal e/ou society, ministradas por profissionais devidamente habilitados e em conformidade com as normas do CREF/CONFEF. Por meio deste contrato, o CLIENTE formaliza a matrícula do aluno na J12, conforme os seguintes detalhes:

PLANO J12
• Plano: {{plano.tipo}}
• Modalidade(s): {{plano.modalidade}}
• Frequência: {{plano.frequencia}}
• Dia(s) e Horário: {{plano.horario}}
• Unidade(s): {{plano.unidade}}

Parágrafo 1º. A direção da J12 está sempre disponível para um diálogo construtivo com o CLIENTE ou RESPONSÁVEIS que demonstrem interesse na melhoria da qualidade das aulas e no processo evolutivo do aluno.

Parágrafo 2º. O regulamento interno da J12 pode ser solicitado ao setor responsável.

Parágrafo 3º. A J12 se compromete a cumprir as datas e horários estabelecidos neste contrato. Caso seja necessário alterar o horário ou a turma, o CLIENTE/RESPONSÁVEL será notificado pessoalmente ou via WhatsApp.

Parágrafo 4º. O cliente deverá apresentar atestado médico, ficando a J12 isenta de responsabilidade por eventuais problemas de saúde do aluno. O atestado médico deverá ser atualizado a cada doze meses, ficando o cliente responsável por tal ato.

Parágrafo 5º. O cliente se declara ciente de que apesar da J12 não poupar esforços para proteger a integridade física dos alunos, a prática de esporte exige esforço físico e contato físico entre os alunos, o que poderá gerar lesões físicas imprevistas, eximindo a J12 de responsabilidade junto a lesões condizentes com a atividade praticada.

Parágrafo 6º. Nos casos de lesões verificadas durante as atividades, a J12 se colocará à disposição aos primeiros socorros, cabendo ao cliente, de forma exclusiva, se responsabilizando pelo ocorrido.

Parágrafo 7º. A reposição das aulas de futsal e Society será realizada exclusivamente mediante apresentação de atestado médico que comprove a incapacidade do aluno de participar das aulas nas datas correspondentes.

Parágrafo 8º. Para a participação em eventos especiais, como campeonatos, festivais e jogos amistosos, será cobrada uma taxa adicional, informada previamente aos responsáveis.

Parágrafo 9º. A taxa de pagamento deverá ser quitada até a data limite informada pela administração da J12, sob pena de o aluno não poder participar do evento. Caso o aluno desista após o pagamento, o valor não será reembolsado, salvo situações excepcionais.

Parágrafo 10º. A J12 disponibiliza e empresta para cada aluno um uniforme de jogo (camisa e calção) para uso em campeonatos. Em caso de perda, extravio ou danos ao uniforme de jogo, o responsável se compromete a pagar multa no valor de R$ 190,00 (cento e noventa reais).

Parágrafo 11º. A J12 não se responsabiliza por objetos pessoais deixados no local de treinamento e jogos.

Parágrafo 12º. O CONTRATANTE autoriza, de forma gratuita e por prazo indeterminado, a utilização da imagem, voz e nome do aluno pela J12, exclusivamente para fins institucionais e promocionais. A autorização compreende a captação, reprodução e divulgação em materiais impressos, digitais e audiovisuais, sem qualquer ônus ou remuneração ao CONTRATANTE.

Parágrafo 13º. É obrigatório o uso do uniforme completo de treino da J12 (camiseta, calção e meião) nos dias de treino e jogo.

Parágrafo 14º. A realização das aulas em feriados ficará a critério da J12. Caso não haja aula, não haverá reposição nem reembolso.

Parágrafo 15º. O responsável poderá solicitar alteração do dia de treino e/ou da modalidade contratada, desde que haja disponibilidade. Trocas que envolvam plano com valor diferente serão ajustadas proporcionalmente.

Cláusula 2ª — Documentação Necessária
Para efetivação da matrícula:
• Cópia do documento de identidade do aluno;
• Cópia do documento de identidade do responsável;
• Comprovante de endereço atualizado (últimos 3 meses);
• Atestado médico de aptidão física recente.

Documentos deverão ser anexados ao sistema da J12 ou enviados por WhatsApp em até 15 dias úteis após a assinatura.

II — REMUNERAÇÃO

Cláusula 3ª — Pagamento
Pela prestação dos serviços, o CLIENTE compromete-se a efetuar o pagamento à J12, conforme:
• Valor total: {{financeiro.valor_total}}
• Forma de pagamento: {{financeiro.parcelas}} parcelas de {{financeiro.valor_mensal}}
• Vencimento: dia {{financeiro.vencimento}} de cada mês

Parágrafo 1º. Em caso de atraso no pagamento, será aplicada multa de R$ 10,00 (dez reais), além de juros moratórios de 2% (dois por cento) ao mês.

Parágrafo 2º. A mensalidade deverá ser paga integralmente, independentemente da quantidade de aulas frequentadas, inclusive em meses com férias, feriados ou pausas no calendário. A ausência do aluno não dará direito a desconto, compensação ou isenção, pois a mensalidade refere-se à reserva da vaga e à disponibilidade da estrutura. A reposição só será permitida mediante atestado médico.

Cláusula 4ª — Inadimplência
O não pagamento das mensalidades na data de vencimento caracterizará inadimplência. Após 15 (quinze) dias de atraso, a J12 poderá suspender o acesso do aluno às aulas e atividades. Persistindo a inadimplência por período superior a 30 (trinta) dias, a matrícula poderá ser bloqueada e/ou cancelada, podendo o aluno perder a sua vaga.

O CONTRATANTE autoriza desde já a adoção de medidas de cobrança, incluindo, se necessário, a inclusão do débito nos órgãos de proteção ao crédito (SPC/Serasa).

III — PRAZO

Cláusula 5ª — Prazo
O presente contrato terá vigência iniciando-se em {{contrato.data_inicio}} e encerrando-se em {{contrato.data_fim}}.

IV — CANCELAMENTO ANTECIPADO

Cláusula 6ª — Cancelamento
Em caso de cancelamento antes do término do período contratado, será aplicada multa equivalente a 50% do valor total dos meses restantes, a ser paga pelo CLIENTE no ato da rescisão.

V — CONDUTA E DISCIPLINA
O aluno deverá manter comportamento adequado, pautado no respeito aos professores, colaboradores, colegas e às normas internas da J12. Em caso de conduta inadequada, a J12 poderá aplicar advertência, suspensão ou desligamento do aluno, sem direito a reembolso de valores já pagos.

VI — RENOVAÇÃO

Cláusula 7ª — Renovação
Ao término do prazo contratual, o presente contrato poderá ser renovado automaticamente mediante o pagamento da mensalidade referente ao novo período, condicionado à disponibilidade de vaga. A J12 poderá revisar valores, horários e condições para o novo período mediante comunicação prévia.

VII — CASO FORTUITO E FORÇA MAIOR
A CONTRATADA não será responsabilizada pela interrupção, suspensão ou alteração das atividades decorrentes de eventos de caso fortuito ou força maior (chuvas intensas, problemas estruturais, determinações governamentais, pandemias, falta de energia etc.). Não há direito a reembolso, desconto ou indenização.

VIII — ASSINATURA ELETRÔNICA E VALIDADE JURÍDICA
O presente contrato poderá ser firmado por meio de assinatura eletrônica ou aceite digital, incluindo sistemas próprios da J12, plataformas online e/ou confirmação via WhatsApp. As partes reconhecem que o aceite eletrônico constitui manifestação válida de vontade, possui plena validade jurídica e eficácia probatória, nos termos da Medida Provisória nº 2.200-2/2001.

Para fins de comprovação, poderão ser utilizados registros eletrônicos: data e hora do aceite, endereço de IP, identificação do dispositivo e dados cadastrais. O CONTRATANTE declara estar ciente de que o aceite eletrônico possui caráter irrevogável e irretratável, salvo nos casos previstos em lei.

IX — FORO
Para dirimir quaisquer dúvidas, será competente o foro do domicílio do CONTRATANTE. Subsidiariamente, fica eleito o foro da Comarca de São Paulo/SP, com renúncia expressa de qualquer outro.

São Paulo, {{contrato.data_assinatura}}.
`;

export interface ContratoVariaveis {
  responsavel: {
    nome: string;
    cpf: string;
    telefone: string;
    email: string;
    endereco: string;
  };
  aluno: {
    nome: string;
    data_nascimento: string;
  };
  plano: {
    tipo: string;
    modalidade: string;
    frequencia: string;
    horario: string;
    unidade: string;
  };
  financeiro: {
    valor_total: string;
    parcelas: string;
    valor_mensal: string;
    vencimento: string;
  };
  contrato: {
    data_inicio: string;
    data_fim: string;
    data_assinatura: string;
  };
}

/** Substitui todas as variáveis {{grupo.campo}} no template. */
export function renderTemplate(template: string, vars: ContratoVariaveis): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, path: string) => {
    const parts = path.split(".");
    let cur: unknown = vars;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        return `{{${path}}}`;
      }
    }
    const v = String(cur ?? "").trim();
    return v || `{{${path}}}`;
  });
}

export function formatBRDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatBRDateLong(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}