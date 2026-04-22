const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'No env' });

  let clinicName = req.body?.clinicName || '';
  const email = (req.body?.email || '').trim();
  const password = req.body?.password || '';

  if (clinicName && /[^\x00-\x7F]/.test(clinicName)) {
    try {
      clinicName = Buffer.from(clinicName, 'latin1').toString('utf8');
    } catch (e) {}
  }

  clinicName = clinicName.trim();

  if (!clinicName || !email || !/^\d{6}$/.test(password)) {
    return res.status(400).json({ error: 'missing fields' });
  }

  try {
    const sb = createClient(url, key);

    console.log('[/api/login] 요청 데이터:', { clinicName, email, pwdLength: password.length });

    // ✅ clinicName으로 병원 찾기
    const { data: clinic, error: cErr } = await sb
      .from('clinics')
      .select('*')
      .eq('name', clinicName)
      .maybeSingle();

    console.log('[/api/login] clinic 조회:', { found: !!clinic, error: cErr?.message });

    if (cErr) throw new Error(`clinic: ${cErr.message}`);
    if (!clinic) {
      console.warn('[/api/login] ❌ clinic not found:', clinicName);
      return res.status(401).json({ error: 'clinic not found' });
    }

    console.log('[/api/login] clinic 정보:', { id: clinic.id, name: clinic.name, hasPasswordHash: !!clinic.password_hash });

    const hash = sha256(password);
    console.log('[/api/login] 비밀번호 검증:', { inputHash: hash, storedHash: clinic.password_hash, match: clinic.password_hash === hash });

    if (clinic.password_hash !== hash) {
      console.warn('[/api/login] ❌ password mismatch for clinic:', clinicName);
      return res.status(401).json({ error: 'password mismatch' });
    }

    console.log('[/api/login] ✅ 비밀번호 일치');

    // user 조회
    const { data: user, error: uErr } = await sb
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('clinic_id', clinic.id)
      .maybeSingle();

    console.log('[/api/login] user 조회:', { found: !!user, error: uErr?.message });

    if (uErr) throw new Error(`user: ${uErr.message}`);

    let userData = user;
    if (!user) {
      console.log('[/api/login] 새 user 생성 중...');
      const { data: nu, error: nErr } = await sb
        .from('users')
        .insert([{
          email,
          name: email.split('@')[0],
          clinic_id: clinic.id,
          role: '상담실장',
          is_admin: false,
          last_login_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (nErr) {
        console.error('[/api/login] ❌ user insert 실패:', nErr.message);
        throw new Error(`insert: ${nErr.message}`);
      }
      userData = nu;
      console.log('[/api/login] ✅ user 생성 완료:', userData.id);
    } else {
      console.log('[/api/login] 기존 user 업데이트 중...');
      const { error: uuErr } = await sb
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);

      if (uuErr) throw new Error(`update: ${uuErr.message}`);
      console.log('[/api/login] ✅ user 업데이트 완료');
    }

    console.log('[/api/login] ✅✅✅ 로그인 성공:', { clinic_id: clinic.id, user_id: userData.id, email });

    return res.status(200).json({
      success: true,
      userId: userData.id,
      name: userData.name || email.split('@')[0],
      email,
      role: userData.role || '상담실장',
      clinic: clinic.name,
      clinic_id: clinic.id,
      tier: clinic.tier || 'free',
      is_admin: userData.is_admin || false
    });

  } catch (e) {
    console.error('[/api/login] ❌ 예외 발생:', e.message, e.stack);
    return res.status(500).json({ error: e.message });
  }
};
