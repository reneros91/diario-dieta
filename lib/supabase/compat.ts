/**
 * Compatibilidade com um banco que ainda não recebeu a migration mais nova.
 *
 * O app é publicado na Vercel assim que o código entra na branch, mas as
 * migrations são rodadas à mão no painel do Supabase. Entre uma coisa e outra
 * existe uma janela em que o código grava uma coluna que o banco não tem — e
 * o sintoma é cruel: tudo parece funcionar e nada é registrado.
 *
 * Aqui a gravação tenta com a coluna nova e, se o banco disser que ela não
 * existe, repete sem ela. Perde a procedência da linha, não perde a refeição.
 */

const CODIGOS_COLUNA_AUSENTE = new Set([
  "PGRST204", // PostgREST: coluna fora do cache de schema
  "42703", // Postgres: undefined_column
]);

/** Só o que interessa do erro; a classe inteira do SDK não é necessária. */
export type ErroBanco = { code: string; message: string; details?: string | null };

export function colunaAusente(erro: ErroBanco | null, coluna: string): boolean {
  if (!erro) return false;
  if (CODIGOS_COLUNA_AUSENTE.has(erro.code)) {
    return `${erro.message} ${erro.details ?? ""}`.toLowerCase().includes(coluna.toLowerCase());
  }
  return false;
}

/** Tira uma chave de cada linha, para repetir a gravação sem ela. */
export function semColuna<T extends object, K extends keyof T>(
  linhas: T[],
  coluna: K,
): Omit<T, K>[] {
  return linhas.map((linha) => {
    const copia = { ...linha };
    delete copia[coluna];
    return copia;
  });
}
