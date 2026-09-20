import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { hojeISO, somaDias } from "@/lib/calc";
import { colunaAusente, semColuna } from "@/lib/supabase/compat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Diagnóstico — NutriDia" };

type Checagem = { nome: string; ok: boolean; detalhe: string };

/** O rastro que /api/chat grava em `ai_calls.resposta` a cada chamada. */
type ItemRastro = {
  nome?: string;
  qtd?: number;
  unidade?: string;
  kcal?: number;
  alcool?: number;
  fonte?: string;
  fonte_detalhe?: string | null;
};

type Rastro = {
  pergunta?: string;
  buscas?: number;
  consultas?: string[];
  produtos?: { busca: string; achados: string[] }[];
  falhaBusca?: string | null;
  candidatosTaco?: string[];
  itensDaIA?: ItemRastro[];
  itensGravados?: ItemRastro[];
  problemas?: string[];
};

/**
 * Diagnóstico: por que um registro não apareceu.
 *
 * Existe porque a causa mora no banco — permissão, view faltando, dia errado —
 * e daqui de dentro do app dá para perguntar direto, em vez de adivinhar.
 */
export default async function Diagnostico() {
  const sb = await supabaseServer();
  const user = await usuarioAtual();
  const hoje = hojeISO();
  const checagens: Checagem[] = [];

  /* Perfil ---------------------------------------------------------- */
  const { data: perfil, error: erroPerfil } = await sb
    .from("profiles")
    .select("*")
    .eq("user_id", user!.id)
    .maybeSingle();

  checagens.push({
    nome: "Perfil existe",
    ok: Boolean(perfil),
    detalhe: perfil
      ? `peso ${Number(perfil.peso_kg)} kg · gordura ${
          perfil.gordura_pct === null ? "não informada" : `${Number(perfil.gordura_pct)}%`
        } · meta fixa ${perfil.meta_manual ?? "não"} · déficit ${perfil.deficit_kcal ?? "pelo ritmo"}`
      : (erroPerfil?.message ?? "não encontrado"),
  });

  /* Refeições ------------------------------------------------------- */
  const { data: meals, error: erroMeals } = await sb
    .from("meals")
    .select("id, dia, tipo, nome, origem, created_at, meal_items(id)")
    .order("created_at", { ascending: false })
    .limit(20);

  const deHoje = (meals ?? []).filter((m) => m.dia === hoje);

  checagens.push({
    nome: "Consigo ler refeições",
    ok: !erroMeals,
    detalhe: erroMeals
      ? erroMeals.message
      : `${meals?.length ?? 0} no total (últimas 20) · ${deHoje.length} com dia = ${hoje}`,
  });

  const semItens = (meals ?? []).filter((m) => m.meal_items.length === 0);
  checagens.push({
    nome: "Refeições têm itens",
    ok: semItens.length === 0,
    detalhe:
      semItens.length === 0
        ? "toda refeição tem pelo menos uma linha"
        : `${semItens.length} refeição(ões) sem nenhuma linha — a gravação dos itens falhou`,
  });

  /* Teste de escrita real ------------------------------------------- */
  const { data: teste, error: erroEscrita } = await sb
    .from("meals")
    .insert({
      user_id: user!.id,
      dia: hoje,
      tipo: "lanche",
      nome: "__teste do diagnóstico__",
      hora: null,
      origem: "manual",
    })
    .select("id")
    .single();

  let detalheEscrita = erroEscrita?.message ?? "";
  let temColunaFonte = true;

  if (teste) {
    const linha = {
      meal_id: teste.id,
      nome: "teste",
      qtd: 100,
      unidade: "g" as const,
      fonte: "manual" as const,
      k100: 100,
      p100: 10,
      c100: 10,
      g100: 1,
      ordem: 0,
    };

    let { error: erroItem } = await sb.from("meal_items").insert(linha);

    if (colunaAusente(erroItem, "fonte")) {
      temColunaFonte = false;
      ({ error: erroItem } = await sb.from("meal_items").insert(semColuna([linha], "fonte")));
    }

    detalheEscrita = erroItem ? `refeição entrou, mas o item falhou: ${erroItem.message}` : "ok";
    await sb.from("meals").delete().eq("id", teste.id);
  }

  checagens.push({
    nome: "Consigo gravar (teste que se apaga sozinho)",
    ok: Boolean(teste) && detalheEscrita === "ok",
    detalhe: detalheEscrita || "não consegui inserir",
  });

  checagens.push({
    nome: "Coluna de procedência (migration 0004)",
    ok: temColunaFonte,
    detalhe: temColunaFonte
      ? "presente — cada linha diz se veio da tabela ou de estimativa"
      : "faltando: rode a migration 0005. Sem ela o app grava, mas sem dizer a origem.",
  });

  /* View de totais --------------------------------------------------- */
  const { data: totais, error: erroTotais } = await sb
    .from("day_totals")
    .select("*")
    .gte("dia", somaDias(hoje, -7))
    .order("dia");

  checagens.push({
    nome: "View day_totals responde (é o anel do topo)",
    ok: !erroTotais,
    detalhe: erroTotais
      ? `${erroTotais.message} — provavelmente falta a permissão da migration 0003`
      : `${totais?.length ?? 0} dia(s) com total nos últimos 7`,
  });

  /* IA --------------------------------------------------------------- */
  const { data: chamadas, error: erroChamadas } = await sb
    .from("ai_calls")
    .select("tipo, modelo, tokens_in, tokens_out, ms, created_at, resposta")
    .order("created_at", { ascending: false })
    .limit(5);

  checagens.push({
    nome: "Chamadas de IA registradas",
    ok: !erroChamadas && (chamadas?.length ?? 0) > 0,
    detalhe: erroChamadas
      ? erroChamadas.message
      : `${chamadas?.length ?? 0} nas últimas · ${
          chamadas?.[0] ? `mais recente em ${chamadas[0].created_at.slice(0, 16).replace("T", " ")}` : "nenhuma"
        }`,
  });

  /* Tabela TACO ------------------------------------------------------ */
  const { count: qtdTaco, error: erroTaco } = await sb
    .from("taco")
    .select("id", { count: "exact", head: true });

  checagens.push({
    nome: "Tabela de alimentos carregada",
    ok: !erroTaco && (qtdTaco ?? 0) > 100,
    detalhe: erroTaco ? erroTaco.message : `${qtdTaco ?? 0} alimentos`,
  });

  const falhas = checagens.filter((c) => !c.ok).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="display text-lg font-semibold">Diagnóstico</h1>
        <p className="text-[11px] text-muted mt-0.5 num">
          {hoje} · fuso America/Sao_Paulo
        </p>
      </div>

      <section
        className="rounded-card border p-4"
        style={{
          borderColor: falhas ? "var(--over)" : "var(--line)",
          background: "var(--card)",
        }}
      >
        <p className="text-sm font-semibold" style={{ color: falhas ? "var(--over)" : "var(--accent)" }}>
          {falhas === 0 ? "Tudo respondendo" : `${falhas} problema(s) encontrado(s)`}
        </p>
        <p className="mt-1 text-[11px] text-muted">
          Mande esta tela para o Claude — é com ela que dá para achar a causa.
        </p>
      </section>

      <ul className="space-y-2">
        {checagens.map((c) => (
          <li key={c.nome} className="rounded-card bg-card border border-line shadow-card p-3">
            <div className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-0.5 shrink-0 text-sm"
                style={{ color: c.ok ? "var(--accent)" : "var(--over)" }}
              >
                {c.ok ? "✓" : "✕"}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.nome}</p>
                <p className="text-[11px] text-muted break-words">{c.detalhe}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <section className="rounded-card bg-card border border-line shadow-card p-4">
        <h2 className="text-sm font-semibold">O que a IA fez nas últimas conversas</h2>
        <p className="mt-0.5 text-[11px] text-muted">
          Para cada pergunta: se ela pesquisou, o que devolveu e o que o app gravou.
        </p>

        {(chamadas ?? []).filter((c) => c.tipo === "chat").length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Nenhuma conversa registrada ainda. Mande uma mensagem no chat e volte aqui.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {(chamadas ?? [])
              .filter((c) => c.tipo === "chat")
              .map((c) => {
                const r = (c.resposta ?? {}) as Rastro;
                const antigo = r.itensDaIA === undefined;
                return (
                  <li key={c.created_at} className="rounded-btn border border-line p-3">
                    <p className="num text-[11px] text-muted">
                      {c.created_at.slice(0, 16).replace("T", " ")} · {c.ms} ms
                    </p>

                    {r.pergunta && <p className="mt-1 text-sm">“{r.pergunta}”</p>}

                    {antigo ? (
                      <p className="mt-1 text-[11px] text-muted">
                        Conversa anterior à gravação do rastro — só o texto da resposta foi guardado.
                      </p>
                    ) : (
                      <>
                        <p
                          className="mt-2 text-[11px]"
                          style={{ color: r.falhaBusca ? "var(--over)" : "var(--muted)" }}
                        >
                          {r.falhaBusca
                            ? `Busca na web FALHOU: ${r.falhaBusca}`
                            : r.buscas
                              ? `Pesquisou ${r.buscas}× na web: ${(r.consultas ?? []).join(" · ") || "sem consulta registrada"}`
                              : "Não pesquisou na web."}
                        </p>

                        {(r.produtos ?? []).map((c, i) => (
                          <p key={`${c.busca}-${i}`} className="mt-1 text-[11px] text-muted">
                            Open Food Facts, “{c.busca}”:{" "}
                            {c.achados.length
                              ? c.achados.join(" | ")
                              : "não achou nada"}
                          </p>
                        ))}

                        <p className="mt-1 text-[11px] text-muted">
                          Alimentos da tabela oferecidos:{" "}
                          {(r.candidatosTaco ?? []).length
                            ? (r.candidatosTaco ?? []).slice(0, 6).join(", ")
                            : "nenhum casou com o texto"}
                        </p>

                        {(r.itensDaIA ?? []).length > 0 && (
                          <table className="mt-2 w-full text-[11px]">
                            <thead className="text-muted">
                              <tr>
                                <th className="text-left font-normal">item</th>
                                <th className="text-right font-normal">IA</th>
                                <th className="text-right font-normal">gravado</th>
                                <th className="text-left font-normal pl-2">fonte</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(r.itensDaIA ?? []).map((ia, i) => {
                                const gravado = (r.itensGravados ?? [])[i];
                                const divergiu =
                                  gravado && Math.round(ia.kcal ?? 0) !== Math.round(gravado.kcal ?? 0);
                                return (
                                  <tr key={`${ia.nome}-${i}`}>
                                    <td className="truncate max-w-[9rem]">
                                      {ia.nome}
                                      {ia.alcool ? ` · ${ia.alcool} g álcool` : ""}
                                    </td>
                                    <td className="num text-right">{ia.kcal}</td>
                                    <td
                                      className="num text-right"
                                      style={{ color: divergiu ? "var(--over)" : undefined }}
                                    >
                                      {gravado ? gravado.kcal : "—"}
                                    </td>
                                    <td className="pl-2 truncate max-w-[8rem] text-muted">
                                      {gravado?.fonte ?? ia.fonte}
                                      {ia.fonte_detalhe ? ` · ${ia.fonte_detalhe}` : ""}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}

                        {(r.problemas ?? []).length > 0 && (
                          <p className="mt-2 text-[11px]" style={{ color: "var(--over)" }}>
                            {(r.problemas ?? []).join(" · ")}
                          </p>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <section className="rounded-card bg-card border border-line shadow-card p-4">
        <h2 className="text-sm font-semibold">Últimas refeições gravadas</h2>
        {(meals ?? []).length === 0 ? (
          <p className="mt-1 text-sm text-muted">Nenhuma. É esse o problema a resolver.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {(meals ?? []).slice(0, 10).map((m) => (
              <li key={m.id} className="py-2 flex items-baseline gap-2 text-sm">
                <span className="num text-[11px] text-muted w-20 shrink-0">{m.dia}</span>
                <span className="min-w-0 flex-1 truncate">{m.nome}</span>
                <span className="num text-[11px] text-muted shrink-0">
                  {m.meal_items.length} linha(s) · {m.origem}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
