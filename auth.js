/* ==========================================================================
   GXVideos — auth.js
   Contas estilo Netflix (várias contas no mesmo dispositivo) + perfis
   custom com moldura/banner/fundo/cor/bio/status. Sincroniza opcionalmente
   com o repositório do GitHub configurado em Configurações, para que os
   perfis apareçam em outro dispositivo.
   Aviso: isto é autenticação 100% client-side (sem servidor próprio) —
   serve para separar contas/perfis no navegador, não é um sistema de
   login seguro para dados sensíveis.
   ========================================================================== */

GX.auth = (function(){
  const S = GX.storage;

  function uid(prefix){ return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }

  async function sha256(text){
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  function blankProfile(accountId, name){
    return {
      id: uid('prof'),
      accountId,
      name: name || 'Novo perfil',
      avatar: `${GX.CONFIG.IMAGE_API_BASE}/seed/${encodeURIComponent(uid('av'))}/200/200`,
      gifAvatar: '',
      frame: 'signal',
      banner: `${GX.CONFIG.IMAGE_API_BASE}/seed/${encodeURIComponent(uid('bn'))}/640/220`,
      background: '',
      color: GX.CONFIG.DEFAULT_COLORS[0],
      bio: '',
      status: 'Disponível',
      isKid: false,
      pin: '',
      createdAt: Date.now()
    };
  }

  /* ---------------------- Contas locais (device) ---------------------- */
  function listAccounts(){ return S.getAccounts(); }

  async function createAccount({ name, email, password }){
    const accounts = S.getAccounts();
    if (accounts.some(a => a.email === email)) return { ok:false, error:'Já existe uma conta com esse e-mail neste dispositivo.' };
    const account = {
      id: uid('acc'), name, email,
      passHash: password ? await sha256(password) : '',
      avatar: `${GX.CONFIG.IMAGE_API_BASE}/seed/${encodeURIComponent(email||name)}/100/100`,
      createdAt: Date.now(),
      profiles: [ blankProfile(null, name?.split(' ')[0] || 'Principal') ]
    };
    account.profiles[0].accountId = account.id;
    accounts.push(account);
    S.setAccounts(accounts);
    return { ok:true, account };
  }

  async function verifyPassword(accountId, password){
    const acc = S.getAccounts().find(a => a.id === accountId);
    if (!acc) return false;
    if (!acc.passHash) return true;
    return (await sha256(password)) === acc.passHash;
  }

  function removeAccount(accountId){
    S.setAccounts(S.getAccounts().filter(a => a.id !== accountId));
  }

  function getAccount(accountId){ return S.getAccounts().find(a => a.id === accountId) || null; }

  function saveAccount(account){
    const accounts = S.getAccounts();
    const idx = accounts.findIndex(a => a.id === account.id);
    if (idx >= 0) accounts[idx] = account; else accounts.push(account);
    S.setAccounts(accounts);
  }

  /* ---------------------- Sessão ---------------------- */
  function getSession(){ return S.getSession(); }
  function setSession(accountId, profileId){ S.setSession({ accountId, profileId, ts: Date.now() }); }
  function logout(){ S.clearSession(); }

  function currentAccount(){
    const s = S.getSession();
    return s ? getAccount(s.accountId) : null;
  }
  function currentProfile(){
    const s = S.getSession();
    const acc = currentAccount();
    if (!s || !acc) return null;
    return (acc.profiles||[]).find(p => p.id === s.profileId) || null;
  }

  /* ---------------------- Perfis ---------------------- */
  function listProfiles(accountId){
    const acc = getAccount(accountId);
    return acc ? (acc.profiles||[]) : [];
  }

  function addProfile(accountId, data){
    const acc = getAccount(accountId);
    if (!acc) return null;
    const profile = { ...blankProfile(accountId), ...data, accountId };
    acc.profiles = acc.profiles || [];
    acc.profiles.push(profile);
    saveAccount(acc);
    return profile;
  }

  function updateProfile(profileId, patch){
    const accounts = S.getAccounts();
    for (const acc of accounts){
      const p = (acc.profiles||[]).find(x => x.id === profileId);
      if (p){ Object.assign(p, patch); S.setAccounts(accounts); return p; }
    }
    return null;
  }

  function deleteProfile(profileId){
    const accounts = S.getAccounts();
    for (const acc of accounts){
      const before = (acc.profiles||[]).length;
      acc.profiles = (acc.profiles||[]).filter(p => p.id !== profileId);
      if (acc.profiles.length !== before){ S.setAccounts(accounts); return true; }
    }
    return false;
  }

  /* ---------------------- Sincronização online (GitHub) ----------------------
     Salva/lê o "pacote" da conta (perfis + personalizações) em:
       {owner}/{repo}/gxdata/accounts/{email-hash}.json
     Assim, em outro dispositivo, bastando configurar o mesmo repositório +
     token e entrar com o mesmo e-mail, os perfis aparecem sincronizados. */
  async function remoteKeyFor(email){ return `${GX.CONFIG.DATA_DIR}/accounts/${await sha256(email)}.json`; }

  async function pushAccountOnline(accountId){
    const settings = S.getSettings();
    if (!settings.syncEnabled || !settings.githubOwner || !settings.githubRepo){
      return { ok:false, error:'Sincronização online não configurada.' };
    }
    const acc = getAccount(accountId);
    if (!acc) return { ok:false, error:'Conta não encontrada.' };
    const path = await remoteKeyFor(acc.email);
    const payload = { name: acc.name, email: acc.email, profiles: acc.profiles, updatedAt: Date.now() };
    return GX.github.putJSON(settings.githubOwner, settings.githubRepo, path, payload, `GXVideos: sync conta ${acc.name}`);
  }

  async function pullAccountOnline(email){
    const settings = S.getSettings();
    if (!settings.syncEnabled || !settings.githubOwner || !settings.githubRepo){
      return { ok:false, error:'Sincronização online não configurada.' };
    }
    const path = await remoteKeyFor(email);
    const remote = await GX.github.getJSON(settings.githubOwner, settings.githubRepo, path, true);
    if (!remote) return { ok:false, error:'Nenhum dado online encontrado para este e-mail.' };
    return { ok:true, data: remote };
  }

  /* ---------------------- Bloqueio parental ---------------------- */
  function parentalIsEnabled(){ return S.getParental().enabled; }
  function parentalCheckPin(pin){ return S.getParental().pin === pin; }
  function parentalSet(patch){ S.setParental({ ...S.getParental(), ...patch }); }
  function contentIsBlocked(tags = []){
    const p = S.getParental();
    if (!p.enabled || !tags.length) return false;
    return tags.some(t => (p.blockedTags||[]).includes(t));
  }

  return {
    listAccounts, createAccount, verifyPassword, removeAccount, getAccount, saveAccount,
    getSession, setSession, logout, currentAccount, currentProfile,
    listProfiles, addProfile, updateProfile, deleteProfile, blankProfile,
    pushAccountOnline, pullAccountOnline,
    parentalIsEnabled, parentalCheckPin, parentalSet, contentIsBlocked
  };
})();
