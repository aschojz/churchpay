"use server";

import { z } from "zod";
import { getTenant } from "./config";
import { accessSchema, verifyPaymentLink } from "./payment-link";
import { rateLimit, referenceKey } from "./payment-store";
import { paymentService } from "./payments";
import type { PaymentInfo } from "./types";

const error = {
  type: "error" as const,
  message:
    "Die Zahlungsinformationen konnten nicht geladen werden. Bitte prüfe deinen Link oder versuche es später erneut. Bei einer bereits bestätigten Zahlung wird der Status automatisch abgeglichen.",
};

async function authorize(input: unknown, operation: string, limit: number) {
  const access = accessSchema.parse(input);
  verifyPaymentLink(access, getTenant(access.domain).linkSecret);
  await rateLimit(`${referenceKey(access)}:${operation}`, limit);
  return access;
}

export async function getPaymentInfo(input: unknown): Promise<PaymentInfo> {
  try {
    const access = await authorize(input, "info", 60);
    return await paymentService(access.domain).info(access);
  } catch {
    console.error(JSON.stringify({ event: "payment_info_failed" }));
    return error;
  }
}

export async function createPayPalPayment(input: unknown) {
  try {
    const access = await authorize(input, "create", 10);
    return await paymentService(access.domain).create(access);
  } catch {
    console.error(JSON.stringify({ event: "payment_create_failed" }));
    return error;
  }
}

export async function capturePayPalPayment(input: unknown, orderId: unknown) {
  try {
    const access = await authorize(input, "capture", 30);
    const id = z
      .string()
      .regex(/^[A-Z0-9]{1,36}$/)
      .parse(orderId);
    return await paymentService(access.domain).capture(access, id);
  } catch {
    console.error(JSON.stringify({ event: "payment_capture_failed" }));
    return error;
  }
}
