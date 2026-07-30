(() => {
  const doc = document.documentElement;
  const body = document.body;
  const lang = doc.lang === 'en' ? 'en' : 'fr';
  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('[data-menu-button]');
  const menuClose = document.querySelector('[data-menu-close]');
  const panel = document.querySelector('[data-mobile-panel]');
  const WHATSAPP_NUMBER = '16892290770';
  const FACEBOOK_URL = 'https://www.facebook.com/share/1JxasHrmQS/?mibextid=wwXIfr';
  const EDERITO_INSTAGRAM_URL = 'https://www.instagram.com/ederito_studio/';
  let lastY = window.scrollY;

  const patch = document.createElement('style');
  patch.textContent = `
    [data-mobile-panel][hidden]{display:none!important}
    body{background:#f7f9fa}
    .announcement{background:#051a29;border-bottom:1px solid rgba(255,255,255,.12)}
    .site-header{background:rgba(255,255,255,.94);backdrop-filter:blur(18px) saturate(135%);border-bottom:1px solid rgba(7,62,104,.14)}
    .button,.lang-switch,.menu-button{border-radius:8px}
    .button--primary{background:linear-gradient(135deg,#073e68,#078dc2)}
    .program-tile,.contact-form-card,.booking-card,.pricing-box,.module-panel,.waitlist-panel{border-radius:8px!important}
    .capacity-note{display:block;margin-top:14px;padding:13px 15px;background:#eef8e9;border-left:3px solid #67be45;color:#173d25;font-size:.84rem;font-weight:700}
    .booking-policy-card{margin:0 0 28px;padding:25px;border-left:4px solid #078dc2;background:#eef5f7;color:#071b29}
    .booking-policy-card h3{margin:0 0 12px;font:700 1.5rem/1.2 "Playfair Display",serif}
    .booking-policy-card ul{margin:0;padding-left:20px}.booking-policy-card li{margin:7px 0;color:#47606f}
    .terms-booking-policy{margin:48px auto;padding:32px;max-width:920px;border:1px solid rgba(7,62,104,.14);border-left:4px solid #078dc2;background:#fff}
    .terms-booking-policy h2{margin-top:0;font-family:"Playfair Display",serif}
    .whatsapp-float{position:fixed;right:20px;bottom:22px;z-index:90;width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:#25D366;color:#fff;box-shadow:0 18px 42px rgba(0,0,0,.22);transition:transform .2s ease}
    .whatsapp-float:hover{transform:translateY(-3px)}.whatsapp-float svg{width:29px;height:29px;fill:currentColor}
    .footer-socials{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.footer-socials a{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:9px 14px;border:1px solid rgba(255,255,255,.18);border-radius:8px;font-size:.78rem;font-weight:800}
    @media(max-width:980px){
      .mobile-panel{position:fixed!important;inset:0!important;z-index:9999!important;width:100%!important;height:100dvh!important;padding:max(24px,env(safe-area-inset-top)) 24px max(24px,env(safe-area-inset-bottom))!important;overflow-y:auto!important;background:#051a29!important;color:#fff!important;opacity:1!important}
      .mobile-nav{height:auto!important;min-height:calc(100dvh - 120px)!important;padding:28px 0 36px!important;justify-content:flex-start!important;gap:10px!important}
      .mobile-nav>a:not(.button){display:block!important;padding:7px 0!important;font-size:clamp(2rem,10vw,3.25rem)!important;line-height:1.04!important;color:#fff!important}
      .mobile-nav .button{margin-top:12px!important;width:100%!important}.whatsapp-float{bottom:92px;right:16px;width:54px;height:54px}
    }
  `;
  document.head.appendChild(patch);

  function setMenu(open){
    if(!menuButton || !panel) return;
    menuButton.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    panel.setAttribute('aria-hidden', String(!open));
    body.classList.toggle('menu-open', open);
    if(open) requestAnimationFrame(() => menuClose?.focus());
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
    if(progress) progress.style.width = `${Math.min(100, (y / max) * 100)}%`;
    header?.classList.toggle('is-scrolled', y > 20);
    if(y > 300 && y > lastY && !body.classList.contains('menu-open')) header?.classList.add('is-hidden');
    else header?.classList.remove('is-hidden');
    backTop?.classList.toggle('visible', y > 600);
    lastY = y;
  }
  addEventListener('scroll', onScroll, {passive:true}); onScroll();
  backTop?.addEventListener('click', () => scrollTo({top:0, behavior:'smooth'}));

  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if(entry.isIntersecting){ entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    });
  }, {threshold:.08, rootMargin:'0px 0px -40px'}) : null;
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${Math.min((i % 4) * 70, 210)}ms`;
    observer ? observer.observe(el) : el.classList.add('visible');
  });

  document.querySelectorAll('[data-accordion-button]').forEach(button => {
    button.addEventListener('click', () => {
      const accordionPanel = button.parentElement.querySelector('.accordion__panel');
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      if(accordionPanel) accordionPanel.hidden = expanded;
      const icon = button.querySelector('[data-accordion-icon]');
      if(icon) icon.textContent = expanded ? '+' : '−';
    });
  });

  function whatsappUrl(message){ return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`; }
  document.querySelectorAll('[data-demo-form]').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const values = [...form.querySelectorAll('input,select,textarea')]
        .filter(el => el.type !== 'checkbox').map(el => el.value?.trim()).filter(Boolean);
      const heading = lang === 'fr' ? 'Bonjour Stéphanie, je vous contacte depuis le site Becoming Training Center.' : 'Hello Stephanie, I am contacting you from the Becoming Training Center website.';
      window.open(whatsappUrl([heading, ...values].join('\n')), '_blank', 'noopener,noreferrer');
    });
  });

  const whatsapp = document.createElement('a');
  whatsapp.className = 'whatsapp-float';
  whatsapp.href = whatsappUrl(lang === 'fr' ? 'Bonjour Stéphanie, je souhaite obtenir plus d’informations sur Becoming Training Center.' : 'Hello Stephanie, I would like more information about Becoming Training Center.');
  whatsapp.target = '_blank';
  whatsapp.rel = 'noopener noreferrer';
  whatsapp.setAttribute('aria-label', lang === 'fr' ? 'Contacter Stéphanie sur WhatsApp' : 'Contact Stephanie on WhatsApp');
  whatsapp.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M19.11 17.33c-.26-.13-1.53-.75-1.77-.84-.24-.09-.41-.13-.59.13-.17.26-.67.84-.82 1.01-.15.17-.3.19-.56.06-.26-.13-1.08-.4-2.06-1.27-.76-.68-1.28-1.52-1.43-1.78-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.59-1.42-.8-1.94-.21-.51-.43-.44-.59-.45h-.5c-.17 0-.45.06-.69.32-.24.26-.91.89-.91 2.17s.93 2.52 1.06 2.69c.13.17 1.83 2.8 4.44 3.93.62.27 1.1.43 1.48.55.62.2 1.19.17 1.64.1.5-.07 1.53-.63 1.75-1.23.22-.6.22-1.12.15-1.23-.06-.11-.24-.17-.5-.3M16.03 3.2A12.72 12.72 0 0 0 5.08 22.38L3.2 28.8l6.58-1.73a12.78 12.78 0 1 0 6.25-23.87m0 23.17c-2.04 0-4.03-.55-5.76-1.59l-.41-.24-3.9 1.02 1.04-3.8-.27-.43a10.36 10.36 0 1 1 9.3 5.04"/></svg>';
  document.body.appendChild(whatsapp);

  const footerBrand = document.querySelector('.footer-brand');
  if(footerBrand && !footerBrand.querySelector('.footer-socials')){
    const socials = document.createElement('div');
    socials.className = 'footer-socials';
    socials.innerHTML = `<a href="${FACEBOOK_URL}" target="_blank" rel="noopener noreferrer">Facebook</a><a href="${whatsappUrl(lang === 'fr' ? 'Bonjour Stéphanie, je vous contacte depuis le site.' : 'Hello Stephanie, I am contacting you from the website.')}" target="_blank" rel="noopener noreferrer">WhatsApp</a><a href="${EDERITO_INSTAGRAM_URL}" target="_blank" rel="noopener noreferrer">Ederito Studio</a>`;
    footerBrand.appendChild(socials);
  }

  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

  const assetRoot = location.pathname.includes('/en/') ? '../' : '';
  const loadScript = (src) => {
    const script = document.createElement('script');
    script.src = `${assetRoot}${src}`;
    script.defer = true;
    document.body.appendChild(script);
  };

  loadScript('assets/js/schedule-update.js');

  if(location.pathname.endsWith('coaching.html')){
    loadScript('assets/js/personal-coaching-field.js');
  } else {
    loadScript('assets/js/personal-images.js');
  }
})();