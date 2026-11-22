// Shared layout for the public pages (/login, /register): a centered card.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="mb-6 text-center text-2xl font-semibold">Canary</p>
        {children}
      </div>
    </main>
  );
}
