"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adicionarItensAnalisados } from "@/app/actions";
import { FONTE_LABEL } from "@/lib/ai/taco";
import { TIPO_EMOJI, TIPO_LABEL, UNIDADE_LABEL, kcal, num } from "@/lib/format";
import type { ItemAnalisado, RespostaAnalise } from "@/app/api/analisar/route";
import type { TipoRefeicao } from "@/lib/types/db";

/**
 * Painel da IA: descreve, mostra, e só grava depois do OK.
 *
 * O chat anterior escrevia direto no diário e a pessoa só descobria o estrago
 * conferindo linha por linha depois. Aqui a ordem é outra: a IA propõe, você lê
 * os macros e a procedência de cada linha, ajusta a quantidade se quiser, e
 * então aprova. Nada entra sem esse passo.
 */

const TIMEOUT_MS = 90_000;
const MAX_IMAGENS = 4;

type Fase = "entrada" | "analisando" | "revisao";

export function PainelIA({
  dia,
  tipo,
  onFechar,
}: {
  dia: string;
  tipo: TipoRefeicao;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>("entrada");
  const [texto, setTexto] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [analise, setAnalise] = useState<RespostaAnalise | null>(null);
  const [itens, setItens] = useState<ItemAnalisado[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    campo.current?.focus();
    return () => document.removeEventListener("keydown", esc);
  }, [onFechar]);

  async function anexar(lista: FileList | null) {
    if (!lista) return;
    const novas: string[] = [];
    for (const arquivo of Array.from(lista).slice(0, MAX_IMAGENS - fotos.length)) {
      novas.push(
        await new Promise<string>((ok, falhou) => {
          const leitor = new FileReader();
          leitor.onload = () => ok(String(leitor.result));
          leitor.onerror = () => falhou(leitor.error);
          leitor.readAsDataURL(arquivo);
        }),
      );
    }
    setFotos((f) => [...f, ...novas].slice(0, MAX_IMAGENS));
  }

  async function analisar() {
    if (!texto.trim() && fotos.length === 0) return;
    setFase("analisando");
    setErro(null);

    const corta = new AbortController();
    const relogio = setTimeout(() => corta.abort(), TIMEOUT_MS);

    try {
      const r = await fetch("/api/analisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: texto.trim(), imagens: fotos, refeicao: tipo }),
        signal: corta.signal,
      });

      const dados = await r.json().catch(() => null);

      if (!r.ok) {
        setErro(
          (dados as { message?: string } | null)?.message ??
            (r.status === 504
              ? "A análise demorou demais. Tente descrever com menos itens."
              : `O servidor respondeu ${r.status}.`),
        );
        setFase("entrada");
        return;
      }

      const a = dados as RespostaAnalise;
      setAnalise(a);
      setItens(a.itens);
      setFase("revisao");
    } catch (e) {
      setErro(
        e instanceof DOMException && e.name === "AbortError"
          ? "A análise passou de 90 segundos e foi cancelada."
          : "Não consegui falar com o servidor. Veja a conexão e tente de novo.",
      );
      setFase("entrada");
    } finally {
      clearTimeout(relogio);
    }
  }

  function mudarQtd(i: number, valor: string) {
    const q = Number(valor.replace(",", ".")) || 0;
    setItens((atuais) =>
      atuais.map((item, idx) =>
        idx === i
          ? {
              ...item,
              qtd: q,
              // Os valores por 100 é que são a verdade da linha; o absoluto
              // é sempre derivado deles, como no cartão do diário.
              kcal: Math.round((q * item.k100) / 100),
              prot: Math.round((q * item.p100) / 10) / 10,
              carb: Math.round((q * item.c100) / 10) / 10,
              gord: Math.round((q * item.g100) / 10) / 10,
            }
          : item,
      ),
    );
  }

  const validos = itens.filter((i) => i.qtd > 0);
  const total = validos.reduce(
    (a, i) => ({
      kcal: a.kcal + i.kcal,
      prot: a.prot + i.prot,
      carb: a.carb + i.carb,
      gord: a.gord + i.gord,
    }),
    { kcal: 0, prot: 0, carb: 0, gord: 0 },
  );

  function aprovar() {
    if (validos.length === 0) {
      setErro("Nenhuma linha para adicionar.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const r = await adicionarItensAnalisados({
        dia,
        tipo,
        nome: nomeDaRefeicao(validos),
        itens: validos.map((i) => ({
          nome: i.nome,
          qtd: i.qtd,
          unidade: i.unidade,
          fonte: fonteValida(i.fonte),
          k100: i.k100,
          p100: i.p100,
          c100: i.c100,
          g100: i.g100,
        })),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.refresh();
      onFechar();
    });
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

        <header className="flex items-baseline justify-between gap-3">
          <h2 className="display text-xl font-semibold">Descrever com a IA</h2>
          <span className="text-[11px] text-muted shrink-0">
            {TIPO_EMOJI[tipo]} {TIPO_LABEL[tipo]}
          </span>
        </header>

        {fase !== "revisao" && (
          <div className="mt-3 space-y-3">
            <textarea
              ref={campo}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              placeholder="150 g de arroz, um filé de frango e salada. Ou mande uma foto."
              className="w-full rounded-btn border border-line bg-bg px-3 py-2.5 text-sm resize-none"
              aria-label="O que você comeu"
            />

            <p className="text-[11px] text-muted -mt-1.5">
              Para falar em vez de digitar, use o microfone do teclado do celular.
            </p>

            {fotos.length > 0 && (
              <ul className="flex gap-2 flex-wrap">
                {fotos.map((f, i) => (
                  <li key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f} alt="" className="h-16 w-16 rounded-btn object-cover" />
                    <button
                      type="button"
                      onClick={() => setFotos((atual) => atual.filter((_, x) => x !== i))}
                      aria-label={`Remover foto ${i + 1}`}
                      className="absolute -top-1.5 -right-1.5 rounded-full bg-card border border-line h-5 w-5 text-[11px] leading-none"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <label className="flex-1 rounded-btn border border-line px-3 py-2.5 text-sm text-center cursor-pointer">
                📷 Foto
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    void anexar(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                onClick={analisar}
                disabled={fase === "analisando" || (!texto.trim() && fotos.length === 0)}
                className="flex-[2] rounded-btn btn-acento px-4 py-2.5 font-semibold disabled:opacity-50"
              >
                {fase === "analisando" ? "Analisando…" : "Analisar"}
              </button>
            </div>

            {fase === "analisando" && (
              <p className="text-sm text-muted anim-pulso">
                Consultando a tabela e o rótulo do produto…
              </p>
            )}
          </div>
        )}

        {fase === "revisao" && analise && (
          <div className="mt-3 space-y-3">
            {analise.resposta && <p className="text-sm">{analise.resposta}</p>}

            {itens.length > 0 && (
              <>
                <ul className="divide-y divide-line">
                  {itens.map((item, i) => (
                    <li key={`${item.nome}-${i}`} className="py-2.5 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-tight truncate">{item.nome}</p>
                        <p className="num text-[11px] text-muted">
                          {kcal(item.kcal)} kcal · {num(item.prot)} P · {num(item.carb)} C ·{" "}
                          {num(item.gord)} G
                        </p>
                        <p
                          className="text-[10px] mt-0.5"
                          style={{
                            color:
                              item.fonte === "estimativa" ? "var(--carb)" : "var(--muted)",
                          }}
                        >
                          {rotuloFonte(item.fonte)}
                          {item.fonte_detalhe ? ` · ${item.fonte_detalhe}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="text"
                          inputMode="decimal"
                          defaultValue={String(item.qtd)}
                          onBlur={(e) => mudarQtd(i, e.target.value)}
                          aria-label={`Quantidade de ${item.nome}`}
                          className="num w-16 rounded-btn border border-line bg-bg px-2 py-1.5 text-right text-sm"
                        />
                        <span className="text-[11px] text-muted w-6">
                          {UNIDADE_LABEL[item.unidade]}
                        </span>
                        <button
                          type="button"
                          onClick={() => setItens((a) => a.filter((_, x) => x !== i))}
                          aria-label={`Tirar ${item.nome}`}
                          className="rounded-btn px-2 py-1 text-muted"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="rounded-card bg-bg p-3">
                  <p className="display num text-2xl font-semibold leading-none">
                    {kcal(total.kcal)}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">kcal no total</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 num text-sm">
                    <span style={{ color: "var(--prot)" }}>P {num(total.prot)} g</span>
                    <span style={{ color: "var(--carb)" }}>C {num(total.carb)} g</span>
                    <span style={{ color: "var(--gord)" }}>G {num(total.gord)} g</span>
                  </div>
                </div>
              </>
            )}

            {analise.problemas.length > 0 && (
              <p className="text-sm" style={{ color: "var(--over)" }}>
                {analise.problemas.join(" · ")}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setFase("entrada");
                  setAnalise(null);
                  setItens([]);
                }}
                className="flex-1 rounded-btn border border-line px-4 py-3 text-sm"
              >
                Refazer
              </button>
              <button
                type="button"
                onClick={aprovar}
                disabled={salvando || validos.length === 0}
                className="flex-[2] rounded-btn btn-acento px-4 py-3 font-semibold disabled:opacity-50"
              >
                {salvando ? "Adicionando…" : `Adicionar ao ${TIPO_LABEL[tipo].toLowerCase()}`}
              </button>
            </div>
          </div>
        )}

        {erro && (
          <p role="alert" className="mt-3 text-sm" style={{ color: "var(--over)" }}>
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}

/** O cartão precisa de um nome; o da primeira linha diz mais que "Refeição". */
function nomeDaRefeicao(itens: ItemAnalisado[]): string {
  if (itens.length === 0) return "Refeição";
  if (itens.length === 1) return itens[0].nome.slice(0, 120);
  return `${itens[0].nome} +${itens.length - 1}`.slice(0, 120);
}

const FONTES_GRAVAVEIS = ["taco", "rotulo", "web", "receita", "estimativa", "manual"] as const;

function fonteValida(fonte: string): (typeof FONTES_GRAVAVEIS)[number] {
  return (FONTES_GRAVAVEIS as readonly string[]).includes(fonte)
    ? (fonte as (typeof FONTES_GRAVAVEIS)[number])
    : "estimativa";
}

function rotuloFonte(fonte: string): string {
  if (fonte === "taco") return "tabela de alimentos";
  if (fonte === "web") return "pesquisado";
  if (fonte === "rotulo") return "rótulo";
  return `${FONTE_LABEL.estimativa} da IA`;
}
