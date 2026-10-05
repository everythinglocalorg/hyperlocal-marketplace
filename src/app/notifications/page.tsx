import { redirect } from "next/navigation";

// Notifications now live inside the inbox, under the "Notifications / Offers" tab.
export default function NotificationsPage() {
  redirect("/messages?tab=notifications");
}
