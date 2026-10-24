import { jsPDF } from "jspdf";
import type { RentalOrder } from "../types";

const STORE_NAME = "Imperatriz Trajes de Festa";
const STORE_ADDRESS = "Rua Guanabara, 2535 – Fátima";
const STORE_PHONE = "(47) 9 9696-9968";
const STORE_CNPJ = "48.231.562/0001-72";

export function downloadRentalContract(order: RentalOrder) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const width = pageWidth - margin * 2;
  let y = 14;

  drawLogo(pdf, margin, y - 1, 17);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10.5);
  pdf.text(`${STORE_NAME} ${STORE_ADDRESS} – Telefone: ${STORE_PHONE}`, margin + 22, y + 4, { maxWidth: width - 22 });
  y += 18;

  pdf.setFontSize(13);
  pdf.text("CONTRATO DE LOCAÇÃO DE TRAJES SOCIAIS", pageWidth / 2, y, { align: "center" });
  y += 9;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.6);
  y = paragraph(pdf, `Por este instrumento de Contrato de Locação de Traje Social, de um lado, IMPERATRIZ TRAJES DE FESTA LOCAÇÃO DE TRAJES LTDA, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob nº ${STORE_CNPJ}, com sede na ${STORE_ADDRESS}, bairro Fátima, Joinville/SC, e do outro lado, denominado(a) LOCATÁRIO(A), identificados abaixo, têm entre si o presente contrato de locação de trajes sociais, mediante as cláusulas e condições seguintes:`, margin, y, width, 3.8);

  y = fieldLine(pdf, "Locatário:", order.customer_name, margin, y, width);
  y = fieldLine(pdf, "CPF:", order.customer_cpf, margin, y, width * 0.56, true);
  pdf.text("Telefone:", margin + width * 0.58, y - 3.8);
  pdf.line(margin + width * 0.72, y - 2.4, margin + width, y - 2.4);
  pdf.setFont("helvetica", "normal");
  pdf.text(order.customer_phone || "", margin + width * 0.72, y - 3.8);
  y += 1;
  y = fieldLine(pdf, "Endereço:", order.customer_address || "", margin, y, width * 0.60, true);
  pdf.text("Bairro:", margin + width * 0.62, y - 3.8);
  pdf.line(margin + width * 0.72, y - 2.4, margin + width, y - 2.4);
  pdf.text(order.customer_neighborhood || "", margin + width * 0.72, y - 3.8);
  y += 1;
  y = paragraph(pdf, "Doravante denominado(a) cliente, têm entre si o presente contrato de locação de trajes sociais, mediante as cláusulas e condições seguintes:", margin, y, width, 3.8);

  y = clause(pdf, "1 – A locadora fornece em locação o seguinte traje:", `${order.dress_description} (código: ${order.dress_code})`, margin, y, width);
  y = clause(pdf, "2 – O valor da locação do traje é de", `${money(order.total_amount)}. Entrada no ato da reserva: ${money(order.entry_amount || 0)}. Restante a pagar na retirada: ${money(Math.max(0, order.total_amount - (order.entry_amount || 0)))}. Em caso de desistência da locação por parte do cliente, o valor pago no ato da reserva permanecerá com a locadora, conforme as condições acordadas entre as partes.`, margin, y, width);
  const pickup = order.pickup_at ? formatDateTime(order.pickup_at) : "A combinar";
  const returned = order.return_date ? formatDate(order.return_date) : "A combinar";
  y = clause(pdf, "3 – Fica estipulado entre as partes que as datas de retirada e devolução do traje são:", `DATA DE RETIRADA: ${pickup}. DATA DE DEVOLUÇÃO: ${returned}. O cliente se responsabiliza pela devolução do traje no prazo acima estipulado. Em caso de atraso, poderá ser aplicada mora diária de ${money(order.daily_late_fee || 0) } e multa contratual de ${Number(order.late_fee_percent ?? 2)}% sobre o valor contratado, conforme as condições legais aplicáveis.`, margin, y, width);
  y = clause(pdf, "4 – O cliente declara estar ciente de que:", "4.1 – Retirou ou retirará o traje em perfeitas condições de uso. 4.2 – Caso o traje alugado retorne com manchas difíceis de serem removidas, tais como sangue, graxa, lama ou maquiagem, poderá ser cobrada taxa de lavanderia no valor de " + money(order.laundry_cost || 0) + ". 4.3 – Em caso de queima, rasgos sem possibilidade de reparo, extravio ou situações similares que ocasionem perda parcial ou integral do traje, o locatário deverá indenizar a locadora pelo custo de " + money(order.damage_indemnity ?? order.total_amount * 3) + ".", margin, y, width);
  y = clause(pdf, "5 –", "A IMPERATRIZ compromete-se a efetuar a entrega do traje na data e horário estipulados, salvo caso fortuito ou força maior.", margin, y, width);
  y = clause(pdf, "6 –", `Caracterizada a mora por parte do cliente, poderá ser aplicada multa contratual de ${Number(order.late_fee_percent ?? 2)}% e mora diária de ${money(order.daily_late_fee || 0)}, conforme as condições acordadas e a legislação aplicável.`, margin, y, width);
  y = clause(pdf, "6.1 –", "A locadora poderá adotar as medidas extrajudiciais ou judiciais cabíveis para receber os valores previstos neste instrumento.", margin, y, width);
  y = clause(pdf, "7 – Autorização de uso de imagem:", `Neste ato ( ${order.image_authorized ? "X" : " "} ) SIM  ( ${order.image_authorized ? " " : "X"} ) NÃO autorizo expressamente a IMPERATRIZ TRAJES DE FESTA a utilizar minha imagem ou som da minha voz em caráter definitivo e gratuito.`, margin, y, width);
  y = clause(pdf, "8 –", "A tolerância de uma das partes ao descumprimento de quaisquer cláusulas não implicará novação, perdão, renúncia ou modificação deste instrumento. Fica eleito o Foro da Comarca de Joinville, Estado de Santa Catarina, para dirimir eventuais dúvidas e litígios, observadas as regras legais de competência e proteção do consumidor. E, por estarem de acordo, assinam o presente instrumento em duas vias de igual teor.", margin, y, width);

  y += 4;
  if (y > 245) { pdf.addPage(); y = 35; }
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Joinville, ______ de __________________________ de ________.`, pageWidth / 2, y, { align: "center" });
  y += 23;
  const sigGap = 18;
  const sigWidth = (width - sigGap) / 2;
  pdf.line(margin, y, margin + sigWidth, y);
  pdf.line(margin + sigWidth + sigGap, y, margin + width, y);
  pdf.setFontSize(8.5);
  pdf.text("Cliente / Locatário(a)", margin + sigWidth / 2, y + 5, { align: "center" });
  pdf.text("Imperatriz Trajes de Festa", margin + sigWidth + sigGap + sigWidth / 2, y + 5, { align: "center" });

  pdf.save(`contrato-locacao-${String(order.id).slice(0, 8)}.pdf`);
}

function clause(pdf: jsPDF, heading: string, body: string, x: number, y: number, width: number) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.2);
  const headingLines = pdf.splitTextToSize(heading, width) as string[];
  pdf.text(headingLines, x, y);
  y += headingLines.length * 3.5;
  pdf.setFont("helvetica", "normal");
  const bodyLines = pdf.splitTextToSize(body, width) as string[];
  pdf.text(bodyLines, x, y);
  return y + bodyLines.length * 3.5 + 1.2;
}
function paragraph(pdf: jsPDF, text: string, x: number, y: number, width: number, lineHeight: number) {
  const lines = pdf.splitTextToSize(text, width) as string[];
  pdf.text(lines, x, y);
  return y + lines.length * lineHeight + 2;
}
function fieldLine(pdf: jsPDF, label: string, value: string, x: number, y: number, width: number, compact = false) {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(label, x, y);
  const labelWidth = pdf.getTextWidth(label) + 2;
  pdf.line(x + labelWidth, y + 1, x + width, y + 1);
  if (value) pdf.text(value, x + labelWidth, y, { maxWidth: Math.max(5, width - labelWidth - 1) });
  return y + (compact ? 4.5 : 5.5);
}
function drawLogo(pdf: jsPDF, x: number, y: number, size: number) {
  // Emblema vetorial simplificado inspirado no símbolo fornecido, para impressão nítida.
  const cx = x + size / 2, top = y + 1, bottom = y + size;
  pdf.setDrawColor(35, 35, 35);
  pdf.setLineWidth(0.35);
  pdf.roundedRect(x + size * 0.18, top, size * 0.64, size * 0.82, size * 0.3, size * 0.3, "S");
  pdf.line(cx, top - 1, cx, bottom + 1);
  pdf.ellipse(cx, y + size * 0.35, size * 0.22, size * 0.29, "S");
  pdf.ellipse(cx, y + size * 0.61, size * 0.22, size * 0.29, "S");
  pdf.line(x + size * 0.25, y + size * 0.18, x + size * 0.75, y + size * 0.78);
  pdf.line(x + size * 0.75, y + size * 0.18, x + size * 0.25, y + size * 0.78);
  pdf.line(x + size * 0.28, y + size * 0.45, x + size * 0.72, y + size * 0.45);
}
function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}
function formatDate(value: string) {
  if (!value) return "A combinar";
  const date = new Date(value + (value.length === 10 ? "T12:00:00" : ""));
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pt-BR").format(date);
}
function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}
