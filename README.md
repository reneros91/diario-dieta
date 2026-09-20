# NutriDia

Diário alimentar e corporal em formato de conversa. A pessoa fala o que comeu, treinou, pesou e
dormiu; a IA separa em ingredientes com kcal e macros; a pessoa confere e edita linha a linha.

A especificação completa está em [`SPEC.md`](./SPEC.md). Este README é o que você precisa para
rodar, publicar e mexer.

## Sobre o protótipo

A especificação cita um `balanco.html` como protótipo de referência (tabela TACO, `REGRAS`,
`normAcoes`, tendência, receitas). **O arquivo não veio no repositório** — ele chegou vazio, sem
nenhum commit. Tudo que dependia dele foi reconstruído a partir da própria especificação:

| Coisa do protótipo | Onde está agora |
| --- | --- |
| Tabela TACO (~140 itens) | `supabase/migrations/0002_seed_taco.sql` — 160 alimentos, com `fonte` separando TACO de rótulo médio |
| Fórmulas (§4) | `lib/calc.ts`, com testes em `lib/calc.test.ts` |
| `REGRAS` (prompt do motor) | `lib/ai/prompt.ts` |
| `normAcoes` | `lib/ai/normalize.ts`, com testes em `lib/ai/normalize.test.ts` |
| Tendência e sugestão de meta | `lib/calc.ts` (`tendencia`, `sugerirMeta`) |
| Lógica de receitas | `lib/ai/prompt.ts` (`REGRAS_RECEITA`) + `app/api/recipe/calc/route.ts` |

Se o `balanco.html` aparecer, vale comparar os valores da TACO e o texto do prompt — o resto da
mecânica está coberta por teste.

> **Não é programador?** Vá direto para o [`COMECE-AQUI.md`](./COMECE-AQUI.md): é o mesmo caminho,
> explicado clique a clique, sem jargão.

## Rodar

```bash
npm install
cp .env.example .env.local   # preencha as chaves
npm run dev
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` | sobe em http://localhost:3000 |
| `npm run build` | build de produção |
| `npm test` | testes das fórmulas e da normalização |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run taco:import -- taco.csv` | importa uma TACO completa por cima do seed |

Sem as chaves do Supabase o app não quebra: ele sobe e mostra a tela `/configurar`, dizendo o que
falta. Assim que as variáveis entram, essa tela some sozinha e o app abre no login.

### Variáveis de ambiente

| Variável | Onde vive | Para quê |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | cliente e servidor | projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente e servidor | chave pública; a RLS é que protege |
| `SUPABASE_SERVICE_ROLE_KEY` | **só servidor** | ingestão do Atalho e log de custo |
| `ANTHROPIC_API_KEY` | **só servidor** | paga todas as chamadas de IA |
| `ANTHROPIC_MODEL` | servidor | padrão `claude-sonnet-5` |
| `ADMIN_IDS` | servidor | `user_id` dos donos, separados por vírgula, com acesso a `/admin` |
| `NEXT_PUBLIC_SITE_URL` | ambos | origem pública (link do OTP, Atalho do iOS) |

Nenhuma chave de servidor entra no bundle do cliente. Para conferir depois de um build:

```bash
grep -rl "ANTHROPIC_API_KEY\|SERVICE_ROLE" .next/static/   # não deve achar nada
```

## Banco

Aplique as migrations na ordem, pelo SQL Editor do Supabase ou pela CLI:

```bash
supabase db push        # ou cole supabase/migrations/*.sql no SQL Editor
```

- `0001_init.sql` — tabelas, RLS, triggers, índices (`pg_trgm` na TACO) e a view `day_totals`.
- `0002_seed_taco.sql` — alimentos do dia a dia.

Toda tabela tem RLS ligada com `user_id = auth.uid()`. `meal_items` e `recipe_items` herdam do pai.
`taco` é leitura para qualquer pessoa autenticada. Receita com `publica = true` aparece para a casa
inteira, mas só o dono edita.

Para regenerar os tipos depois de mexer no esquema:

```bash
npx supabase gen types typescript --project-id <id> > lib/types/db.ts
```

### Auth

Login por **e-mail e senha** (`signInWithPassword`), com cadastro em `/cadastro`
(`signUp`, mínimo de 8 caracteres).

No painel do Supabase, em **Authentication → Providers → Email**: provider ligado e
**"Confirm email" DESLIGADO**. Sem isso o `signUp` não devolve sessão e a pessoa fica presa na
tela de cadastro (o app avisa, em vez de travar em silêncio).

> Por que não OTP: o plano gratuito do Supabase envia **2 e-mails por hora no projeto inteiro**.
> Com login por código, duas pessoas entrando na mesma manhã já estouram o limite — é a razão de
> a autenticação ser por senha.

`/auth/confirm` continua no projeto: não é mais usada no login do dia a dia, e serve de ponto de
entrada caso um fluxo de recuperação de senha seja ligado depois.

## Publicar na Vercel

1. Conecte o repositório.
2. Preencha as variáveis acima em **Settings → Environment Variables** (as de servidor sem o
   prefixo `NEXT_PUBLIC_`).
3. Em **Authentication → URL Configuration** no Supabase, acrescente o domínio da Vercel às
   *Redirect URLs*.

Cada PR ganha um preview. As rotas de IA rodam no runtime Node (`maxDuration` de 60 s).

## Controle de custo

A chave da Anthropic é uma só e é do dono, então o custo é medido por pessoa:

- Limite diário por usuário em `profiles.ai_diario_limite` (padrão 40 chamadas/dia). Estourou →
  HTTP 429 `limite_diario`, e o resto do app continua funcionando normalmente.
- Toda chamada grava tokens, tempo e custo estimado em `ai_calls`.
- Entradas idênticas nos últimos 5 minutos reaproveitam a resposta, sem nova chamada.
- O bloco `REGRAS` do system prompt vai com `cache_control` ephemeral — leitura de cache custa uma
  fração do token de entrada.
- `max_tokens`: 1.200 no chat, 2.000 na receita, 600 na análise.
- Rate limit por IP nas rotas de IA, além do limite por usuário.
- `/admin` mostra gasto por usuário e por dia (só para quem está em `ADMIN_IDS`).

Se a tabela de preços da Anthropic mudar, atualize `PRECO` em `lib/ai/anthropic.ts`.

## Atalho do iOS (Apple Watch / Saúde)

Página web não lê o app Saúde. O Atalho roda de manhã, lê o Saúde e faz um POST.

**Endereço:** `POST https://<seu-domínio>/api/ingest/health`
**Header:** `Authorization: Bearer <ingest_token>` — o token está em **Perfil → Atalho do iOS**, e
pode ser trocado a qualquer momento (o antigo deixa de valer na hora).

**Corpo:**

```json
{
  "dia": "2026-02-10",
  "passos": 8432,
  "sono_h": 7.2,
  "treinos": [{ "nome": "Musculação", "minutos": 52, "kcal": 410 }]
}
```

### Montando o Atalho

1. App **Atalhos** → **+** → nomeie "NutriDia da manhã".
2. **Data** → ajuste para ontem: ação *Data* com "Ajustar Data" de −1 dia. Formate como
   `aaaa-MM-dd` com *Formatar Data* e guarde em uma variável `dia`.
3. **Buscar amostras de saúde** → Tipo: *Passos*, Período: *Ontem*, Operação: *Soma*. Guarde em
   `passos`.
4. **Buscar amostras de saúde** → Tipo: *Análise do sono* (ou *Tempo de sono*), Período: *Ontem*,
   Operação: *Soma*. Converta para horas e guarde em `sono`.
5. **Buscar exercícios** (Buscar amostras de treino) → Período: *Ontem*. Use *Repetir com cada* para
   montar a lista de `{nome, minutos, kcal}` com **Adicionar ao dicionário** e
   **Adicionar à variável**.
6. **Texto** → monte o JSON acima usando as variáveis.
7. **Obter conteúdo da URL**:
   - URL: `https://<seu-domínio>/api/ingest/health`
   - Método: `POST`
   - Cabeçalhos: `Authorization` = `Bearer <seu token>`, `Content-Type` = `application/json`
   - Corpo da requisição: **Arquivo** → a variável do passo 6 (ou *JSON*, montando os campos na
     própria ação).
8. **Automação** → *Hora do dia*, 7h, executar sem perguntar.

Rodar de novo no mesmo dia não duplica: os treinos de fonte `watch` daquele dia são substituídos, e
os treinos digitados à mão ficam onde estão. **kcal do relógio não abatem da meta** — entram como
informação, igual a treino digitado.

## Como o app está organizado

```
app/
  (app)/            5 abas com o topo fixo: conversa, diário, período, corpo, perfil
  api/
    chat/           motor de IA: tool forçada, normalização, persistência, custo
    recipe/calc/    receita crua → peso pronto e macros
    analysis/       parecer dos últimos 14 dias
    ingest/health/  Atalho do iOS (autenticado por token, não por cookie)
    busca/ hub/     TACO, receitas, alimentos e favoritos
    export/         JSON e CSV de tudo (LGPD)
  admin/            gasto de IA por usuário e por dia
  actions.ts        server actions do CRUD, todas checando a sessão
components/         cartão de refeição, hub ＋, gráficos, formulários
lib/
  calc.ts           TODAS as fórmulas da §4 — o único lugar onde elas existem
  ai/               prompt, schema da tool, normalização, cliente e custo
  supabase/         clients de browser, servidor e service role
supabase/migrations/
```

### Decisões que valem saber

- **Um item guarda valor por 100 unidades + quantidade.** Editar a gramatura de uma linha é
  multiplicação no cliente e um `UPDATE` de um campo — nunca uma chamada de IA.
- **Treino não abate da meta.** Fica registrado e visível, fora da conta de kcal.
- **Dia sem refeição não é dia de déficit.** O período só soma dias com pelo menos um registro.
- **kcal sempre fecham com 4P + 4C + 9G.** Se o modelo devolver algo com mais de 5% de diferença, o
  valor derivado dos macros ganha.
- **A meta tem piso na TMB.** Quando bate no piso, a tela avisa em vez de deixar cortar mais.
- **A pesagem de hoje vira o peso do perfil**, então TMB, GET e alvos acompanham o corpo.

## Acessibilidade e design

Tokens de cor, raio e sombra ficam em `app/globals.css` (claro e escuro por `prefers-color-scheme`).
Os três macros usam teal/âmbar/roxo, validados para daltonismo — e **toda marca colorida vem com
rótulo em texto**, então a cor nunca é a única informação. Movimento só como resposta a uma ação, e
desligado sob `prefers-reduced-motion`. Safe areas do iPhone com `viewport-fit=cover`.

## Estado atual

Implementado: as 9 etapas da §10 — scaffold e login, banco com RLS e seed, hub e diário, motor de
IA com fotos e controle de custo, receitas e alimentos, corpo com tendência e análise, período, PWA
com ingestão do Atalho e painel de custos, exportação e exclusão de conta.

Testado automaticamente: fórmulas (`lib/calc.test.ts`) e normalização das respostas da IA
(`lib/ai/normalize.test.ts`), incluindo o caso da fatia de pizza de 140 g da §11. O que depende de
Supabase e da API da Anthropic ativos — RLS entre duas contas reais, foto de rótulo, limite diário
estourando — precisa de verificação manual com as chaves no lugar.

## Marca

O logo e o ícone vêm de uma única arte, processada em `public/`:

| Arquivo | Onde aparece |
| --- | --- |
| `logo-nutridia.png` / `-escuro.png` | lockup completo — login e `/configurar` |
| `simbolo-nutridia.png` / `-escuro.png` | só a tigela — topo do cadastro |
| `icons/icone-{192,512}.png` | ícone do PWA e da aba |
| `icons/apple-touch-icon.png` | tela de início do iPhone |
| `icons/icone-maskable-512.png` | Android, com folga para o recorte circular |

Duas artes em vez de um filtro de CSS: no modo escuro o azul-marinho da palavra sumiria no fundo
`#111614`, então existe uma versão com esse azul clareado. O componente `components/Logo.tsx`
troca entre elas por `prefers-color-scheme`.

Os ícones têm fundo branco sólido de propósito — o iOS não respeita transparência e preencheria
com preto.

> **Pendente:** a paleta do app (acento verde `#1F7A63`, definida na SPEC §8) é anterior a esta
> marca e não conversa com o azul e o laranja do logo — o botão da tela de login é verde embaixo
> de um logo azul. Trocar os tokens de `app/globals.css` para o azul `#1048B0` e o laranja
> `#F09C60` resolve, mas muda o app inteiro, então está esperando decisão.
