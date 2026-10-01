import { timingSafeEqual } from "node:crypto";

export type MetricsSource = "crm" | "trainer";
export async function readWeeklyDashboard(
  request: Request,
  source: MetricsSource,
  secret: string | undefined,
  count: () => Promise<number>,
): Promise<Response> {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  };
  const respond = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });
  if (request.method !== "GET")
    return respond(405, { error: "METHOD_NOT_ALLOWED" });
  if (!secret || secret.length < 32)
    return respond(503, { error: "READ_ONLY_METRICS_NOT_CONFIGURED" });
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(supplied),
    b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return respond(401, { error: "UNAUTHORIZED" });
  try {
    const value = await count();
    if (!Number.isSafeInteger(value) || value < 0 || value > 1e12)
      throw new Error("Invalid count");
    return respond(200, {
      format: "goldenflow-weekly-metrics",
      version: 1,
      source,
      observedAt: new Date().toISOString(),
      definition: "active-subscriptions-excluding-trials",
      activeSubscriptions: value,
    });
  } catch {
    return respond(503, { error: "METRICS_UNAVAILABLE" });
  }
}
