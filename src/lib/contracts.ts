import { jsPDF } from "jspdf";
import type { RentalOrder } from "../types";

/**
 * Modelo inicial de contrato para testes. Antes de usar comercialmente,
 * substitua as cláusulas pelo texto revisado pela loja/assessoria jurídica.
 */
export function downloadRentalContract(order: RentalOrder) {
  const pdf = new jsPDF();
  const margin = 18;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("CONTRATO DE LOCAÇÃO DE TRAJE", margin, y);
  y += 12;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const lines = [
    `Pedido: ${order.id}`,
    `Locatário(a): ${order.customer_name}`,
    `CPF: ${order.customer_cpf}`,
    `Traje: ${order.dress_description} (código: ${order.dress_code || "não informado"})`,
    `Data do evento: ${order.event_date}`,
    `Atendente responsável: ${order.attendant}`,
    `Valor total: ${formatCurrency(order.total_amount)}`,
    "",
    "1. OBJETO",
    "A loja disponibilizará o traje descrito neste pedido para locação, conforme as datas e condições acordadas entre as partes.",
    "",
    "2. RETIRADA E DEVOLUÇÃO",
    "As datas, horários, condições de retirada e devolução deverão ser confirmados com a loja e registrados no pedido.",
    "",
    "3. PAGAMENTO",
    "Os valores pagos e o saldo pendente serão registrados no controle financeiro do pedido.",
    "",
    "4. CONSERVAÇÃO E OCORRÊNCIAS",
    "As responsabilidades por danos, extravio, atrasos e demais ocorrências deverão ser descritas na versão final aprovada pela loja.",
    "",
    "5. ACEITE",
    "As partes declaram que leram e concordam com as condições da versão final deste contrato.",
    "",
    "ATENÇÃO: modelo preliminar para desenvolvimento. Não utilizar como contrato definitivo sem revisão jurídica.",
  ];

  for (const line of lines) {
    const wrapped = pdf.splitTextToSize(line, contentWidth) as string[];
    if (y + wrapped.length * 5 > 275) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(wrapped, margin, y);
    y += wrapped.length * 5 + 2;
  }

  pdf.save(`contrato-locacao-${order.id.slice(0, 8)}.pdf`);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
