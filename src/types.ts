export type FittingStatus = "pendente" | "agendada" | "realizada";

export type OrderStatus = "rascunho" | "confirmado" | "cancelado";

export interface RentalOrder {
  id: string;
  customer_name: string;
  customer_cpf: string;
  customer_phone?: string | null;
  customer_address?: string | null;
  customer_neighborhood?: string | null;
  dress_description: string;
  dress_code: string;
  rental_confirmed_at: string;
  event_date: string;
  attendant: string;
  total_amount: number;
  entry_amount?: number;
  pickup_at?: string | null;
  return_date?: string | null;
  late_fee_percent?: number;
  daily_late_fee?: number;
  laundry_cost?: number;
  damage_indemnity?: number | null;
  image_authorized?: boolean;
  contract_date?: string | null;
  status: OrderStatus;
  fitting_status: FittingStatus;
  fitting_date: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  paid_at: string;
  method: string;
  notes: string | null;
}
