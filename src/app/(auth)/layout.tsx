import Link from "next/link";
import Logo from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col">
      <header className="p-6">
        <Link href="/" aria-label="Everything Local home">
          <Logo size="md" />
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </main>
      <footer className="p-6 text-center text-sm text-gray-500">
        © 2024 Everything Local Marketplace
      </footer>
    </div>
  );
}
