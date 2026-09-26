"use client";

import { useState } from "react";

export function CalendarDisconnectButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function disconnect() {
    if (!window.confirm("לנתק את יומן Google ולהסיר את עותקי האירועים המסונכרנים? ההוצאות הידניות יישארו.")) return;
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch("/api/calendar/disconnect", { method: "POST" });
      if (!response.ok) throw new Error();
      const result: { disconnected?: boolean } = await response.json();
      setMessage(result.disconnected ? "יומן Google נותק ועותקי האירועים הוסרו." : "לא נמצא יומן Google מחובר לחשבון זה.");
    } catch {
      setError(true);
      setMessage("הניתוק לא הושלם. נסה שוב או פנה אלינו לעזרה.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="button-secondary mt-3" disabled={busy} onClick={() => void disconnect()}>
        {busy ? "מנתק את היומן..." : "ניתוק יומן Google"}
      </button>
      {message && <p role={error ? "alert" : "status"} className={`mt-3 text-sm ${error ? "text-red-300" : "text-zinc-300"}`}>{message}</p>}
    </div>
  );
}
