
import { useEffect, useMemo, useState } from "react";
import {
  BellRing, CalendarDays, CheckCircle2, ClipboardList, Download,
  LogOut, Plus, ShieldAlert, Wallet, Pencil, X, AlertTriangle, Clock3, Trash2, FileBarChart, FileSpreadsheet,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { downloadRentalContract } from "./lib/contracts";
import { jsPDF } from "jspdf";
import { getBlockedPeriod, getFittingDate, getBalance } from "./lib/rentalRules";
import type { RentalOrder, Payment } from "./types";

type Tab = "orders" | "availability" | "payments" | "fittings" | "reports";

type OrderForm = {
  customer_name: string;
  customer_cpf: string;
  customer_phone: string;
  customer_address: string;
  customer_neighborhood: string;
  dress_description: string;
  dress_code: string;
  adjustments: string;
  adjustment_status: "pendente" | "feito";
  rental_confirmed_at: string;
  event_date: string;
  attendant: string;
  total_amount: string;
  entry_amount: string;
  pickup_at: string;
  return_date: string;
  late_fee_percent: string;
  daily_late_fee: string;
  laundry_cost: string;
  image_authorized: boolean;
};

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const emptyForm = (): OrderForm => ({
  customer_name: "",
  customer_cpf: "",
  customer_phone: "",
  customer_address: "",
  customer_neighborhood: "",
  dress_description: "",
  dress_code: "",
  adjustments: "",
  adjustment_status: "pendente",
  rental_confirmed_at: today(),
  event_date: "",
  attendant: "",
  total_amount: "",
  entry_amount: "0",
  pickup_at: "",
  return_date: "",
  late_fee_percent: "2",
  daily_late_fee: "0",
  laundry_cost: "250",
  image_authorized: false,
});

const tabLabels: Record<Tab, string> = {
  orders: "Pedidos de locação",
  availability: "Disponibilidade",
  payments: "Pagamentos",
  fittings: "Provas e alertas",
  reports: "Relatórios",
};

export default function App() {
  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [form, setForm] = useState<OrderForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [message, setMessage] = useState("Entre com sua conta para acessar os dados da loja.");
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [availabilityCode, setAvailabilityCode] = useState("");
  const [availabilityDate, setAvailabilityDate] = useState("");
  const [availabilityYear, setAvailabilityYear] = useState(new Date().getFullYear());
  const [paymentOrderId, setPaymentOrderId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState("Pix");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [fittingOrderId, setFittingOrderId] = useState<string | null>(null);
  const [fittingDateInput, setFittingDateInput] = useState("");
  const [fittingSaving, setFittingSaving] = useState(false);
  const [reportPeriodType, setReportPeriodType] = useState<"created_at" | "pickup_at" | "return_date">("created_at");
  const [reportQuickRange, setReportQuickRange] = useState("all");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [reportPaymentStatus, setReportPaymentStatus] = useState("");
  const [reportAttendant, setReportAttendant] = useState("");
  const [reportCustomerQuery, setReportCustomerQuery] = useState("");
  const [reportDressQuery, setReportDressQuery] = useState("");


  useEffect(() => {
    if (!supabase) {
      setMessage("Supabase não configurado. Confira as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Netlify.");
      setAuthReady(true);
      return;
    }

    let alive = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setMessage(`Erro ao verificar sessão: ${error.message}`);
      setUserEmail(data.session?.user.email ?? null);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      if (!session) {
        setOrders([]);
        setPayments([]);
      }
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function loadData() {
    if (!supabase || !userEmail) return;
    setLoading(true);

    const [ordersResult, paymentsResult] = await Promise.all([
      supabase.from("rental_orders").select("*").order("event_date", { ascending: true }),
      supabase.from("payments").select("*").order("paid_at", { ascending: false }),
    ]);

    if (ordersResult.error) {
      setMessage(`Não foi possível carregar os pedidos: ${ordersResult.error.message}`);
    } else {
      setOrders((ordersResult.data ?? []) as RentalOrder[]);
    }

    if (paymentsResult.error) {
      setPayments([]);
      setMessage(`Pedidos carregados, mas os pagamentos não puderam ser consultados: ${paymentsResult.error.message}`);
    } else {
      setPayments((paymentsResult.data ?? []) as Payment[]);
      if (!ordersResult.error) setMessage("Dados atualizados a partir do Supabase.");
    }

    setLoading(false);
  }

  useEffect(() => {
    if (userEmail) void loadData();
    // loadData is intentionally triggered when the authenticated account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Confira as variáveis do Supabase no Netlify e publique novamente.");
      return;
    }
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setMessage(error ? `Não foi possível entrar: ${error.message}` : "Login realizado.");
    setAuthLoading(false);
  }

  async function handleLogout() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(`Não foi possível sair: ${error.message}`);
    else {
      setOrders([]);
      setPayments([]);
      setShowForm(false);
      setEditingId(null);
      setMessage("Você saiu da sua conta.");
    }
  }

  function startNewOrder() {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
    setActiveTab("orders");
  }

  function startEditOrder(order: RentalOrder) {
    setForm({
      customer_name: order.customer_name,
      customer_cpf: order.customer_cpf,
      customer_phone: order.customer_phone ?? "",
      customer_address: order.customer_address ?? "",
      customer_neighborhood: order.customer_neighborhood ?? "",
      dress_description: order.dress_description,
      dress_code: order.dress_code,
      adjustments: order.adjustments ?? "",
      adjustment_status: order.adjustment_status ?? "pendente",
      rental_confirmed_at: order.rental_confirmed_at,
      event_date: order.event_date,
      attendant: order.attendant,
      total_amount: String(order.total_amount),
      entry_amount: String(order.entry_amount ?? 0),
      pickup_at: order.pickup_at ? order.pickup_at.slice(0, 16) : "",
      return_date: order.return_date ?? "",
      late_fee_percent: String(order.late_fee_percent ?? 2),
      daily_late_fee: String(order.daily_late_fee ?? 0),
      laundry_cost: String(order.laundry_cost ?? 250),
      image_authorized: order.image_authorized ?? false,
    });
    setEditingId(order.id);
    setShowForm(true);
    setActiveTab("orders");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userEmail) {
      setMessage("Entre na sua conta para salvar pedidos.");
      return;
    }

    const amount = Number(form.total_amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setMessage("Informe um valor total válido.");
      return;
    }
    if (form.event_date < form.rental_confirmed_at) {
      setMessage("A data do evento não pode ser anterior à confirmação da locação.");
      return;
    }

    const entryAmount = Number(form.entry_amount || 0);
    const lateFeePercent = Number(form.late_fee_percent || 0);
    const dailyLateFee = Number(form.daily_late_fee || 0);
    const laundryCost = Number(form.laundry_cost || 0);
    if (![entryAmount, lateFeePercent, dailyLateFee, laundryCost].every(Number.isFinite) ||
        entryAmount < 0 || entryAmount > amount || lateFeePercent < 0 || dailyLateFee < 0 || laundryCost < 0) {
      setMessage("Confira a entrada (não pode superar o total), a multa e os custos informados.");
      return;
    }
    if (form.return_date && form.return_date < form.event_date) {
      setMessage("A data de devolução não pode ser anterior à data do evento.");
      return;
    }

    const values = {
      customer_name: form.customer_name.trim(),
      customer_cpf: form.customer_cpf.trim(),
      customer_phone: form.customer_phone.trim() || null,
      customer_address: form.customer_address.trim() || null,
      customer_neighborhood: form.customer_neighborhood.trim() || null,
      dress_description: form.dress_description.trim(),
      dress_code: form.dress_code.trim(),
      adjustments: form.adjustments.trim(),
      adjustment_status: form.adjustment_status,
      rental_confirmed_at: form.rental_confirmed_at,
      event_date: form.event_date,
      attendant: form.attendant.trim(),
      total_amount: amount,
      pickup_at: form.pickup_at ? new Date(form.pickup_at).toISOString() : null,
      return_date: form.return_date || null,
      late_fee_percent: lateFeePercent,
      daily_late_fee: dailyLateFee,
      laundry_cost: laundryCost,
      damage_indemnity: Number((amount * 3).toFixed(2)),
      image_authorized: form.image_authorized,
      contract_date: editingId
        ? (orders.find((order) => order.id === editingId)?.contract_date ?? today())
        : today(),
    };

    setLoading(true);
    if (editingId) {
      const { data, error } = await supabase
        .from("rental_orders")
        .update(values)
        .eq("id", editingId)
        .select()
        .single();

      setLoading(false);
      if (error) {
        setMessage(`Não foi possível atualizar o pedido: ${error.message}`);
        return;
      }

      setOrders((current) =>
        current.map((item) => item.id === editingId ? data as RentalOrder : item)
          .sort((a, b) => a.event_date.localeCompare(b.event_date)),
      );
      setMessage("Pedido atualizado com sucesso. A entrada inicial não foi lançada novamente.");
    } else {
      const { data, error } = await supabase
        .from("rental_orders")
        .insert({
          ...values,
          entry_amount: entryAmount,
          status: "confirmado",
          fitting_status: "pendente",
        })
        .select()
        .single();

      setLoading(false);
      if (error) {
        setMessage(`Pedido não salvo: ${error.message}`);
        return;
      }

      const saved = data as RentalOrder;
      if (entryAmount > 0) {
        const { data: paymentData, error: paymentError } = await supabase
          .from("payments")
          .insert({
            order_id: saved.id,
            amount: entryAmount,
            paid_at: saved.rental_confirmed_at || today(),
            method: "não informado",
            notes: "Entrada inicial registrada no cadastro do pedido.",
          })
          .select()
          .single();

        if (paymentError) {
          setOrders((current) => [...current, saved].sort((a, b) => a.event_date.localeCompare(b.event_date)));
          setMessage(`Pedido criado, mas a entrada de ${currency(entryAmount)} não foi registrada nos pagamentos. Registre-a manualmente na aba Pagamentos. Erro: ${paymentError.message}`);
          setLoading(false);
          setForm(emptyForm());
          setShowForm(false);
          setEditingId(null);
          downloadRentalContract(saved);
          return;
        }
        setPayments((current) => [paymentData as Payment, ...current]);
      }
      setOrders((current) => [...current, saved].sort((a, b) => a.event_date.localeCompare(b.event_date)));
      setMessage(entryAmount > 0
        ? "Pedido e entrada inicial registrados. O contrato PDF será atualizado quando você enviar o novo modelo."
        : "Pedido salvo. O contrato PDF será atualizado quando você enviar o novo modelo.");
      downloadRentalContract(saved);
    }

    setForm(emptyForm());
    setShowForm(false);
    setEditingId(null);
  }

  async function deleteOrder(order: RentalOrder) {
    if (!supabase || !userEmail) {
      setMessage("Sua sessão expirou ou a conexão com o Supabase não está configurada.");
      return;
    }
    const confirmed = window.confirm(
      `Tem certeza de que deseja excluir o pedido de ${order.customer_name} (peça ${order.dress_code || order.dress_description})? Essa ação não pode ser desfeita. Os pagamentos vinculados também serão excluídos.`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const { error: paymentsError } = await supabase
        .from("payments")
        .delete()
        .eq("order_id", order.id);
      if (paymentsError) {
        setMessage(`Não foi possível excluir os pagamentos vinculados: ${paymentsError.message}`);
        return;
      }

      const { error } = await supabase
        .from("rental_orders")
        .delete()
        .eq("id", order.id);
      if (error) {
        setMessage(`Não foi possível excluir o pedido: ${error.message}`);
        return;
      }

      setOrders((current) => current.filter((item) => item.id !== order.id));
      setPayments((current) => current.filter((payment) => payment.order_id !== order.id));
      setMessage("Pedido e pagamentos vinculados excluídos.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setMessage(`Erro inesperado ao excluir o pedido: ${detail}`);
    } finally {
      setLoading(false);
    }
  }

  async function updateFitting(order: RentalOrder, status: "agendada" | "realizada") {
    if (!supabase || !userEmail) return;

    const { error } = await supabase
      .from("rental_orders")
      .update({ fitting_status: status })
      .eq("id", order.id);

    if (error) {
      setMessage(`Não foi possível atualizar a prova: ${error.message}`);
      return;
    }

    setOrders((current) =>
      current.map((item) => item.id === order.id ? { ...item, fitting_status: status } : item),
    );
    setMessage(status === "agendada" ? "Prova marcada como agendada." : "Prova marcada como realizada.");
  }

  function openFittingScheduler(order: RentalOrder) {
    setFittingOrderId(order.id);
    setFittingDateInput(order.fitting_date || getFittingDate(order.event_date));
  }

  async function saveFittingSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setMessage("Não foi possível salvar: conexão com o Supabase não configurada.");
      return;
    }
    if (!userEmail) {
      setMessage("Sua sessão expirou. Entre novamente para salvar o agendamento.");
      return;
    }
    if (!fittingOrderId) {
      setMessage("Selecione uma locação antes de salvar o agendamento.");
      return;
    }
    if (!fittingDateInput) {
      setMessage("Selecione a data da prova antes de confirmar.");
      return;
    }

    setFittingSaving(true);
    try {
      const { data, error } = await supabase
        .from("rental_orders")
        .update({ fitting_status: "agendada", fitting_date: fittingDateInput })
        .eq("id", fittingOrderId)
        .select("id")
        .maybeSingle();

      if (error) {
        setMessage(`Não foi possível salvar a data da prova: ${error.message}`);
        return;
      }
      if (!data) {
        setMessage("Nenhuma locação foi atualizada. Verifique as permissões de edição no Supabase e tente novamente.");
        return;
      }

      setOrders((current) => current.map((item) =>
        item.id === fittingOrderId
          ? { ...item, fitting_status: "agendada", fitting_date: fittingDateInput }
          : item,
      ));
      setFittingOrderId(null);
      setFittingDateInput("");
      setMessage("Data da prova salva e agendamento atualizado.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setMessage(`Erro inesperado ao salvar a prova: ${detail}`);
    } finally {
      setFittingSaving(false);
    }
  }

  async function savePayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userEmail) return;

    const amount = Number(paymentAmount);
    if (!paymentOrderId) {
      setMessage("Selecione um pedido para registrar o pagamento.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("O valor do pagamento deve ser maior que zero.");
      return;
    }

    setPaymentSaving(true);
    const { data, error } = await supabase
      .from("payments")
      .insert({
        order_id: paymentOrderId,
        amount,
        paid_at: paymentDate,
        method: paymentMethod,
        notes: paymentNotes.trim() || null,
      })
      .select()
      .single();
    setPaymentSaving(false);

    if (error) {
      setMessage(`Pagamento não registrado: ${error.message}`);
      return;
    }

    setPayments((current) => [data as Payment, ...current]);
    setPaymentAmount("");
    setPaymentNotes("");
    setMessage("Pagamento registrado com sucesso.");
  }

  const confirmed = useMemo(
    () => orders.filter((order) => order.status === "confirmado"),
    [orders],
  );

  const pendingFittings = useMemo(
    () => confirmed.filter((order) => order.fitting_status === "pendente"),
    [confirmed],
  );

  /*const totalContracted = confirmed.reduce((sum, order) => sum + Number(order.total_amount), 0);*/
  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const totalBalance = confirmed.reduce((sum, order) => sum + balanceFor(order, payments), 0);
  const paymentPendingOrders = useMemo(
    () => confirmed.filter((order) => balanceFor(order, payments) > 0.009),
    [confirmed, payments],
  );

  const reportAttendants = useMemo(() => [...new Set(orders.map((order) => order.attendant).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")), [orders]);
  const reportOrders = useMemo(() => {
    let start = reportStartDate;
    let end = reportEndDate;
    if (reportQuickRange !== "custom" && reportQuickRange !== "all") {
      const now = new Date();
      const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startDate = new Date(endDate);
      if (reportQuickRange === "today") { /* start and end remain today */ }
      if (reportQuickRange === "week") startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));
      if (reportQuickRange === "month") startDate.setDate(1);
      if (reportQuickRange === "30days") startDate.setDate(startDate.getDate() - 29);
      start = toDateString(startDate);
      end = toDateString(endDate);
    } else if (reportQuickRange === "all") {
      start = "";
      end = "";
    }
    return orders.filter((order) => {
      const rawDate = reportPeriodType === "created_at" ? order.created_at : reportPeriodType === "pickup_at" ? order.pickup_at : order.return_date;
      const date = rawDate ? rawDate.slice(0, 10) : "";
      if ((start || end) && !date) return false;
      if (start && date < start) return false;
      if (end && date > end) return false;
      if (reportAttendant && order.attendant !== reportAttendant) return false;
      const customerQuery = reportCustomerQuery.trim().toLocaleLowerCase("pt-BR");
      const dressQuery = reportDressQuery.trim().toLocaleLowerCase("pt-BR");
      if (customerQuery && !order.customer_name.toLocaleLowerCase("pt-BR").includes(customerQuery)) return false;
      const dressSearchText = `${order.dress_description || ""} ${order.dress_code || ""}`.toLocaleLowerCase("pt-BR");
      if (dressQuery && !dressSearchText.includes(dressQuery)) return false;
      const paid = payments.reduce((sum, payment) => payment.order_id === order.id ? sum + Number(payment.amount) : sum, 0);
      const balance = Math.max(0, Number(order.total_amount || 0) - paid);
      if (reportPaymentStatus === "paid" && balance > 0.009) return false;
      if (reportPaymentStatus === "pending" && balance <= 0.009) return false;
      return true;
    }).sort((a, b) => {
      const da = reportPeriodType === "created_at" ? a.created_at : reportPeriodType === "pickup_at" ? a.pickup_at || "" : a.return_date || "";
      const db = reportPeriodType === "created_at" ? b.created_at : reportPeriodType === "pickup_at" ? b.pickup_at || "" : b.return_date || "";
      return da.localeCompare(db);
    });
  }, [orders, payments, reportPeriodType, reportQuickRange, reportStartDate, reportEndDate, reportPaymentStatus, reportAttendant, reportCustomerQuery, reportDressQuery]);
  const reportTotals = useMemo(() => reportOrders.reduce((acc, order) => {
    acc.contracts += Number(order.total_amount || 0);
    acc.paid += payments.filter((payment) => payment.order_id === order.id).reduce((sum, payment) => sum + Number(payment.amount), 0);
    acc.balance += balanceFor(order, payments);
    return acc;
  }, { contracts: 0, paid: 0, balance: 0 }), [reportOrders, payments]);

  function exportReportCsv() {
    const headers = ["Cliente", "CPF", "Telefone", "Peça", "Código", "Data do pedido", "Retirada", "Devolução", "Evento", "Atendente", "Valor contratado", "Valor pago", "Saldo"];
    const rows = reportOrders.map((order) => {
      const paid = payments.filter((payment) => payment.order_id === order.id).reduce((sum, payment) => sum + Number(payment.amount), 0);
      return [order.customer_name, order.customer_cpf, order.customer_phone || "", order.dress_description, order.dress_code, order.created_at ? formatDate(order.created_at.slice(0, 10)) : "", order.pickup_at ? formatDateTime(order.pickup_at) : "", order.return_date ? formatDate(order.return_date) : "", formatDate(order.event_date), order.attendant, order.total_amount, paid, balanceFor(order, payments)];
    });
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["\\ufeff", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-locacoes-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Planilha CSV exportada. Você pode abri-la no Excel ou Google Planilhas.");
  }

  function exportReportPdf() {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(16);
    pdf.text("Relatório de locações — Imperatriz Trajes de Festa", 12, 14);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    pdf.text(`Registros: ${reportOrders.length} | Valor contratado: ${currency(reportTotals.contracts)} | Pago: ${currency(reportTotals.paid)} | Saldo: ${currency(reportTotals.balance)}`, 12, 21);
    const columns = ["Cliente / peça", "Pedido", "Retirada", "Devolução", "Evento", "Atendente", "Contratado", "Pago", "Saldo"];
    const colWidths = [55, 22, 25, 22, 22, 25, 27, 27, 27];
    let y = 31;
    const drawHeader = () => {
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(7);
      let x = 12;
      columns.forEach((label, i) => { pdf.text(label, x, y); x += colWidths[i]; });
      y += 3;
      pdf.line(12, y, 285, y); y += 5;
    };
    drawHeader();
    reportOrders.forEach((order) => {
      if (y > 190) { pdf.addPage(); y = 15; drawHeader(); }
      const paid = payments.filter((payment) => payment.order_id === order.id).reduce((sum, payment) => sum + Number(payment.amount), 0);
      const values = [`${order.customer_name} / ${order.dress_description}`, order.created_at ? formatDate(order.created_at.slice(0,10)) : "-", order.pickup_at ? formatDateTime(order.pickup_at) : "-", order.return_date ? formatDate(order.return_date) : "-", formatDate(order.event_date), order.attendant || "-", currency(order.total_amount), currency(paid), currency(balanceFor(order, payments))];
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5);
      let x = 12;
      values.forEach((value, i) => { pdf.text(pdf.splitTextToSize(String(value), colWidths[i] - 2).slice(0, 2), x, y); x += colWidths[i]; });
      y += 7;
    });
    pdf.save(`relatorio-locacoes-${today()}.pdf`);
    setMessage("Relatório PDF gerado.");
  }

  const upcomingPriorities = useMemo(() => {
    const start = today();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    const end = toDateString(endDate);
    const items: { order: RentalOrder; date: string; kind: string; urgency: number }[] = [];

    confirmed.forEach((order) => {
      const fittingDate = order.fitting_date || getFittingDate(order.event_date);
      if (order.fitting_status !== "realizada" && fittingDate >= start && fittingDate <= end) {
        items.push({ order, date: fittingDate, kind: "Prova", urgency: dateDistance(fittingDate, start) });
      }
      if (order.pickup_at) {
        const pickupDate = order.pickup_at.slice(0, 10);
        if (pickupDate >= start && pickupDate <= end) {
          items.push({ order, date: pickupDate, kind: "Retirada", urgency: dateDistance(pickupDate, start) });
        }
      }
      if (order.return_date && order.return_date >= start && order.return_date <= end) {
        items.push({ order, date: order.return_date, kind: "Devolução", urgency: dateDistance(order.return_date, start) });
      }
    });

    return items.sort((a, b) => a.urgency - b.urgency || a.date.localeCompare(b.date)).slice(0, 5);
  }, [confirmed]);

  const availabilityMatches = useMemo(() => {
    const code = availabilityCode.trim().toLocaleLowerCase("pt-BR");
    return confirmed.filter((order) => {
      const matchesCode = !code || order.dress_code.toLocaleLowerCase("pt-BR").includes(code);
      if (!matchesCode) return false;
      if (!availabilityDate) return true;
      const blocked = getBlockedPeriod(order.event_date);
      return availabilityDate >= blocked.start && availabilityDate <= blocked.end;
    });
  }, [confirmed, availabilityCode, availabilityDate]);


  const availabilityCalendarOrders = useMemo(() => {
    const code = availabilityCode.trim().toLocaleLowerCase("pt-BR");
    return confirmed.filter((order) => !code || order.dress_code.toLocaleLowerCase("pt-BR").includes(code));
  }, [confirmed, availabilityCode]);

  const paymentOrder = orders.find((order) => order.id === paymentOrderId);

  if (!authReady) {
    return <main className="auth-shell"><section className="auth-card"><div className="brand-mark">A</div><h1>ATELIÊ</h1><p>Verificando sua sessão...</p></section></main>;
  }

  if (!userEmail) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-mark auth-brand">A</div>
          <span className="eyebrow">GESTÃO DE LOCAÇÕES</span>
          <h1>Acesse sua loja</h1>
          <p className="auth-description">Entre com o e-mail e a senha da conta autorizada para acessar os pedidos.</p>
          <form className="auth-form" onSubmit={handleLogin}>
            <label>E-mail<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Senha<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button className="primary-button" type="submit" disabled={authLoading || !isSupabaseConfigured}>{authLoading ? "Entrando..." : "Entrar"}</button>
          </form>
          {(!isSupabaseConfigured || message !== "Entre com sua conta para acessar os dados da loja.") && <div className="auth-message">{message}</div>}
          {!isSupabaseConfigured && <p className="auth-help">Confira as variáveis do Supabase no Netlify e publique novamente.</p>}
          <p className="auth-footnote">O cadastro público está desativado. A conta deve ser criada previamente no Supabase por uma pessoa administradora.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">A</div>
        <div className="brand-copy"><strong>ATELIÊ</strong><span>GESTÃO DE LOCAÇÕES</span></div>
        <nav>
          <button type="button" className={`nav-item ${activeTab === "orders" ? "active" : ""}`} onClick={() => setActiveTab("orders")}><ClipboardList size={18} /> Pedidos</button>
          <button type="button" className={`nav-item ${activeTab === "availability" ? "active" : ""}`} onClick={() => setActiveTab("availability")}><CalendarDays size={18} /> Disponibilidade</button>
          <button type="button" className={`nav-item ${activeTab === "payments" ? "active" : ""}`} onClick={() => setActiveTab("payments")}><Wallet size={18} /> Pagamentos</button>
          <button type="button" className={`nav-item ${activeTab === "fittings" ? "active" : ""}`} onClick={() => setActiveTab("fittings")}><BellRing size={18} /> Provas e alertas <span className="nav-count">{pendingFittings.length}</span></button>
          <button type="button" className={`nav-item ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")}><FileBarChart size={18} /> Relatórios</button>
        </nav>
        <div className="sidebar-bottom"><span className="status-dot" /> {isSupabaseConfigured ? "Conexão configurada" : "Sem conexão"}</div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div><span className="eyebrow">PAINEL DE CONTROLE</span><h1>{tabLabels[activeTab]}</h1><p>Gerencie locações, disponibilidade, pagamentos e provas.</p></div>
          <div className="topbar-actions"><span className="signed-in-email">{userEmail}</span><button className="secondary-button" onClick={() => void handleLogout()}><LogOut size={16} /> Sair</button>{activeTab === "orders" && <button className="primary-button" onClick={startNewOrder}><Plus size={17} /> Novo pedido</button>}</div>
        </header>

        <div className="notice"><span className="notice-icon"><ShieldAlert size={18} /></span><div><strong>Informações do sistema</strong><p>{message}</p></div></div>

        {fittingOrderId && <div className="fitting-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !fittingSaving) setFittingOrderId(null); }}>
          <section className="fitting-modal" role="dialog" aria-modal="true" aria-labelledby="fitting-modal-title">
            <div className="form-heading">
              <div><span className="eyebrow">AGENDA DE PROVAS</span><h2 id="fitting-modal-title">Agendar prova</h2><p>{orders.find((order) => order.id === fittingOrderId)?.customer_name ?? "Selecione a data"}</p></div>
              <button className="text-button" type="button" disabled={fittingSaving} onClick={() => setFittingOrderId(null)}><X size={14} /> Cancelar</button>
            </div>
            <form onSubmit={saveFittingSchedule}>
              <label className="fitting-date-label">Data da prova
                <input type="date" required value={fittingDateInput} onChange={(event) => setFittingDateInput(event.target.value)} />
              </label>
              <p className="calculated-hint">A data escolhida ficará salva no cadastro da locação e aparecerá na agenda de provas.</p>
              <button className="primary-button" type="submit" disabled={fittingSaving || !fittingDateInput}>{fittingSaving ? "Salvando..." : "Salvar agendamento"}</button>
            </form>
          </section>
        </div>}

        {activeTab === "orders" && <>
        <div className="stats-grid">
          <article className="stat-card"><span>Pedidos confirmados</span><strong>{confirmed.length}</strong><small><CheckCircle2 size={14} /> Locações ativas</small></article>
          <article className="stat-card"><span>Provas pendentes</span><strong>{pendingFittings.length}</strong><small><BellRing size={14} /> Exigem acompanhamento</small></article>
          <article className="stat-card"><span>Saldo a receber</span><strong>{currency(totalBalance)}</strong><small>Total contratado menos pagamentos registrados</small></article>
        </div>

        <section className="section-block priority-overview">
          <div className="section-heading">
            <div><h2><AlertTriangle size={17} /> Prioridades</h2><p>Pagamentos pendentes e compromissos dos próximos 7 dias.</p></div>
          </div>
          <div className="priority-grid">
            <button type="button" className={`priority-card payment-priority ${paymentPendingOrders.length ? "has-pending" : "all-paid"}`} onClick={() => setActiveTab("payments")}>
              <span className="priority-icon"><Wallet size={19} /></span>
              <span className="priority-copy"><strong>{paymentPendingOrders.length ? "Pagamentos pendentes" : "Tudo quitado"}</strong><small>{paymentPendingOrders.length ? `${paymentPendingOrders.length} ${paymentPendingOrders.length === 1 ? "locação com saldo" : "locações com saldo"}` : "Nenhum saldo em aberto"}</small></span>
              <span className="priority-total"><strong>{currency(totalBalance)}</strong><small>{paymentPendingOrders.length ? "Falta receber" : "Saldo em aberto"}</small></span>
              <span className="priority-open">Ver pagamentos <span aria-hidden="true">→</span></span>
            </button>
            <div className="priority-card upcoming-card">
              <div className="upcoming-card-heading">
                <span className="priority-icon"><Clock3 size={19} /></span>
                <span className="priority-copy"><strong>Próximas atividades</strong><small>Provas, retiradas e devoluções</small></span>
                <button type="button" className="agenda-button" onClick={() => setActiveTab("fittings")}>Abrir agenda <span aria-hidden="true">→</span></button>
              </div>
              {upcomingPriorities.length > 0 ? <ul className="priority-list">
                {upcomingPriorities.map((item, index) => <li key={item.order.id + item.kind + item.date + index}>
                  <span className="priority-date">{formatDate(item.date)}</span>
                  <span className="priority-detail"><strong>{item.kind}</strong><small>{item.order.customer_name} · {item.order.dress_code || "Sem código"}</small></span>
                  <span className="priority-tag">{item.urgency === 0 ? "Hoje" : item.urgency === 1 ? "Amanhã" : `Em ${item.urgency} dias`}</span>
                </li>)}
              </ul> : <p className="empty-state compact-empty">Nenhuma atividade prevista para os próximos 7 dias.</p>}
            </div>
          </div>
        </section>
        </>}

        {activeTab === "orders" && <>
          {showForm && <div className="order-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) { setShowForm(false); setEditingId(null); setForm(emptyForm()); } }}><form className="order-form order-modal-form" role="dialog" aria-modal="true" aria-labelledby="order-modal-title" onSubmit={saveOrder}>
            <div className="form-heading"><div><h2 id="order-modal-title">{editingId ? "Editar pedido" : "Novo pedido de locação"}</h2><p>{editingId ? "Altere os dados e salve as mudanças." : "O contrato PDF será gerado após o registro."}</p></div><button className="text-button" type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm()); }}><X size={14} /> Cancelar</button></div>
            <div className="form-grid">
              <label>Nome do cliente<input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></label>
              <label>CPF<input required value={form.customer_cpf} onChange={(e) => setForm({ ...form, customer_cpf: e.target.value })} placeholder="000.000.000-00" /></label>
              <label>Telefone<input type="tel" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></label>
              <label>Bairro<input value={form.customer_neighborhood} onChange={(e) => setForm({ ...form, customer_neighborhood: e.target.value })} /></label>
              <label className="wide">Endereço<input value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} /></label>
              <label className="wide">Descrição do vestido<input required value={form.dress_description} onChange={(e) => setForm({ ...form, dress_description: e.target.value })} placeholder="Ex.: vestido verde com strass, tamanho M" /></label>
              <label>Código/identificador da peça<input required value={form.dress_code} onChange={(e) => setForm({ ...form, dress_code: e.target.value })} placeholder="Ex.: VD-014" /></label>
              <label className="wide">Ajustes necessários<textarea rows={4} value={form.adjustments} onChange={(e) => setForm({ ...form, adjustments: e.target.value })} placeholder="Descreva os ajustes necessários no vestido ou traje..." /></label>
              <label>Status do ajuste<select value={form.adjustment_status} onChange={(e) => setForm({ ...form, adjustment_status: e.target.value as "pendente" | "feito" })}><option value="pendente">Pendente de ajuste</option><option value="feito">Ajuste realizado</option></select></label>
              <label>Atendente responsável<select required value={form.attendant} onChange={(e) => setForm({ ...form, attendant: e.target.value })}><option value="">Selecione o atendente</option><option value="Walter">Walter</option><option value="Jaqueline">Jaqueline</option></select></label>
              <label>Data de confirmação<input required type="date" value={form.rental_confirmed_at} onChange={(e) => setForm({ ...form, rental_confirmed_at: e.target.value })} /></label>
              <label>Data do evento<input required type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></label>
              <label>Valor total do aluguel (R$)<input required type="number" min="0" step="0.01" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} /></label>
              <label>Entrada inicial (R$)<input type="number" min="0" step="0.01" value={form.entry_amount} disabled={Boolean(editingId)} onChange={(e) => setForm({ ...form, entry_amount: e.target.value })} /><small>{editingId ? "Para registrar outro recebimento, use a aba Pagamentos." : "Será lançada automaticamente na aba Pagamentos ao criar o pedido."}</small></label>
              <label>Retirada (data e horário)<input type="datetime-local" value={form.pickup_at} onChange={(e) => setForm({ ...form, pickup_at: e.target.value })} /></label>
              <label>Data de devolução<input type="date" value={form.return_date} onChange={(e) => setForm({ ...form, return_date: e.target.value })} /></label>
              <label>Multa por atraso (%)<input type="number" min="0" step="0.01" value={form.late_fee_percent} onChange={(e) => setForm({ ...form, late_fee_percent: e.target.value })} /></label>
              <label>Mora diária (R$)<input type="number" min="0" step="0.01" value={form.daily_late_fee} onChange={(e) => setForm({ ...form, daily_late_fee: e.target.value })} /></label>
              <label>Custo de lavanderia (R$)<input type="number" min="0" step="0.01" value={form.laundry_cost} onChange={(e) => setForm({ ...form, laundry_cost: e.target.value })} /></label>
              <label>Indenização por dano (R$)<input type="text" readOnly value={currency(Number(form.total_amount || 0) * 3)} /></label>
              <label className="checkbox-field">Autorização de uso de imagem
                <input type="checkbox" checked={form.image_authorized} onChange={(e) => setForm({ ...form, image_authorized: e.target.checked })} />
                <span>{form.image_authorized ? "Sim" : "Não"}</span>
              </label>
            </div>
            {form.event_date && <p className="calculated-hint">Prova prevista: <strong>{formatDate(getFittingDate(form.event_date))}</strong>. Bloqueio da peça: <strong>{formatDate(getBlockedPeriod(form.event_date).start)} a {formatDate(getBlockedPeriod(form.event_date).end)}</strong>.</p>}
            <button className="primary-button" type="submit" disabled={loading}>{loading ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar pedido e gerar contrato"}</button>
          </form></div>}

          <section className="section-block">
            <div className="section-heading"><div><h2>Pedidos de locação</h2><p>Consulte, edite e gere novamente o contrato preliminar.</p></div><span className="subtle-pill">{loading ? "Carregando…" : `${orders.length} registros`}</span></div>
            <div className="table-wrap"><table><thead><tr><th>Cliente / peça</th><th>Evento</th><th>Valor / saldo</th><th>Prova</th><th>Ações</th></tr></thead>
              <tbody>{orders.map((order) => <tr key={order.id}>
                <td><strong>{order.customer_name}</strong><span className="table-sub">{order.dress_description}</span><span className="code-pill">{order.dress_code || "Sem código"}</span></td>
                <td>{formatDate(order.event_date)}<span className="table-sub">Confirmação: {formatDate(order.rental_confirmed_at)}</span></td>
                <td>
                  <strong>Total: {currency(Number(order.total_amount))}</strong>
                  <span className="table-sub">Pago: {currency(paidFor(order, payments))}</span>
                  <span className="table-sub balance-emphasis">Falta: {currency(balanceFor(order, payments))}</span>
                  <span className={`status-pill payment-status ${balanceFor(order, payments) > 0.009 ? "pagamento-pendente" : "pagamento-quitado"}`}>
                    {balanceFor(order, payments) > 0.009 ? "Pendente" : "Quitado"}
                  </span>
                </td>
                <td><span className={`status-pill ${order.fitting_status}`}>{labelFitting(order.fitting_status)}</span>{order.fitting_status === "pendente" && <button className="inline-action" onClick={() => openFittingScheduler(order)}>Agendar prova</button>}{order.fitting_status === "agendada" && <button className="inline-action" onClick={() => void updateFitting(order, "realizada")}>Marcar realizada</button>}</td>
                <td><button className="icon-button" onClick={() => startEditOrder(order)} title="Editar pedido"><Pencil size={14} /> Editar</button>{" "}<button className="icon-button" title="Baixar contrato PDF" onClick={() => downloadRentalContract(order)}><Download size={14} /> PDF</button>{" "}<button className="icon-button danger-action" title="Excluir pedido" disabled={loading} onClick={() => void deleteOrder(order)}><Trash2 size={14} /> Excluir</button></td>
              </tr>)}</tbody></table>
              {orders.length === 0 && <div className="empty-state">{loading ? "Carregando pedidos..." : "Nenhum pedido cadastrado. Use “Novo pedido” para começar."}</div>}
            </div>
          </section>
        </>}

        {activeTab === "availability" && <section className="section-block availability-section">
          <div className="section-heading"><div><h2>Consultar disponibilidade</h2><p>Pesquise pelo código da peça e visualize os períodos bloqueados no calendário anual.</p></div></div>
          <div className="availability-controls">
            <label>Código do traje (opcional)<input value={availabilityCode} onChange={(e) => setAvailabilityCode(e.target.value)} placeholder="Ex.: VD-014" /></label>
            <label>Ano da consulta<select value={availabilityYear} onChange={(e) => setAvailabilityYear(Number(e.target.value))}>{Array.from({ length: 11 }, (_, index) => new Date().getFullYear() - 5 + index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
            <label>Data específica (opcional)<input type="date" value={availabilityDate} onChange={(e) => { setAvailabilityDate(e.target.value); if (e.target.value) setAvailabilityYear(Number(e.target.value.slice(0, 4))); }} /></label>
          </div>
          <div className="availability-legend"><span><i className="availability-dot blocked" /> Indisponível</span><span><i className="availability-dot available" /> Sem bloqueio registrado</span><span>Selecione uma data para consultar os conflitos.</span></div>
          {availabilityDate && <p className="calculated-hint">Data selecionada: <strong>{formatDate(availabilityDate)}</strong>. A consulta considera os períodos bloqueados das locações confirmadas.</p>}
          <div className="availability-year-grid">
            {["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((monthName, monthIndex) => {
              const firstWeekday = new Date(availabilityYear, monthIndex, 1).getDay();
              const daysInMonth = new Date(availabilityYear, monthIndex + 1, 0).getDate();
              return <article className="availability-month" key={monthName}>
                <h3>{monthName}</h3>
                <div className="availability-weekdays">{["D","S","T","Q","Q","S","S"].map((day, index) => <span key={day + index}>{day}</span>)}</div>
                <div className="availability-days">
                  {Array.from({ length: firstWeekday }, (_, index) => <span className="availability-day empty" key={"empty-" + index} />)}
                  {Array.from({ length: daysInMonth }, (_, index) => {
                    const day = index + 1;
                    const date = `${availabilityYear}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const conflicts = availabilityCalendarOrders.filter((order) => {
                      const blocked = getBlockedPeriod(order.event_date);
                      return date >= blocked.start && date <= blocked.end;
                    });
                    const isSelected = availabilityDate === date;
                    return <button type="button" key={date} title={conflicts.length ? conflicts.map((order) => `${order.dress_code} — ${order.customer_name}`).join("\n") : "Nenhum bloqueio registrado"} className={`availability-day ${conflicts.length ? "blocked" : ""} ${isSelected ? "selected" : ""}`} onClick={() => setAvailabilityDate(isSelected ? "" : date)}>{day}</button>;
                  })}
                </div>
              </article>;
            })}
          </div>
          <div className="section-heading availability-results-heading"><div><h2>{availabilityDate ? `Conflitos em ${formatDate(availabilityDate)}` : "Locações que bloqueiam o período"}</h2><p>{availabilityDate ? "Peças bloqueadas na data selecionada." : "Locações confirmadas relacionadas ao filtro de código."}</p></div></div>
          <div className="table-wrap"><table><thead><tr><th>Peça / código</th><th>Cliente</th><th>Evento</th><th>Período bloqueado</th><th>Resultado</th></tr></thead>
            <tbody>{availabilityMatches.map((order) => {
              const blocked = getBlockedPeriod(order.event_date);
              return <tr key={order.id}>
                <td><strong>{order.dress_description}</strong><span className="code-pill">{order.dress_code}</span></td>
                <td>{order.customer_name}</td><td>{formatDate(order.event_date)}</td><td>{formatDate(blocked.start)} a {formatDate(blocked.end)}</td>
                <td><span className="status-pill pendente">{availabilityDate ? "Conflito de período" : "Locação registrada"}</span></td>
              </tr>;
            })}</tbody></table>
            {availabilityMatches.length === 0 && <div className="empty-state">{availabilityDate ? "Nenhuma locação confirmada bloqueia esta data com os filtros informados." : "Nenhuma locação encontrada com esses filtros."}</div>}
          </div>
          <p className="app-footer">As datas vermelhas representam períodos bloqueados por locações confirmadas cadastradas no sistema. A consulta considera o intervalo definido nas regras de locação.</p>
        </section>}

        {activeTab === "payments" && <section className="section-block">
          <div className="section-heading"><div><h2>Registrar pagamento</h2><p>Associe cada recebimento a uma locação existente.</p></div></div>
          <form className="order-form" onSubmit={savePayment}>
            <div className="form-grid">
              <label className="wide">Pedido / cliente
                <select required value={paymentOrderId} onChange={(e) => setPaymentOrderId(e.target.value)}>
                  <option value="">Selecione um pedido</option>
                  {confirmed.map((order) => <option key={order.id} value={order.id}>{order.customer_name} — {order.dress_code} — {currency(Number(order.total_amount))}</option>)}
                </select>
              </label>
              <label>Valor recebido (R$)<input required type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></label>
              <label>Data do pagamento<input required type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></label>
              <label>Forma de pagamento<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option>Pix</option><option>Dinheiro</option><option>Cartão de débito</option><option>Cartão de crédito</option><option>Transferência</option><option>Outro</option></select></label>
              <label>Observações<input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Opcional" /></label>
            </div>
            {paymentOrder && <p className="calculated-hint">Total: <strong>{currency(Number(paymentOrder.total_amount))}</strong>. Pago até agora: <strong>{currency(paidFor(paymentOrder, payments))}</strong>. Saldo atual: <strong>{currency(balanceFor(paymentOrder, payments))}</strong>.</p>}
            <button className="primary-button" type="submit" disabled={paymentSaving}>{paymentSaving ? "Registrando..." : "Registrar pagamento"}</button>
          </form>

          <div className="section-heading"><div><h2>Histórico de pagamentos</h2><p>Recebimentos já registrados no banco de dados.</p></div><span className="subtle-pill">{payments.length} pagamentos</span></div>
          <div className="table-wrap"><table><thead><tr><th>Data</th><th>Cliente / peça</th><th>Forma</th><th>Observações</th><th>Valor</th></tr></thead>
            <tbody>{payments.map((payment) => {
              const order = orders.find((item) => item.id === payment.order_id);
              return <tr key={payment.id}>
                <td>{formatDate(payment.paid_at)}</td>
                <td><strong>{order?.customer_name ?? "Pedido não encontrado"}</strong><span className="table-sub">{order?.dress_code ?? payment.order_id}</span></td>
                <td>{payment.method}</td>
                <td>{payment.notes || "—"}</td>
                <td><strong>{currency(Number(payment.amount))}</strong></td>
              </tr>;
            })}</tbody></table>
            {payments.length === 0 && <div className="empty-state">Nenhum pagamento registrado até o momento.</div>}
          </div>
          <p className="calculated-hint">Total recebido registrado: <strong>{currency(totalPaid)}</strong>. Saldo total das locações confirmadas: <strong>{currency(totalBalance)}</strong>.</p>
        </section>}

        
        {activeTab === "reports" && <section className="section-block reports-section">
          <div className="section-heading"><div><h2>Relatórios de locação</h2><p>Filtre os pedidos e exporte os resultados para PDF ou planilha.</p></div><div className="report-export-actions"><button className="secondary-button" onClick={exportReportPdf}><Download size={16} /> Exportar PDF</button><button className="primary-button" onClick={exportReportCsv}><FileSpreadsheet size={16} /> Exportar planilha</button></div></div>
          <div className="report-filters">
            <label>Período baseado em<select value={reportPeriodType} onChange={(e) => setReportPeriodType(e.target.value as typeof reportPeriodType)}><option value="created_at">Data do pedido (criação)</option><option value="pickup_at">Data de retirada</option><option value="return_date">Data de devolução</option></select></label>
            <label>Atalho de período<select value={reportQuickRange} onChange={(e) => { setReportQuickRange(e.target.value); if (e.target.value === "custom") { setReportStartDate(""); setReportEndDate(""); } }}><option value="all">Todo o período</option><option value="today">Hoje</option><option value="week">Esta semana</option><option value="month">Este mês</option><option value="30days">Últimos 30 dias</option><option value="custom">Personalizado</option></select></label>
            {reportQuickRange === "custom" && <><label>Data inicial<input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} /></label><label>Data final<input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} /></label></>}
            <label>Status do pagamento<select value={reportPaymentStatus} onChange={(e) => setReportPaymentStatus(e.target.value)}><option value="">Todos</option><option value="paid">Integralmente pago</option><option value="pending">Pendente de pagamento</option></select></label>
            <label>Atendente<select value={reportAttendant} onChange={(e) => setReportAttendant(e.target.value)}><option value="">Todos os atendentes</option>{reportAttendants.map((attendant) => <option key={attendant} value={attendant}>{attendant}</option>)}</select></label>
            <label>Cliente<input type="search" placeholder="Digite o nome do cliente..." value={reportCustomerQuery} onChange={(e) => setReportCustomerQuery(e.target.value)} /></label>
            <label>Vestido ou código<input type="search" placeholder="Descrição ou código da peça..." value={reportDressQuery} onChange={(e) => setReportDressQuery(e.target.value)} /></label>
          </div>
          <div className="report-summary-cards"><article><span>Pedidos encontrados</span><strong>{reportOrders.length}</strong></article><article><span>Valor contratado</span><strong>{currency(reportTotals.contracts)}</strong></article><article><span>Total recebido</span><strong>{currency(reportTotals.paid)}</strong></article><article><span>Saldo pendente</span><strong>{currency(reportTotals.balance)}</strong></article></div>
          <div className="table-wrap"><table><thead><tr><th>Cliente / peça</th><th>Data do pedido</th><th>Retirada</th><th>Devolução</th><th>Evento</th><th>Atendente</th><th>Contratado</th><th>Pago</th><th>Saldo</th></tr></thead><tbody>{reportOrders.map((order) => { const paid = payments.filter((payment) => payment.order_id === order.id).reduce((sum, payment) => sum + Number(payment.amount), 0); return <tr key={order.id}><td><strong>{order.customer_name}</strong><span className="table-sub">{order.dress_description} · {order.dress_code}</span></td><td>{order.created_at ? formatDate(order.created_at.slice(0,10)) : "—"}</td><td>{order.pickup_at ? formatDateTime(order.pickup_at) : "—"}</td><td>{order.return_date ? formatDate(order.return_date) : "—"}</td><td>{formatDate(order.event_date)}</td><td>{order.attendant}</td><td>{currency(order.total_amount)}</td><td>{currency(paid)}</td><td>{currency(balanceFor(order, payments))}</td></tr>; })}</tbody></table>{reportOrders.length===0 && <div className="empty-state">Nenhum pedido encontrado com os filtros selecionados.</div>}</div>
        </section>}

        {activeTab === "fittings" && <section className="section-block">
          <div className="section-heading"><div><h2>Provas e alertas</h2><p>Organize as provas previstas e acompanhe o status de cada locação.</p></div><span className="subtle-pill">{pendingFittings.length} pendentes</span></div>
          <div className="table-wrap"><table><thead><tr><th>Cliente / peça</th><th>Data do evento</th><th>Prova prevista</th><th>Status</th><th>Ação</th></tr></thead>
            <tbody>{confirmed.slice().sort((a, b) => getFittingDate(a.event_date).localeCompare(getFittingDate(b.event_date))).map((order) => {
              const fittingDate = order.fitting_date || getFittingDate(order.event_date);
              return <tr key={order.id}>
                <td><strong>{order.customer_name}</strong><span className="table-sub">{order.dress_description}</span><span className="code-pill">{order.dress_code}</span></td>
                <td>{formatDate(order.event_date)}</td>
                <td>{formatDate(fittingDate)}</td>
                <td><span className={`status-pill ${order.fitting_status}`}>{labelFitting(order.fitting_status)}</span></td>
                <td>{order.fitting_status === "pendente" && <button className="inline-action" onClick={() => openFittingScheduler(order)}>Agendar prova</button>}{order.fitting_status === "agendada" && <button className="inline-action" onClick={() => void updateFitting(order, "realizada")}>Marcar realizada</button>}{order.fitting_status === "realizada" && <span className="table-sub">Concluída</span>}</td>
              </tr>;
            })}</tbody></table>
            {confirmed.length === 0 && <div className="empty-state">Não há locações confirmadas para acompanhar.</div>}
          </div>
        </section>}

        <footer className="app-footer">Sistema de gestão de locações · Contrato PDF preliminar, sujeito à revisão jurídica.</footer>
      </section>
    </main>
  );
}

function paidFor(order: RentalOrder, payments: Payment[]) {
  return payments.filter((payment) => payment.order_id === order.id)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
}

function balanceFor(order: RentalOrder, payments: Payment[]) {
  return getBalance(Number(order.total_amount), payments
    .filter((payment) => payment.order_id === order.id)
    .map((payment) => Number(payment.amount)));
}

function toDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateDistance(date: string, from: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  return Math.round((new Date(year, month - 1, day).getTime() - new Date(fromYear, fromMonth - 1, fromDay).getTime()) / 86400000);
}

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelFitting(status: RentalOrder["fitting_status"]) {
  if (status === "pendente") return "Pendente";
  if (status === "agendada") return "Agendada";
  return "Realizada";
}
