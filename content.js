/* ==========================================================================
   GXVideos — content.js
   Fontes de conteúdo exibidas na plataforma:
     1) Catálogo padrão de demonstração (para a Home nunca ficar vazia)
     2) Repositórios custom do GitHub cadastrados em Configurações — a
        plataforma lista imagens/banners do repositório como "leitor"
     3) Sites custom cadastrados em Configurações — idem, mostra banner/
        capa via leitura best-effort (og:image/og:title, quando o CORS do
        site permite) ou os dados manuais informados ao cadastrar.
   Em TODOS os casos de fonte custom, clicar no card sempre abre a fonte
   original em uma nova aba — a plataforma nunca tenta burlar login/auth,
   ela só exibe uma vitrine.
   ========================================================================== */

GX.content = (function(){

  const MEDIA_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;

  const DEFAULT_CHANNELS = [
    { title:'Fortnite', viewers:'186K', tags:['Shooter'], live:true, kind:'default' },
    { title:'Grand Theft Auto V', viewers:'144K', tags:['Action','Driving/Racing Game','Open World'], live:true, kind:'default' },
    { title:'Just Chatting', viewers:'139K', tags:['IRL'], live:true, kind:'default' },
    { title:'League of Legends', viewers:'137K', tags:['MOBA'], live:true, kind:'default' },
    { title:'Talk Shows & Podcasts', viewers:'52K', tags:['IRL'], live:true, kind:'default' },
    { title:'Counter-Strike: Global', viewers:'55.8K', tags:['FPS','Shooter'], live:true, kind:'default' },
    { title:'PLAYERUNKNOWN\'S...', viewers:'54.4K', tags:['Shooter','FPS'], live:true, kind:'default' },
    { title:'Dota 2', viewers:'59.6K', tags:['MOBA'], live:true, kind:'default' },
    { title:'Magic: The Gathering', viewers:'40.7K', tags:['Card & Board Game'], live:true, kind:'default' },
    { title:'Mordhau', viewers:'32.4K', tags:['Fighting','Indie Game'], live:true, kind:'default' },
    { title:'Hearthstone', viewers:'32.1K', tags:['Card & Board Game'], live:true, kind:'default' },
    { title:'Minecraft', viewers:'29.1K', tags:['Action','Open World'], live:true, kind:'default' },
    { title:'Apex Legends', viewers:'27.2K', tags:['FPS','Shooter'], live:true, kind:'default' },
    { title:'World of Warcraft', viewers:'27.1K', tags:['MMORPG'], live:true, kind:'default' },
    { title:'Days Gone', viewers:'23.7K', tags:['Action','Open World'], live:false, kind:'default' },
    { title:'Auto Chess', viewers:'22.4K', tags:['Strategy'], live:true, kind:'default' },
    { title:'FIFA 19', viewers:'21.5K', tags:['Sports Game'], live:true, kind:'default' },
    { title:'Overwatch', viewers:'20K', tags:['FPS','Shooter'], live:true, kind:'default' }
  ].map((c,i) => ({
    id: `demo_${i}`,
    ...c,
    thumb: `${GX.CONFIG.IMAGE_API_BASE}/seed/${encodeURIComponent(c.title)}/400/300`
  }));

  const DEFAULT_FOLLOWED = [
    { name:'Bethesda', sub:'Rage 2', live:true },
    { name:'Xbox', sub:'Sea of Thieves', live:true },
    { name:'DATAFGC', sub:'29 novos vídeos', live:false },
    { name:'escapingworkforce', sub:'9 novos vídeos', live:false },
    { name:'EsportsArena', sub:'6 novos vídeos', live:false }
  ].map(f => ({ ...f, avatar:`${GX.CONFIG.IMAGE_API_BASE}/seed/${encodeURIComponent(f.name)}/64/64` }));

  function getDefaultCatalog(){ return DEFAULT_CHANNELS; }
  function getDefaultFollowed(){ return DEFAULT_FOLLOWED; }

  /* -------- repositórios custom do GitHub (vitrine de imagens) -------- */
  async function fetchRepoSourceItems(source){
    const files = await GX.github.listDir(source.owner, source.repo, source.path || '');
    const branch = await GX.github.getDefaultBranch(source.owner, source.repo);
    return files
      .filter(f => f.type === 'file' && MEDIA_EXT.test(f.name))
      .map(f => ({
        id: `repo_${source.owner}_${source.repo}_${f.name}`,
        title: f.name.replace(MEDIA_EXT,''),
        thumb: GX.github.rawUrl(source.owner, source.repo, branch, f.path),
        tags: ['Repositório custom'],
        sourceLabel: `${source.owner}/${source.repo}`,
        externalUrl: `https://github.com/${source.owner}/${source.repo}/blob/${branch}/${f.path}`,
        kind: 'repo'
      }));
  }

  /* -------- sites custom (vitrine best-effort + fallback manual) -------- */
  async function tryReadSiteMeta(url){
    try{
      const res = await fetch(url, { mode:'cors' });
      if (!res.ok) return null;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const og = (p) => doc.querySelector(`meta[property="${p}"]`)?.getAttribute('content')
                      || doc.querySelector(`meta[name="${p}"]`)?.getAttribute('content');
      return {
        title: og('og:title') || doc.querySelector('title')?.textContent || url,
        image: og('og:image') || '',
        description: og('og:description') || ''
      };
    }catch(e){
      return null; // provavelmente bloqueado por CORS — usaremos os dados manuais cadastrados
    }
  }

  async function fetchSiteSourceItem(source){
    let meta = null;
    if (source.autoRead) meta = await tryReadSiteMeta(source.url);
    return {
      id: `site_${btoa(unescape(encodeURIComponent(source.url))).slice(0,16)}`,
      title: source.title || meta?.title || source.url,
      thumb: source.image || meta?.image || `${GX.CONFIG.IMAGE_API_BASE}/seed/${encodeURIComponent(source.url)}/400/300`,
      tags: ['Site custom'],
      sourceLabel: (new URL(source.url)).hostname,
      externalUrl: source.url,
      requiresAuth: !!source.requiresAuth,
      kind: 'site'
    };
  }

  async function buildCustomSections(){
    const settings = GX.storage.getSettings();
    const sections = [];
    for (const source of (settings.customRepos||[])){
      try{
        const items = await fetchRepoSourceItems(source);
        if (items.length) sections.push({ title: `📦 ${source.label || source.repo}`, items, custom:true });
      }catch(e){ GX.log('Erro lendo repositório custom', source, e); }
    }
    if ((settings.customSites||[]).length){
      const items = [];
      for (const source of settings.customSites){
        try{ items.push(await fetchSiteSourceItem(source)); }
        catch(e){ GX.log('Erro lendo site custom', source, e); }
      }
      if (items.length) sections.push({ title:'🌐 Sites custom', items, custom:true });
    }
    return sections;
  }

  return { getDefaultCatalog, getDefaultFollowed, buildCustomSections, fetchRepoSourceItems, fetchSiteSourceItem };
})();
