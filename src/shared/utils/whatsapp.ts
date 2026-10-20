// WhatsApp links (wa.me) with the message templates from the content.

export interface TemplateValues {
  name: string;
  seats: number;
  link: string;
}

/** Replaces {name}, {seats} and {link}; unknown placeholders are left as they are. */
export function renderTemplate(template: string, values: TemplateValues): string {
  return template.replace(/\{(name|seats|link)\}/g, (_, key: keyof TemplateValues) =>
    String(values[key]),
  );
}

/**
 * Digits for wa.me (country code, no "+"). Peruvian mobiles are written as 9 digits
 * starting with 9: they get 51 in front. Returns null if it cannot be a phone number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 9 && digits.startsWith('9')) digits = `51${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/** wa.me link with the message, or null when the phone is missing or invalid. */
export function whatsappUrl(phone: string | null | undefined, message: string): string | null {
  const digits = normalizePhone(phone);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}

/** wa.me link without a number: WhatsApp opens with the message and asks for the contact. */
export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
