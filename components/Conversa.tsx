"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CartaoRefeicao } from "@/components/CartaoRefeicao";
import { Hub } from "@/components/Hub";
import { prepararFoto } from "@/lib/imagem";
import { kcal, num } from "@/lib/format";
import type { Card } from "@/app/api/chat/route";
import type { MessageRow } from "@/lib/types/db";

const MAX_FOTOS = 4;

const EXEMPLOS = [
  "2 ovos mexidos e um pão francês com requeijão",
  "Marmita: 150 g de arroz, 120 g de frango e salada",
  "Treinei perna 50 min",
  "Pesei 91,4 kg com 23,8% de gordura",
];

type Mensagem = {
  id: string;
  role: "user" | "assistant";
  texto: string;
  fotos: number;
  cards: Card[];
};

/** Tela de Conversa (SPEC §3.2). */
export function Conversa({ historico }: { historico: MessageRow[] }) {
  const router = useRouter();
  const [mensagens, setMensagens] = useState<Mensagem[]>(() =>
    historico.map((m) => ({
      id: m.id,
      role: m.role,
      texto: m.texto,
      fotos: m.fotos,
      cards: Array.isArray(m.cards) ? (m.cards as Card[]) : [],
    })),
  );
  const [texto, setTexto] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [hubAberto, setHubAberto] = useState(false);

  const fim = useRef<HTMLDivElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens.length, analisando]);

  async function escolherFotos(lista: FileList | null) {
    if (!lista?.length) return;
    setErro(null);
    const novas: string[] = [];
    for (const arquivo of Array.from(lista).slice(0, MAX_FOTOS - fotos.length)) {
      try {
        novas.push(await prepararFoto(arquivo));
      } catch {
        setErro("Não consegui ler a foto.");
      }
    }
    setFotos((f) => [...f, ...novas].slice(0, MAX_FOTOS));
    if (arquivoRef.current) arquivoRef.current.value = "";
  }

  async function enviar() {
    const conteudo = texto.trim();
    if (!conteudo && fotos.length === 0) return;

    setErro(null);
    setAnalisando(true);
    setMensagens((m) => [
      ...m,
      {
        id: `local-${Date.now()}`,
        role: "user",
        texto: conteudo,
        fotos: fotos.length,
        cards: [],
      },
    ]);
    setTexto("");
    const enviadas = fotos;
    setFotos([]);

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: conteudo, imagens: enviadas }),
      });
      const dados = await r.json();

      if (!r.ok) {
        setErro(dados.message ?? "Não deu certo. Tente de novo.");
        return;
      }

      setMensagens((m) => [
        ...m,
        {
          id: `ia-${Date.now()}`,
          role: "assistant",
          texto: dados.resposta,
          fotos: 0,
          cards: dados.cards ?? [],
        },
      ]);
      router.refresh();
    } catch {
      setErro("Sem conexão com o servidor.");
    } finally {
      setAnalisando(false);
    }
  }

  const vazio = mensagens.length === 0;

  return (
    <div className="flex flex-col gap-3">
      {vazio && (
        <div className="rounded-card bg-card border border-line shadow-card p-4">
          <h2 className="display text-lg font-semibold">Fale o que comeu</h2>
          <p className="mt-1 text-sm text-muted">
            Eu separo em ingredientes com kcal e macros. Você confere e corrige.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXEMPLOS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setTexto(e)}
                className="rounded-btn border border-line px-2.5 py-1.5 text-xs text-left"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {mensagens.map((m) => (
        <div key={m.id} className="space-y-2">
          {(m.texto || m.fotos > 0) && (
            <div
              className={
                m.role === "user"
                  ? "ml-auto max-w-[85%] rounded-card rounded-br-md bg-accent px-3.5 py-2.5 text-white text-sm"
                  : "mr-auto max-w-[90%] rounded-card rounded-bl-md bg-card border border-line px-3.5 py-2.5 text-sm shadow-card"
              }
            >
              {m.texto}
              {m.fotos > 0 && (
                <span className="block text-[11px] opacity-80 mt-1">
                  {m.fotos} {m.fotos === 1 ? "foto" : "fotos"}
                </span>
              )}
            </div>
          )}

          {m.cards.map((c, i) => (
            <CartaoDaConversa key={`${m.id}-${i}`} card={c} />
          ))}
        </div>
      ))}

      {analisando && (
        <p className="anim-pulso text-sm text-muted" aria-live="polite">
          Analisando…
        </p>
      )}

      {erro && (
        <p
          role="alert"
          className="rounded-btn border px-3 py-2 text-sm"
          style={{ borderColor: "var(--over)", color: "var(--over)" }}
        >
          {erro}
        </p>
      )}

      <div ref={fim} />

      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 58px)" }}
      >
        <div className="mx-auto max-w-lg px-4 py-2.5">
          {fotos.length > 0 && (
            <div className="mb-2 flex gap-2">
              {fotos.map((f, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f} alt="" className="h-14 w-14 rounded-btn object-cover" />
                  <button
                    type="button"
                    onClick={() => setFotos(fotos.filter((_, j) => j !== i))}
                    aria-label="Remover foto"
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-ink text-bg text-[11px]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setHubAberto(true)}
              aria-label="Adicionar da tabela, receitas ou favoritos"
              className="h-10 w-10 shrink-0 rounded-full border border-line bg-card text-xl leading-none"
            >
              ＋
            </button>

            <button
              type="button"
              onClick={() => arquivoRef.current?.click()}
              aria-label="Tirar ou escolher foto"
              disabled={fotos.length >= MAX_FOTOS}
              className="h-10 w-10 shrink-0 rounded-full border border-line bg-card disabled:opacity-40"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="mx-auto"
                aria-hidden
              >
                <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1-2h7.6l1 2h1.7A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-9Z" />
                <circle cx="12" cy="13" r="3.4" />
              </svg>
            </button>

            <input
              ref={arquivoRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => escolherFotos(e.target.files)}
            />

            <textarea
              rows={1}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar();
                }
              }}
              placeholder="O que você comeu?"
              aria-label="Mensagem"
              className="min-h-10 max-h-32 flex-1 resize-none rounded-card border border-line bg-card px-3.5 py-2.5 text-sm"
            />

            <button
              type="button"
              onClick={() => void enviar()}
              disabled={analisando || (!texto.trim() && fotos.length === 0)}
              aria-label="Enviar"
              className="h-10 w-10 shrink-0 rounded-full bg-accent text-white disabled:opacity-40"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto"
                aria-hidden
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <Hub aberto={hubAberto} onFechar={() => setHubAberto(false)} />
    </div>
  );
}

function CartaoDaConversa({ card }: { card: Card }) {
  if (card.tipo === "refeicao") return <CartaoRefeicao refeicao={card.refeicao} />;

  const linha = (() => {
    switch (card.tipo) {
      case "treino":
        return `🏋️ ${card.nome}${card.min ? ` · ${card.min} min` : ""}${
          card.kcal ? ` · ${kcal(card.kcal)} kcal (não abate da meta)` : ""
        }`;
      case "peso":
        return `⚖️ ${num(card.peso, 2)} kg${
          card.gordura ? ` · ${num(card.gordura)}% de gordura` : ""
        }${card.massa_muscular ? ` · ${num(card.massa_muscular)} kg de músculo` : ""}`;
      case "dia":
        return `📋 ${[
          card.passos ? `${card.passos} passos` : null,
          card.sono ? `${num(card.sono)} h de sono` : null,
          card.atividade,
        ]
          .filter(Boolean)
          .join(" · ")}`;
      case "alimento":
        return `🏷️ ${card.nome} salvo · ${kcal(card.kcal)} kcal por ${card.porcao} g`;
    }
  })();

  return (
    <div className="anim-card rounded-card bg-card border border-line shadow-card px-3.5 py-2.5 num text-sm">
      {linha}
    </div>
  );
}
