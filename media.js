/* ==========================================================================
   GXVideos — media.js
   Fontes de imagens/gifs para dar ideias de banners, fundos, avatares e
   figurinhas de perfil.
     - Imagens: Picsum Photos (não exige chave) + Unsplash (opcional, se o
       usuário cadastrar uma Access Key em Configurações > APIs de mídia).
     - GIFs: Giphy (exige API key própria do usuário — grátis em
       developers.giphy.com). Sem chave cadastrada, mostramos instruções
       em vez de resultado quebrado.
   ========================================================================== */

GX.media = (function(){

  function imageSuggestions(seedText, count = 8, size = '480/270'){
    // Picsum permite "seed" para resultados estáveis e sem necessidade de chave.
    const [w,h] = size.split('/');
    const list = [];
    for (let i=0;i<count;i++){
      const seed = encodeURIComponent(`${seedText||'gxvideos'}-${i}`);
      list.push(`${GX.CONFIG.IMAGE_API_BASE}/seed/${seed}/${w}/${h}`);
    }
    return list;
  }

  async function unsplashSearch(query, count = 8){
    const settings = GX.storage.getSettings();
    if (!settings.imageApiKey) return null; // sem chave: quem chamou deve cair no fallback do Picsum
    try{
      const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}`, {
        headers: { Authorization: `Client-ID ${settings.imageApiKey}` }
      });
      if (!res.ok) return null;
      const json = await res.json();
      return (json.results||[]).map(r => r.urls.regular);
    }catch(e){ return null; }
  }

  async function bannerIdeas(seedText, query){
    const settings = GX.storage.getSettings();
    if (settings.imageApiKey){
      const unsplash = await unsplashSearch(query || seedText || 'streaming neon', 8);
      if (unsplash && unsplash.length) return { source:'unsplash', images: unsplash };
    }
    return { source:'picsum', images: imageSuggestions(seedText, 8, '640/220') };
  }

  async function avatarIdeas(seedText){
    // avatares quadrados, mesma fonte
    return imageSuggestions(seedText, 10, '200/200');
  }

  async function gifSearch(query, count = 12){
    const settings = GX.storage.getSettings();
    if (!settings.gifApiKey){
      return { ok:false, reason:'no-key' };
    }
    try{
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(settings.gifApiKey)}&q=${encodeURIComponent(query)}&limit=${count}&rating=pg-13`);
      if (!res.ok) return { ok:false, reason:'http-error' };
      const json = await res.json();
      return { ok:true, gifs: (json.data||[]).map(g => ({
        preview: g.images.fixed_width_small.url,
        full: g.images.original.url
      })) };
    }catch(e){ return { ok:false, reason:'network' }; }
  }

  async function gifTrending(count = 12){
    const settings = GX.storage.getSettings();
    if (!settings.gifApiKey) return { ok:false, reason:'no-key' };
    try{
      const res = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(settings.gifApiKey)}&limit=${count}&rating=pg-13`);
      if (!res.ok) return { ok:false, reason:'http-error' };
      const json = await res.json();
      return { ok:true, gifs: (json.data||[]).map(g => ({
        preview: g.images.fixed_width_small.url,
        full: g.images.original.url
      })) };
    }catch(e){ return { ok:false, reason:'network' }; }
  }

  return { imageSuggestions, unsplashSearch, bannerIdeas, avatarIdeas, gifSearch, gifTrending };
})();
