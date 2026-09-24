import "server-only";
import { closeCrmAccountInOrder } from "./order.mjs";
import { disconnectCalendar, readConnection } from "@/lib/calendar/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// This is an internal operation, not a public account-deletion endpoint. The
// caller must first complete the billing, dispatch, Storage and backup gates.
export async function closeCrmBusinessAccount(userId: string, expectedEmail: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Account closure configuration unavailable");

  await closeCrmAccountInOrder(userId, expectedEmail, {
    async getUser(id) {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error) throw new Error("Account identity unavailable");
      return data.user;
    },
    disconnectCalendar,
    async hasCalendarConnection(id) {
      return Boolean(await readConnection(id));
    },
    async deleteAuthUser(id) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new Error("Auth deletion failed after Calendar disconnect");
    },
  });
}
