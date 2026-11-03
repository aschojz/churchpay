import "dotenv/config";
import { readFile } from "node:fs/promises";
import { database } from "../lib/payment-store";

async function main() {
  await database().query(await readFile("migrations/001_payments.sql", "utf8"));
  console.log("ChurchPay database migration complete.");
}
main()
  .catch(() => {
    console.error(
      "Database migration failed. Check DATABASE_URL and database permissions.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    if (process.env.DATABASE_URL) await database().end();
  });
