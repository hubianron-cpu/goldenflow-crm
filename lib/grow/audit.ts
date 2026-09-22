export type GrowAuditDetails = {
  paymentDate: string;
  paymentSum: number | null;
};

// Store only fields needed to reconcile a payment event; never retain the provider body.
export function growAuditPayload(details: GrowAuditDetails) {
  const date = /^\d{4}-\d{2}-\d{2}/.test(details.paymentDate)
    ? details.paymentDate.slice(0, 10)
    : /^\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4})$/.test(details.paymentDate)
      ? details.paymentDate
      : null;

  return {
    schema_version: 1,
    payment_date: date,
    payment_sum: details.paymentSum !== null && Number.isFinite(details.paymentSum) ? details.paymentSum : null,
  };
}
