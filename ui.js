/* ==========================================================================
   GXVideos — ui.js
   Toda a renderização de tela. Sem framework: strings de template + DOM.
   ========================================================================== */

GX.ui = (function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const esc = (s='') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  let currentView = 'browse';
  let currentSettingsTab = 'account';

  /* ---------------------------- toast / modal ---------------------------- */
  function toast(msg, isErr=false){
    const host = $('#toast-host');
    const el = document.createElement('div');
    el.className = 'toast' + (isErr ? ' err' : '');
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function openModal(innerHtml, onMount){
    const host = $('#modal-host');
    host.innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><div class="modal">${innerHtml}</div></div>`;
    $('#modal-backdrop').addEventListener('click', (e) => { if (e.target.id === 'modal-backdrop') closeModal(); });
    if (onMount) onMount(host);
  }
  function closeModal(){ $('#modal-host').innerHTML = ''; }

  /* ---------------------------- boot screen ---------------------------- */
  async function paintLogos(){
    const url = await GX.github.getOfficialLogoUrl();
    $('#boot-logo-img').src = url;
    $('#sidebar-logo').src = url;
  }

  function setBootStatus(text){ const el = $('#boot-status'); if (el) el.textContent = text; }
  function hideBoot(){ $('#boot-screen').classList.add('hidden'); }

  /* ============================================================
     ACCOUNT GATE
     ============================================================ */
  function renderGate(mode = 'list'){
    $('#screen-gate').classList.remove('hidden');
    $('#screen-profiles').classList.add('hidden');
    $('#app-shell').classList.add('hidden');

    const accounts = GX.auth.listAccounts();
    const panel = $('#gate-panel-content');

    if (mode === 'list' && accounts.length){
      panel.innerHTML = `
        <div class="brand"><img id="gate-logo" alt=""><b>GXVideos</b></div>
        <h1>Selecione uma conta</h1>
        <p class="sub">Plataforma de streaming multi-conta — como perfis do lado numa Netflix.</p>
        <div class="account-list">
          ${accounts.map(a => `
            <button class="account-row" data-acc="${a.id}">
              <img class="avatar-sm" src="${esc(a.avatar)}" alt="">
              <div class="meta"><b>${esc(a.name)}</b><span>${esc(a.email)} · ${(a.profiles||[]).length} perfil(is)</span></div>
            </button>
          `).join('')}
        </div>
        <button class="btn btn-signal btn-block" id="btn-new-account">+ Criar nova conta</button>
      `;
      GX.github.getOfficialLogoUrl().then(u => { const l = $('#gate-logo'); if (l) l.src = u; });
      $$('.account-row', panel).forEach(row => row.addEventListener('click', () => onPickAccount(row.dataset.acc)));
      $('#btn-new-account').addEventListener('click', () => renderGate('create'));
      return;
    }

    if (mode === 'create'){
      panel.innerHTML = `
        <div class="brand"><img id="gate-logo" alt=""><b>GXVideos</b></div>
        <h1>Criar conta</h1>
        <p class="sub">Cada conta pode ter vários perfis personalizados, como no Netflix.</p>
        <div class="field"><label>Nome</label><input id="f-name" placeholder="Seu nome"></div>
        <div class="field"><label>E-mail</label><input id="f-email" type="email" placeholder="voce@exemplo.com"></div>
        <div class="field"><label>Senha (opcional, só local)</label><input id="f-pass" type="password" placeholder="••••••••"></div>
        <button class="btn btn-signal btn-block" id="btn-create-account">Criar conta</button>
        <div style="height:10px"></div>
        ${accounts.length ? `<button class="btn btn-ghost btn-block" id="btn-back-list">Voltar</button>` : ''}
      `;
      GX.github.getOfficialLogoUrl().then(u => { const l = $('#gate-logo'); if (l) l.src = u; });
      $('#btn-back-list')?.addEventListener('click', () => renderGate('list'));
      $('#btn-create-account').addEventListener('click', async () => {
        const name = $('#f-name').value.trim(), email = $('#f-email').value.trim(), pass = $('#f-pass').value;
        if (!name || !email){ toast('Preencha nome e e-mail.', true); return; }
        const res = await GX.auth.createAccount({ name, email, password: pass });
        if (!res.ok){ toast(res.error, true); return; }
        onPickAccount(res.account.id);
      });
      return;
    }

    // sem contas ainda
    panel.innerHTML = `
      <div class="brand"><img id="gate-logo" alt=""><b>GXVideos</b></div>
      <h1>Bem-vindo</h1>
      <p class="sub">Crie a primeira conta deste dispositivo para começar a assistir.</p>
      <div class="field"><label>Nome</label><input id="f-name" placeholder="Seu nome"></div>
      <div class="field"><label>E-mail</label><input id="f-email" type="email" placeholder="voce@exemplo.com"></div>
      <div class="field"><label>Senha (opcional, só local)</label><input id="f-pass" type="password" placeholder="••••••••"></div>
      <button class="btn btn-signal btn-block" id="btn-create-account">Criar conta</button>
    `;
    GX.github.getOfficialLogoUrl().then(u => { const l = $('#gate-logo'); if (l) l.src = u; });
    $('#btn-create-account').addEventListener('click', async () => {
      const name = $('#f-name').value.trim(), email = $('#f-email').value.trim(), pass = $('#f-pass').value;
      if (!name || !email){ toast('Preencha nome e e-mail.', true); return; }
      const res = await GX.auth.createAccount({ name, email, password: pass });
      if (!res.ok){ toast(res.error, true); return; }
      onPickAccount(res.account.id);
    });
  }

  function onPickAccount(accountId){
    const acc = GX.auth.getAccount(accountId);
    if (!acc) return;
    if (acc.passHash){
      openModal(`
        <h3>Entrar em ${esc(acc.name)}</h3>
        <div class="field"><label>Senha</label><input id="f-login-pass" type="password"></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="m-cancel">Cancelar</button>
          <button class="btn btn-signal" id="m-ok">Entrar</button>
        </div>
      `, () => {
        $('#m-cancel').addEventListener('click', closeModal);
        $('#m-ok').addEventListener('click', async () => {
          const ok = await GX.auth.verifyPassword(accountId, $('#f-login-pass').value);
          if (!ok){ toast('Senha incorreta.', true); return; }
          closeModal();
          GX.auth.setSession(accountId, null);
          renderProfiles();
        });
      });
      return;
    }
    GX.auth.setSession(accountId, null);
    renderProfiles();
  }

  /* ============================================================
     PROFILE PICKER (Netflix-style)
     ============================================================ */
  function frameClass(frame){ return frame && frame !== 'none' ? `frame-${frame}` : ''; }
  function frameInlineStyle(frame){
    switch(frame){
      case 'neon-magenta': return 'box-shadow:0 0 0 3px var(--magenta), 0 0 18px rgba(255,46,120,.6);';
      case 'neon-cyan': return 'box-shadow:0 0 0 3px var(--cyan), 0 0 18px rgba(41,224,209,.6);';
      case 'signal': return 'box-shadow:0 0 0 3px transparent; border-image: var(--grad-signal) 1;';
      case 'vhs': return 'box-shadow:0 0 0 3px #fff2;';
      case 'gold': return 'box-shadow:0 0 0 3px var(--amber), 0 0 16px rgba(255,176,32,.5);';
      default: return '';
    }
  }

  function renderProfiles(){
    $('#screen-gate').classList.add('hidden');
    $('#screen-profiles').classList.remove('hidden');
    $('#app-shell').classList.add('hidden');

    const session = GX.auth.getSession();
    const acc = GX.auth.currentAccount();
    if (!acc){ renderGate(); return; }
    const profiles = GX.auth.listProfiles(acc.id);
    $('#profiles-title').textContent = `Quem está assistindo, ${acc.name.split(' ')[0]}?`;

    $('#profiles-grid').innerHTML = profiles.map(p => `
      <button class="profile-tile ${p.isKid?'is-kid':''}" data-profile="${p.id}">
        <div class="profile-avatar-wrap crt" style="${frameInlineStyle(p.frame)}">
          <img src="${esc(p.gifAvatar || p.avatar)}" alt="">
          ${p.pin ? '<span class="profile-lock">🔒</span>' : ''}
        </div>
        <span class="profile-name">${esc(p.name)}</span>
      </button>
    `).join('') + `
      <button class="profile-tile add-tile" id="tile-add-profile">
        <div class="profile-avatar-wrap"><span>+</span></div>
        <span class="profile-name">Adicionar perfil</span>
      </button>
    `;

    $$('.profile-tile[data-profile]').forEach(tile => {
      tile.addEventListener('click', () => onPickProfile(tile.dataset.profile));
    });
    $('#tile-add-profile').addEventListener('click', () => openProfileEditor(null));
    $('#btn-switch-account').onclick = () => { GX.auth.logout(); renderGate(); };
    $('#btn-manage-profiles').onclick = () => openProfileManager();
  }

  function onPickProfile(profileId){
    const profiles = GX.auth.listProfiles(GX.auth.currentAccount().id);
    const p = profiles.find(x => x.id === profileId);
    if (!p) return;
    const enter = () => {
      GX.auth.setSession(GX.auth.currentAccount().id, profileId);
      renderAppShell();
    };
    if (p.pin){
      openPinPad(`Entrar em ${p.name}`, p.pin, enter);
    } else enter();
  }

  function openPinPad(title, correctPin, onSuccess){
    let entered = '';
    openModal(`
      <h3>${esc(title)}</h3>
      <div class="pin-dots" id="pin-dots">${'<i></i>'.repeat(4)}</div>
      <div class="pinpad" id="pinpad">
        ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(n => `<button data-k="${n}">${n}</button>`).join('')}
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" id="m-cancel">Cancelar</button></div>
    `, () => {
      $('#m-cancel').addEventListener('click', closeModal);
      $$('#pinpad button').forEach(btn => btn.addEventListener('click', () => {
        const k = btn.dataset.k;
        if (k === '⌫'){ entered = entered.slice(0,-1); }
        else if (k !== '' && entered.length < 4){ entered += k; }
        $$('#pin-dots i').forEach((dot,i) => dot.classList.toggle('filled', i < entered.length));
        if (entered.length === 4){
          setTimeout(() => {
            if (entered === correctPin){ closeModal(); onSuccess(); }
            else { toast('PIN incorreto.', true); entered=''; $$('#pin-dots i').forEach(d=>d.classList.remove('filled')); }
          }, 120);
        }
      }));
    });
  }

  function openProfileManager(){
    const acc = GX.auth.currentAccount();
    const profiles = GX.auth.listProfiles(acc.id);
    openModal(`
      <h3>Gerenciar perfis</h3>
      ${profiles.map(p => `
        <div class="list-item">
          <img class="avatar-sm" src="${esc(p.avatar)}" style="width:34px;height:34px;border-radius:8px;object-fit:cover">
          <div class="grow"><b>${esc(p.name)}</b><span>${p.isKid?'Infantil · ':''}${p.pin?'Protegido por PIN':'Sem PIN'}</span></div>
          <button class="btn btn-sm btn-ghost" data-edit="${p.id}">Editar</button>
          <button class="btn btn-sm btn-danger" data-del="${p.id}">Excluir</button>
        </div>
      `).join('')}
      <button class="btn btn-signal btn-block" id="m-add">+ Novo perfil</button>
      <div class="modal-actions"><button class="btn btn-ghost" id="m-close">Fechar</button></div>
    `, () => {
      $('#m-close').addEventListener('click', closeModal);
      $('#m-add').addEventListener('click', () => { closeModal(); openProfileEditor(null); });
      $$('[data-edit]').forEach(b => b.addEventListener('click', () => { closeModal(); openProfileEditor(b.dataset.edit); }));
      $$('[data-del]').forEach(b => b.addEventListener('click', () => {
        if (profiles.length <= 1){ toast('A conta precisa ter ao menos 1 perfil.', true); return; }
        GX.auth.deleteProfile(b.dataset.del);
        closeModal(); renderProfiles();
      }));
    });
  }

  async function openProfileEditor(profileId){
    const acc = GX.auth.currentAccount();
    const existing = profileId ? GX.auth.listProfiles(acc.id).find(p => p.id === profileId) : GX.auth.blankProfile(acc.id);
    openModal(`
      <h3>${profileId ? 'Editar perfil' : 'Novo perfil'}</h3>
      <div class="avatar-editor">
        <div class="avatar-preview-wrap crt" id="av-preview-wrap" style="${frameInlineStyle(existing.frame)}">
          <img class="av-img" id="av-preview" src="${esc(existing.gifAvatar||existing.avatar)}">
        </div>
        <div style="flex:1;min-width:180px">
          <div class="field"><label>Nome do perfil</label><input id="f-pname" value="${esc(existing.name)}"></div>
          <label class="toggle-row" style="border:none;padding:4px 0">
            <span class="lbl"><b>Perfil infantil</b><span>Filtra conteúdo sensível automaticamente</span></span>
            <span class="switch ${existing.isKid?'on':''}" id="sw-kid"><i></i></span>
          </label>
        </div>
      </div>

      <div class="field"><label>Status custom</label><input id="f-status" value="${esc(existing.status)}" placeholder="Ex: Assistindo League of Legends"></div>
      <div class="field"><label>Descrição / bio custom</label><textarea id="f-bio" rows="2" placeholder="Fale sobre você...">${esc(existing.bio)}</textarea></div>

      <div class="field"><label>Cor de destaque</label>
        <div class="swatch-row" id="swatch-row">
          ${GX.CONFIG.DEFAULT_COLORS.map(c => `<span class="swatch ${existing.color===c?'selected':''}" style="background:${c}" data-color="${c}"></span>`).join('')}
        </div>
      </div>

      <div class="field"><label>Moldura do avatar</label>
        <div class="frame-row" id="frame-row">
          ${GX.CONFIG.DEFAULT_FRAMES.map(f => `<div class="pick-tile ${existing.frame===f.id?'selected':''}" data-frame="${f.id}" title="${f.label}" style="display:flex;align-items:center;justify-content:center;font-size:10px;text-align:center;padding:4px">${f.label}</div>`).join('')}
        </div>
      </div>

      <div class="field"><label>Avatar — sugestões de imagem</label>
        <div class="frame-row" id="avatar-suggestions"><span class="timecode">carregando sugestões…</span></div>
        <small>Fonte: API de imagens (Picsum / Unsplash se configurado em Configurações → APIs de mídia).</small>
      </div>

      <div class="field"><label>Avatar animado (GIF)</label>
        <div class="gif-row" id="gif-suggestions"></div>
        <small id="gif-hint">Configure uma chave do Giphy em Configurações → APIs de mídia para ver sugestões de GIF.</small>
      </div>

      <div class="field"><label>Banner do perfil — sugestões</label>
        <div class="frame-row" id="banner-suggestions" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))"></div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-ghost" id="m-cancel">Cancelar</button>
        <button class="btn btn-signal" id="m-save">Salvar perfil</button>
      </div>
    `, async (host) => {
      let state = { ...existing };
      $('#m-cancel').addEventListener('click', closeModal);
      $('#sw-kid').addEventListener('click', (e) => { e.currentTarget.classList.toggle('on'); state.isKid = e.currentTarget.classList.contains('on'); });

      $$('#swatch-row .swatch').forEach(sw => sw.addEventListener('click', () => {
        $$('#swatch-row .swatch').forEach(s=>s.classList.remove('selected'));
        sw.classList.add('selected'); state.color = sw.dataset.color;
      }));
      $$('#frame-row .pick-tile').forEach(t => t.addEventListener('click', () => {
        $$('#frame-row .pick-tile').forEach(x=>x.classList.remove('selected'));
        t.classList.add('selected'); state.frame = t.dataset.frame;
        $('#av-preview-wrap').setAttribute('style', frameInlineStyle(state.frame));
      }));

      GX.media.avatarIdeas(state.name).then(list => {
        $('#avatar-suggestions').innerHTML = list.map(u => `<div class="pick-tile" data-av="${u}"><img src="${u}"></div>`).join('');
        $$('#avatar-suggestions .pick-tile').forEach(t => t.addEventListener('click', () => {
          $$('#avatar-suggestions .pick-tile').forEach(x=>x.classList.remove('selected'));
          t.classList.add('selected'); state.avatar = t.dataset.av; state.gifAvatar='';
          $('#av-preview').src = state.avatar;
        }));
      });

      GX.media.bannerIdeas(state.name).then(res => {
        $('#banner-suggestions').innerHTML = res.images.map(u => `<div class="pick-tile" data-bn="${u}" style="aspect-ratio:16/6"><img src="${u}"></div>`).join('');
        $$('#banner-suggestions .pick-tile').forEach(t => t.addEventListener('click', () => {
          $$('#banner-suggestions .pick-tile').forEach(x=>x.classList.remove('selected'));
          t.classList.add('selected'); state.banner = t.dataset.bn;
        }));
      });

      GX.media.gifTrending(12).then(res => {
        if (!res.ok){ return; }
        $('#gif-hint').classList.add('hidden');
        $('#gif-suggestions').innerHTML = res.gifs.map(g => `<div class="pick-tile" data-gif="${g.full}"><img src="${g.preview}"></div>`).join('');
        $$('#gif-suggestions .pick-tile').forEach(t => t.addEventListener('click', () => {
          $$('#gif-suggestions .pick-tile').forEach(x=>x.classList.remove('selected'));
          t.classList.add('selected'); state.gifAvatar = t.dataset.gif;
          $('#av-preview').src = state.gifAvatar;
        }));
      });

      $('#m-save').addEventListener('click', () => {
        state.name = $('#f-pname').value.trim() || 'Perfil';
        state.status = $('#f-status').value.trim();
        state.bio = $('#f-bio').value.trim();
        if (profileId) GX.auth.updateProfile(profileId, state);
        else GX.auth.addProfile(acc.id, state);
        closeModal();
        renderProfiles();
        toast('Perfil salvo.');
      });
    });
  }

  /* ============================================================
     APP SHELL
     ============================================================ */
  function renderAppShell(){
    $('#screen-gate').classList.add('hidden');
    $('#screen-profiles').classList.add('hidden');
    $('#app-shell').classList.remove('hidden');

    paintSidebarProfile();
    paintFollowedList();
    wireTopbar();
    navigate('browse');

    $$('.nav-item[data-view]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.view)));
    $('#btn-open-profiles').onclick = () => renderProfiles();
    $('#btn-parental').onclick = () => openParentalGate();
    $('#btn-sync').onclick = () => openSyncPanel();
  }

  function paintSidebarProfile(){
    const p = GX.auth.currentProfile();
    if (!p) return;
    $('#sidebar-profile-footer').innerHTML = `
      <img src="${esc(p.gifAvatar||p.avatar)}" alt="">
      <div class="who"><b style="color:${esc(p.color)}">${esc(p.name)}</b><span>${esc(p.status||'Disponível')}</span></div>
    `;
  }

  function paintFollowedList(){
    const list = GX.content.getDefaultFollowed();
    $('#followed-list').innerHTML = list.map(f => `
      <div class="followed-row">
        <img src="${esc(f.avatar)}" alt="">
        <span>${esc(f.name)}</span>
        ${f.live ? '<span class="dot"></span>' : ''}
      </div>
    `).join('');
  }

  function wireTopbar(){
    const input = $('#global-search');
    input.oninput = () => { if (currentView === 'browse') renderBrowse(input.value.trim().toLowerCase()); };
  }

  function navigate(view){
    currentView = view;
    $$('.nav-item[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    const root = $('#view-root');
    root.innerHTML = '';
    if (view === 'browse') renderBrowse();
    else if (view === 'following') renderFollowing();
    else if (view === 'library') renderLibrary();
    else if (view === 'downloads') renderDownloads();
    else if (view === 'settings') renderSettings();
  }

  function cardHtml(item){
    const tags = (item.tags||[]).slice(0,2);
    return `
      <div class="card" data-card="${esc(item.id)}">
        <div class="thumb-wrap">
          <img class="thumb" src="${esc(item.thumb)}" alt="">
          ${item.live ? '<span class="live-badge">AO VIVO</span>' : ''}
          ${item.viewers ? `<span class="viewers-badge">${esc(item.viewers)} espectadores</span>` : ''}
          ${item.sourceLabel ? `<span class="source-badge">${esc(item.sourceLabel)}</span>` : ''}
        </div>
        <div class="body">
          <div class="title">${esc(item.title)}</div>
          ${item.sub ? `<div class="sub">${esc(item.sub)}</div>` : ''}
          <div class="tags">${tags.map(t => `<span class="tag">${GX.CONFIG.CATEGORY_ICONS[t]||'🏷️'} ${esc(t)}</span>`).join('')}</div>
        </div>
      </div>`;
  }

  function attachCardHandlers(root, items){
    $$('.card[data-card]', root).forEach(card => {
      const item = items.find(i => i.id === card.dataset.card);
      card.addEventListener('click', () => openContentItem(item));
    });
  }

  function openContentItem(item){
    if (!item) return;
    if (GX.auth.contentIsBlocked(item.tags||[])){
      openModal(`<h3>🛡 Bloqueado pelo controle parental</h3><p style="color:var(--text-dim);font-size:13.5px">Este conteúdo foi restringido nas configurações de bloqueio parental do perfil atual.</p><div class="modal-actions"><button class="btn btn-signal" id="m-ok">Entendi</button></div>`,
        () => $('#m-ok').addEventListener('click', closeModal));
      return;
    }
    GX.storage.addHistory({ title:item.title, thumb:item.thumb, kind:item.kind });

    if (item.kind === 'repo' || item.kind === 'site'){
      // vitrine apenas: ao clicar, sempre manda para a fonte original
      openModal(`
        <h3>${esc(item.title)}</h3>
        <img src="${esc(item.thumb)}" style="width:100%;border-radius:10px;margin-bottom:12px;max-height:260px;object-fit:cover">
        <p style="color:var(--text-dim);font-size:13px;margin-bottom:14px">
          Conteúdo de <b>${esc(item.sourceLabel||'')}</b>. ${item.requiresAuth ? 'Este site exige autenticação — você será enviado à fonte original para continuar.' : 'Você será enviado à fonte original para ver o conteúdo completo.'}
        </p>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="m-cancel">Cancelar</button>
          <a class="btn btn-signal" id="m-open" href="${esc(item.externalUrl)}" target="_blank" rel="noopener">Abrir fonte original ↗</a>
        </div>
      `, () => $('#m-cancel').addEventListener('click', closeModal));
      return;
    }

    // item de demonstração: player local simples
    openModal(`
      <h3>${esc(item.title)}</h3>
      <div class="player-wrap"><img src="${esc(item.thumb.replace('400/300','800/450'))}"></div>
      <p style="color:var(--text-dim);font-size:13px">${item.viewers ? `${esc(item.viewers)} espectadores · ` : ''}${(item.tags||[]).join(', ')}</p>
      <div class="modal-actions"><button class="btn btn-signal" id="m-close">Fechar</button></div>
    `, () => $('#m-close').addEventListener('click', closeModal));
  }

  async function renderBrowse(filterText=''){
    const root = $('#view-root');
    const hero = GX.content.getDefaultCatalog()[0];
    root.innerHTML = `
      <div class="hero">
        <img class="hero-bg" src="${esc(hero.thumb.replace('400/300','1200/500'))}">
        <div class="hero-content">
          <div class="hero-eyebrow">EM DESTAQUE · AO VIVO AGORA</div>
          <h1>${esc(hero.title)}</h1>
          <p>${esc(hero.viewers)} espectadores assistindo agora nesta categoria.</p>
          <div class="hero-actions">
            <button class="btn btn-signal" id="hero-watch">▶ Assistir agora</button>
            <button class="btn btn-ghost" id="hero-follow">+ Seguir</button>
          </div>
        </div>
      </div>
      <div id="custom-sections"></div>
      <div class="section">
        <div class="section-title"><h3>Categorias em alta</h3><span class="timecode">${GX.content.getDefaultCatalog().length} canais</span></div>
        <div class="card-grid" id="grid-default"></div>
      </div>
    `;
    $('#hero-watch').addEventListener('click', () => openContentItem(hero));
    $('#hero-follow').addEventListener('click', () => toast(`Seguindo ${hero.title}.`));

    const all = GX.content.getDefaultCatalog();
    const filtered = filterText ? all.filter(i => i.title.toLowerCase().includes(filterText)) : all;
    const grid = $('#grid-default');
    grid.innerHTML = filtered.length ? filtered.map(cardHtml).join('') : `<div class="empty-state" style="grid-column:1/-1"><div class="big">🔍</div><h3>Nada encontrado</h3><p>Tente outro termo de busca.</p></div>`;
    attachCardHandlers(grid, filtered);

    const sections = await GX.content.buildCustomSections();
    const host = $('#custom-sections');
    if (!sections.length){
      host.innerHTML = `
        <div class="empty-state" style="margin-bottom:30px">
          <div class="big">📦</div>
          <h3>Nenhuma fonte custom cadastrada</h3>
          <p>Adicione repositórios do GitHub ou sites custom em Configurações → Fontes de conteúdo para exibi-los aqui como vitrines.</p>
          <button class="btn btn-signal btn-sm" id="empty-goto-settings">Ir para configurações</button>
        </div>`;
      $('#empty-goto-settings')?.addEventListener('click', () => navigate('settings'));
      return;
    }
    host.innerHTML = sections.map((sec, idx) => `
      <div class="section">
        <div class="section-title"><h3>${esc(sec.title)}</h3><span class="timecode">${sec.items.length} itens</span></div>
        <div class="card-grid" id="grid-custom-${idx}"></div>
      </div>
    `).join('');
    sections.forEach((sec, idx) => {
      const g = $(`#grid-custom-${idx}`);
      g.innerHTML = sec.items.map(cardHtml).join('');
      attachCardHandlers(g, sec.items);
    });
  }

  function renderFollowing(){
    const root = $('#view-root');
    const list = GX.content.getDefaultFollowed();
    root.innerHTML = `
      <div class="view-header"><h2>Canais seguidos</h2></div>
      <div class="card-grid">
        ${list.map(f => `
          <div class="card">
            <div class="thumb-wrap"><img class="thumb" src="${esc(f.avatar.replace('64/64','400/300'))}">${f.live?'<span class="live-badge">AO VIVO</span>':''}</div>
            <div class="body"><div class="title">${esc(f.name)}</div><div class="sub">${esc(f.sub)}</div></div>
          </div>`).join('')}
      </div>
    `;
  }

  async function renderLibrary(){
    const root = $('#view-root');
    const history = await GX.storage.getHistory();
    root.innerHTML = `
      <div class="view-header"><h2>Meus jogos / mídias</h2><span class="timecode">${history.length} itens no histórico local</span></div>
      ${history.length ? `<div class="card-grid">${history.map(h => `
        <div class="card">
          <div class="thumb-wrap"><img class="thumb" src="${esc(h.thumb)}"></div>
          <div class="body"><div class="title">${esc(h.title)}</div><div class="sub">${new Date(h.ts).toLocaleString('pt-BR')}</div></div>
        </div>`).join('')}</div>` :
      `<div class="empty-state"><div class="big">◧</div><h3>Ainda sem histórico</h3><p>O que você assistir aparecerá aqui, salvo localmente no cache do dispositivo (IndexedDB).</p></div>`}
    `;
  }

  function renderDownloads(){
    const root = $('#view-root');
    root.innerHTML = `
      <div class="view-header"><h2>Downloads locais</h2></div>
      <div class="settings-panel" style="margin-bottom:20px">
        <h3>Pasta do dispositivo</h3>
        <p class="panel-sub">Escolha uma pasta real do seu computador para onde o GXVideos vai salvar backups e exportações (via File System Access API). Se seu navegador não suportar, o download tradicional é usado como alternativa.</p>
        <button class="btn btn-signal" id="btn-pick-folder">📁 Escolher pasta do dispositivo</button>
      </div>
      <div class="settings-panel">
        <h3>Exportar dados</h3>
        <p class="panel-sub">Salva um backup local (.json) com contas, perfis e configurações deste dispositivo.</p>
        <button class="btn btn-ghost" id="btn-export">⭳ Exportar backup local</button>
      </div>
    `;
    $('#btn-pick-folder').addEventListener('click', async () => {
      const ok = await GX.storage.pickDeviceFolder();
      if (ok) toast('Pasta selecionada. Os próximos salvamentos irão para ela.');
    });
    $('#btn-export').addEventListener('click', async () => {
      const dump = { accounts: GX.storage.getAccounts(), settings: GX.storage.getSettings(), parental: GX.storage.getParental(), exportedAt: new Date().toISOString() };
      await GX.storage.saveJSONToDevice(`gxvideos-backup-${Date.now()}.json`, dump);
      toast('Backup salvo no dispositivo.');
    });
  }

  /* ============================================================
     SETTINGS
     ============================================================ */
  const SETTINGS_TABS = [
    { id:'account', label:'Perfil & personalização', ic:'🎭' },
    { id:'accounts', label:'Contas & perfis', ic:'👥' },
    { id:'sources', label:'Fontes de conteúdo', ic:'🌐' },
    { id:'sync', label:'Sincronização online', ic:'☁' },
    { id:'media', label:'APIs de mídia', ic:'🖼' },
    { id:'parental', label:'Bloqueio parental', ic:'🛡' },
  ];

  function renderSettings(){
    const root = $('#view-root');
    root.innerHTML = `
      <div class="view-header"><h2>Configurações</h2></div>
      <div class="settings-grid">
        <div class="settings-nav" id="settings-nav">
          ${SETTINGS_TABS.map(t => `<button class="nav-item ${t.id===currentSettingsTab?'active':''}" data-tab="${t.id}"><span class="ic">${t.ic}</span> ${t.label}</button>`).join('')}
        </div>
        <div id="settings-panel-host"></div>
      </div>
    `;
    $$('#settings-nav [data-tab]').forEach(b => b.addEventListener('click', () => { currentSettingsTab = b.dataset.tab; renderSettings(); }));
    const host = $('#settings-panel-host');
    if (currentSettingsTab === 'account') paintAccountPanel(host);
    else if (currentSettingsTab === 'accounts') paintAccountsPanel(host);
    else if (currentSettingsTab === 'sources') paintSourcesPanel(host);
    else if (currentSettingsTab === 'sync') paintSyncPanel(host);
    else if (currentSettingsTab === 'media') paintMediaApiPanel(host);
    else if (currentSettingsTab === 'parental') paintParentalPanel(host);
  }

  function paintAccountPanel(host){
    const p = GX.auth.currentProfile();
    host.innerHTML = `
      <div class="settings-panel">
        <h3>Personalizar perfil atual</h3>
        <p class="panel-sub">Molduras, banners, cores, status e bio custom — visível para quem acessar esta conta.</p>
        <button class="btn btn-signal" id="btn-edit-profile">Editar "${esc(p?.name||'')}"</button>
      </div>
    `;
    $('#btn-edit-profile').addEventListener('click', () => openProfileEditor(p.id));
  }

  function paintAccountsPanel(host){
    const acc = GX.auth.currentAccount();
    const accounts = GX.auth.listAccounts();
    host.innerHTML = `
      <div class="settings-panel">
        <h3>Contas neste dispositivo</h3>
        <p class="panel-sub">Estilo Netflix: várias contas podem usar o mesmo dispositivo, cada uma com seus perfis.</p>
        ${accounts.map(a => `
          <div class="list-item">
            <img class="avatar-sm" src="${esc(a.avatar)}" style="width:32px;height:32px;border-radius:8px;object-fit:cover">
            <div class="grow"><b>${esc(a.name)} ${a.id===acc.id?'(atual)':''}</b><span>${esc(a.email)} · ${(a.profiles||[]).length} perfis</span></div>
            ${a.id!==acc.id?`<button class="btn btn-sm btn-danger" data-rm="${a.id}">Remover do dispositivo</button>`:''}
          </div>
        `).join('')}
        <div class="divider"></div>
        <h3>Perfis da conta atual</h3>
        <button class="btn btn-ghost" id="btn-manage-profiles-2">Gerenciar perfis</button>
      </div>
    `;
    $('#btn-manage-profiles-2').addEventListener('click', openProfileManager);
    $$('[data-rm]').forEach(b => b.addEventListener('click', () => { GX.auth.removeAccount(b.dataset.rm); renderSettings(); toast('Conta removida deste dispositivo.'); }));
  }

  function paintSourcesPanel(host){
    const settings = GX.storage.getSettings();
    host.innerHTML = `
      <div class="settings-panel">
        <h3>Repositórios custom (GitHub)</h3>
        <p class="panel-sub">A plataforma lê imagens/banners da pasta informada e exibe como vitrine. Ao clicar, o usuário é enviado ao GitHub original.</p>
        ${(settings.customRepos||[]).map((r,i) => `
          <div class="list-item">
            <div class="grow"><b>${esc(r.label||r.repo)}</b><span>${esc(r.owner)}/${esc(r.repo)}${r.path?'/'+esc(r.path):''}</span></div>
            <button class="btn btn-sm btn-danger" data-rmrepo="${i}">Remover</button>
          </div>
        `).join('') || '<p class="panel-sub">Nenhum repositório custom cadastrado.</p>'}
        <button class="btn btn-signal btn-sm" id="btn-add-repo">+ Adicionar repositório</button>
      </div>
      <div class="settings-panel" style="margin-top:20px">
        <h3>Sites custom</h3>
        <p class="panel-sub">Mostra banner/capa do site como vitrine (leitura best-effort — alguns sites bloqueiam via CORS, então você pode informar imagem/título manualmente). Ao clicar, o site original é aberto, inclusive quando exige login.</p>
        ${(settings.customSites||[]).map((s,i) => `
          <div class="list-item">
            <div class="grow"><b>${esc(s.title||s.url)}</b><span>${esc(s.url)}</span></div>
            ${s.requiresAuth?'<span class="badge-status warn">exige login</span>':'<span class="badge-status ok">livre</span>'}
            <button class="btn btn-sm btn-danger" data-rmsite="${i}">Remover</button>
          </div>
        `).join('') || '<p class="panel-sub">Nenhum site custom cadastrado.</p>'}
        <button class="btn btn-signal btn-sm" id="btn-add-site">+ Adicionar site</button>
      </div>
    `;
    $('#btn-add-repo').addEventListener('click', openAddRepoModal);
    $('#btn-add-site').addEventListener('click', openAddSiteModal);
    $$('[data-rmrepo]').forEach(b => b.addEventListener('click', () => {
      const s = GX.storage.getSettings(); s.customRepos.splice(+b.dataset.rmrepo,1); GX.storage.setSettings(s); renderSettings();
    }));
    $$('[data-rmsite]').forEach(b => b.addEventListener('click', () => {
      const s = GX.storage.getSettings(); s.customSites.splice(+b.dataset.rmsite,1); GX.storage.setSettings(s); renderSettings();
    }));
  }

  function openAddRepoModal(){
    openModal(`
      <h3>Adicionar repositório custom</h3>
      <div class="field"><label>Nome de exibição</label><input id="f-label" placeholder="Ex: Meus banners"></div>
      <div class="form-row">
        <div class="field"><label>Dono (owner)</label><input id="f-owner" placeholder="ex: gamesistem"></div>
        <div class="field"><label>Repositório</label><input id="f-repo" placeholder="ex: GXVideos"></div>
      </div>
      <div class="field"><label>Pasta (opcional)</label><input id="f-path" placeholder="ex: banners"></div>
      <small style="display:block;margin:-6px 0 14px;color:var(--text-faint)">Repositório precisa ser público, ou você precisa ter um token com acesso configurado em Sincronização online.</small>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="m-cancel">Cancelar</button>
        <button class="btn btn-signal" id="m-save">Adicionar</button>
      </div>
    `, () => {
      $('#m-cancel').addEventListener('click', closeModal);
      $('#m-save').addEventListener('click', () => {
        const owner = $('#f-owner').value.trim(), repo = $('#f-repo').value.trim();
        if (!owner || !repo){ toast('Informe dono e repositório.', true); return; }
        const s = GX.storage.getSettings();
        s.customRepos = s.customRepos || [];
        s.customRepos.push({ label: $('#f-label').value.trim(), owner, repo, path: $('#f-path').value.trim() });
        GX.storage.setSettings(s);
        closeModal(); renderSettings(); toast('Repositório adicionado.');
      });
    });
  }

  function openAddSiteModal(){
    openModal(`
      <h3>Adicionar site custom</h3>
      <div class="field"><label>URL do site</label><input id="f-url" placeholder="https://exemplo.com"></div>
      <div class="field"><label>Título (opcional, usado se a leitura automática falhar)</label><input id="f-title" placeholder="Nome do site"></div>
      <div class="field"><label>Imagem de capa (opcional)</label><input id="f-image" placeholder="https://.../capa.jpg"></div>
      <label class="toggle-row" style="border:none">
        <span class="lbl"><b>Tentar ler automaticamente (og:title / og:image)</b><span>Pode falhar por CORS — nesse caso os campos acima são usados</span></span>
        <span class="switch on" id="sw-auto"><i></i></span>
      </label>
      <label class="toggle-row" style="border:none">
        <span class="lbl"><b>Este site exige login</b><span>Ao clicar, o usuário é enviado direto ao site original</span></span>
        <span class="switch" id="sw-auth"><i></i></span>
      </label>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="m-cancel">Cancelar</button>
        <button class="btn btn-signal" id="m-save">Adicionar</button>
      </div>
    `, () => {
      $('#m-cancel').addEventListener('click', closeModal);
      $$('.switch').forEach(sw => sw.addEventListener('click', () => sw.classList.toggle('on')));
      $('#m-save').addEventListener('click', () => {
        const url = $('#f-url').value.trim();
        if (!url){ toast('Informe a URL do site.', true); return; }
        try{ new URL(url); }catch(e){ toast('URL inválida.', true); return; }
        const s = GX.storage.getSettings();
        s.customSites = s.customSites || [];
        s.customSites.push({
          url, title: $('#f-title').value.trim(), image: $('#f-image').value.trim(),
          autoRead: $('#sw-auto').classList.contains('on'), requiresAuth: $('#sw-auth').classList.contains('on')
        });
        GX.storage.setSettings(s);
        closeModal(); renderSettings(); toast('Site adicionado.');
      });
    });
  }

  function paintSyncPanel(host){
    const s = GX.storage.getSettings();
    const token = GX.storage.getToken();
    host.innerHTML = `
      <div class="settings-panel">
        <h3>Sincronização online (GitHub)</h3>
        <p class="panel-sub">Salva perfis e configurações num repositório do GitHub para acessar de outro dispositivo — o mesmo princípio de storage usado pelo repositório oficial do GXVideos.</p>
        <div class="form-row">
          <div class="field"><label>Dono do repositório</label><input id="f-sowner" value="${esc(s.githubOwner)}" placeholder="seu-usuario"></div>
          <div class="field"><label>Repositório</label><input id="f-srepo" value="${esc(s.githubRepo)}" placeholder="meu-repo-gxvideos"></div>
        </div>
        <div class="field"><label>Personal Access Token (escopo "repo")</label><input id="f-token" type="password" value="${esc(token)}" placeholder="ghp_..."></div>
        <small style="display:block;margin:-8px 0 14px;color:var(--text-faint)">O token fica salvo apenas no localStorage deste navegador e é enviado só para api.github.com.</small>
        <label class="toggle-row" style="border:none">
          <span class="lbl"><b>Ativar sincronização online</b><span>Necessário para salvar/ler perfis de outro dispositivo</span></span>
          <span class="switch ${s.syncEnabled?'on':''}" id="sw-sync"><i></i></span>
        </label>
        <div class="modal-actions" style="justify-content:flex-start;margin-top:16px">
          <button class="btn btn-ghost" id="btn-test">Testar conexão</button>
          <button class="btn btn-signal" id="btn-save-sync">Salvar</button>
        </div>
        <div class="divider"></div>
        <h3>Enviar / receber perfis</h3>
        <div class="modal-actions" style="justify-content:flex-start">
          <button class="btn btn-ghost" id="btn-push">☁⇧ Enviar perfis desta conta</button>
          <button class="btn btn-ghost" id="btn-pull">☁⇩ Puxar perfis online</button>
        </div>
      </div>
    `;
    $('#sw-sync').addEventListener('click', e => e.currentTarget.classList.toggle('on'));
    $('#btn-save-sync').addEventListener('click', () => {
      const ns = GX.storage.getSettings();
      ns.githubOwner = $('#f-sowner').value.trim();
      ns.githubRepo = $('#f-srepo').value.trim();
      ns.syncEnabled = $('#sw-sync').classList.contains('on');
      GX.storage.setSettings(ns);
      GX.storage.setToken($('#f-token').value.trim());
      toast('Configurações de sincronização salvas.');
    });
    $('#btn-test').addEventListener('click', async () => {
      GX.storage.setToken($('#f-token').value.trim());
      const owner = $('#f-sowner').value.trim(), repo = $('#f-srepo').value.trim();
      if (!owner || !repo){ toast('Informe dono e repositório.', true); return; }
      const res = await GX.github.testToken(owner, repo);
      toast(res.ok ? `Conectado! ${res.canPush?'Permissão de escrita OK.':'Sem permissão de escrita neste token.'}` : res.error, !res.ok);
    });
    $('#btn-push').addEventListener('click', async () => {
      const res = await GX.auth.pushAccountOnline(GX.auth.currentAccount().id);
      toast(res.ok ? 'Perfis enviados ao repositório.' : res.error, !res.ok);
    });
    $('#btn-pull').addEventListener('click', async () => {
      const acc = GX.auth.currentAccount();
      const res = await GX.auth.pullAccountOnline(acc.email);
      if (!res.ok){ toast(res.error, true); return; }
      acc.profiles = res.data.profiles || acc.profiles;
      GX.auth.saveAccount(acc);
      toast('Perfis atualizados a partir do repositório online.');
      renderProfiles();
    });
  }

  function paintMediaApiPanel(host){
    const s = GX.storage.getSettings();
    host.innerHTML = `
      <div class="settings-panel">
        <h3>APIs de imagens e GIFs</h3>
        <p class="panel-sub">Usadas para sugerir banners, fundos e avatares nos perfis. Sem chave cadastrada, imagens usam a Picsum Photos (sem necessidade de conta).</p>
        <div class="field"><label>Unsplash Access Key (opcional)</label><input id="f-imgkey" value="${esc(s.imageApiKey)}" placeholder="Client-ID da Unsplash API"></div>
        <div class="field"><label>Giphy API Key (opcional, para GIFs de avatar)</label><input id="f-gifkey" value="${esc(s.gifApiKey)}" placeholder="Chave grátis em developers.giphy.com"></div>
        <button class="btn btn-signal" id="btn-save-media">Salvar chaves</button>
      </div>
    `;
    $('#btn-save-media').addEventListener('click', () => {
      const ns = GX.storage.getSettings();
      ns.imageApiKey = $('#f-imgkey').value.trim();
      ns.gifApiKey = $('#f-gifkey').value.trim();
      GX.storage.setSettings(ns);
      toast('Chaves de API salvas.');
    });
  }

  function paintParentalPanel(host){
    const p = GX.storage.getParental();
    const allTags = ['18+','NSFW','Gambling','Violence'];
    host.innerHTML = `
      <div class="settings-panel">
        <h3>Bloqueio parental</h3>
        <p class="panel-sub">Restringe conteúdo marcado com certas tags. Perfis marcados como "infantil" também respeitam este filtro.</p>
        <label class="toggle-row">
          <span class="lbl"><b>Ativar bloqueio parental</b><span>Pedirá o PIN para desativar</span></span>
          <span class="switch ${p.enabled?'on':''}" id="sw-parental"><i></i></span>
        </label>
        <div class="field" style="margin-top:14px"><label>PIN de 4 dígitos</label><input id="f-pin" maxlength="4" value="${esc(p.pin)}" placeholder="0000"></div>
        <div class="field"><label>Categorias bloqueadas</label>
          <div class="chip-row">
            ${allTags.map(t => `<span class="chip ${p.blockedTags.includes(t)?'active':''}" data-tag="${t}">${t}</span>`).join('')}
          </div>
        </div>
        <button class="btn btn-signal" id="btn-save-parental">Salvar</button>
      </div>
    `;
    $('#sw-parental').addEventListener('click', e => e.currentTarget.classList.toggle('on'));
    $$('.chip[data-tag]').forEach(c => c.addEventListener('click', () => c.classList.toggle('active')));
    $('#btn-save-parental').addEventListener('click', () => {
      const enabled = $('#sw-parental').classList.contains('on');
      const pin = $('#f-pin').value.trim();
      if (enabled && pin.length !== 4){ toast('Cadastre um PIN de 4 dígitos para ativar o bloqueio.', true); return; }
      const blockedTags = $$('.chip.active[data-tag]').map(c => c.dataset.tag);
      GX.auth.parentalSet({ enabled, pin, blockedTags });
      toast('Configurações de bloqueio parental salvas.');
    });
  }

  function openParentalGate(){
    const p = GX.storage.getParental();
    if (!p.enabled){ navigate('settings'); currentSettingsTab='parental'; renderSettings(); return; }
    openPinPad('Bloqueio parental — informe o PIN', p.pin, () => { navigate('settings'); currentSettingsTab='parental'; renderSettings(); });
  }

  function openSyncPanel(){ navigate('settings'); currentSettingsTab = 'sync'; renderSettings(); }

  return {
    esc, toast, openModal, closeModal, paintLogos, setBootStatus, hideBoot,
    renderGate, renderProfiles, renderAppShell, navigate
  };
})();
