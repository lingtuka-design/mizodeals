interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, message: 'DB not bound' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS bot_auth (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    ).run();

    const rows = await env.DB.prepare('SELECT key, value FROM bot_auth').all();
    const data: Record<string, string> = {};
    if (rows.results) {
      for (const r of rows.results as any[]) {
        data[r.key] = r.value;
      }
    }

    return new Response(JSON.stringify({ success: true, files: data }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, message: 'DB not bound' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: any = await request.json();
    const files = body.files as Record<string, string>;
    if (!files || typeof files !== 'object') {
      return new Response(JSON.stringify({ success: false, message: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS bot_auth (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    ).run();

    const stmt = env.DB.prepare(
      'INSERT INTO bot_auth (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    );

    const batch = [];
    const now = Date.now();
    for (const [key, value] of Object.entries(files)) {
      batch.push(stmt.bind(key, value, now));
    }

    if (batch.length > 0) {
      await env.DB.batch(batch);
    }

    return new Response(JSON.stringify({ success: true, count: batch.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
