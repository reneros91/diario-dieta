# Balanço — especificação para construir com Claude Code

O arquivo `balanco.html` que acompanha é o protótipo funcional: reaproveite dele a tabela TACO,
as fórmulas, o prompt do motor de IA (`REGRAS`), a normalização de respostas (`normAcoes`), os
cálculos de tendência e a lógica de receitas. O que ele tem de errado é onde grava (localStorage)
e quem paga a IA (o usuário). Isso muda aqui.

> Nota de implementação: o repositório chegou vazio, sem o `balanco.html`. Tudo que dependia dele
> (tabela TACO, `REGRAS`, `normAcoes`, tendência, receitas) foi reconstruído a partir desta
> especificação. Ver `README.md` → "Sobre o protótipo".

## 1. O que é

Diário alimentar e corporal em formato de conversa, para pessoas com experiência em dieta. A pessoa
fala o que comeu, treinou, pesou e dormiu; a IA separa em ingredientes com kcal e macros; a pessoa
confere e edita linha a linha. O app acompanha déficit, macros, peso e bioimpedância ao longo do
tempo e opina como um nutricionista esportivo direto, sem didatismo.

Usuários iniciais: o dono (Rene) e a noiva (Mariana). Pode crescer para mais gente. Toda chamada de
IA é paga pela chave do dono, então precisa de controle de custo por usuário.

Idioma: português do Brasil em toda a interface e nas respostas da IA.

## 2. Stack (não negociar sem motivo)

- Next.js 15, App Router, TypeScript, Tailwind. PWA instalável (manifest + service worker; funciona
  offline para leitura do que já está em cache).
- Supabase: Postgres + Auth + RLS. Login por e-mail com código (OTP), sem senha. Cada usuário só vê
  os próprios dados.
- Anthropic API somente em Route Handlers (`app/api/**`), server-side. A chave fica em
  `ANTHROPIC_API_KEY` na Vercel. Nunca no cliente. SDK oficial `@anthropic-ai/sdk`.
  - Modelo padrão em `ANTHROPIC_MODEL` (env). Começar com `claude-sonnet-5`.
  - Usar tool use com JSON Schema (tool forçada) para extrair as ações; não depender de
    "responda só JSON".
  - Visão: enviar imagens em base64 após redimensionar no cliente para ≤ 1.600 px no maior lado e
    JPEG qualidade 0,8.
- Vercel para deploy; GitHub como origem. Preview por PR.
- Sem Redux/Zustand: server components + `fetch` + revalidação simples. Sem ORM pesado; usar o
  client do Supabase com tipos gerados (`supabase gen types`).

## 3. Telas

Barra inferior com 5 abas. Conversa é a tela inicial.

### 3.1 Topo fixo (em todas as abas)

- Anel de kcal do dia: restantes (ou "acima", em vermelho), consumido / meta.
- Três barras de macro (P, C, G) com valor / alvo.

### 3.2 Conversa

- Histórico de mensagens do usuário e da IA. Cada registro que a IA fez vira um cartão dentro da
  conversa, editável.
- Campo de texto com: botão ＋ (hub), câmera/galeria (até 4 fotos), microfone é o do teclado.
- Estados: "Analisando…", erros legíveis ("limite diário atingido", "não consegui ler a foto").
- Chips de exemplo no estado vazio.

### 3.3 Cartão de refeição (componente central)

- Emoji por refeição (café ☕ / almoço 🍛 / lanche 🥪 / jantar 🍽️ / ceia 🌙), nome, hora, kcal grande,
  caixinhas P/C/G.
- Linhas de ingrediente: nome, quantidade editável (g, ml ou porção), kcal · P · C · G da linha.
  Editar quantidade recalcula proporcionalmente. Excluir linha. Zero itens apaga o cartão.
- Ações: mudar refeição, ★ favoritar, apagar.

### 3.4 Diário

- Navegação por dia (‹ ›). Resumo: consumido, saldo/acima da meta, P/C/G vs alvo.
- Refeições em ordem (café → ceia), treinos, nota do dia (passos, sono, nível de atividade).
- Botão "＋ Adicionar neste dia" (abre o hub apontando para aquele dia).

### 3.5 Período

- Seletor 7 / 30 / 90 dias (e intervalo custom).
- Déficit acumulado (só dias com registro), equivalente teórico em gordura (7.700 kcal/kg), média
  kcal/dia, déficit médio vs planejado.
- Gráfico de barras kcal/dia com linha da meta (vermelho quando acima). Para 90 dias, agregar por
  semana.
- Macros médios (g, % das kcal, g/kg de proteína).
- Balança no período: variação real vs prevista pelo déficit, com a observação padrão
  (subregistro, retenção hídrica, GET superestimado).

### 3.6 Corpo

- Registrar pesagem (peso, % gordura, opcional: massa muscular, água, gordura visceral, idade
  metabólica — campos que a balança dá).
- Gráfico de peso e de % gordura. Massa magra derivada.
- Tendência por regressão linear (mínimo 3 pesagens em ≥ 7 dias, janela 28 dias): kg/semana real vs
  planejado, gap em kcal/dia, sugestão de nova meta (limitada a ±250 kcal, nunca abaixo da TMB),
  botão "usar".
- Botão "Análise da IA" (últimos 14 dias).
- Histórico.

### 3.7 Perfil

- Dados: nome, sexo, idade, altura, peso, % gordura, fator de atividade
  (1,2 / 1,375 / 1,55 / 1,725 / 1,9).
- Meta: ritmo desejado (gera sugestão de déficit) → déficit editável em kcal/dia → ou meta fixa.
  Proteína (g/kg, padrão 2,0), gordura (% kcal, padrão 25). Mostra MLG, TMB (com a fórmula usada),
  GET, meta, alvo de macros. Aviso quando a meta bate na TMB.
- Exportar dados (JSON e CSV), apagar conta.
- Token do Atalho iOS (ver §7).

### 3.8 Hub "＋" (bottom sheet)

Tabela TACO (busca) · Minhas receitas · Meus alimentos · Refeições favoritas · Nova receita (IA) ·
Novo alimento (rótulo à mão).

- Tela de porção: quantidade com preview ao vivo de kcal e P/C/G, seletor de refeição, adicionar.

### 3.9 Receitas ("marmitas")

- Nome, ingredientes crus (texto livre, um por linha, com peso), quantas porções rendeu, peso total
  pronto (opcional).
- IA devolve itens com peso pronto (fator de rendimento) e macros calculados pelo cru. Usuário
  confere/edita, salva.
- Receita salva com kcal e macros por porção; adicionar ao dia em porções (aceita 1,5) ou em gramas
  se o peso pronto foi informado.
- Flag `publica` para compartilhar entre usuários do app (lista "Receitas da casa").

## 4. Regras de cálculo (copiar exatamente)

```
MLG = peso × (1 − gordura/100)                           # se % gordura informado
TMB = 370 + 21,6 × MLG                                   # Katch-McArdle (preferida)
TMB = 10×peso + 6,25×altura − 5×idade + (5 homem | −161 mulher)   # Mifflin, fallback
GET = TMB × fator
déficit_sugerido = kg_por_semana × 7700 / 7
meta = max( GET − déficit , TMB )                         # piso na TMB; avisar quando bater
prot_alvo(g) = protGkg × peso
gord_alvo(g) = meta × gordPct/100 / 9
carb_alvo(g) = (meta − 4×prot − 9×gord) / 4
```

- Item de refeição guarda valores por 100 unidades (k100, p100, c100, g100) + quantidade + unidade
  (`g` | `ml` | `porcao`). Editar quantidade não chama IA.
- Treino nunca abate da meta. Registra, mostra, mas não entra na conta.
- Rendimento cru → pronto (peso): arroz 2,5 · feijão 2,2 · macarrão 2,2 · lentilha 2,2 ·
  carne bovina 0,70 · frango 0,75 · peixe 0,80 · legumes 0,90 · batata 0,95. Macros calculados pelo
  cru.
- Tendência: regressão linear simples (dias × peso) → coeficiente × 7 = kg/semana.
- Déficit acumulado no período considera só dias com pelo menos uma refeição registrada.

## 5. Modelo de dados (Supabase)

Todas as tabelas com `user_id uuid references auth.users` e RLS `user_id = auth.uid()` para
select/insert/update/delete. `created_at`, `updated_at` com trigger.

```
profiles      (user_id pk, nome, sexo, idade, altura_cm, peso_kg, gordura_pct, fator, kg_sem,
               deficit_kcal null, meta_manual null, prot_gkg default 2.0, gord_pct default 25,
               ingest_token text unique, plano text default 'padrao', ai_diario_limite int default 40)
meals         (id, user_id, dia date, tipo text check in (cafe,almoco,lanche,jantar,ceia),
               nome, hora time, origem text (ia|taco|receita|alimento|favorito|manual), created_at)
meal_items    (id, meal_id fk cascade, nome, qtd numeric, unidade text, k100, p100, c100, g100, ordem int)
workouts      (id, user_id, dia, nome, minutos, kcal_estimadas, fonte text (manual|watch))
day_notes     (user_id, dia, passos, sono_h, atividade text, obs, pk(user_id, dia))
weighins      (id, user_id, dia, peso, gordura_pct, massa_muscular, agua_pct, visceral, idade_metabolica, fonte)
recipes       (id, user_id, nome, porcoes, peso_pronto_g null, obs, publica bool default false)
recipe_items  (id, recipe_id fk cascade, nome, qtd_pronto, unidade, k100, p100, c100, g100)
foods         (id, user_id, nome, unidade, porcao_rotulo, k100, p100, c100, g100)     -- "meus alimentos"
favorites     (id, user_id, nome, itens jsonb)
messages      (id, user_id, role text (user|assistant), texto, fotos int, cards jsonb, created_at)
taco          (id, nome, kcal, prot, carb, gord, unidade, fonte)                       -- pública, só leitura
ai_calls      (id, user_id, tipo, modelo, tokens_in, tokens_out, imagens, ms, custo_usd_est, created_at)
```

- Seed de `taco` com os itens do protótipo. Deixar script para importar a TACO completa depois (CSV).
- Índices: `meals(user_id, dia)`, `weighins(user_id, dia)`, `messages(user_id, created_at)`, `taco`
  com `pg_trgm` para busca por similaridade (`ilike`/`%`).
- View `day_totals(user_id, dia, kcal, prot, carb, gord)` para Diário/Período.

## 6. API e motor de IA

Todos em `app/api/`, autenticados via Supabase server client (cookie). Retornam erros como
`{ code, message }`.

### `POST /api/chat`

Body: `{ texto, imagens?: base64[] }` (imagens já redimensionadas no cliente).

1. Verifica limite diário do usuário (`ai_calls` de hoje < `ai_diario_limite`). Excedeu → 429
   `limite_diario`.
2. Monta o contexto: perfil, TMB/GET/meta/alvos, totais de hoje, refeições e treinos de hoje, última
   pesagem, tendência, data/hora. Últimas 8 mensagens como histórico.
3. System prompt = `REGRAS`, com tool forçada `registrar` cujo schema é:

```json
{ "resposta": "string (até 3 frases)",
  "acoes": [ { "tipo":"refeicao", "refeicao":"cafe|almoco|lanche|jantar|ceia", "nome":"string",
               "itens":[{ "nome":"string","quantidade":number,"unidade":"g|ml","kcal":number,"prot":number,"carb":number,"gord":number }] },
             { "tipo":"treino","nome":"string","min":number,"kcal":number },
             { "tipo":"peso","peso":number,"gordura":number|null,"massa_muscular":number|null },
             { "tipo":"dia","passos":number|null,"sono":number|null,"atividade":"sentado|leve|ativo"|null },
             { "tipo":"alimento","nome":"string","porcao":number,"unidade":"g|ml","kcal":number,"prot":number,"carb":number,"gord":number } ] }
```

4. Normaliza defensivamente (`normAcoes`), valida com zod, persiste em transação, grava `ai_calls`,
   devolve `{ resposta, cards }`.
5. Regras de negócio no prompt: peso total informado → itens somam esse peso; cru → pronto;
   kcal ≈ 4P+4C+9G; foto de rótulo → conferir "por porção" vs "por 100 g", assumir 1 porção se não
   disser; foto de prato → estimativa visual, dizer que é estimativa; foto de bioimpedância →
   repetir na resposta os números lidos; treino nunca abate meta; não inventar pesagem/treino; se a
   pessoa deu kcal e macros diretos, usar os dela.

### `POST /api/recipe/calc`

Body: `{ nome, ingredientes, porcoes, peso_pronto? }` → itens com peso pronto e macros. Mesma
mecânica (tool forçada, limite, log).

### `POST /api/analysis`

Últimos 14 dias + pesagens → parecer em até 5 frases (adesão, proteína, perda real vs déficit, uma
mudança concreta). Modelo pode ser o mesmo; `max_tokens` baixo.

### CRUD simples

`meals`, `meal_items` (PATCH quantidade), `weighins`, `recipes`, `foods`, `favorites`, `day_notes` —
via Server Actions ou route handlers, sempre checando `auth.uid()`.

### Controle de custo (obrigatório)

- Limite diário por usuário (`profiles.ai_diario_limite`, padrão 40 chamadas). Painel do dono
  (`/admin`, só para `user_id` em `ADMIN_IDS` env) com gasto por usuário e por dia.
- Registrar tokens e custo estimado em `ai_calls`.
- `max_tokens` 1.200 no chat, 2.000 em receita, 600 em análise.
- Cache de 5 min para entradas idênticas (hash de texto+imagens) na própria tabela.
- Prompt caching da Anthropic no bloco fixo `REGRAS` (cache_control ephemeral).

## 7. Integração com Apple Watch / Saúde

Página web não lê o app Saúde. Solução: Atalho do iOS que roda de manhã, lê Saúde (passos de ontem,
sono, treinos com duração e kcal) e faz `POST /api/ingest/health` com header
`Authorization: Bearer <ingest_token>`.

- Token gerado em Perfil, revogável.
- Body: `{ dia, passos, sono_h, treinos:[{nome, minutos, kcal}] }`. Upsert em `day_notes` e
  `workouts` (fonte `watch`).
- Incluir no README o passo a passo do Atalho ("Buscar amostras de saúde" → "Obter conteúdo da URL").
- kcal do relógio não abatem da meta; ficam como informação.

## 8. Design

- Mobile-first, 100% utilizável com uma mão. Fontes: Bricolage Grotesque (números grandes, títulos) e
  Manrope (texto). Números tabulares.
- Tokens: fundo `#F3F5F1`, cartão `#FFFFFF`, texto `#172420`, acento `#1F7A63`, acima da meta
  `#C8473B`, proteína `#1F7A63`, carbo `#D6902B`, gordura `#7A5AC7`. Modo escuro com
  `prefers-color-scheme` (fundo `#111614`, cartão `#1A211D`, acento `#5CC4A6`).
- Raio 18px nos cartões, 12px em botões, sombras quase invisíveis. Nada de gradiente decorativo.
- Motion só como resposta a ação (anel preenchendo, cartão aparecendo). Respeitar
  `prefers-reduced-motion`.
- Safe areas do iPhone (`viewport-fit=cover`, `env(safe-area-inset-*)`). Tema no `manifest` para o
  ícone.
- Textos curtos, voz ativa, sem "por favor", sem exclamação em erro. A pessoa é experiente: mostrar
  números, não explicar o que é caloria.

## 9. Segurança

- RLS em tudo; testar com dois usuários que não veem os dados um do outro.
- Chave da Anthropic e service role do Supabase só no server. Cliente usa anon key.
- Validar todo input com zod. Limitar imagens a 4 por mensagem e 4 MB cada após redimensionar.
- Rate limit também por IP nas rotas de IA.
- LGPD básica: exportar e apagar todos os dados da conta em um clique.

## 10. Ordem de trabalho

1. Scaffold Next.js + Tailwind + Supabase Auth (OTP) + layout com topo e abas.
2. Migrations + RLS + seed TACO + tipos gerados. Perfil com todos os cálculos da §4 (testes
   unitários das fórmulas).
3. Hub ＋: busca TACO, tela de porção com preview, cartão de refeição editável, Diário. Sem IA ainda.
4. `/api/chat` com tool forçada, normalização, persistência, cartões na conversa, limite diário e log
   de custo. Fotos.
5. Receitas (IA) e alimentos manuais. Favoritos.
6. Corpo: pesagens, gráficos, tendência, sugestão de meta, análise da IA.
7. Período.
8. PWA, ícone, offline de leitura. Atalho iOS (`/api/ingest/health`). `/admin` de custos.
9. Exportar/apagar conta. Polimento, acessibilidade, modo escuro.

## 11. Definição de pronto

- Dois usuários reais conseguem usar em celulares diferentes sem ver dados um do outro.
- "Fatia de pizza de mussarela e calabresa, 140 g" vira 3 a 5 linhas cujos gramas somam 140 e cujas
  kcal fecham com 4P+4C+9G (±5%).
- Foto de rótulo real registra o alimento e pergunta/assume a porção corretamente.
- Editar gramas de uma linha atualiza kcal, macros, cartão, topo e Diário sem chamada de IA.
- Receita com 1 kg de frango cru + 400 g de arroz cru dividida em 5 porções salva com peso pronto e
  kcal/porção coerentes.
- Tendência aparece com 3 pesagens em 7 dias e sugere ajuste quando o gap passa de 0,12 kg/semana.
- Um usuário que estourar o limite diário recebe mensagem clara e continua usando tudo que não é IA.
- Chave da Anthropic não aparece em nenhum bundle do cliente (`grep` no `.next`).
