export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      let database = 'unavailable';

      try {
        const result = await env.DB.prepare('SELECT 1 AS ok').first();
        database = result?.ok === 1 ? 'connected' : 'unavailable';
      } catch (error) {
        database = 'error';
      }

      return Response.json({
        ok: database === 'connected',
        service: 'becoming-training-center-website',
        database
      }, {
        status: database === 'connected' ? 200 : 503,
        headers: {
          'Cache-Control': 'no-store'
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
