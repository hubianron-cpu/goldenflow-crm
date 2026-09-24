export async function closeCrmAccountInOrder(userId, expectedEmail, operations) {
  if (!userId || !expectedEmail) throw new Error("Account identity is required");

  const user = await operations.getUser(userId);
  if (user?.id !== userId || user.email?.toLowerCase() !== expectedEmail.toLowerCase()) {
    throw new Error("Account identity mismatch");
  }

  await operations.disconnectCalendar(userId);
  if (await operations.hasCalendarConnection(userId)) {
    throw new Error("Calendar connection remains; Auth deletion aborted");
  }

  await operations.deleteAuthUser(userId);
}
