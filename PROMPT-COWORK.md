# Prompts para o Cowork (Claude no navegador)

Dois prompts independentes. Dá para mandar os dois juntos ou um de cada vez —
cada um funciona sozinho. O Prompt 1 é o que destrava a tabela completa de
alimentos; o Prompt 2 decide se vale integrar o Open Food Facts no app.

---

## Prompt 1 — Baixar a Tabela TACO em CSV e subir no GitHub

Copie daqui:

> **Regras de segurança, valem para tudo abaixo:** nunca digite dados de cartão
> de crédito — se algo pedir pagamento, pare e me avise. Não crie contas novas.
> Se aparecer captcha, confirmação de e-mail ou um login que você não tem, pare
> e me avise em vez de tentar contornar.
>
> Preciso da TACO (Tabela Brasileira de Composição de Alimentos, NEPA/UNICAMP,
> 4ª edição) em CSV. Ela tem 597 alimentos.
>
> 1. Procure primeiro a fonte oficial: busque por `TACO tabela brasileira de
>    composição de alimentos NEPA UNICAMP 4a edição` e veja se o site da UNICAMP
>    oferece planilha (.xls ou .xlsx) além do PDF.
> 2. Se só houver PDF, procure no GitHub um repositório público com a TACO já
>    convertida em CSV ou JSON (busque `TACO tabela alimentos csv` em
>    github.com). Prefira um repositório com muitas estrelas e que cite a
>    4ª edição como fonte.
> 3. Baixe o arquivo. **Confira antes de prosseguir:** ele precisa ter perto de
>    597 linhas e colunas de nome do alimento, energia (kcal), proteína,
>    carboidrato e lipídeos/gordura, todos por 100 g. Se tiver muito menos linhas
>    ou faltar alguma dessas colunas, me diga o que encontrou em vez de subir um
>    arquivo incompleto.
> 4. Se for XLS ou XLSX, abra e salve como CSV (separador vírgula, codificação
>    UTF-8).
> 5. Suba o arquivo para o GitHub:
>    - Vá em `https://github.com/reneros91/diario-dieta`
>    - Troque para o branch `claude/zen-lovelace-gws3nf` (menu de branches, no
>      canto superior esquerdo da lista de arquivos)
>    - Botão `Add file` → `Upload files`
>    - Arraste o CSV
>    - O caminho do arquivo deve ficar `dados/taco-oficial.csv`. Se a interface
>      não deixar renomear durante o upload, renomeie o arquivo no computador
>      para `taco-oficial.csv` antes de arrastar — eu movo para a pasta depois.
>    - Mensagem do commit: `dados: tabela TACO oficial em CSV`
>    - Escolha **"Commit directly to the branch `claude/zen-lovelace-gws3nf`"**
>      e confirme
> 6. Me diga no final: de onde baixou (endereço exato), quantas linhas o arquivo
>    tem, e quais são os nomes das colunas.

---

## Prompt 2 — Conferir a cobertura do Open Food Facts para produtos brasileiros

Copie daqui:

> **Regras de segurança:** nunca digite dados de cartão de crédito. Não crie
> contas novas. Se aparecer captcha ou pedido de login, pare e me avise. Nenhum
> desses endereços precisa de login.
>
> Quero saber se o Open Food Facts tem produto brasileiro de verdade, com
> números de rótulo. Abra cada endereço abaixo e me diga, para cada um, quantos
> produtos apareceram e quais os valores por 100 ml ou 100 g dos 2 primeiros
> (nome, marca, kcal, carboidrato, proteína, gordura):
>
> - `https://br.openfoodfacts.org/busca?search_terms=coca-cola`
> - `https://br.openfoodfacts.org/busca?search_terms=skol`
> - `https://br.openfoodfacts.org/busca?search_terms=guarana+antarctica`
> - `https://br.openfoodfacts.org/busca?search_terms=leite+integral+italac`
>
> Depois abra
> `https://world.openfoodfacts.org/api/v2/product/7894900011517.json`
> (código de barras de uma Coca-Cola brasileira) e me diga se voltou um produto
> com tabela nutricional ou um erro de "produto não encontrado".
>
> Resuma no final: a base tem produto brasileiro com números de rótulo, ou está
> vazia?

---

## O que eu faço com cada resposta

| Resposta do Cowork | O que acontece |
| --- | --- |
| CSV da TACO no GitHub | Gero a migração SQL e você cola no Supabase — de ~333 para 597 alimentos |
| Open Food Facts com boa cobertura | Integro a consulta por código de barras e por nome; a busca livre na web vira último recurso |
| Open Food Facts vazio ou ruim | Mudo de estratégia antes de escrever código — provavelmente prendo a busca na web a uma lista curta de sites confiáveis |
