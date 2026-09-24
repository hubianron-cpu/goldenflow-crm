export type AccountClosureOperations = {
  getUser(userId: string): Promise<{ id: string; email?: string | null } | null>;
  disconnectCalendar(userId: string): Promise<void>;
  hasCalendarConnection(userId: string): Promise<boolean>;
  deleteAuthUser(userId: string): Promise<void>;
};

export function closeCrmAccountInOrder(
  userId: string,
  expectedEmail: string,
  operations: AccountClosureOperations,
): Promise<void>;
