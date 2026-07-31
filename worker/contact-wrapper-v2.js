import app from './contact-wrapper.js';

function isBookingPage(url) {
  return [
    '/booking.html',
    '/booking',
    '/booking/',
    '/en/booking.html',
    '/en/booking',
    '/en/booking/'
  ].includes(url.pathname);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const response = await app.fetch(request, env, ctx);

    if (request.method !== 'GET' || !isBookingPage(url) || !response.ok) {
      return response;
    }

    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');

    const freshResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });

    return new HTMLRewriter()
      .on('body', {
        element(element) {
          element.append(
            '<script src="/assets/js/contact-enhancements.js?v=20260731-3" defer></script>',
            { html: true }
          );
        }
      })
      .transform(freshResponse);
  }
};
