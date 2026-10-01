const FAILURE_WORDS = ["fail", "failed", "failure", "declined", "denied", "error", "cancel", "cancelled", "rejected", "refused", "סורב", "נכשל"];

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return null; }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function classifyGrowPaymentStatus(
  payload: Record<string, unknown>,
  status: string,
  statusCode: string,
  errorMessage: string,
) {
  const data = record(payload.data);
  const combinedStatus = `${status} ${statusCode} ${text(data?.status)} ${errorMessage}`.toLowerCase();
  const isFailedPayment = Boolean(errorMessage) || FAILURE_WORDS.some(word => combinedStatus.includes(word));
  const providerError = payload.err !== undefined && payload.err !== null && payload.err !== "";
  // The envelope's 1 is not a payment outcome; only nested payment status 2 is paid.
  const providerPaid = text(payload.status) === "1" && text(data?.statusCode) === "2" &&
    statusCode === "2";
  const legacyPaid = status.toLowerCase() === "success" && (!statusCode || statusCode === "2");
  return {
    isFailedPayment,
    isSuccessfulPayment: !isFailedPayment && !providerError && (providerPaid || legacyPaid),
  };
}
