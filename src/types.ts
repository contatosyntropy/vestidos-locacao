export type FittingStatus = "pendente" | "agendada" | "realizada";

export type OrderStatus = "rascunho" | "confirmado" | "cancelado";

export interface RentalOrder {
  id: string;
  customer_name: string;
  customer_cpf: string;
  dress_description: string;
  dress_code: string;
  rental_confirmed_at: string;
  event_date: string;
  attendant: string;
  total_amount: number;
  status: OrderStatus;
  fitting_status: FittingStatus;
  fitting_date: string;
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
