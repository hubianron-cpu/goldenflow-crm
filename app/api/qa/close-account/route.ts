import { NextResponse } from "next/server";
import { closeCrmBusinessAccount } from "@/lib/account-closure/server";
import { isClosureQaRequest, isClosureQaRuntime, isClosureQaUser } from "@/lib/account-closure/qa-guard.mjs";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isClosureQaRuntime(process.env)) return new Response(null, { status: 404 });

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !isClosureQaUser(user)) return new Response(null, { status: 403 });

  const form = await request.formData().catch(() => null);
  const confirmation = form?.get("confirmation");
  if (!isClosureQaRequest(request.headers.get("origin"), request.url, confirmation, user!.email!)) {
    return NextResponse.json({ error: "QA confirmation mismatch" }, { status: 400 });
  }

  try {
    await closeCrmBusinessAccount(user!.id, user!.email!);
    return NextResponse.json({ closed: true });
  } catch {
    return NextResponse.json({ error: "QA closure failed; verify Calendar and Auth state before retry" }, { status: 500 });
  }
}
