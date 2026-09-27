import { redirect } from "next/navigation";
import { lng } from "next/root-params";

export default async function RootPage() {
  const locale = await lng();
  redirect(`/${locale}/dashboard`);
}
