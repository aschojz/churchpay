import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPayPalAmount, parseEuroCents, sumEuroCents } from "../lib/money";

test("parse exact euro amounts, German thousands separators and labelled choices", () => {
  for (const [value, expected] of [
    ["69", 6900],
    ["69 €", 6900],
    ["69,50 €", 6950],
    ["69.50", 6950],
    ["1.234,56 €", 123456],
    ["1.234 €", 123400],
    ["Teilnahme 69 €", 6900],
    ["0,01 €", 1],
  ] as const)
    assert.equal(parseEuroCents(value), expected, value);
});
test("reject malformed, negative, non-finite and sub-cent amounts", () => {
  for (const value of [
    "-10 €",
    "−10 €",
    "10xyz",
    "Infinity",
    "NaN",
    "1e3",
    "0,001 €",
    "1,2,3",
    "1.23.456 €",
    "10 € + 20 €",
    "",
    "99999999999999999",
  ])
    assert.equal(parseEuroCents(value), null, value);
});
test("sum integer cents and reject incomplete or zero totals", () => {
  assert.equal(sumEuroCents(["0,10 €", "0,20 €"]), 30);
  for (const values of [[], ["0"], ["10", "invalid"], ["999999,99", "1"]])
    assert.equal(sumEuroCents(values), null);
  assert.equal(formatPayPalAmount(123456), "1234.56");
  assert.equal(formatPayPalAmount(1), "0.01");
  assert.throws(() => formatPayPalAmount(Infinity));
});
