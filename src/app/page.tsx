import { redirect } from "next/navigation";
import { getSessionContext } from "@/services/session";

export default async function Home() {
  const { user } = await getSessionContext();
  redirect(user ? "/workspaces" : "/sign-in");
}
