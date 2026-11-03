// Euros are parsed once, then stored and compared as integer cents.
export function parseEuroCents(input: string): number | null {
  const text = input.trim();
  if (text.length > 256) return null;
  const match =
    /^(?:(?:[^0-9+−\-€]+?)\s+)?((?:[1-9][0-9]{0,2}(?:\.[0-9]{3})+|[0-9]+)(?:,[0-9]{1,2})?|[0-9]+\.[0-9]{1,2})\s*€?$/.exec(
      text,
    );
  if (!match) return null;
  const value = match[1];
  const german =
    value.includes(",") || /^[1-9][0-9]{0,2}(?:\.[0-9]{3})+$/.test(value);
  const normalized = german
    ? value.replaceAll(".", "").replace(",", ".")
    : value;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 99999999
    ? cents
    : null;
}

export function sumEuroCents(values: string[]): number | null {
  if (!values.length) return null;
  let total = 0;
  for (const value of values) {
    const cents = parseEuroCents(value);
    if (cents === null) return null;
    total += cents;
  }
  return total > 0 && total <= 99999999 ? total : null;
}

export function formatPayPalAmount(cents: number) {
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 99999999)
    throw new Error("Invalid payment amount");
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
