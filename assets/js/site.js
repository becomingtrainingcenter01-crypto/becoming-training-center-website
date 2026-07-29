(() => {
  const doc = document.documentElement;
  const body = document.body;
  const lang = doc.lang === 'en' ? 'en' : 'fr';
  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('[data-menu-button]');
  const menuClose = document.querySelector('[data-menu-close]');
  const panel = document.querySelector('[data-mobile-panel]');
  let lastY = window.scrollY;

  const WHATSAPP_NUMBER = '16892290770';
  const FACEBOOK_URL = 'https://www.facebook.com/share/1JxasHrmQS/?mibextid=wwXIfr';
  const EDERITO_INSTAGRAM_URL = 'https://www.instagram.com/ederito_studio/';

  const mobilePatch = document.createElement('style');
  mobilePatch.textContent = `
    [data-mobile-panel][hidden]{display:none!important}

    /* Institutional visual system — original Becoming colors preserved */
    body{background:#f7f9fa}
    .announcement{background:#051a29;border-bottom:1px solid rgba(255,255,255,.12)}
    .announcement__inner{min-height:40px;letter-spacing:.12em}
    .site-header{background:rgba(255,255,255,.94);backdrop-filter:blur(18px) saturate(135%);border-bottom:1px solid rgba(7,62,104,.14)}
    .header-shell{min-height:92px}
    .desktop-nav{font-size:.72rem;letter-spacing:.085em;text-transform:uppercase;gap:24px}
    .desktop-nav a{padding:33px 0}
    .desktop-nav a::after{bottom:23px;height:3px}
    .lang-switch,.menu-button{border-radius:8px;background:#fff}
    .button{border-radius:8px;letter-spacing:.01em}
    .button--primary{background:linear-gradient(135deg,#073e68,#078dc2)}
    .mesh-bg{background:linear-gradient(145deg,#f4f9fb 0%,#fff 58%,#f7faf6 100%)}
    .mesh-bg::before{opacity:.72}
    .mesh-bg::after{opacity:.62}
    .home-hero{border-bottom:1px solid rgba(7,62,104,.12)}
    .home-hero__grid{min-height:820px;grid-template-columns:1.08fr .92fr;gap:72px;padding:82px 0 96px}
    .home-hero__copy{padding-left:32px;border-left:4px solid #078dc2}
    .home-hero__copy h1{max-width:820px;font-size:clamp(3.8rem,6.15vw,6.45rem);line-height:.94}
    .home-hero__copy h1 em{font-size:.68em;margin-top:18px;color:#078dc2}
    .home-hero__copy>p{max-width:720px;font-size:1.08rem}
    .hero-visual__halo{inset:18px 0 0 18px;border-radius:8px;transform:none;background:linear-gradient(145deg,rgba(32,186,213,.18),rgba(103,190,69,.10),rgba(255,138,30,.10))}
    .hero-visual__frame{inset:0 18px 18px 0;border-radius:8px;border:1px solid rgba(7,62,104,.15);box-shadow:0 34px 90px rgba(5,35,54,.18)}
    .hero-visual__badge{border-radius:8px;border-left:4px solid #67be45}
    .hero-visual__badge>span{border-radius:6px}
    .hero-visual__mini{border-radius:8px;transform:none;width:110px;height:110px;background:#ff8a1e}
    .proof-strip{margin-top:0;border-radius:0;border-left:4px solid #078dc2;background:#fff;box-shadow:0 18px 44px rgba(5,35,54,.09)}
    .proof-strip>div{text-align:left;padding:26px 24px}
    .proof-strip strong{font-size:1.9rem}
    .section{padding:120px 0}
    .section-heading{align-items:flex-start;border-bottom:1px solid rgba(7,62,104,.14);padding-bottom:28px}
    .editorial-grid{border-top:4px solid #073e68;padding-top:34px}
    .program-tile{border-radius:8px;box-shadow:none;background:#fff}
    .program-tile:hover{transform:translateY(-4px);box-shadow:0 24px 60px rgba(5,35,54,.12)}
    .tile-icon,.detail-icon{border-radius:6px}
    .founder-collage__main,.founder-collage__accent,.training-image,.resource-feature,.waitlist-panel,.contact-form-card,.booking-card,.pricing-card,.vip-home__panel{border-radius:8px!important}
    .founder-signature{border-radius:8px!important}
    .experience-card,.resource-tile,.contact-options>div,.accordion,.coaching-card,.training-card{border-radius:8px!important}
    .global-cta{background:linear-gradient(120deg,#041824,#073e68 65%,#078dc2)}
    .site-footer{border-top:4px solid #078dc2}
    .footer-socials a{border-radius:8px!important}

    @media (max-width:980px){
      .header-shell{min-height:76px}
      .home-hero__grid{min-height:auto;display:block;padding:54px 0 64px}
      .home-hero__copy{padding-left:0;padding-top:24px;border-left:0;border-top:4px solid #078dc2}
      .home-hero__copy h1{font-size:clamp(3.35rem,15vw,5.5rem);line-height:.93}
      .home-hero__copy h1 em{font-size:.66em;margin-top:14px}
      .proof-strip{border-left:0;border-top:4px solid #078dc2}
      .proof-strip>div{text-align:center}
      .mobile-panel{
        position:fixed!important;
        inset:0!important;
        z-index:9999!important;
        width:100%!important;
        height:100dvh!important;
        padding:max(24px,env(safe-area-inset-top)) 24px max(24px,env(safe-area-inset-bottom))!important;
        overflow-y:auto!important;
        background:#051a29!important;
        color:#fff!important;
        opacity:1!important;
        isolation:isolate!important;
      }
      .mobile-panel::before{content:none!important}
      .mobile-panel__head{position:relative;z-index:2;min-height:48px}
      .mobile-panel__head button{width:48px;height:48px;display:grid;place-items:center;font-size:2.2rem;line-height:1}
      .mobile-nav{
        position:relative!important;
        z-index:2!important;
        height:auto!important;
        min-height:calc(100dvh - 120px)!important;
        padding:28px 0 36px!important;
        justify-content:flex-start!important;
        gap:10px!important;
      }
      .mobile-nav>a:not(.button){
        display:block!important;
        padding:7px 0!important;
        font-size:clamp(2rem,10vw,3.25rem)!important;
        line-height:1.04!important;
        color:#fff!important;
        opacity:1!important;
      }
      .mobile-nav .button{margin-top:12px!important;width:100%!important}
      body.menu-open .site-header{transform:none!important}
    }
    .whatsapp-float{
      position:fixed;right:20px;bottom:22px;z-index:90;width:58px;height:58px;border-radius:50%;
      display:grid;place-items:center;background:#25D366;color:#fff;box-shadow:0 18px 42px rgba(0,0,0,.22);
      font:800 1.35rem/1 system-ui;text-decoration:none;transition:transform .2s ease
    }
    .whatsapp-float:hover{transform:translateY(-3px)}
    .whatsapp-float svg{width:29px;height:29px;fill:currentColor}
    @media (max-width:980px){.whatsapp-float{bottom:92px;right:16px;width:54px;height:54px}}
    .footer-socials{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
    .footer-socials a{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:9px 14px;border:1px solid rgba(255,255,255,.18);font-size:.78rem;font-weight:800}
    .whatsapp-contact-card{padding:28px;border-radius:8px;background:linear-gradient(135deg,#073e68,#078dc2);color:#fff;box-shadow:0 24px 60px rgba(5,35,54,.18)}
    .whatsapp-contact-card h3{margin:0 0 10px;font:700 2rem/1.1 "Playfair Display",serif}
    .whatsapp-contact-card p{margin:0 0 20px;color:rgba(255,255,255,.82)}
  `;
  document.head.appendChild(mobilePatch);

  function setMenu(open){
    if(!menuButton || !panel) return;
    menuButton.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    panel.setAttribute('aria-hidden', String(!open));
    body.classList.toggle('menu-open', open);
    if(open){
      panel.scrollTop = 0;
      requestAnimationFrame(() => menuClose?.focus());
    } else {
      menuButton.focus({preventScroll:true});
    }
  }
  menuButton?.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  menuClose?.addEventListener('click', () => setMenu(false));
  panel?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if(e.key === 'Escape') setMenu(false); });

  const progress = document.querySelector('.scroll-progress span');
  const backTop = document.querySelector('[data-backtop]');
  function onScroll(){
    const y = window.scrollY;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    if(progress) progress.style.width = `${Math.min(100, (y/max)*100)}%`;
    header?.classList.toggle('is-scrolled', y > 20);
    if(y > 300 && y > lastY && !body.classList.contains('menu-open')) header?.classList.add('is-hidden');
    else header?.classList.remove('is-hidden');
    backTop?.classList.toggle('visible', y > 600);
    lastY = y;
  }
  addEventListener('scroll', onScroll, {passive:true}); onScroll();
  backTop?.addEventListener('click', () => scrollTo({top:0,behavior:'smooth'}));

  const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {threshold:.08, rootMargin:'0px 0px -40px'}) : null;
  document.querySelectorAll('.reveal').forEach((el,i) => {
    el.style.transitionDelay = `${Math.min((i%4)*70,210)}ms`;
    observer ? observer.observe(el) : el.classList.add('visible');
  });

  document.querySelectorAll('[data-accordion-button]').forEach(button => {
    button.addEventListener('click', () => {
      const accordionPanel = button.parentElement.querySelector('.accordion__panel');
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      accordionPanel.hidden = expanded;
      const icon = button.querySelector('[data-accordion-icon]');
      if(icon) icon.textContent = expanded ? '+' : '−';
    });
  });

  const messages = {
    fr:{contact:'Ouverture de WhatsApp…',newsletter:'Merci. Votre inscription a été enregistrée dans cette démonstration.',booking:'Merci. Votre sélection est prête. L’étape suivante sera la connexion sécurisée à Stripe et au calendrier en direct.'},
    en:{contact:'Opening WhatsApp…',newsletter:'Thank you. Your signup has been recorded in this demonstration.',booking:'Thank you. Your selection is ready. The next step will be the secure Stripe and live-calendar connection.'}
  };

  function whatsappUrl(message){
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }

  document.querySelectorAll('[data-demo-form]').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const status = form.querySelector('.form-status');
      const inputs = [...form.querySelectorAll('input,select,textarea')];
      const values = inputs.filter(el => el.type !== 'checkbox').map(el => el.value?.trim()).filter(Boolean);
      const heading = lang === 'fr' ? 'Bonjour Stéphanie, je vous contacte depuis le site Becoming Training Center.' : 'Hello Stephanie, I am contacting you from the Becoming Training Center website.';
      const message = [heading, ...values].join('\n');
      if(status) status.textContent = messages[lang].contact;
      window.open(whatsappUrl(message), '_blank', 'noopener,noreferrer');
    });
  });

  document.querySelectorAll('[data-booking-form]').forEach(form => {
    const program = form.querySelector('#program-select');
    const format = form.querySelector('#format-select');
    const summary = form.querySelector('[data-price-summary]');
    const prices = {personal:{session:'$50',module:'$150',full:'$650',interest:'—'},parenting:{session:'$150',module:'$150',full:'$650',interest:'—'},business:{session:'$150',module:'$150',full:'$650',interest:'—'},wellness:{session:'$150',module:'$150',full:'$650',interest:'—'},training:{session:'—',module:'—',full:'—',interest:'—'},vip:{session:'—',module:'—',full:'—',interest:'—'}};
    function updatePrice(){
      const p = program?.value || 'personal';
      const f = format?.value || 'session';
      if(summary) summary.textContent = prices[p]?.[f] || '—';
    }
    program?.addEventListener('change', updatePrice); format?.addEventListener('change', updatePrice);
    const params = new URLSearchParams(location.search);
    if(params.get('program') && program){ program.value = params.get('program'); }
    if(params.get('type') && format){ format.value = params.get('type'); }
    updatePrice();
    const hidden = form.querySelector('[data-time-input]');
    form.querySelectorAll('.time-slot').forEach(slot => slot.addEventListener('click', () => {
      form.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
      slot.classList.add('selected');
      if(hidden) hidden.value = slot.dataset.time;
    }));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const status = form.querySelector('.form-status');
      if(status) status.textContent = messages[lang].booking;
    });
  });

  document.querySelectorAll('.interactive-card').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX-r.left}px`);
      card.style.setProperty('--my', `${e.clientY-r.top}px`);
    });
  });

  const whatsappFloat = document.createElement('a');
  whatsappFloat.className = 'whatsapp-float';
  whatsappFloat.href = whatsappUrl(lang === 'fr' ? 'Bonjour Stéphanie, je souhaite obtenir plus d’informations sur Becoming Training Center.' : 'Hello Stephanie, I would like more information about Becoming Training Center.');
  whatsappFloat.target = '_blank';
  whatsappFloat.rel = 'noopener noreferrer';
  whatsappFloat.setAttribute('aria-label', lang === 'fr' ? 'Contacter Stéphanie sur WhatsApp' : 'Contact Stephanie on WhatsApp');
  whatsappFloat.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M19.11 17.33c-.26-.13-1.53-.75-1.77-.84-.24-.09-.41-.13-.59.13-.17.26-.67.84-.82 1.01-.15.17-.3.19-.56.06-.26-.13-1.08-.4-2.06-1.27-.76-.68-1.28-1.52-1.43-1.78-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.59-1.42-.8-1.94-.21-.51-.43-.44-.59-.45h-.5c-.17 0-.45.06-.69.32-.24.26-.91.89-.91 2.17s.93 2.52 1.06 2.69c.13.17 1.83 2.8 4.44 3.93.62.27 1.1.43 1.48.55.62.2 1.19.17 1.64.1.5-.07 1.53-.63 1.75-1.23.22-.6.22-1.12.15-1.23-.06-.11-.24-.17-.5-.3M16.03 3.2A12.72 12.72 0 0 0 5.08 22.38L3.2 28.8l6.58-1.73a12.78 12.78 0 1 0 6.25-23.87m0 23.17c-2.04 0-4.03-.55-5.76-1.59l-.41-.24-3.9 1.02 1.04-3.8-.27-.43a10.36 10.36 0 1 1 9.3 5.04"/></svg>';
  document.body.appendChild(whatsappFloat);

  const footerBrand = document.querySelector('.footer-brand');
  if(footerBrand){
    const socials = document.createElement('div');
    socials.className = 'footer-socials';
    socials.innerHTML = `<a href="${FACEBOOK_URL}" target="_blank" rel="noopener noreferrer">Facebook</a><a href="${whatsappUrl(lang === 'fr' ? 'Bonjour Stéphanie, je vous contacte depuis le site.' : 'Hello Stephanie, I am contacting you from the website.')}" target="_blank" rel="noopener noreferrer">WhatsApp</a><a href="${EDERITO_INSTAGRAM_URL}" target="_blank" rel="noopener noreferrer">Ederito Studio</a>`;
    footerBrand.appendChild(socials);
  }

  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
})();