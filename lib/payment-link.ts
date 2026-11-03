import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { referenceSchema, type PaymentReference } from "./config";

export const accessSchema = referenceSchema.extend({
  expires: z.string().regex(/^[1-9][0-9]{9,10}$/),
  signature: z.string().regex(/^[a-f0-9]{64}$/),
});
export type PaymentAccess = z.infer<typeof accessSchema>;

function signature(
  reference: PaymentReference,
  expires: string,
  secret: string,
) {
  return createHmac("sha256", secret)
    .update(
      JSON.stringify([
        "churchpay-v1",
        reference.domain,
        reference.groupId,
        reference.personId,
        expires,
      ]),
    )
    .digest("hex");
}

export function signPaymentLink(
  reference: PaymentReference,
  expires: number,
  secret: string,
): PaymentAccess {
  referenceSchema.parse(reference);
  const value = String(expires);
  return accessSchema.parse({
    ...reference,
    expires: value,
    signature: signature(reference, value, secret),
  });
}

export function verifyPaymentLink(
  input: unknown,
  secret: string,
  now = Date.now(),
): PaymentAccess {
  const access = accessSchema.parse(input);
  if (Number(access.expires) * 1000 <= now)
    throw new Error("Expired payment link");
  if (
    !timingSafeEqual(
      Buffer.from(access.signature, "hex"),
      Buffer.from(signature(access, access.expires, secret), "hex"),
    )
  )
    throw new Error("Invalid payment link");
  return access;
}
