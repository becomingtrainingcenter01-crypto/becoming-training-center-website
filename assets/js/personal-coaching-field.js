(() => {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';
  const assetRoot = location.pathname.includes('/en/') ? '../' : '';

  const personalPanel = document.querySelector('#personal .module-panel');
  if (personalPanel && !personalPanel.querySelector('.personal-topic-field')) {
    personalPanel.setAttribute('data-booking-form', '');

    const field = document.createElement('label');
    field.className = 'field field--full personal-topic-field';
    field.innerHTML = `
      <span>${lang === 'fr' ? 'De quoi souhaitez-vous parler pendant votre séance ?' : 'What would you like to discuss during your session?'}</span>
      <textarea id="personal-topic" name="personal-topic" rows="6" placeholder="${lang === 'fr' ? 'Écrivez librement ce que vous souhaitez aborder. Aucun sujet ne vous est imposé.' : 'Freely describe what you would like to discuss. No topic is imposed or suggested.'}"></textarea>
      <small>${lang === 'fr' ? 'Cet espace vous permet d’expliquer votre besoin avec vos propres mots.' : 'Use this space to explain your needs in your own words.'}</small>`;
    personalPanel.appendChild(field);

    const style = document.createElement('style');
    style.textContent = `
      .personal-topic-field{display:block;margin-top:24px;padding-top:24px;border-top:1px solid rgba(7,62,104,.14)}
      .personal-topic-field>span{display:block;margin-bottom:10px;color:#071b29;font-weight:800}
      .personal-topic-field textarea{display:block;width:100%;min-height:150px;padding:16px 18px;border:1px solid rgba(7,62,104,.22);border-radius:8px;background:#fff;color:#071b29;font:inherit;resize:vertical;box-sizing:border-box}
      .personal-topic-field textarea:focus{outline:3px solid rgba(7,141,194,.16);border-color:#078dc2}
      .personal-topic-field small{display:block;margin-top:8px;color:#617482;line-height:1.5}`;
    document.head.appendChild(style);
  }

  const galleryScript = document.createElement('script');
  galleryScript.src = `${assetRoot}assets/js/personal-images.js`;
  galleryScript.defer = true;
  document.body.appendChild(galleryScript);
})();
