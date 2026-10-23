/**
 * Regras de domínio compartilhadas.
 * As mesmas regras também devem ser garantidas no banco de dados para evitar
 * conflitos quando duas pessoas confirmarem pedidos ao mesmo tempo.
 */

export function getBlockedPeriod(eventDate: string) {
  const event = parseLocalDate(eventDate);
  const start = new Date(event);
  const end = new Date(event);
  start.setDate(start.getDate() - 10);
  end.setDate(end.getDate() + 10);

  return {
    start: toDateInput(start),
    end: toDateInput(end),
  };
}

export function getFittingDate(eventDate: string) {
  const event = parseLocalDate(eventDate);
  event.setDate(event.getDate() - 25);
  return toDateInput(event);
}

export function getBalance(total: number, payments: number[]) {
  return Math.max(0, total - payments.reduce((sum, amount) => sum + amount, 0));
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
