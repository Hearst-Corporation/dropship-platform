// ⟪RASÉ⟫ admin shell. Aucun chrome pour l'instant — les blocs UI seront fournis
// puis branchés ici à la reconstruction. Layout neutre, pass-through.
export const revalidate = 0;

export default function AdminAppLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-zinc-50 text-zinc-900">{children}</div>;
}
