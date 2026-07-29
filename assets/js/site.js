
(() => {
  const doc = document.documentElement;
  const body = document.body;
  const lang = doc.lang === 'en' ? 'en' : 'fr';
  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('[data-menu-button]');
  const menuClose = document.querySelector('[data-menu-close]');
  const panel = document.querySelector('[data-mobile-panel]');
  let lastY = window.scrollY;

  function setMenu(open){
    if(!menuButton || !panel) return;
    menuButton.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    body.classList.toggle('menu-open', open);
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
      const panel = button.parentElement.querySelector('.accordion__panel');
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      panel.hidden = expanded;
      const icon = button.querySelector('[data-accordion-icon]');
      if(icon) icon.textContent = expanded ? '+' : '−';
    });
  });

  const messages = {
    fr:{contact:'Merci. Votre demande a été enregistrée dans cette démonstration. La connexion au courriel professionnel sera ajoutée avant le lancement.',newsletter:'Merci. Votre inscription a été enregistrée dans cette démonstration.',booking:'Merci. Votre sélection est prête. L’étape suivante sera la connexion sécurisée à Stripe et au calendrier en direct.'},
    en:{contact:'Thank you. Your request has been recorded in this demonstration. The professional email connection will be added before launch.',newsletter:'Thank you. Your signup has been recorded in this demonstration.',booking:'Thank you. Your selection is ready. The next step will be the secure Stripe and live-calendar connection.'}
  };
  document.querySelectorAll('[data-demo-form]').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const status = form.querySelector('.form-status');
      if(status) status.textContent = messages[lang][form.dataset.message || 'contact'];
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
  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
})();
