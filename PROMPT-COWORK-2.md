# Prompt 2ª tentativa — entregar a TACO e o resultado do Open Food Facts

O primeiro pedido não chegou: o arquivo não apareceu no GitHub. O provável é que
o download tenha funcionado e o upload não. Este prompt refaz só o que faltou e
**confere no final** se o arquivo está mesmo lá.

Mande tudo abaixo de uma vez.

---

> **Regras de segurança:** nunca digite dados de cartão de crédito — se algo
> pedir pagamento, pare e me avise. Não crie contas novas. Se aparecer captcha
> ou um login que você não tem, pare e me avise em vez de tentar contornar.
>
> Você já tentou esta tarefa antes e o arquivo não chegou no destino. Desta vez,
> o passo que importa é o 3: só considere a tarefa concluída depois de **ver o
> arquivo listado** na página do GitHub.
>
> **TAREFA A — colocar a Tabela TACO no GitHub**
>
> 1. Veja se você já baixou o arquivo numa tentativa anterior. Procure na pasta
>    de Downloads por algo como `taco`, `.csv` ou `.xlsx`. Se já existir e tiver
>    perto de 597 linhas com nome do alimento, energia (kcal), proteína,
>    carboidrato e lipídeos por 100 g, use esse mesmo arquivo e pule para o
>    passo 2.
>
>    Se não existir, baixe agora: procure a Tabela Brasileira de Composição de
>    Alimentos (TACO, NEPA/UNICAMP, 4ª edição) em CSV ou XLSX. Tente primeiro o
>    site da UNICAMP; se lá só houver PDF, procure no GitHub por um repositório
>    público com a TACO já convertida (busque `TACO tabela alimentos csv`),
>    preferindo um com muitas estrelas que cite a 4ª edição como fonte.
>
> 2. Se o arquivo for XLSX, abra e salve como CSV, separador vírgula,
>    codificação UTF-8. Renomeie o arquivo para exatamente `taco-oficial.csv`.
>
> 3. Suba para o GitHub e **confirme**:
>    - Abra `https://github.com/reneros91/diario-dieta`
>    - No canto superior esquerdo da lista de arquivos há um botão com o nome do
>      branch atual (provavelmente `main`). Clique nele e escolha
>      `claude/zen-lovelace-gws3nf`. Confirme que o botão agora mostra esse nome
>      antes de seguir.
>    - Botão `Add file` → `Upload files`
>    - Arraste o `taco-oficial.csv`
>    - Espere a barra de progresso terminar. Arquivo grande demora.
>    - Role até o fim da página. No campo da mensagem escreva
>      `dados: tabela TACO oficial em CSV`
>    - Logo abaixo há duas opções. Marque
>      **"Commit directly to the `claude/zen-lovelace-gws3nf` branch"**
>      — NÃO a opção de criar um branch novo com pull request.
>    - Clique no botão verde `Commit changes`
>    - **Verificação obrigatória:** abra
>      `https://github.com/reneros91/diario-dieta/blob/claude/zen-lovelace-gws3nf/taco-oficial.csv`
>      e me diga o que aparece. Se abrir a tabela, deu certo. Se aparecer
>      "404" ou "This is not the web page you are looking for", o commit não
>      foi feito — tente de novo e me diga exatamente em qual passo travou.
>
>    Se o upload falhar duas vezes, pare e me diga onde o arquivo está salvo no
>    computador e qual o tamanho dele. Eu resolvo por outro caminho.
>
> **TAREFA B — vistoria no Open Food Facts**
>
> Não baixe nada e não faça login. É só olhar e me contar.
>
> Abra cada endereço e me diga, para cada um, quantos produtos apareceram e os
> valores por 100 ml ou 100 g dos 2 primeiros (nome, marca, kcal, carboidrato,
> proteína, gordura):
>
> - `https://br.openfoodfacts.org/busca?search_terms=coca-cola`
> - `https://br.openfoodfacts.org/busca?search_terms=skol`
> - `https://br.openfoodfacts.org/busca?search_terms=guarana+antarctica`
> - `https://br.openfoodfacts.org/busca?search_terms=leite+integral+italac`
>
> Depois abra
> `https://world.openfoodfacts.org/api/v2/product/7894900011517.json`
> e me diga se voltou um produto com tabela nutricional ou um erro de
> "produto não encontrado".
>
> **NO FINAL, escreva um resumo em texto que eu possa copiar**, contendo:
> - se o arquivo da TACO está ou não no GitHub, e de onde você baixou
> - quantas linhas e quais colunas o CSV tem
> - os números que você viu no Open Food Facts
> - se a base tem produto brasileiro com número de rótulo, ou está vazia

---

## Se o upload no GitHub falhar de novo

Não insista. É mais rápido você mesmo anexar o `taco-oficial.csv` direto aqui
nesta conversa comigo — eu leio o arquivo, gero a migração SQL e você cola no
Supabase, como nas outras vezes.
