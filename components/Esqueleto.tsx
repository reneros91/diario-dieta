/**
 * Placeholder enquanto a aba busca os dados.
 *
 * Sem isto o Next segura a navegação até a consulta terminar: o toque no botão
 * não faz nada visível e a troca de aba parece travada. Com o esqueleto, a aba
 * troca na hora e o conteúdo chega depois.
 */
export function Esqueleto({ blocos = 3 }: { blocos?: number }) {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-5 w-32 rounded-btn bg-track" />
      {Array.from({ length: blocos }).map((_, i) => (
        <div key={i} className="rounded-card bg-card border border-line shadow-card p-4">
          <div className="h-3 w-24 rounded bg-track" />
          <div className="mt-3 h-8 w-40 rounded bg-track" />
          <div className="mt-3 flex gap-2">
            <div className="h-10 flex-1 rounded-btn bg-track" />
            <div className="h-10 flex-1 rounded-btn bg-track" />
            <div className="h-10 flex-1 rounded-btn bg-track" />
          </div>
        </div>
      ))}
    </div>
  );
}
