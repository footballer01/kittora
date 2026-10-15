// All money is stored and computed in integer paise. Format only at the edge.
const whole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

export function formatPaise(paise: number): string {
  if (!Number.isInteger(paise)) throw new TypeError(`paise must be an integer, got ${paise}`);
  return (paise % 100 === 0 ? whole : exact).format(paise / 100);
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
