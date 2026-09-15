import { redirect } from "next/navigation";
import { getCurrentOwner } from "@/lib/supabase/owner";

export default async function Home() {
  const owner = await getCurrentOwner();
  redirect(owner ? "/dashboard" : "/login");
}
