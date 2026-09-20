# Comece aqui

Guia para colocar o Balanço no ar do zero, sem precisar saber programar. São três contas
gratuitas (GitHub, Supabase, Vercel) e uma paga por uso (Anthropic). Reserve uns 40 minutos.

Quem já é técnico pode ir direto ao [`README.md`](./README.md).

---

## O que é cada peça

| Peça | Para que serve | Custo |
| --- | --- | --- |
| **GitHub** | guarda o código. Já está feito. | grátis |
| **Supabase** | guarda os *dados*: refeições, pesagens, receitas, login | grátis no plano inicial |
| **Vercel** | é o *site* em si — o endereço que você abre no celular | grátis no plano pessoal |
| **Anthropic** | é a *IA* que lê o que você escreveu e separa em ingredientes | por uso, centavos por conversa |

O app funciona sem a Anthropic — só o chat fica desligado. Sem o Supabase ele não funciona,
porque não teria onde salvar nada.

---

## Passo 1 — Supabase (onde os dados moram)

1. Entre em **supabase.com** e crie a conta (dá para entrar com o GitHub).
2. Clique em **New project**.
   - **Name:** `balanco`
   - **Database Password:** clique em *Generate a password* e **guarde num lugar seguro**. Você
     não vai precisar dela no dia a dia, mas não dá para recuperar depois.
   - **Region:** `South America (São Paulo)` — é a mais perto, o app fica mais rápido.
3. Clique em **Create new project** e espere uns 2 minutos até ficar verde.

### 1.1 — Criar as tabelas

1. No menu da esquerda, clique em **SQL Editor**.
2. Clique em **New query**.
3. Abra o arquivo `supabase/migrations/0001_init.sql` deste projeto, copie **tudo** e cole na
   caixa. Clique em **Run** (ou Ctrl+Enter). Deve aparecer *Success*.
4. Clique em **New query** de novo, e repita com o arquivo `supabase/migrations/0002_seed_taco.sql`.
   Esse é o que enche a lista de alimentos.

> Se aparecer erro vermelho, confira se você colou o arquivo inteiro, do começo ao fim, e se rodou
> o `0001` **antes** do `0002`.

### 1.2 — Deixar o login por código ligado

1. Menu da esquerda → **Authentication** → **Providers** → **Email**.
2. Deixe **Enable Email provider** ligado.
3. Ainda em Authentication, vá em **Emails** (ou *Email Templates*) → aba **Magic Link**.
4. No corpo do e-mail, garanta que existe a linha `{{ .Token }}` — é o código de 6 dígitos que o
   app pede. Se só tiver o link, acrescente uma linha com:

   ```
   Seu código: {{ .Token }}
   ```

### 1.3 — Copiar as três chaves

Menu da esquerda → **Project Settings** (a engrenagem) → **API**. Deixe essa aba aberta, você vai
copiar daqui no passo 3:

| Nome na tela do Supabase | Para onde vai |
| --- | --- |
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon public** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role** | `SUPABASE_SERVICE_ROLE_KEY` |

> A `service_role` é a chave-mestra: ela ignora todas as travas de segurança. Nunca cole ela num
> site, num grupo de WhatsApp ou num print. As outras duas podem aparecer, são públicas por
> natureza — quem protege os dados é a regra de acesso que já está no banco.

---

## Passo 2 — Anthropic (a IA)

1. Entre em **console.anthropic.com** e crie a conta.
2. Em **Billing**, coloque um cartão e adicione um crédito inicial (US$ 5 já dura bastante para
   duas pessoas).
3. Em **API Keys** → **Create Key**. Dê o nome `balanco` e **copie a chave na hora** — ela só
   aparece uma vez. Ela começa com `sk-ant-`.

Essa chave vai em `ANTHROPIC_API_KEY`.

> É a sua chave que paga as conversas de todo mundo que usar o app. Por isso cada pessoa tem um
> limite de 40 chamadas de IA por dia, e existe a tela `/admin` para você ver quanto cada uma
> gastou.

---

## Passo 3 — Vercel (o site)

1. Entre em **vercel.com** e crie a conta **entrando com o GitHub**.
2. Clique em **Add New** → **Project**.
3. Na lista, encontre **diario-dieta** e clique em **Import**.
4. Antes de clicar em Deploy, abra **Environment Variables** e adicione uma por uma:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | a *Project URL* do passo 1.3 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a chave *anon public* |
   | `SUPABASE_SERVICE_ROLE_KEY` | a chave *service_role* |
   | `ANTHROPIC_API_KEY` | a chave `sk-ant-...` do passo 2 |
   | `ANTHROPIC_MODEL` | `claude-sonnet-5` |

5. Clique em **Deploy** e espere. No fim a Vercel mostra o endereço, algo como
   `https://diario-dieta.vercel.app`.

### 3.1 — Avisar o Supabase qual é o endereço

1. Volte ao Supabase → **Authentication** → **URL Configuration**.
2. Em **Site URL**, coloque o endereço da Vercel.
3. Em **Redirect URLs**, adicione o mesmo endereço com `/**` no fim:
   `https://diario-dieta.vercel.app/**`

Sem isso o código do e-mail chega, mas o login não conclui.

---

## Passo 4 — Primeiro acesso

1. Abra o endereço da Vercel no celular.
2. Digite seu e-mail → chega um código de 6 dígitos → digite e entre.
3. Vá direto na aba **Perfil** e preencha: sexo, idade, altura, peso, % de gordura (se souber) e
   o fator de atividade. É daí que saem a TMB, o GET e a meta — antes disso os números na tela
   são só o padrão de fábrica.
4. Volte na **Conversa** e escreva algo como *"2 ovos mexidos e um pão francês com requeijão"*.

Para a Mariana usar: ela abre o mesmo endereço e entra com o e-mail dela. Cada conta enxerga só
os próprios dados — isso é garantido pelo banco, não pelo app.

### Instalar como aplicativo no iPhone

Abra o endereço no Safari → botão de compartilhar → **Adicionar à Tela de Início**. Ele passa a
abrir em tela cheia, sem a barra do navegador, com ícone próprio.

---

## Passo 5 (opcional) — Ver seus gastos de IA

A tela `/admin` mostra quanto cada pessoa gastou, por dia. Para liberar:

1. No Supabase → **Authentication** → **Users**, clique no seu usuário e copie o **UID**.
2. Na Vercel → **Settings** → **Environment Variables**, crie `ADMIN_IDS` com esse UID colado.
   (Para liberar mais de uma pessoa, separe por vírgula.)
3. Em **Deployments**, clique nos três pontinhos do último deploy → **Redeploy**.

Depois é só abrir `https://seu-endereco.vercel.app/admin`.

---

## Passo 6 (opcional) — Atalho do iPhone para o Apple Watch

Faz os passos, o sono e os treinos do Saúde entrarem sozinhos toda manhã. O passo a passo,
ação por ação, está no [`README.md`](./README.md#atalho-do-ios-apple-watch--saúde). O token fica
em **Perfil → Atalho do iOS**.

---

## Se der errado

| O que você vê | O que é |
| --- | --- |
| Tela "Falta configurar" | alguma variável não foi salva na Vercel, ou faltou o *Redeploy* depois de adicionar |
| O código do e-mail não chega | veja a caixa de spam; confirme que o provider Email está ligado no Supabase |
| Digito o código e volta para o login | falta o endereço da Vercel em *Redirect URLs* (passo 3.1) |
| "Limite diário de IA atingido" | são 40 conversas por dia por pessoa; o resto do app continua funcionando normalmente |
| "IA não configurada neste ambiente" | falta a `ANTHROPIC_API_KEY` na Vercel |
| Erro de tabela não encontrada | as migrations do passo 1.1 não rodaram, ou rodaram fora de ordem |

Mudou uma variável na Vercel? **Sempre faça o Redeploy depois** — ela só passa a valer no
próximo deploy.
