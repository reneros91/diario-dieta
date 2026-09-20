import { faltaNoAmbiente } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Falta configurar — Balanço" };

/**
 * Tela que aparece enquanto o app não tem Supabase.
 * É o primeiro contato de quem acabou de subir o projeto, então fala português,
 * não jargão, e diz exatamente o próximo passo.
 */
export default function Configurar() {
  const falta = faltaNoAmbiente();

  const passos = [
    {
      titulo: "Criar o projeto no Supabase",
      texto:
        "É onde ficam os dados: refeições, pesagens, receitas. Crie uma conta em supabase.com, crie um projeto e guarde a senha do banco.",
    },
    {
      titulo: "Rodar as duas migrations",
      texto:
        "No Supabase, abra o SQL Editor e cole o conteúdo de supabase/migrations/0001_init.sql e depois o do 0002_seed_taco.sql. Isso cria as tabelas e a lista de alimentos.",
    },
    {
      titulo: "Copiar as chaves",
      texto:
        "Em Project Settings → API você encontra a URL do projeto, a chave anon e a service role. Elas vão nas variáveis de ambiente.",
    },
    {
      titulo: "Criar a chave da Anthropic",
      texto:
        "Em console.anthropic.com, gere uma API key. É ela que paga a parte de IA — sem ela o resto do app funciona, só o chat não.",
    },
    {
      titulo: "Publicar na Vercel",
      texto:
        "Conecte o repositório na vercel.com e preencha as mesmas variáveis em Settings → Environment Variables.",
    },
  ];

  return (
    <main className="min-h-dvh px-6 py-12">
      <div className="mx-auto w-full max-w-lg">
        <h1 className="display text-3xl font-semibold tracking-tight">Balanço</h1>
        <p className="mt-2 text-muted">
          O app está instalado e funcionando, mas ainda não sabe onde guardar os dados. Faltam as
          chaves de acesso.
        </p>

        {falta.length > 0 && (
          <section className="mt-6 rounded-card bg-card border border-line shadow-card p-4">
            <h2 className="text-sm font-semibold">O que está faltando</h2>
            <ul className="mt-2 space-y-1">
              {falta.map((v) => (
                <li key={v} className="num text-[13px] text-muted break-all">
                  {v}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted leading-relaxed">
              Rodando no seu computador, essas linhas vão num arquivo chamado{" "}
              <code className="num">.env.local</code> na raiz do projeto (copie o{" "}
              <code className="num">.env.example</code> e preencha). Na Vercel, vão em Settings →
              Environment Variables.
            </p>
          </section>
        )}

        <ol className="mt-6 space-y-3">
          {passos.map((p, i) => (
            <li key={p.titulo} className="rounded-card bg-card border border-line shadow-card p-4">
              <div className="flex gap-3">
                <span
                  className="num shrink-0 h-6 w-6 rounded-full text-center text-[12px] leading-6 font-semibold"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="font-medium leading-tight">{p.titulo}</h3>
                  <p className="mt-1 text-sm text-muted leading-relaxed">{p.texto}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-6 text-sm text-muted leading-relaxed">
          O passo a passo completo, com o que clicar em cada tela, está no arquivo{" "}
          <strong className="text-ink">COMECE-AQUI.md</strong> na raiz do projeto. Assim que as
          chaves estiverem no lugar, esta tela some sozinha e o app abre no login.
        </p>
      </div>
    </main>
  );
}
