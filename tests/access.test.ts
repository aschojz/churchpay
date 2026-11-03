import assert from "node:assert/strict";
import { test } from "node:test";
import { domainSchema, getTenant, idSchema } from "../lib/config";
import { signPaymentLink, verifyPaymentLink } from "../lib/payment-link";

const reference = { domain: "demo-1", groupId: "10", personId: "20" };
const secret = "test-secret-with-at-least-32-characters";
const now = 1900000000000;
test("signed links bind tenant, group, person, expiry and secret", () => {
  const access = signPaymentLink(reference, now / 1000 + 3600, secret);
  assert.deepEqual(verifyPaymentLink(access, secret, now), access);
  for (const patch of [
    { domain: "demo-2" },
    { groupId: "11" },
    { personId: "21" },
    { expires: String(now / 1000 + 7200) },
    { signature: "0".repeat(64) },
  ])
    assert.throws(() =>
      verifyPaymentLink({ ...access, ...patch }, secret, now),
    );
  assert.throws(() => verifyPaymentLink(access, "another-secret", now));
  assert.throws(() => verifyPaymentLink(access, secret, now + 3600000));
  assert.throws(() => verifyPaymentLink(reference, secret, now));
});
test("reject URL, domain and path injection and non-canonical IDs", () => {
  for (const value of [
    "demo.example/org",
    "demo@evil",
    "demo%2fother",
    "DEMO",
    "demo_1",
    "demo#",
    "demo?",
    "-demo",
    "demo-",
  ])
    assert.equal(domainSchema.safeParse(value).success, false, value);
  for (const value of [
    "0",
    "01",
    "../1",
    "1/members",
    "1?x=2",
    "1.5",
    "1e2",
    "2147483648",
  ])
    assert.equal(idSchema.safeParse(value).success, false, value);
});
test("tenant allowlist and credential suffixes preserve digits", () => {
  const original = { ...process.env };
  try {
    process.env.CHURCHPAY_DOMAINS = "demo-1,demo-2";
    for (const suffix of ["DEMO_1", "DEMO_2"]) {
      for (const key of [
        "CT_TOKEN",
        "PAYPAL_CLIENT_ID",
        "PAYPAL_CLIENT_SECRET",
        "PAYPAL_MERCHANT_ID",
        "PAYPAL_WEBHOOK_ID",
      ])
        process.env[`${key}_${suffix}`] = `${key}-${suffix}`;
      process.env[`PAYPAL_ENV_${suffix}`] = "sandbox";
      process.env[`PAYMENT_LINK_SECRET_${suffix}`] = secret;
    }
    assert.notEqual(
      getTenant("demo-1").churchToolsToken,
      getTenant("demo-2").churchToolsToken,
    );
    assert.throws(() => getTenant("unknown"));
    delete process.env.PAYPAL_ENV_DEMO_1;
    assert.throws(() => getTenant("demo-1"));
  } finally {
    process.env = original;
  }
});
