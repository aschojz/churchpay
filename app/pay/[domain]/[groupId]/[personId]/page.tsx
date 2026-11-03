import { accessSchema } from "@/lib/payment-link";
import { PaymentPage } from "./payment-page";

export const runtime = "nodejs";
export const maxDuration = 120;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string; groupId: string; personId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const access = accessSchema.safeParse({
    ...(await params),
    expires: query.expires,
    signature: query.signature,
  });
  if (!access.success)
    return (
      <main className="mx-auto max-w-xl px-4 py-24">
        <h1 className="text-xl font-bold">Ungültiger Zahlungslink</h1>
        <p>Bitte verwende einen aktuellen Link aus deiner Bestätigungsmail.</p>
      </main>
    );
  return <PaymentPage key={JSON.stringify(access.data)} access={access.data} />;
}
