import Image from "next/image";

/** Proporção real do arquivo, para o espaço não pular enquanto carrega. */
const LOCKUP = { largura: 1200, altura: 310 };
const SIMBOLO = { largura: 512, altura: 521 };

/**
 * Marca do NutriDia.
 *
 * Duas artes em vez de um filtro de CSS: no modo escuro o azul-marinho da
 * palavra sumiria no fundo, então existe uma versão com o azul clareado.
 */
export function Logo({
  largura = 200,
  prioridade = false,
  className = "",
}: {
  largura?: number;
  prioridade?: boolean;
  className?: string;
}) {
  const altura = Math.round((largura * LOCKUP.altura) / LOCKUP.largura);

  return (
    <span className={`inline-block ${className}`} style={{ width: largura, height: altura }}>
      <Image
        src="/logo-nutridia.png"
        alt="NutriDia"
        width={LOCKUP.largura}
        height={LOCKUP.altura}
        priority={prioridade}
        className="w-full h-auto dark:hidden"
      />
      <Image
        src="/logo-nutridia-escuro.png"
        alt=""
        aria-hidden
        width={LOCKUP.largura}
        height={LOCKUP.altura}
        priority={prioridade}
        className="w-full h-auto hidden dark:block"
      />
    </span>
  );
}

/** Só a tigela, para onde o nome já está escrito ao lado. */
export function Simbolo({
  tamanho = 40,
  className = "",
}: {
  tamanho?: number;
  className?: string;
}) {
  const altura = Math.round((tamanho * SIMBOLO.altura) / SIMBOLO.largura);

  return (
    <span className={`inline-block ${className}`} style={{ width: tamanho, height: altura }}>
      <Image
        src="/simbolo-nutridia.png"
        alt=""
        aria-hidden
        width={SIMBOLO.largura}
        height={SIMBOLO.altura}
        className="w-full h-auto dark:hidden"
      />
      <Image
        src="/simbolo-nutridia-escuro.png"
        alt=""
        aria-hidden
        width={SIMBOLO.largura}
        height={SIMBOLO.altura}
        className="w-full h-auto hidden dark:block"
      />
    </span>
  );
}
