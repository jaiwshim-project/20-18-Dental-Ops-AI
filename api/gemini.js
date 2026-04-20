// Vercel Serverless Function — Gemini 프록시 (SaaS 운영 완비형)
// 본사 GEMINI_API_KEY를 서버에서만 보관, 모든 치과가 공동 사용
//
// 제공 기능:
//   ① Auth 검증  — Supabase Bearer 토큰 or body.user_email로 사용자 식별
//   ② Rate Limit — 월별 tier 한도 (Free 3 / Pro 20 / Max 60)
//   ③ 호출 로그  — api_call_logs 테이블에 프롬프트/응답 길이, 지연, 에러 기록
//
// 요청 body: { prompt, imageBase64?, model?, user_email?, engine? }
// GET 응답: 키/환경변수 등록 여부 + tier 정보
// POST 응답 (성공): { text, model, usage: { tier, used, limit } }
// POST 응답 (한도 초과): 429 { error, tier, used, limit, reset_on }

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro'
]);
const TIER_LIMITS = { free: 3, pro: 20, max: 60 };

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: !!process.env.GEMINI_API_KEY,
      default_model: DEFAULT_MODEL,
      allowed_models: Array.from(ALLOWED_MODELS),
      tier_limits: TIER_LIMITS,
      supabase_configured: !!(SUPABASE_URL && SUPABASE_KEY)
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: '서버에 GEMINI_API_KEY가 등록되지 않았습니다. 관리자에게 문의하세요.'
    });
  }

  const { prompt, imageBase64, model, user_email, engine } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt 필드가 필요합니다' });
  }
  const MODEL = model && ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
  const t0 = Date.now();

  // ============================================================
  // 1. Auth 검증 + Rate Limit 체크 (SUPABASE 환경변수 있을 때만)
  // ============================================================
  let user = null;
  let rateLimitInfo = null;

  if (SUPABASE_URL && SUPABASE_KEY) {
    let email = null;

    // Bearer 토큰 먼저 시도
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY }
        });
        if (r.ok) {
          const au = await r.json();
          email = au.email;
        }
      } catch {}
    }

    // Body user_email fallback (간편 로그인용)
    if (!email && user_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user_email)) {
      email = user_email;
    }

    if (!email) {
      return res.status(401).json({ error: '로그인이 필요합니다' });
    }

    // users 조회
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,email,name,clinic,tier,is_admin&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const arr = await r.json();
      if (!Array.isArray(arr) || !arr.length) {
        return res.status(403).json({ error: '등록된 사용자가 아닙니다. 로그인 후 이용하세요.' });
      }
      user = arr[0];
    } catch (e) {
      return res.status(500).json({ error: 'users 조회 실패: ' + e.message });
    }

    // Rate Limit 체크 (is_admin은 제외)
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
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              Prefer: 'count=exact',
              Range: '0-0'
            }
          }
        );
        const range = r.headers.get('content-range') || '*/0';
        const count = parseInt(range.split('/')[1]) || 0;
        rateLimitInfo = { tier, used: count, limit };

        if (count >= limit) {
          const next = new Date(monthStart);
          next.setUTCMonth(next.getUTCMonth() + 1);
          return res.status(429).json({
            error: `월 사용 한도 초과 (${tier.toUpperCase()} ${count}/${limit}회). 다음 달 ${next.toISOString().slice(0,10)}에 초기화됩니다.`,
            tier, used: count, limit,
            reset_on: next.toISOString().slice(0, 10)
          });
        }
      } catch (e) {
        console.warn('Rate Limit 체크 실패 — 호출은 허용', e);
      }
    }
  }

  // ============================================================
  // 2. Gemini 호출
  // ============================================================
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
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      }
    );
    statusCode = r.status;
    if (!r.ok) {
      try {
        const eb = await r.json();
        errMsg = eb.error?.message || 'Gemini API 오류';
      } catch { errMsg = 'Gemini API 오류'; }
    } else {
      const data = await r.json();
      text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
  } catch (e) {
    statusCode = 500;
    errMsg = e.message || 'Gemini 프록시 실패';
  }

  const latency = Date.now() - t0;

  // ============================================================
  // 3. 호출 로그 기록 (과금 추적 + Rate Limit 카운트)
  // ============================================================
  if (user && SUPABASE_URL && SUPABASE_KEY) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/api_call_logs`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email,
          clinic: user.clinic,
          endpoint: 'gemini',
          model: MODEL,
          prompt_chars: prompt.length,
          response_chars: text.length,
          status_code: statusCode,
          latency_ms: latency,
          metadata: { engine: engine || 'generic', error: errMsg || null }
        })
      });
    } catch (e) {
      console.warn('로그 저장 실패 (무시)', e);
    }
  }

  if (errMsg) {
    return res.status(statusCode).json({ error: errMsg, model: MODEL });
  }
  return res.status(200).json({
    text,
    model: MODEL,
    ...(rateLimitInfo && { usage: rateLimitInfo })
  });
}
