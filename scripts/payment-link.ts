import "dotenv/config";
import { getTenant, referenceSchema } from "../lib/config";
import { signPaymentLink } from "../lib/payment-link";

try {
  const [base, domain, groupId, personId, days = "7"] = process.argv.slice(2);
  const url = new URL(base);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && url.hostname === "localhost")
  )
    throw new Error("HTTPS is required");
  const reference = referenceSchema.parse({ domain, groupId, personId });
  const validity = Number(days);
  if (!Number.isInteger(validity) || validity < 1 || validity > 30)
    throw new Error("Invalid expiry");
  const access = signPaymentLink(
    reference,
    Math.floor(Date.now() / 1000) + validity * 86400,
    getTenant(domain).linkSecret,
  );
  url.pathname = `/pay/${domain}/${groupId}/${personId}`;
  url.search = new URLSearchParams({
    expires: access.expires,
    signature: access.signature,
  }).toString();
  url.hash = "";
  console.log(url.toString());
} catch {
  console.error(
    "Usage: npm run payment-link -- <https://churchpay.example> <domain> <groupId> <personId> [validityDays=7, max=30]",
  );
  process.exitCode = 1;
}
