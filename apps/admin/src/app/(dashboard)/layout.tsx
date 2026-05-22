import { redirect } from "next/navigation";
import { AuthError, requireUser } from "@luratha/auth/requireUser";
import { Sidebar } from "@/src/components/Sidebar";
import styles from "./layout.module.css";

/**
 * Authoritative gate for the admin dashboard. The Edge middleware only checks
 * that a `__session` cookie exists; here (a Node server component) the cookie
 * is verified and the `admin` custom claim is enforced via `requireUser()`.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) {
      redirect("/login");
    }
    throw err;
  }

  if (!user.isAdmin) {
    redirect("/login?error=forbidden");
  }

  return (
    <div className={styles.shell}>
      <Sidebar email={user.email} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
