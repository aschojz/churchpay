import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { postgresStore, rateLimit, type Payment } from "../lib/payment-store";

test(
  "PostgreSQL persists capture state and excludes concurrent workers",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      max: 3,
    });
    const reference = {
      domain: `test-${randomUUID()}`,
      groupId: "10",
      personId: "20",
    };
    try {
      await pool.query(await readFile("migrations/001_payments.sql", "utf8"));
      const store = postgresStore(pool);
      await Promise.all([
        rateLimit(reference.domain, 2, pool),
        rateLimit(reference.domain, 2, pool),
      ]);
      await assert.rejects(rateLimit(reference.domain, 2, pool));
      const payment: Payment = {
        ...reference,
        id: randomUUID(),
        amountCents: 6900,
        paidFieldId: 5,
        status: "capturing",
        orderId: `ORDER${Date.now()}`,
        captureId: null,
        captureRequested: true,
        synced: false,
        createdAt: Date.now(),
        checkedAt: null,
      };
      await store.withLock(reference, async (session) => {
        assert.equal(await session.get(), null);
        await session.save(payment);
        await assert.rejects(session.save({ ...payment, id: randomUUID() }));
        await assert.rejects(
          store.withLock(reference, async () =>
            assert.fail("concurrent worker acquired the lock"),
          ),
        );
        await assert.rejects(session.save({ ...payment, personId: "21" }));
      });
      // A new pool represents a different process, not an in-memory cache.
      const secondPool = new Pool({
        connectionString: process.env.TEST_DATABASE_URL,
        max: 1,
      });
      try {
        await assert.rejects(
          postgresStore(secondPool).withLock(reference, async (session) => {
            const recovered = await session.get();
            assert.equal(recovered?.captureRequested, true);
            assert.equal(recovered?.status, "capturing");
            assert.equal(recovered?.amountCents, 6900);
            await session.save({
              ...recovered!,
              status: "completed",
              captureId: `CAPTURE${Date.now()}`,
            });
            throw new Error("process failed after durable write");
          }),
        );
        await store.withLock(reference, async (session) => {
          assert.equal((await session.get())?.status, "completed");
        });
      } finally {
        await secondPool.end();
      }
      await pool.query("DELETE FROM churchpay_payments WHERE domain=$1", [
        reference.domain,
      ]);
    } finally {
      await pool.end();
    }
  },
);
