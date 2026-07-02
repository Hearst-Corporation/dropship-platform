import { AdminLayoutClient } from "./AdminLayoutClient";

export const revalidate = 0;

export default function AdminAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
