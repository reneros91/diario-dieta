"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adicionarFavoritoAoDia, adicionarReceitaAoDia, salvarAlimento } from "@/app/actions";
import { hojeISO } from "@/lib/calc";
import { ORDEM_TIPO, TIPO_EMOJI, TIPO_LABEL, kcal, num, refeicaoPorHora } from "@/lib/format";
import type { ResultadoBusca } from "@/app/api/busca/route";
import type { TipoRefeicao, Unidade } from "@/lib/types/db";
import { TelaPorcao, type AlimentoEscolhido } from "@/components/TelaPorcao";
import { NovaReceita } from "@/components/NovaReceita";

type Tela =
  | "menu"
  | "taco"
  | "receitas"
  | "alimentos"
  | "favoritos"
  | "nova-receita"
  | "novo-alimento"
  | "porcao";

type ReceitaHub = {
  id: string;
  nome: string;
  porcoes: number;
  peso_pronto_g: number | null;
  publica: boolean;
  minha: boolean;
  porPorcao: { kcal: number; prot: number; carb: number; gord: number };
};

type AlimentoHub = {
  id: string;
  nome: string;
  unidade: Unidade;
  porcao: number;
  k100: number;
  p100: number;
  c100: number;
  g100: number;
};

type FavoritoHub = { id: string; nome: string; linhas: number; kcal: number };

/** Hub ＋ (SPEC §3.8). Bottom sheet com tudo que entra no dia sem passar pela IA. */
export function Hub({
  aberto,
  dia,
  onFechar,
}: {
  aberto: boolean;
  dia?: string;
  onFechar: () => void;
}) {
  const diaAlvo = dia ?? hojeISO();
  const tipoSugerido = refeicaoPorHora(new Date().getHours());

  const [tela, setTela] = useState<Tela>("menu");
  const [escolhido, setEscolhido] = useState<AlimentoEscolhido | null>(null);
  const [listas, setListas] = useState<{
    receitas: ReceitaHub[];
    alimentos: AlimentoHub[];
    favoritos: FavoritoHub[];
  } | null>(null);

  const carregarListas = useCallback(async () => {
    const r = await fetch("/api/hub", { cache: "no-store" });
    if (r.ok) setListas(await r.json());
  }, []);

  useEffect(() => {
    if (!aberto) return;
    setTela("menu");
    setEscolhido(null);
    void carregarListas();
  }, [aberto, carregarListas]);

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  function escolher(a: AlimentoEscolhido) {
    setEscolhido(a);
    setTela("porcao");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-black/30"
      />

      <div
        className="anim-card relative w-full mx-auto max-w-lg max-h-[86dvh] overflow-y-auto rounded-t-[22px] bg-card border-t border-line p-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />

        {tela === "menu" && <Menu onIr={setTela} />}

        {tela === "taco" && <BuscaTaco onEscolher={escolher} />}

        {tela === "receitas" && (
          <Receitas
            receitas={listas?.receitas ?? []}
            dia={diaAlvo}
            tipoInicial={tipoSugerido}
            onVoltar={() => setTela("menu")}
            onPronto={onFechar}
          />
        )}

        {tela === "alimentos" && (
          <ListaAlimentos
            alimentos={listas?.alimentos ?? []}
            onVoltar={() => setTela("menu")}
            onEscolher={escolher}
          />
        )}

        {tela === "favoritos" && (
          <Favoritos
            favoritos={listas?.favoritos ?? []}
            dia={diaAlvo}
            tipoInicial={tipoSugerido}
            onVoltar={() => setTela("menu")}
            onPronto={onFechar}
          />
        )}

        {tela === "nova-receita" && (
          <NovaReceita
            onVoltar={() => setTela("menu")}
            onSalva={() => {
              void carregarListas();
              setTela("receitas");
            }}
          />
        )}

        {tela === "novo-alimento" && (
          <NovoAlimento
            onVoltar={() => setTela("menu")}
            onSalvo={() => {
              void carregarListas();
              setTela("alimentos");
            }}
          />
        )}

        {tela === "porcao" && escolhido && (
          <TelaPorcao
            alimento={escolhido}
            dia={diaAlvo}
            tipoInicial={tipoSugerido}
            onVoltar={() => setTela("menu")}
            onPronto={onFechar}
          />
        )}
      </div>
    </div>
  );
}

function Menu({ onIr }: { onIr: (t: Tela) => void }) {
  const opcoes: { tela: Tela; titulo: string; sub: string }[] = [
    { tela: "taco", titulo: "Tabela TACO", sub: "Buscar alimento" },
    { tela: "receitas", titulo: "Minhas receitas", sub: "Marmitas e a lista da casa" },
    { tela: "alimentos", titulo: "Meus alimentos", sub: "Rótulos que já salvei" },
    { tela: "favoritos", titulo: "Refeições favoritas", sub: "Cartões inteiros" },
    { tela: "nova-receita", titulo: "Nova receita", sub: "A IA calcula o rendimento" },
    { tela: "novo-alimento", titulo: "Novo alimento", sub: "Digitar o rótulo à mão" },
  ];

  return (
    <div>
      <h2 className="display text-xl font-semibold mb-3">Adicionar</h2>
      <ul className="space-y-2">
        {opcoes.map((o) => (
          <li key={o.tela}>
            <button
              type="button"
              onClick={() => onIr(o.tela)}
              className="w-full rounded-btn border border-line px-4 py-3 text-left"
            >
              <span className="block font-medium">{o.titulo}</span>
              <span className="block text-[11px] text-muted">{o.sub}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BuscaTaco({ onEscolher }: { onEscolher: (a: AlimentoEscolhido) => void }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/busca?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (r.ok) setResultados((await r.json()).resultados);
      setBuscando(false);
    }, 220);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <div>
      <h2 className="display text-xl font-semibold mb-3">Tabela TACO</h2>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="arroz, frango, whey…"
        autoFocus
        className="w-full rounded-btn border border-line bg-bg px-4 py-2.5"
        aria-label="Buscar alimento"
      />

      {buscando && <p className="mt-3 text-sm text-muted anim-pulso">Buscando…</p>}

      <ul className="mt-3 divide-y divide-line">
        {resultados.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() =>
                onEscolher({
                  nome: r.nome,
                  unidade: r.unidade,
                  porcao: r.porcao,
                  k100: r.k100,
                  p100: r.p100,
                  c100: r.c100,
                  g100: r.g100,
                  origem: r.fonte === "taco" ? "taco" : "alimento",
                })
              }
              className="w-full py-2.5 text-left flex items-baseline gap-3"
            >
              <span className="min-w-0 flex-1 truncate text-sm">{r.nome}</span>
              <span className="num text-[11px] text-muted shrink-0">
                {kcal(r.k100)} kcal/100{r.unidade === "ml" ? "ml" : "g"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {!buscando && q.trim().length >= 2 && resultados.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          Nada com esse nome. Dá para cadastrar em &ldquo;Novo alimento&rdquo;.
        </p>
      )}
    </div>
  );
}

function Receitas({
  receitas,
  dia,
  tipoInicial,
  onVoltar,
  onPronto,
}: {
  receitas: ReceitaHub[];
  dia: string;
  tipoInicial: TipoRefeicao;
  onVoltar: () => void;
  onPronto: () => void;
}) {
  const router = useRouter();
  const [ativa, setAtiva] = useState<ReceitaHub | null>(null);
  const [porcoes, setPorcoes] = useState("1");
  const [tipo, setTipo] = useState<TipoRefeicao>(tipoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  const minhas = receitas.filter((r) => r.minha);
  const daCasa = receitas.filter((r) => !r.minha);

  if (ativa) {
    const p = Number(porcoes.replace(",", ".")) || 0;
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setAtiva(null)} className="text-sm text-muted">
          ‹ Voltar
        </button>
        <h3 className="display text-xl font-semibold">{ativa.nome}</h3>
        <p className="text-[11px] text-muted">
          Rende {num(ativa.porcoes)} porções · {kcal(ativa.porPorcao.kcal)} kcal por porção
        </p>

        <div>
          <label htmlFor="porcoes" className="block text-[11px] text-muted mb-1">
            Porções (aceita 1,5)
          </label>
          <input
            id="porcoes"
            type="text"
            inputMode="decimal"
            value={porcoes}
            onChange={(e) => setPorcoes(e.target.value)}
            className="num w-full rounded-btn border border-line bg-bg px-3 py-2.5 text-lg"
          />
        </div>

        <div className="rounded-card bg-bg p-3 num">
          <p className="display text-3xl font-semibold leading-none">
            {kcal(ativa.porPorcao.kcal * p)}
          </p>
          <p className="text-[11px] text-muted mt-0.5">kcal</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <span style={{ color: "var(--prot)" }}>P {num(ativa.porPorcao.prot * p)} g</span>
            <span style={{ color: "var(--carb)" }}>C {num(ativa.porPorcao.carb * p)} g</span>
            <span style={{ color: "var(--gord)" }}>G {num(ativa.porPorcao.gord * p)} g</span>
          </div>
        </div>

        <SeletorTipo tipo={tipo} onTipo={setTipo} />

        {erro && (
          <p role="alert" className="text-sm" style={{ color: "var(--over)" }}>
            {erro}
          </p>
        )}

        <button
          type="button"
          disabled={salvando || p <= 0}
          onClick={() =>
            startTransition(async () => {
              const r = await adicionarReceitaAoDia({
                receitaId: ativa.id,
                dia,
                tipo,
                porcoes: p,
              });
              if (!r.ok) {
                setErro(r.erro);
                return;
              }
              router.refresh();
              onPronto();
            })
          }
          className="w-full rounded-btn bg-accent px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {salvando ? "Adicionando…" : "Adicionar"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={onVoltar} className="text-sm text-muted">
        ‹ Voltar
      </button>
      <h2 className="display text-xl font-semibold mt-2 mb-3">Receitas</h2>

      {receitas.length === 0 && (
        <p className="text-sm text-muted">
          Nenhuma ainda. Crie em &ldquo;Nova receita&rdquo; — a IA calcula o peso pronto.
        </p>
      )}

      <ListaReceitas titulo="Minhas" receitas={minhas} onAbrir={setAtiva} />
      <ListaReceitas titulo="Da casa" receitas={daCasa} onAbrir={setAtiva} />
    </div>
  );
}

function ListaReceitas({
  titulo,
  receitas,
  onAbrir,
}: {
  titulo: string;
  receitas: ReceitaHub[];
  onAbrir: (r: ReceitaHub) => void;
}) {
  if (receitas.length === 0) return null;
  return (
    <section className="mt-3">
      <h3 className="text-[11px] uppercase tracking-wide text-muted">{titulo}</h3>
      <ul className="divide-y divide-line">
        {receitas.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onAbrir(r)}
              className="w-full py-2.5 text-left flex items-baseline gap-3"
            >
              <span className="min-w-0 flex-1 truncate text-sm">{r.nome}</span>
              <span className="num text-[11px] text-muted shrink-0">
                {kcal(r.porPorcao.kcal)} kcal/porção
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ListaAlimentos({
  alimentos,
  onVoltar,
  onEscolher,
}: {
  alimentos: AlimentoHub[];
  onVoltar: () => void;
  onEscolher: (a: AlimentoEscolhido) => void;
}) {
  return (
    <div>
      <button type="button" onClick={onVoltar} className="text-sm text-muted">
        ‹ Voltar
      </button>
      <h2 className="display text-xl font-semibold mt-2 mb-3">Meus alimentos</h2>

      {alimentos.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhum ainda. Cadastre um rótulo em &ldquo;Novo alimento&rdquo;.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {alimentos.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onEscolher({ ...a, origem: "alimento" })}
                className="w-full py-2.5 text-left flex items-baseline gap-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm">{a.nome}</span>
                <span className="num text-[11px] text-muted shrink-0">
                  {kcal(a.k100)} kcal/100{a.unidade === "ml" ? "ml" : "g"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Favoritos({
  favoritos,
  dia,
  tipoInicial,
  onVoltar,
  onPronto,
}: {
  favoritos: FavoritoHub[];
  dia: string;
  tipoInicial: TipoRefeicao;
  onVoltar: () => void;
  onPronto: () => void;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoRefeicao>(tipoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  return (
    <div>
      <button type="button" onClick={onVoltar} className="text-sm text-muted">
        ‹ Voltar
      </button>
      <h2 className="display text-xl font-semibold mt-2 mb-3">Favoritas</h2>

      {favoritos.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhuma ainda. Use ★ no cartão de uma refeição para guardar.
        </p>
      ) : (
        <>
          <SeletorTipo tipo={tipo} onTipo={setTipo} />
          <ul className="mt-3 divide-y divide-line">
            {favoritos.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await adicionarFavoritoAoDia({ favoritoId: f.id, dia, tipo });
                      if (!r.ok) {
                        setErro(r.erro);
                        return;
                      }
                      router.refresh();
                      onPronto();
                    })
                  }
                  className="w-full py-2.5 text-left flex items-baseline gap-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{f.nome}</span>
                  <span className="num text-[11px] text-muted shrink-0">
                    {kcal(f.kcal)} kcal · {f.linhas} linhas
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {erro && (
        <p role="alert" className="mt-3 text-sm" style={{ color: "var(--over)" }}>
          {erro}
        </p>
      )}
    </div>
  );
}

function NovoAlimento({ onVoltar, onSalvo }: { onVoltar: () => void; onSalvo: () => void }) {
  const [form, setForm] = useState({
    nome: "",
    unidade: "g" as Unidade,
    porcao: "",
    kcal: "",
    prot: "",
    carb: "",
    gord: "",
    base: "100" as "100" | "porcao",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  const n = (v: string) => Number(v.replace(",", ".")) || 0;

  function salvar() {
    if (!form.nome.trim()) {
      setErro("Falta o nome.");
      return;
    }
    const porcao = n(form.porcao);
    if (form.base === "porcao" && porcao <= 0) {
      setErro("Informe o peso da porção do rótulo.");
      return;
    }
    // Rótulo "por porção" vira valor por 100 dividindo pelo peso da porção.
    const f = form.base === "porcao" ? 100 / porcao : 1;
    setErro(null);

    startTransition(async () => {
      const r = await salvarAlimento({
        nome: form.nome.trim(),
        unidade: form.unidade,
        porcao_rotulo: porcao > 0 ? porcao : null,
        k100: Number((n(form.kcal) * f).toFixed(2)),
        p100: Number((n(form.prot) * f).toFixed(2)),
        c100: Number((n(form.carb) * f).toFixed(2)),
        g100: Number((n(form.gord) * f).toFixed(2)),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      onSalvo();
    });
  }

  const campo = (
    chave: keyof typeof form,
    rotulo: string,
    extra?: { inputMode?: "decimal" },
  ) => (
    <div>
      <label htmlFor={`al-${chave}`} className="block text-[11px] text-muted mb-1">
        {rotulo}
      </label>
      <input
        id={`al-${chave}`}
        type="text"
        inputMode={extra?.inputMode}
        value={form[chave] as string}
        onChange={(e) => setForm({ ...form, [chave]: e.target.value })}
        className="num w-full rounded-btn border border-line bg-bg px-3 py-2"
      />
    </div>
  );

  return (
    <div className="space-y-3">
      <button type="button" onClick={onVoltar} className="text-sm text-muted">
        ‹ Voltar
      </button>
      <h2 className="display text-xl font-semibold">Novo alimento</h2>

      <div>
        <label htmlFor="al-nome" className="block text-[11px] text-muted mb-1">
          Nome
        </label>
        <input
          id="al-nome"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          className="w-full rounded-btn border border-line bg-bg px-3 py-2"
        />
      </div>

      <div className="flex gap-2">
        {(["100", "porcao"] as const).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setForm({ ...form, base: b })}
            aria-pressed={form.base === b}
            className="flex-1 rounded-btn border px-3 py-2 text-sm"
            style={{
              borderColor: form.base === b ? "var(--accent)" : "var(--line)",
              color: form.base === b ? "var(--accent)" : "var(--ink)",
            }}
          >
            {b === "100" ? "Por 100 g/ml" : "Por porção"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {campo("porcao", "Peso da porção (g/ml)", { inputMode: "decimal" })}
        <div>
          <label htmlFor="al-unidade" className="block text-[11px] text-muted mb-1">
            Unidade
          </label>
          <select
            id="al-unidade"
            value={form.unidade}
            onChange={(e) => setForm({ ...form, unidade: e.target.value as Unidade })}
            className="w-full rounded-btn border border-line bg-bg px-3 py-2"
          >
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="porcao">porção</option>
          </select>
        </div>
        {campo("kcal", "kcal", { inputMode: "decimal" })}
        {campo("prot", "Proteína (g)", { inputMode: "decimal" })}
        {campo("carb", "Carbo (g)", { inputMode: "decimal" })}
        {campo("gord", "Gordura (g)", { inputMode: "decimal" })}
      </div>

      {erro && (
        <p role="alert" className="text-sm" style={{ color: "var(--over)" }}>
          {erro}
        </p>
      )}

      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="w-full rounded-btn bg-accent px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {salvando ? "Salvando…" : "Salvar alimento"}
      </button>
    </div>
  );
}

export function SeletorTipo({
  tipo,
  onTipo,
}: {
  tipo: TipoRefeicao;
  onTipo: (t: TipoRefeicao) => void;
}) {
  return (
    <div>
      <p className="text-[11px] text-muted mb-1.5">Refeição</p>
      <div className="flex flex-wrap gap-1.5">
        {ORDEM_TIPO.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTipo(t)}
            aria-pressed={t === tipo}
            className="rounded-btn px-2.5 py-1.5 text-xs border"
            style={{
              borderColor: t === tipo ? "var(--accent)" : "var(--line)",
              color: t === tipo ? "var(--accent)" : "var(--ink)",
            }}
          >
            {TIPO_EMOJI[t]} {TIPO_LABEL[t]}
          </button>
        ))}
      </div>
    </div>
  );
}
