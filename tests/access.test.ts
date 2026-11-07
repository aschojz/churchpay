import assert from "node:assert/strict";
import { test } from "node:test";
import {
  domainSchema,
  getTenant,
  idSchema,
  referenceSchema,
} from "../lib/config";

const reference = { domain: "demo-1", groupId: "10", personId: "20" };
test("ChurchTools template links need only tenant, group and person IDs", () => {
  const url = new URL("https://churchpay.example/pay/demo-1/10/20");
  const [, , domain, groupId, personId] = url.pathname.split("/");
  assert.deepEqual(
    referenceSchema.parse({ domain, groupId, personId }),
    reference,
  );
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
      delete process.env[`PAYMENT_LINK_SECRET_${suffix}`];
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
