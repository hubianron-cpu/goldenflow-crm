# Work Schedule Builder QA Scenarios

Manual scenarios for the current MVP:

1. Red availability: an employee marked red for a shift must not be assigned.
2. Role safety: a guard must not fill a shift leader slot.
3. Role safety: a shift leader must not fill a guard slot.
4. Max shifts: an employee with `max_shifts_per_week = 2` must not receive a third shift.
5. Night conflict: an employee who worked night must not receive next-day morning.
6. Night conflict: an employee who worked night must not receive next-day `08:00-16:00`.
7. Same-day conflict: an employee who worked morning must not receive another same-day shift.
8. Yellow fallback: if not enough green employees exist, yellow employees may be used with a warning.
9. Empty slot: if no valid employee exists, the slot must stay empty with a warning.
10. Workbook safety: missing sheets, required columns, duplicate names, no active employees, or no valid requirements must block generation.
