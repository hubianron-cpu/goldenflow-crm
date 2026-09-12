export function isClientActivationLeadAllowed(
  enabled: boolean,
  qaLeadId: string | null,
  leadId: string,
) {
  return enabled || (Boolean(qaLeadId) && qaLeadId === leadId);
}
