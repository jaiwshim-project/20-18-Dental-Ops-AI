const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(500).json({ error: 'No env' });
  }

  // req.body 안전하게 파싱
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = req.body;
    }
  }

  const email = (body?.email || '').trim();
  const password = (body?.password || '').trim();
  let clinicName = (body?.clinicName || '').trim();

  console.log('[LOGIN] 요청:', { email, passwordLen: password?.length, clinicName });

  if (!email || !password || !/^\d{6}$/.test(password)) {
    return res.status(400).json({ error: 'missing fields' });
  }

  try {
    const sb = createClient(url, key);

    // 1️⃣ EMAIL로 USER 조회 (한글 인코딩 무관)
    console.log('[LOGIN] Step 1: EMAIL 검색');
    const { data: user, error: userErr } = await sb
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (userErr) {
      console.error('[LOGIN] USER 조회 실패:', userErr.message);
      throw new Error(`user: ${userErr.message}`);
    }

    if (!user) {
      console.warn('[LOGIN] EMAIL로 USER 못찾음:', email);
      return res.status(401).json({ error: 'user not found' });
    }

    console.log('[LOGIN] ✅ USER 찾음:', { clinic_id: user.clinic_id });

    // 2️⃣ CLINIC ID로 CLINIC 조회
    console.log('[LOGIN] Step 2: CLINIC 검색');
    const { data: clinic, error: clinicErr } = await sb
      .from('clinics')
      .select('*')
      .eq('id', user.clinic_id)
      .maybeSingle();

    if (clinicErr) {
      console.error('[LOGIN] CLINIC 조회 실패:', clinicErr.message);
      throw new Error(`clinic: ${clinicErr.message}`);
    }

    if (!clinic) {
      console.error('[LOGIN] CLINIC 못찾음:', user.clinic_id);
      return res.status(401).json({ error: 'clinic not found' });
    }

    console.log('[LOGIN] ✅ CLINIC 찾음:', clinic.name);

    // 3️⃣ 비밀번호 검증
    console.log('[LOGIN] Step 3: 비밀번호 검증');
    const hash = sha256(password);
    const matches = clinic.password_hash === hash;

    console.log('[LOGIN] 해시 비교:', {
      input: hash.substring(0, 20),
      stored: clinic.password_hash?.substring(0, 20),
      matches
    });

    if (!matches) {
      console.warn('[LOGIN] 비밀번호 불일치');
      return res.status(401).json({ error: 'password mismatch' });
    }

    console.log('[LOGIN] ✅ 비밀번호 일치');

    // 4️⃣ LAST LOGIN 업데이트
    sb.from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)
      .then(() => {})
      .catch(() => {});

    // ✅ SUCCESS
    console.log('[LOGIN] ✅✅✅ 로그인 성공!');
    return res.status(200).json({
      success: true,
      userId: user.id,
      name: user.name || email.split('@')[0],
      email,
      role: user.role || '상담실장',
      clinic: clinic.name,
      clinic_id: clinic.id,
      tier: clinic.tier || 'free',
      is_admin: user.is_admin || false
    });

  } catch (e) {
    console.error('[LOGIN] 예외:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
