/* ==========================================================================
   GXVideos — storage.js
   Camada de armazenamento LOCAL (no dispositivo/cache do navegador):
     - localStorage  -> sessão, config rápida, cache pequeno
     - IndexedDB     -> cache de conteúdo, histórico, downloads/"favoritos offline"
     - File System Access API -> salvar arquivos numa pasta real do PC
   Isso é independente da sincronização online (github.js cuida disso).
   ========================================================================== */

GX.storage = (function(){
  const { LS_SESSION, LS_ACCOUNTS, LS_SETTINGS, LS_GH_TOKEN, LS_PARENTAL, IDB_NAME, IDB_VERSION } = GX.CONFIG;

  let dbPromise = null;
  function openDB(){
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { resolve(null); return; }
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath:'key' });
        if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath:'id', autoIncrement:true });
        if (!db.objectStoreNames.contains('downloads')) db.createObjectStore('downloads', { keyPath:'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    return dbPromise;
  }

  async function idbSet(store, value){
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }
  async function idbGet(store, key){
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }
  async function idbAll(store){
    const db = await openDB();
    if (!db) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }
  async function idbDelete(store, key){
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  // ---------- localStorage helpers (com fallback silencioso) ----------
  function lsGet(key, fallback = null){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){ return fallback; }
  }
  function lsSet(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch(e){ GX.log('Falha ao salvar localStorage', e); return false; }
  }
  function lsRemove(key){ try{ localStorage.removeItem(key); }catch(e){} }

  // ---------- API pública de alto nível ----------
  return {
    idbSet, idbGet, idbAll, idbDelete,
    lsGet, lsSet, lsRemove,

    getSession(){ return lsGet(LS_SESSION, null); },
    setSession(s){ return lsSet(LS_SESSION, s); },
    clearSession(){ lsRemove(LS_SESSION); },

    getAccounts(){ return lsGet(LS_ACCOUNTS, []); },
    setAccounts(list){ return lsSet(LS_ACCOUNTS, list); },

    getSettings(){
      return lsGet(LS_SETTINGS, {
        customRepos: [],
        customSites: [],
        imageApiKey: '',      // Unsplash Access Key (opcional)
        gifApiKey: '',        // Giphy/Tenor API key (opcional)
        githubOwner: '',      // dono do repositório pessoal para sync online
        githubRepo: '',       // nome do repositório pessoal para sync online
        syncEnabled: false
      });
    },
    setSettings(s){ return lsSet(LS_SETTINGS, s); },

    getToken(){ try{ return localStorage.getItem(LS_GH_TOKEN) || ''; }catch(e){ return ''; } },
    setToken(t){ try{ localStorage.setItem(LS_GH_TOKEN, t || ''); }catch(e){} },

    getParental(){
      return lsGet(LS_PARENTAL, { enabled:false, pin:'', blockedTags:['18+','NSFW','Gambling'] });
    },
    setParental(p){ return lsSet(LS_PARENTAL, p); },

    async addHistory(entry){
      entry.ts = Date.now();
      return idbSet('history', entry);
    },
    async getHistory(){ return (await idbAll('history')).sort((a,b)=>b.ts-a.ts); },

    async cachePut(key, value){ return idbSet('cache', { key, value, ts: Date.now() }); },
    async cacheGet(key){ const r = await idbGet('cache', key); return r ? r.value : null; },

    /* ---------------- Salvar em pasta real do dispositivo ---------------- */
    // Usa File System Access API quando disponível (Chrome/Edge). Faz fallback
    // para download tradicional via <a download> em outros navegadores.
    _dirHandle: null,
    async pickDeviceFolder(){
      if (!window.showDirectoryPicker){
        GX.ui?.toast('Este navegador não suporta escolher pasta — os arquivos usarão a pasta padrão de Downloads.', true);
        return false;
      }
      try{
        this._dirHandle = await window.showDirectoryPicker();
        return true;
      }catch(e){ return false; }
    },
    async saveFileToDevice(filename, blobOrText, mime){
      const blob = (blobOrText instanceof Blob) ? blobOrText : new Blob([blobOrText], { type: mime || 'application/octet-stream' });
      if (this._dirHandle){
        try{
          const fileHandle = await this._dirHandle.getFileHandle(filename, { create:true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          return true;
        }catch(e){ GX.log('Falha ao gravar na pasta escolhida, usando fallback', e); }
      }
      // fallback universal: download do navegador
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      return true;
    },

    async saveJSONToDevice(filename, obj){
      return this.saveFileToDevice(filename, JSON.stringify(obj, null, 2), 'application/json');
    }
  };
})();
