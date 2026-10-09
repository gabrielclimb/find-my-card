# Find My Card

PWA para consultar uma lista de cartas de Magic enquanto você procura no bulk de uma loja. Foi pensado para celular Android.

## Funções

- **Importação** de uma carta por linha, colando o texto ou abrindo um arquivo `.txt`:

  ```
  2 Lightning Bolt
  1 Counterspell (MH2) 267
  Delver of Secrets
  ```

  A quantidade é opcional (também aceita `2x`), e `(SET) número` fixa a impressão. O texto exportado do Moxfield (Export → Copy for Moxfield) funciona como está. Linhas vazias e cabeçalhos como `SIDEBOARD:` são ignorados, e as linhas em outro formato aparecem como não reconhecidas.
- **Visualização** por imagens, com grade de 2 a 6 colunas, ou por nomes.
- **Organização** por cor e nome (grupos de cor, em ordem alfabética dentro de cada um) ou só por nome. A cor é a da carta, lida na face frontal. Os grupos seguem esta ordem: Branco, Azul, Preto, Vermelho, Verde, Multicolor, Incolor, Terrenos e Não encontradas.
- **Toque** amplia a carta e o botão voltar fecha a ampliação, mantendo a posição da lista. Com a carta ampliada, **deslizar para os lados** passa para a anterior ou a próxima. **Segurar** a carta a marca como encontrada.
- **Busca** por parte do nome, sem diferenciar maiúsculas nem acentos.
- **Cartas de duas faces:** botão para virar. **Outras artes:** escolher outra impressão da mesma carta.
- **Tela acesa** durante a consulta, pela Wake Lock API, com um ícone de sol na barra que indica quando está ativa.
- **Modo offline opcional, por lista:** baixa as imagens para o aparelho. O app em si sempre funciona offline.
- **Múltiplas listas,** e as preferências de visualização ficam salvas. Os dados ficam só no aparelho, no navegador usado para abrir o app.

Os dados das cartas e as imagens vêm do [Scryfall](https://scryfall.com/). O parser e o cliente do Scryfall foram adaptados de [mtg-deck-visualizer](https://github.com/gabrielclimb/mtg-deck-visualizer).

## Desenvolvimento

```bash
npm install
npm run dev      # servidor de desenvolvimento (sem service worker)
npm test         # testes do parser e do agrupamento
npm run build    # checagem de tipos + build de produção em dist/
npm run preview  # serve o build, com service worker, em http://localhost:4173
```

Para testar no celular sem fazer deploy, rode `npx vite preview --host`. Recursos como o service worker e a tela acesa exigem HTTPS fora do `localhost`, então o caminho mais simples é o GitHub Pages.

## Deploy

O workflow `.github/workflows/deploy.yml` publica no GitHub Pages a cada push na `main`. Antes, ative Pages com a origem "GitHub Actions" nas configurações do repositório. No Chrome Android, abra a URL e use **Instalar app**.
