import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalRedirect } from "@/lib/auth/redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeInternalRedirect(url.searchParams.get("next")), url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=auth_callback", url.origin));
}
