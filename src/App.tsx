import { useEffect, useMemo, useState } from "react";
import { BellRing, CalendarDays, CheckCircle2, ClipboardList, Download, Plus, ShieldAlert, Wallet } from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { downloadRentalContract } from "./lib/contracts";
import { getBlockedPeriod, getFittingDate } from "./lib/rentalRules";
import type { RentalOrder } from "./types";

const demoOrders: RentalOrder[] = [
  {
    id: "DEMO-0001",
    customer_name: "Mariana Oliveira",
    customer_cpf: "000.000.000-00",
    dress_description: "Vestido verde com strass, tamanho M",
    dress_code: "VD-014",
    rental_confirmed_at: "2026-10-18",
    event_date: "2026-11-20",
    attendant: "Camila",
    total_amount: 680,
    status: "confirmado",
    fitting_status: "pendente",
    fitting_date: getFittingDate("2026-11-20"),
    created_at: "2026-10-18T12:00:00.000Z",
  },
];

type OrderForm = {
  customer_name: string;
  customer_cpf: string;
  dress_description: string;
  dress_code: string;
  rental_confirmed_at: string;
  event_date: string;
  attendant: string;
  total_amount: string;
};

const emptyForm: OrderForm = {
  customer_name: "",
  customer_cpf: "",
  dress_description: "",
  dress_code: "",
  rental_confirmed_at: new Date().toISOString().slice(0, 10),
  event_date: "",
  attendant: "",
  total_amount: "",
};

export default function App() {
  const [orders, setOrders] = useState<RentalOrder[]>(demoOrders);
  const [form, setForm] = useState<OrderForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("Modo de demonstração: configure o Supabase para persistir os dados.");
  const [loading, setLoading] = useState(false);

  const pendingFittings = useMemo(
    () => orders.filter((order) => order.status === "confirmado" && order.fitting_status === "pendente"),
    [orders],
  );

  useEffect(() => {
    async function loadOrders() {
      if (!supabase) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("rental_orders")
        .select("*")
        .order("event_date", { ascending: true });

      if (error) {
        setMessage(`Não foi possível carregar os pedidos: ${error.message}`);
      } else if (data) {
        setOrders(data as RentalOrder[]);
        setMessage("Conectado ao Supabase.");
      }
      setLoading(false);
    }
    void loadOrders();
  }, []);

  async function saveOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fittingDate = getFittingDate(form.event_date);
    const newOrder = {
      customer_name: form.customer_name.trim(),
      customer_cpf: form.customer_cpf.trim(),
      dress_description: form.dress_description.trim(),
      dress_code: form.dress_code.trim(),
      rental_confirmed_at: form.rental_confirmed_at,
      event_date: form.event_date,
      attendant: form.attendant.trim(),
      total_amount: Number(form.total_amount),
      status: "confirmado" as const,
      fitting_status: "pendente" as const,
      fitting_date: fittingDate,
    };

    if (newOrder.total_amount < 0 || !Number.isFinite(newOrder.total_amount)) {
      setMessage("Informe um valor total válido.");
      return;
    }

    if (supabase) {
      const { data, error } = await supabase.from("rental_orders").insert(newOrder).select().single();
      if (error) {
        setMessage(`Pedido não salvo: ${error.message}`);
        return;
      }
      const saved = data as RentalOrder;
      setOrders((current) => [...current, saved]);
      setMessage("Pedido salvo. Revise o contrato antes de utilizá-lo.");
      downloadRentalContract(saved);
    } else {
      const saved: RentalOrder = {
        ...newOrder,
        id: `DEMO-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      setOrders((current) => [...current, saved]);
      setMessage("Pedido adicionado apenas nesta demonstração. Ele não será salvo após recarregar a página.");
      downloadRentalContract(saved);
    }

    setForm(emptyForm);
    setShowForm(false);
  }

  async function updateFitting(order: RentalOrder, status: "agendada" | "realizada") {
    if (supabase) {
      const { error } = await supabase.from("rental_orders").update({ fitting_status: status }).eq("id", order.id);
      if (error) {
        setMessage(`Não foi possível atualizar a prova: ${error.message}`);
        return;
      }
    }
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, fitting_status: status } : item));
    setMessage(status === "agendada" ? "Prova marcada como agendada." : "Prova marcada como realizada.");
  }

  const confirmed = orders.filter((order) => order.status === "confirmado");
  const totalRevenue = confirmed.reduce((sum, order) => sum + order.total_amount, 0);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">A</div>
        <div className="brand-copy"><strong>ATELIÊ</strong><span>GESTÃO DE LOCAÇÕES</span></div>
        <nav>
          <a className="nav-item active"><ClipboardList size={18} /> Pedidos</a>
          <a className="nav-item"><CalendarDays size={18} /> Disponibilidade</a>
          <a className="nav-item"><Wallet size={18} /> Pagamentos</a>
          <a className="nav-item"><BellRing size={18} /> Provas e alertas <span className="nav-count">{pendingFittings.length}</span></a>
        </nav>
        <div className="sidebar-bottom"><span className="status-dot" /> {isSupabaseConfigured ? "Conexão configurada" : "Modo demonstração"}</div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div><span className="eyebrow">PAINEL DE CONTROLE</span><h1>Pedidos de locação</h1><p>Organize reservas, provas e pagamentos em um só lugar.</p></div>
          <button className="primary-button" onClick={() => setShowForm((value) => !value)}><Plus size={17} /> Novo pedido</button>
        </header>

        <div className="notice"><span className="notice-icon"><ShieldAlert size={18} /></span><div><strong>Estrutura inicial em desenvolvimento</strong><p>{message}</p></div></div>

        <div className="stats-grid">
          <article className="stat-card"><span>Pedidos confirmados</span><strong>{confirmed.length}</strong><small><CheckCircle2 size={14} /> Pedidos ativos</small></article>
          <article className="stat-card"><span>Provas pendentes</span><strong>{pendingFittings.length}</strong><small><BellRing size={14} /> Exigem acompanhamento</small></article>
          <article className="stat-card"><span>Valor total contratado</span><strong>{currency(totalRevenue)}</strong><small>Não representa valores já recebidos</small></article>
        </div>

        {showForm && <form className="order-form" onSubmit={saveOrder}>
          <div className="form-heading"><div><h2>Novo pedido</h2><p>O contrato PDF será gerado após o registro.</p></div><button className="text-button" type="button" onClick={() => setShowForm(false)}>Cancelar</button></div>
          <div className="form-grid">
            <label>Nome do cliente<input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></label>
            <label>CPF<input required value={form.customer_cpf} onChange={(e) => setForm({ ...form, customer_cpf: e.target.value })} placeholder="000.000.000-00" /></label>
            <label className="wide">Descrição do vestido<input required value={form.dress_description} onChange={(e) => setForm({ ...form, dress_description: e.target.value })} placeholder="Ex.: vestido verde com strass, tamanho M" /></label>
            <label>Código/identificador da peça<input required value={form.dress_code} onChange={(e) => setForm({ ...form, dress_code: e.target.value })} placeholder="Ex.: VD-014" /></label>
            <label>Atendente responsável<input required value={form.attendant} onChange={(e) => setForm({ ...form, attendant: e.target.value })} /></label>
            <label>Data de confirmação<input required type="date" value={form.rental_confirmed_at} onChange={(e) => setForm({ ...form, rental_confirmed_at: e.target.value })} /></label>
            <label>Data do evento<input required type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></label>
            <label>Valor total (R$)<input required type="number" min="0" step="0.01" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} /></label>
          </div>
          {form.event_date && <p className="calculated-hint">Prova prevista: <strong>{formatDate(getFittingDate(form.event_date))}</strong>. Bloqueio da peça: <strong>{formatDate(getBlockedPeriod(form.event_date).start)} a {formatDate(getBlockedPeriod(form.event_date).end)}</strong>.</p>}
          <button className="primary-button" type="submit">Salvar pedido e gerar contrato</button>
        </form>}

        <section className="section-block">
          <div className="section-heading"><div><h2>Pedidos recentes</h2><p>Visão inicial dos registros cadastrados</p></div><span className="subtle-pill">{loading ? "Carregando…" : `${orders.length} registros`}</span></div>
          <div className="table-wrap"><table><thead><tr><th>Cliente / peça</th><th>Evento</th><th>Valor</th><th>Prova</th><th>Contrato</th></tr></thead>
            <tbody>{orders.map((order) => <tr key={order.id}>
              <td><strong>{order.customer_name}</strong><span className="table-sub">{order.dress_description}</span><span className="code-pill">{order.dress_code || "Sem código"}</span></td>
              <td>{formatDate(order.event_date)}<span className="table-sub">Confirmação: {formatDate(order.rental_confirmed_at)}</span></td>
              <td><strong>{currency(order.total_amount)}</strong><span className="table-sub">Saldo depende dos pagamentos registrados</span></td>
              <td><span className={`status-pill ${order.fitting_status}`}>{order.fitting_status === "pendente" ? "Pendente" : order.fitting_status === "agendada" ? "Agendada" : "Realizada"}</span>{order.fitting_status === "pendente" && <button className="inline-action" onClick={() => void updateFitting(order, "agendada")}>Agendar prova</button>}{order.fitting_status === "agendada" && <button className="inline-action" onClick={() => void updateFitting(order, "realizada")}>Marcar realizada</button>}</td>
              <td><button className="icon-button" title="Gerar contrato preliminar" onClick={() => downloadRentalContract(order)}><Download size={16} /> PDF</button></td>
            </tr>)}</tbody></table>
            {orders.length === 0 && <div className="empty-state">Nenhum pedido cadastrado. Use “Novo pedido” para começar.</div>}
          </div>
        </section>

        <footer className="app-footer">Versão inicial · Datas calculadas localmente · Contrato PDF ainda é um modelo preliminar</footer>
      </section>
    </main>
  );
}

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
function formatDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
