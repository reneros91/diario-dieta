export const metadata = { title: "Sem conexão — NutriDia" };

export default function Offline() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <h1 className="display text-2xl font-semibold">Sem conexão</h1>
      <p className="mt-2 max-w-xs text-sm text-muted">
        O que já foi carregado continua aqui. Registrar comida precisa de rede — volte quando o sinal
        voltar.
      </p>
    </main>
  );
}
