import { z } from "zod";

export const domainSchema = z
  .string()
  .max(63)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
export const idSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,9}$/)
  .refine((value) => Number(value) <= 2147483647);
export const referenceSchema = z.object({
  domain: domainSchema,
  groupId: idSchema,
  personId: idSchema,
});
export type PaymentReference = z.infer<typeof referenceSchema>;

export function configuredDomains() {
  const domains = z
    .array(domainSchema)
    .min(1)
    .parse(
      process.env.CHURCHPAY_DOMAINS?.split(",").map((value) => value.trim()),
    );
  if (new Set(domains).size !== domains.length)
    throw new Error("Duplicate ChurchPay domain");
  return domains;
}

export function getTenant(domain: string) {
  domainSchema.parse(domain);
  if (!configuredDomains().includes(domain))
    throw new Error("Unknown ChurchPay domain");
  // Digits are preserved. Hyphens cannot collide with underscores in valid domains.
  const suffix = domain.toUpperCase().replaceAll("-", "_");
  const value = (name: string) => process.env[`${name}_${suffix}`];
  const required = z.string().trim().min(1);
  return {
    domain,
    churchToolsUrl: `https://${domain}.church.tools`,
    churchToolsToken: required.parse(value("CT_TOKEN")),
    clientId: required.parse(value("PAYPAL_CLIENT_ID")),
    clientSecret: required.parse(value("PAYPAL_CLIENT_SECRET")),
    merchantId: required.parse(value("PAYPAL_MERCHANT_ID")),
    environment: z.enum(["sandbox", "live"]).parse(value("PAYPAL_ENV")),
    webhookId: required.parse(value("PAYPAL_WEBHOOK_ID")),
  };
}
export type Tenant = ReturnType<typeof getTenant>;

export function validateConfiguration() {
  z.url()
    .refine((value) =>
      ["postgres:", "postgresql:"].includes(new URL(value).protocol),
    )
    .parse(process.env.DATABASE_URL);
  configuredDomains().forEach(getTenant);
}
