import { Abas } from "@/components/Abas";
import { TopoDia } from "@/components/TopoDia";

/** Casca das 5 abas: topo fixo em cima, barra de abas embaixo. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <TopoDia />
      <main className="flex-1 mx-auto w-full max-w-lg px-4 pt-4 pb-24">{children}</main>
      <Abas />
    </div>
  );
}
