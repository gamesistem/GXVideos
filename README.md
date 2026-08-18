# GXVideos — Plataforma de Streaming

Plataforma de streaming (HTML5 + CSS + JS puro, sem build) com contas
multi-perfil estilo Netflix, perfis customizáveis, armazenamento local no
dispositivo, sincronização online via API do GitHub, fontes de conteúdo
custom (repositórios e sites) e bloqueio parental.

## Como usar

1. Abra `index.html` no navegador (funciona direto em `file://`, mas para
   usar o **File System Access API** — escolher pasta do PC para salvar
   arquivos — é recomendado rodar via um servidor local, ex:
   `python3 -m http.server` na pasta do projeto, e acessar
   `http://localhost:8000`).
2. Crie uma conta (fica salva no navegador deste dispositivo).
3. Crie/edite perfis: nome, bio, status, cor, moldura, avatar, avatar GIF
   e banner.
4. Em **Configurações**, cadastre:
   - **Fontes de conteúdo**: repositórios do GitHub ou sites custom que
     aparecem como vitrine (banners/imagens). Ao clicar num item dessas
     fontes, o usuário é sempre enviado à fonte original — a plataforma
     nunca tenta logar por você.
   - **Sincronização online**: dono/repositório do GitHub + um
     [Personal Access Token](https://github.com/settings/tokens) com
     escopo `repo`, para salvar os perfis desta conta on-line e poder
     acessá-los de outro dispositivo/navegador (mesmo e-mail de conta).
   - **APIs de mídia**: chave da Unsplash (opcional) e/ou da
     [Giphy](https://developers.giphy.com/) (opcional) para sugestões de
     banners/avatares/GIFs animados. Sem chave, as sugestões de imagem
     usam a Picsum Photos (não exige conta).
   - **Bloqueio parental**: PIN de 4 dígitos + categorias bloqueadas.

## Armazenamento

- **Local (sempre disponível, sem configuração)**
  - `localStorage`: sessão atual, contas, perfis, configurações, PIN
    parental, token do GitHub.
  - `IndexedDB` (`GXVideosDB`): cache de conteúdo e histórico de
    visualização.
  - **File System Access API**: em Downloads locais, é possível escolher
    uma pasta real do dispositivo para onde backups/exportações são
    gravados. Em navegadores sem suporte, cai automaticamente para o
    download tradicional do navegador.

- **Online (opcional, via API do GitHub)**
  - A logo oficial é lida diretamente de
    `https://github.com/gamesistem/GXVideos/blob/main/GXVideos.png`.
  - Perfis de uma conta podem ser publicados em
    `SEU_REPO/gxdata/accounts/<hash-do-email>.json` usando a Contents API
    do GitHub, permitindo puxá-los de volta em outro dispositivo/navegador.

## Estrutura

Todos os arquivos ficam na raiz do projeto (estrutura plana — importante para
o GitHub Pages/upload manual, onde subpastas costumam se perder):

```
index.html
style.css       → design system (tema, componentes)
config.js       → constantes globais (repositório oficial, chaves de storage)
storage.js      → localStorage + IndexedDB + salvar em pasta do dispositivo
github.js       → wrapper da API REST do GitHub (leitura/gravação)
media.js        → sugestões de imagens (Picsum/Unsplash) e GIFs (Giphy)
auth.js         → contas, perfis, sessão, sync online, bloqueio parental
content.js      → catálogo padrão + agregação de fontes custom
ui.js           → toda a renderização de telas/modais
main.js         → boot da aplicação
```

**Importante ao subir para o GitHub:** envie todos os arquivos direto na
raiz do repositório (não dentro de pastas `css/` ou `js/`) — o `index.html`
referencia `style.css`, `config.js` etc. sem prefixo de pasta.

## Limitações honestas

- A "leitura" de sites custom tenta pegar `og:title`/`og:image` via
  `fetch`, mas isso só funciona se o site alvo permitir CORS. Quando
  falha (a maioria dos sites bloqueia), a plataforma usa o título/imagem
  informados manualmente ao cadastrar o site.
- O login de conta é 100% local (senha com hash SHA-256 salva no próprio
  navegador) — serve para separar perfis no dispositivo, não é um sistema
  de autenticação seguro para dados sensíveis.
- O token do GitHub cadastrado em Sincronização online fica salvo apenas
  no `localStorage` deste navegador.
