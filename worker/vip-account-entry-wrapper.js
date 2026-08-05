import app from './vip-account-wrapper.js';

const SESSION_COOKIE = 'btc_vip_session';

function hasSessionCookie(request) {
  return (request.headers.get('Cookie') || '')
    .split(';')
    .some(part => part.trim().startsWith(`${SESSION_COOKIE}=`));
}

function languageFromRequest(request) {
  const referer = request.headers.get('Referer') || '';
  try {
    return new URL(referer).pathname.startsWith('/en/') ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

function accountPath(language) {
  return language === 'en' ? '/en/account.html' : '/account.html';
}

function memberPath(language) {
  return language === 'en' ? '/en/member.html' : '/member.html';
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const language = languageFromRequest(request);

    if (url.pathname === '/api/vip-checkout' && request.method === 'POST' && !hasSessionCookie(request)) {
      return Response.json({
        ok: true,
        account_required: true,
        checkout_url: `${url.origin}${accountPath(language)}`
      }, {
        status: 201,
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    if (url.pathname === '/api/vip-portal-link' && request.method === 'GET') {
      return Response.json({
        ok: true,
        portal_url: `${url.origin}${hasSessionCookie(request) ? memberPath(language) : accountPath(language)}`
      }, {
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    return app.fetch(request, env, ctx);
  }
};