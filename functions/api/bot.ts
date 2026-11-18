interface Env {
  DB: D1Database;
  RENDER_BOT_URL?: string;
  VITE_RENDER_BOT_URL?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);

  let botUrl = (env.RENDER_BOT_URL || env.VITE_RENDER_BOT_URL || '').trim();
  let source = 'env';

  // If not configured in Cloudflare Pages env vars, check dynamic URL in Cloudflare D1
  if ((!botUrl || botUrl.includes('mizodeals-whatsapp-bot.onrender.com')) && env.DB) {
    try {
      const row: any = await env.DB.prepare("SELECT value FROM bot_auth WHERE key = 'bot_url.json'").first();
      if (row && row.value) {
        const parsed = JSON.parse(row.value);
        if (parsed.url && typeof parsed.url === 'string') {
          botUrl = parsed.url.trim();
          source = 'd1_dynamic';
        }
      }
    } catch (e) {
      // Non-blocking fallback
    }
  }

  // Fallback to default
  if (!botUrl) {
    botUrl = 'https://mizodeals-whatsapp-bot.onrender.com';
    source = 'fallback_default';
  }

  const cleanBase = botUrl.replace(/\/+$/, '');
  const action = url.searchParams.get('action') || url.searchParams.get('path') || '';
  const redirectTarget = action ? `${cleanBase}/${action.replace(/^\/+/, '')}` : cleanBase;

  // JSON diagnostic response
  if (url.searchParams.has('json')) {
    return new Response(
      JSON.stringify({
        success: true,
        botUrl: cleanBase,
        redirectTarget,
        resolutionSource: source,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      }
    );
  }

  // 302 Redirect to the live running bot instance
  return Response.redirect(redirectTarget, 302);
};
