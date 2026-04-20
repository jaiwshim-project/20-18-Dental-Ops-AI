// Vercel Edge Runtime — Gemini 프록시 (Dental Ops AI SaaS)
// Cold Start <100ms, 본사 GEMINI_API_KEY 서버 보관
//
// ① Auth 검증 (Bearer token or user_email)
// ② Rate Limit (tier별 월 한도)
// ③ 호출 로그 (api_call_logs)

export const config = { runtime: 'edge' };

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro'
]);
const TIER_LIMITS = { free: 3, pro: 20, max: 60 };

const json = (obj, init = 200) =>
  new Response(JSON.stringify(obj), {
    status: typeof init === 'number' ? init : init.status || 200,
    headers: { 'Content-Type': 'application/json' }
  });

export default async function handler(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  const key = process.env.GEMINI_API_KEY;

  if (req.method === 'GET') {
    return json({
      ok: !!key,
      runtime: 'edge',
      default_model: DEFAULT_MODEL,
      allowed_models: Array.from(ALLOWED_MODELS),
      tier_limits: TIER_LIMITS,
      supabase_configured: !!(SUPABASE_URL && SUPABASE_KEY)
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Allow': 'GET, POST' }
    });
  }

  if (!key) {
    return json({ error: '서버에 GEMINI_API_KEY가 등록되지 않았습니다.' }, 500);
  }

  let body;
  try { body = await req.json(); }
  catch { return json({ error: '잘못된 JSON 본문' }, 400); }

  const { prompt, imageBase64, model, user_email, engine } = body || {};
  if (!prompt || typeof prompt !== 'string') {
    return json({ error: 'prompt 필드가 필요합니다' }, 400);
  }
  const MODEL = (model && ALLOWED_MODELS.has(model)) ? model : DEFAULT_MODEL;
  const t0 = Date.now();

  // 1. Auth + Rate Limit
  let user = null;
  let rateLimitInfo = null;

  if (SUPABASE_URL && SUPABASE_KEY) {
    let email = null;
    const authHeader = req.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { Authorization: authHeader, apikey: SUPABASE_KEY }
        });
        if (r.ok) { const au = await r.json(); email = au.email; }
      } catch {}
    }
    if (!email && user_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user_email)) {
      email = user_email;
    }
    if (!email) return json({ error: '로그인이 필요합니다' }, 401);

    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,email,name,clinic,tier,is_admin&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const arr = await r.json();
      if (!Array.isArray(arr) || !arr.length) {
        return json({ error: '등록된 사용자가 아닙니다. 로그인 후 이용하세요.' }, 403);
      }
      user = arr[0];
    } catch (e) {
      return json({ error: 'users 조회 실패: ' + e.message }, 500);
    }

    if (!user.is_admin) {
      const tier = user.tier || 'free';
      const limit = TIER_LIMITS[tier] || TIER_LIMITS.free;
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      try {
        const r = await fetch(
          `${SUPABASE_URL}/rest/v1/api_call_logs?user_id=eq.${user.id}&created_at=gte.${monthStart.toISOString()}&select=id`,
          {
            headers: {
              apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
              Prefer: 'count=exact', Range: '0-0'
            }
          }
        );
        const range = r.headers.get('content-range') || '*/0';
        const count = parseInt(range.split('/')[1]) || 0;
        rateLimitInfo = { tier, used: count, limit };
        if (count >= limit) {
          const next = new Date(monthStart);
          next.setUTCMonth(next.getUTCMonth() + 1);
          return json({
            error: `월 사용 한도 초과 (${tier.toUpperCase()} ${count}/${limit}회). 다음 달 ${next.toISOString().slice(0,10)}에 초기화됩니다.`,
            tier, used: count, limit,
            reset_on: next.toISOString().slice(0, 10)
          }, 429);
        }
      } catch {}
    }
  }

  // 2. Gemini 호출
  let statusCode = 200;
  let text = '';
  let errMsg = null;

  try {
    const parts = [];
    if (imageBase64) {
      const b64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      parts.push({ inline_data: { mime_type: 'image/jpeg', data: b64 } });
    }
    parts.push({ text: prompt });

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) }
    );
    statusCode = r.status;
    if (!r.ok) {
      try { const eb = await r.json(); errMsg = eb.error?.message || 'Gemini API 오류'; }
      catch { errMsg = 'Gemini API 오류'; }
    } else {
      const data = await r.json();
      text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
  } catch (e) {
    statusCode = 500;
    errMsg = e.message || 'Gemini 프록시 실패';
  }

  const latency = Date.now() - t0;

  // 3. 로그 저장
  if (user && SUPABASE_URL && SUPABASE_KEY) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/api_call_logs`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          user_id: user.id, email: user.email, clinic: user.clinic,
          endpoint: 'gemini', model: MODEL,
          prompt_chars: prompt.length, response_chars: text.length,
          status_code: statusCode, latency_ms: latency,
          metadata: { engine: engine || 'generic', error: errMsg || null }
        })
      });
    } catch {}
  }

  if (errMsg) return json({ error: errMsg, model: MODEL }, statusCode);
  return json({
    text,
    model: MODEL,
    ...(rateLimitInfo && { usage: rateLimitInfo })
  });
}
