(()=>{
  try{
    if(window.__intiFloatingWidgetLoaded){return;} window.__intiFloatingWidgetLoaded=true;

    const CONFIG={
      pwaOrigin:'https://inti.intellipedia.ai',
      menuUrl:'/widget/menu.json',
      replitInvite:`${location.origin}/invite`,
      zIndex:2147483645
    };

    function getCookie(name){
      try{const v=document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith(name+'='));return v?v.split('=')[1]:null;}catch{return null}
    }
    function parseConnectSid(raw){
      if(!raw) return null; try{let v=decodeURIComponent(raw); if(v.startsWith('s:')) v=v.slice(2); const dot=v.indexOf('.'); return dot!==-1? v.slice(0,dot):v;}catch{return null}
    }
    function getSessionId(){
      try{
        const p=new URLSearchParams(location.search);
        const fromUrl=p.get('session')||p.get('sessionId'); if(fromUrl) return fromUrl;
        const fromCookie=getCookie('intellipedia_session')||getCookie('sessionId')||parseConnectSid(getCookie('connect.sid')); if(fromCookie) return fromCookie;
      }catch{}
      return null;
    }
    const sessionId=getSessionId();

    // Host + ShadowRoot (match PWA spacing: bottom/right ~1.5rem)
    const host=document.createElement('div');
    host.style.all='initial'; host.style.position='fixed'; host.style.right='24px'; host.style.bottom='24px'; host.style.zIndex=String(CONFIG.zIndex);
    const shadow=host.attachShadow({mode:'open'});

    // Styles matching the PWA launcher (coin + diffuse glow, no dark background)
    const style=document.createElement('style');
    style.textContent=`
      :host{all:initial}
      @keyframes soft-pulse{0%,100%{transform:scale(1);opacity:.92}50%{transform:scale(1.06);opacity:1}}
      .launcher{position:relative;width:64px;height:64px;border:none;background:transparent;padding:0;margin:0;cursor:pointer;outline:none;animation:soft-pulse 3s ease-in-out infinite}
      .glow{position:absolute;inset:0;border-radius:50%;background:radial-gradient(65% 65% at 50% 50%, rgba(255,200,80,.95), rgba(255,160,40,.85) 60%, rgba(240,120,20,.75) 100%);filter:blur(14px);opacity:.6}
      .coin{position:relative;width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,.45))}
      .panel{position:fixed;right:70px;bottom:6px;background:linear-gradient(180deg, rgba(18,18,18,.98), rgba(6,6,6,.96));color:#fff;border-radius:14px;padding:16px;border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 50px rgba(0,0,0,.55);min-width:560px;max-width:640px}
      .grid{display:grid;grid-template-columns: 1fr 1fr;gap:18px}
      .section{display:flex;flex-direction:column;gap:8px}
      .title{font:600 12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,'Helvetica Neue',sans-serif;color:#9aa4b2;letter-spacing:.04em;text-transform:uppercase;margin:2px 0 6px}
      .item{font:14px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,'Helvetica Neue',sans-serif;color:#e9edf2;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);display:flex;gap:10px;align-items:center}
      .item:hover{background:rgba(255,255,255,.08)}
      .icon{width:18px;text-align:center}
      .admin{margin-top:6px}
      .admin .item{border-color:rgba(0,255,170,.25)}
      .footer{display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.12)}
      .who{font:12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,'Helvetica Neue',sans-serif;color:#b8c1cc}
      .who b{color:#fff}
      .actions{display:flex;gap:8px}
      .btn2{font:12px/1 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,'Helvetica Neue',sans-serif;color:#fff;border:1px solid rgba(255,255,255,.2);background:transparent;border-radius:8px;padding:8px 10px;cursor:pointer}
      .btn2:hover{background:rgba(255,255,255,.08)}
      .hidden{display:none}
    `;
    shadow.appendChild(style);

    // Launcher (coin + diffuse glow)
    const btn=document.createElement('button');
    btn.className='launcher';
    btn.title='Inti Menu';
    const glow=document.createElement('div'); glow.className='glow';
    const coin=document.createElement('img'); coin.className='coin'; coin.alt='Inti'; coin.src=`${CONFIG.pwaOrigin}/inti-logo.png`;

    // Panel root
    const panel=document.createElement('div'); panel.className='panel hidden';

    // Minimal user detection (prefer canonical cookie-based endpoint)
    let userName=null;
    async function resolveWhoami(){
      try{
        const r = await fetch('/api/session/whoami',{credentials:'include'});
        if(r.ok){
          const j=await r.json();
          userName = j?.user?.displayName || j?.user?.display_name || j?.user?.username || null;
          if(!sessionId && j?.sessionId) sessionId = j.sessionId;
          updateFooter();
          return true;
        }
      }catch{}
      return false;
    }
    (async()=>{
      const ok = await resolveWhoami();
      if(ok) return;
      // fallback legacy flows
      try{
        if(sessionId){
          const r=await fetch('/api/auth/me',{method:'GET',headers:{'Authorization':`Bearer ${sessionId}`},credentials:'include'});
          if(r.ok){ const j=await r.json(); userName=j.displayName || j.display_name || j.username || null; updateFooter(); return; }
        }
        const r2=await fetch('/api/auth/me',{credentials:'include'});
        if(r2.ok){ const j=await r2.json(); userName=j.displayName || j.display_name || j.username || null; updateFooter(); }
      }catch{}
    })();

    function navigate(url){ try{window.location.href=url;}catch(e){console.warn('[IntiWidget] nav failed',e);} }
    function linkToUco(){ navigate(`${CONFIG.pwaOrigin}/uco-test${sessionId?`?session=${encodeURIComponent(sessionId)}`:''}`); }
    function login(){ navigate(`${CONFIG.replitInvite}?returnUrl=${encodeURIComponent(CONFIG.pwaOrigin)}`); }
    function logout(){ navigate(`${CONFIG.replitInvite}?returnUrl=${encodeURIComponent(CONFIG.pwaOrigin)}&action=logout`); }

    const grid=document.createElement('div'); grid.className='grid';
    const nav=document.createElement('div'); nav.className='section';
    nav.innerHTML=`<div class="title">Navigation</div>`;
    const features=document.createElement('div'); features.className='section';
    features.innerHTML=`<div class="title">Features</div>`;

    function add(label, icon, handler){
      const a=document.createElement('div'); a.className='item'; a.innerHTML=`<span class="icon">${icon}</span><span>${label}</span>`; a.onclick=()=>{hide(); handler();}; return a;
    }

    // Navigation
    nav.append(
      add('Inti LightBoard', '🌞', ()=>navigate(CONFIG.pwaOrigin)),
      add('Create', '🪄', ()=>navigate(`${location.origin}/create`)),
      add('Profile', '👤', ()=>navigate(`${location.origin}/creator`)),
      add('Intellipedia', '🌐', ()=>window.open('https://intellipedia.ai','_blank'))
    );

    // Features
    features.append(
      add('Text Chat', '💬', ()=>navigate(CONFIG.pwaOrigin)),
      add('Voices', '🎭', ()=>navigate(CONFIG.pwaOrigin))
    );

    // Admin
    const admin=document.createElement('div'); admin.className='section admin';
    admin.append(add('UCO Dashboard', '🧪', linkToUco));

    grid.append(nav, features);
    panel.append(grid, admin);

    // Footer
    const footer=document.createElement('div'); footer.className='footer';
    const who=document.createElement('div'); who.className='who';
    const actions=document.createElement('div'); actions.className='actions';
    const connectBtn=document.createElement('button'); connectBtn.className='btn2'; connectBtn.textContent='Connect';
    connectBtn.onclick=()=>{hide(); navigate(CONFIG.pwaOrigin);};
    let signBtn=document.createElement('button'); signBtn.className='btn2'; signBtn.textContent=(userName||sessionId)? 'Sign Out':'Sign In';
    signBtn.onclick=()=>{hide(); (userName||sessionId)? logout(): login();};
    function updateFooter(){
      if(userName){ who.innerHTML=`Signed in as <b>${userName}</b>`; }
      else if(sessionId){ who.innerHTML=`Session <b>${String(sessionId).slice(0,8)}…</b>`; }
      else { who.textContent='Not signed in'; }
      if(signBtn) signBtn.textContent = (userName||sessionId) ? 'Sign Out' : 'Sign In';
    }
    updateFooter();
    actions.append(connectBtn, signBtn);
    footer.append(who, actions);
    panel.append(footer);

    function show(){ panel.classList.remove('hidden'); }
    function hide(){ panel.classList.add('hidden'); }
    btn.addEventListener('click',()=>{ panel.classList.contains('hidden')? show(): hide(); });

    btn.append(glow, coin);
    shadow.append(btn,panel);
    document.documentElement.appendChild(host);

    // Optional: extend menu from PWA JSON
    fetch(`${CONFIG.pwaOrigin}${CONFIG.menuUrl}`,{mode:'cors'}).then(r=>r.ok?r.json():null).then(cfg=>{
      if(!cfg||!Array.isArray(cfg.items)) return;
      cfg.items.forEach(it=>{
        if(!it||!it.label||!it.href) return;
        const href = it.href
          .replace('{session}', sessionId? encodeURIComponent(sessionId):'')
          .replace('{origin}', location.origin);
        // append to features by default
        features.append(add(String(it.label), '🔗', ()=>navigate(href)));
      });
    }).catch(()=>{});

  }catch(e){console.error('[IntiWidget] failed',e)}
})();
