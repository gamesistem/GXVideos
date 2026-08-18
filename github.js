/* ==========================================================================
   GXVideos — github.js
   Tudo que fala com a API REST do GitHub (api.github.com).
   - Leitura pública (logo oficial, listagem de repositórios custom) não
     precisa de token.
   - Gravação (salvar configs/perfis online para acessar de outro aparelho)
     exige um Personal Access Token (classic, escopo "repo") cadastrado
     pelo usuário em Configurações > Sincronização online. O token só fica
     salvo no localStorage deste navegador — nunca é enviado a nada além
     da própria api.github.com.
   ========================================================================== */

GX.github = (function(){
  const API = 'https://api.github.com';

  function headers(withAuth){
    const h = { 'Accept': 'application/vnd.github+json' };
    const token = GX.storage.getToken();
    if (withAuth && token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  function b64EncodeUnicode(str){
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64DecodeUnicode(str){
    try{ return decodeURIComponent(escape(atob(str))); }
    catch(e){ return atob(str); }
  }

  async function getDefaultBranch(owner, repo){
    const cacheKey = `gh_branch_${owner}_${repo}`;
    const cached = await GX.storage.cacheGet(cacheKey);
    if (cached) return cached;
    try{
      const res = await fetch(`${API}/repos/${owner}/${repo}`, { headers: headers(false) });
      if (!res.ok) throw new Error('repo not found');
      const json = await res.json();
      const branch = json.default_branch || 'main';
      await GX.storage.cachePut(cacheKey, branch);
      return branch;
    }catch(e){ return 'main'; }
  }

  function rawUrl(owner, repo, branch, path){
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  }

  /** Lê um arquivo (texto) do repositório. Retorna { content, sha } ou null se não existir. */
  async function getFile(owner, repo, path, withAuth = false){
    try{
      const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${encodeURI(path)}`, { headers: headers(withAuth) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`GitHub ${res.status}`);
      const json = await res.json();
      if (Array.isArray(json)) return { list: json }; // era um diretório
      const content = json.encoding === 'base64' ? b64DecodeUnicode(json.content.replace(/\n/g,'')) : json.content;
      return { content, sha: json.sha, raw: json };
    }catch(e){
      GX.log('getFile falhou', owner, repo, path, e);
      return null;
    }
  }

  /** Lista o conteúdo de uma pasta do repositório (para repositórios custom de mídia). */
  async function listDir(owner, repo, path = ''){
    try{
      const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${encodeURI(path)}`, { headers: headers(false) });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    }catch(e){ return []; }
  }

  /** Cria ou atualiza um arquivo JSON no repositório (precisa de token). */
  async function putJSON(owner, repo, path, obj, message){
    const token = GX.storage.getToken();
    if (!token) return { ok:false, error:'Nenhum token do GitHub configurado. Vá em Configurações > Sincronização online.' };
    try{
      const existing = await getFile(owner, repo, path, true);
      const body = {
        message: message || `GXVideos: atualiza ${path}`,
        content: b64EncodeUnicode(JSON.stringify(obj, null, 2)),
      };
      if (existing && existing.sha) body.sha = existing.sha;
      const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${encodeURI(path)}`, {
        method: 'PUT', headers: { ...headers(true), 'Content-Type':'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok){
        const err = await res.json().catch(()=>({}));
        return { ok:false, error: err.message || `GitHub respondeu ${res.status}` };
      }
      return { ok:true };
    }catch(e){
      return { ok:false, error: e.message || 'Falha de rede ao gravar no GitHub' };
    }
  }

  async function getJSON(owner, repo, path, withAuth = false){
    const file = await getFile(owner, repo, path, withAuth);
    if (!file || !file.content) return null;
    try{ return JSON.parse(file.content); }catch(e){ return null; }
  }

  /** Testa se um token consegue escrever no repositório informado. */
  async function testToken(owner, repo){
    const token = GX.storage.getToken();
    if (!token) return { ok:false, error:'Sem token.' };
    try{
      const res = await fetch(`${API}/repos/${owner}/${repo}`, { headers: headers(true) });
      if (!res.ok) return { ok:false, error:`Repositório inacessível (${res.status})` };
      const json = await res.json();
      return { ok:true, canPush: !!(json.permissions && json.permissions.push) };
    }catch(e){ return { ok:false, error:'Falha de rede' }; }
  }

  /** Logo oficial do GXVideos, lido diretamente do repositório oficial. */
  async function getOfficialLogoUrl(){
    const { OFFICIAL_OWNER, OFFICIAL_REPO, OFFICIAL_LOGO_PATH } = GX.CONFIG;
    const cacheKey = 'gx_official_logo_url';
    const cached = await GX.storage.cacheGet(cacheKey);
    if (cached) return cached;
    const branch = await getDefaultBranch(OFFICIAL_OWNER, OFFICIAL_REPO);
    const url = rawUrl(OFFICIAL_OWNER, OFFICIAL_REPO, branch, OFFICIAL_LOGO_PATH);
    await GX.storage.cachePut(cacheKey, url);
    return url;
  }

  return { getFile, listDir, putJSON, getJSON, getDefaultBranch, rawUrl, testToken, getOfficialLogoUrl };
})();
