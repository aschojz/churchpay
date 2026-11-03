import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveMemberFieldValues, selectField } from "../lib/churchtools";
import type { GroupMemberField } from "../lib/types";

const field = (id: number, name: string, code = "text"): GroupMemberField => ({
  type: "group",
  field: { id, name, fieldTypeCode: code, options: [] },
});
test("paid fields match exact names and reject missing or ambiguous fields", () => {
  assert.equal(
    selectField(
      [field(1, "Unbezahlt"), field(2, " Bezahlt ")],
      ["bezahlt", "paid"],
    ).id,
    2,
  );
  assert.throws(() =>
    selectField([field(1, "Unbezahlt")], ["bezahlt", "paid"]),
  );
  assert.throws(() =>
    selectField([field(1, "Bezahlt"), field(2, "Paid")], ["bezahlt", "paid"]),
  );
  assert.throws(() =>
    selectField(
      [{ ...field(2, "Bezahlt"), type: "person" }],
      ["bezahlt", "paid"],
    ),
  );
});
test("never treat unresolved choice IDs as prices", () => {
  const value = { id: 9, name: "Betrag", value: "20169" };
  assert.equal(resolveMemberFieldValues(value, []), null);
  assert.equal(
    resolveMemberFieldValues(value, [field(9, "Betrag", "select")]),
    null,
  );
  const choice = field(9, "Betrag", "multiselect");
  choice.field.options = [
    { id: "20169", name: "69 €" },
    { id: "20170", name: "10 €" },
  ];
  assert.deepEqual(resolveMemberFieldValues(value, [choice]), ["69 €"]);
  assert.deepEqual(
    resolveMemberFieldValues({ ...value, value: ["20169", "20170"] }, [choice]),
    ["69 €", "10 €"],
  );
  for (const input of ["999", "20169,20169", "20169,", ""])
    assert.equal(
      resolveMemberFieldValues({ ...value, value: input }, [choice]),
      null,
    );
});
