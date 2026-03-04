import { redirect } from "next/navigation";

export default function TweetsRedirect() {
  redirect("/radar/tweets");
}
