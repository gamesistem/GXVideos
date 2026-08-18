/* ==========================================================================
   GXVideos — main.js
   Ponto de entrada: decide qual tela mostrar (login de conta, escolha de
   perfil, ou app) com base na sessão salva localmente.
   ========================================================================== */

(async function boot(){
  GX.ui.setBootStatus('carregando logo oficial do repositório…');
  try{ await GX.ui.paintLogos(); }catch(e){ GX.log('logo falhou', e); }

  GX.ui.setBootStatus('preparando armazenamento local (IndexedDB)…');
  await GX.storage.idbAll('cache'); // força abertura do banco

  GX.ui.setBootStatus('pronto.');
  await new Promise(r => setTimeout(r, 260));
  GX.ui.hideBoot();

  const session = GX.auth.getSession();
  const acc = session ? GX.auth.getAccount(session.accountId) : null;

  if (!acc){
    GX.ui.renderGate(GX.auth.listAccounts().length ? 'list' : 'first');
    return;
  }
  const profile = (acc.profiles||[]).find(p => p.id === session.profileId);
  if (!profile){
    GX.ui.renderProfiles();
    return;
  }
  GX.ui.renderAppShell();
})();

window.addEventListener('error', (e) => GX.log('Erro não tratado:', e.message));
