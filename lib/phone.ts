function getPhoneDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

export function normalizePhoneForComparison(phone: string | null | undefined) {
  let digits = getPhoneDigits(phone?.trim() ?? "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("9720")) {
    digits = `972${digits.slice(4)}`;
  } else if (digits.startsWith("0")) {
    digits = `972${digits.slice(1)}`;
  }

  return digits;
}

export function getPhoneDuplicateCandidates(phone: string) {
  const rawPhone = phone.trim();
  const normalizedPhone = normalizePhoneForComparison(rawPhone);
  const candidates = new Set<string>([rawPhone]);

  if (!normalizedPhone) {
    return [rawPhone];
  }

  candidates.add(normalizedPhone);
  candidates.add(`+${normalizedPhone}`);
  candidates.add(`00${normalizedPhone}`);

  if (normalizedPhone.startsWith("972")) {
    const nationalNumber = normalizedPhone.slice(3);
    const localNumber = `0${nationalNumber}`;

    candidates.add(localNumber);
    candidates.add(`+972${nationalNumber}`);
    candidates.add(`00972${nationalNumber}`);

    if (localNumber.length === 10) {
      const prefix = localNumber.slice(0, 3);
      const middle = localNumber.slice(3, 6);
      const suffix = localNumber.slice(6);
      const internationalPrefix = nationalNumber.slice(0, 2);

      candidates.add(`${prefix}-${localNumber.slice(3)}`);
      candidates.add(`${prefix}-${middle}-${suffix}`);
      candidates.add(`${prefix} ${middle} ${suffix}`);
      candidates.add(`(${prefix}) ${middle}-${suffix}`);
      candidates.add(`${prefix}.${middle}.${suffix}`);
      candidates.add(`+972 ${internationalPrefix} ${middle} ${suffix}`);
      candidates.add(`+972-${internationalPrefix}-${middle}-${suffix}`);
      candidates.add(`972-${internationalPrefix}-${middle}-${suffix}`);
      candidates.add(`00972-${internationalPrefix}-${middle}-${suffix}`);
    }
  }

  return Array.from(candidates);
}
