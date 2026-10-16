// UPI deep link and WhatsApp link for the payment page.

/** Rupees with exactly two decimals, as UPI apps expect. */
export const upiAmount = (paise: number) => (paise / 100).toFixed(2);

/** upi://pay?pa=<UPI ID>&pn=<payee>&am=<total>&tn=<order number>&cu=INR */
export function upiLink({ upiId, payee, totalPaise, orderNumber }: { upiId: string; payee: string | null; totalPaise: number; orderNumber: string }) {
  const q = new URLSearchParams({ pa: upiId, pn: payee || "KITTORA", am: upiAmount(totalPaise), tn: orderNumber, cu: "INR" });
  // URLSearchParams writes spaces as "+", which some UPI apps show literally.
  return `upi://pay?${q.toString().replace(/\+/g, "%20")}`;
}

/** wa.me link; 10-digit Indian numbers get the 91 country code. */
export function whatsappLink(number: string, message: string) {
  const d = number.replace(/\D/g, "");
  return `https://wa.me/${d.length === 10 ? `91${d}` : d}?text=${encodeURIComponent(message)}`;
}
