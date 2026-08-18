/* ==========================================================================
   GXVideos — config.js
   Constantes globais e ponto único de configuração do repositório oficial.
   Tudo pendurado no namespace global `GX` para evitar módulos ES (funciona
   mesmo abrindo o index.html direto via file://, sem servidor).
   ========================================================================== */

window.GX = window.GX || {};

GX.CONFIG = {
  // Repositório oficial do GXVideos (armazenamento online / sync / logo)
  OFFICIAL_OWNER: 'gamesistem',
  OFFICIAL_REPO: 'GXVideos',
  OFFICIAL_LOGO_PATH: 'GXVideos.png',

  // Pasta dentro do repositório onde os dados de conta/perfil ficam salvos
  DATA_DIR: 'gxdata',

  // Chaves usadas no localStorage / IndexedDB
  LS_SESSION: 'gx_session_v1',
  LS_ACCOUNTS: 'gx_accounts_v1',
  LS_SETTINGS: 'gx_settings_v1',
  LS_GH_TOKEN: 'gx_gh_token_v1',
  LS_PARENTAL: 'gx_parental_v1',
  IDB_NAME: 'GXVideosDB',
  IDB_VERSION: 1,

  // APIs de imagem sem necessidade de chave (fallback padrão)
  IMAGE_API_BASE: 'https://picsum.photos',

  DEFAULT_FRAMES: [
    { id: 'none', label: 'Sem moldura' },
    { id: 'neon-magenta', label: 'Neon magenta' },
    { id: 'neon-cyan', label: 'Neon ciano' },
    { id: 'signal', label: 'Sinal (gradiente)' },
    { id: 'vhs', label: 'VHS scanline' },
    { id: 'gold', label: 'Dourado' }
  ],

  DEFAULT_COLORS: ['#ff2e78', '#29e0d1', '#b13cff', '#ffb020', '#4ade80', '#f1eef7', '#67637d'],

  CATEGORY_ICONS: {
    'FPS':'🎯','MOBA':'🧙','IRL':'🗣️','Action':'💥','Shooter':'🔫','Strategy':'♟️',
    'Sports Game':'⚽','Card & Board Game':'🃏','Fighting':'🥊','Indie Game':'🎮',
    'Adventure Game':'🧭','Open World':'🗺️','MMORPG':'🐉','Driving/Racing Game':'🏎️'
  }
};

GX.log = (...a) => console.log('%c[GXVideos]', 'color:#ff2e78;font-weight:bold', ...a);
