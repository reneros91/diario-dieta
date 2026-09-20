/**
 * Importa a TACO completa a partir de um CSV.
 *
 *   npm run taco:import -- caminho/para/taco.csv
 *
 * Colunas esperadas (cabeçalho, em qualquer ordem):
 *   nome, kcal, prot, carb, gord [, unidade] [, fonte]
 *
 * Precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.
 * Alimento com nome repetido é atualizado, não duplicado.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("uso: npm run taco:import -- caminho/taco.csv");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

/** CSV com aspas e vírgula dentro do campo. */
function linhasCSV(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += c;
      continue;
    }

    if (c === '"') aspas = true;
    else if (c === "," || c === ";") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n") {
      linha.push(campo.replace(/\r$/, ""));
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }

  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }

  return linhas.filter((l) => l.some((c) => c.trim() !== ""));
}

const numero = (v: string) => {
  const n = Number((v ?? "").trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

async function main() {
  const linhas = linhasCSV(readFileSync(arquivo, "utf8"));
  const cabecalho = linhas[0].map((c) => c.trim().toLowerCase());
  const col = (nome: string) => cabecalho.indexOf(nome);

  const iNome = col("nome");
  const iKcal = col("kcal");
  if (iNome < 0 || iKcal < 0) {
    console.error(`cabeçalho precisa ter ao menos "nome" e "kcal"; veio: ${cabecalho.join(", ")}`);
    process.exit(1);
  }

  const registros = linhas
    .slice(1)
    .map((l) => ({
      nome: (l[iNome] ?? "").trim(),
      kcal: numero(l[iKcal]),
      prot: numero(l[col("prot")]),
      carb: numero(l[col("carb")]),
      gord: numero(l[col("gord")]),
      unidade: (l[col("unidade")] ?? "g").trim() === "ml" ? "ml" : "g",
      fonte: (l[col("fonte")] ?? "TACO").trim() || "TACO",
    }))
    .filter((r) => r.nome.length > 1);

  const sb = createClient(url!, chave!, { auth: { persistSession: false } });

  let gravados = 0;
  for (let i = 0; i < registros.length; i += 500) {
    const lote = registros.slice(i, i + 500);
    const { error } = await sb.from("taco").upsert(lote, { onConflict: "nome" });
    if (error) {
      console.error(`lote ${i / 500 + 1} falhou:`, error.message);
      process.exit(1);
    }
    gravados += lote.length;
    console.log(`${gravados}/${registros.length}`);
  }

  console.log(`pronto: ${gravados} alimentos`);
}

void main();
