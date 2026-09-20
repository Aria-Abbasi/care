import { getCurrentUser } from "@/lib/auth";
import NurseHeader from "@/components/nurse/NurseHeader";

export default async function NurseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      <NurseHeader user={user} />
      <div className="flex-1 max-w-3xl w-full mx-auto pb-28">
        {children}
      </div>
    </div>
  );
}
