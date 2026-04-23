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

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = req.body;
    }
  }

  let clinicName = body?.clinicName || '';
  const email = (body?.email || '').trim();
  const password = body?.password || '';

  console.log('[/api/login] 원본 clinicName:', {
    value: clinicName,
    type: typeof clinicName,
    length: clinicName.length,
    hex: Buffer.from(clinicName).toString('hex'),
    hasNonASCII: clinicName && /[^\x00-\x7F]/.test(clinicName)
  });

  // 한글 인코딩 처리 (Vercel latin1 변환)
  if (clinicName && /[^\x00-\x7F]/.test(clinicName)) {
    console.log('[/api/login] 한글 감지, 인코딩 복구 시도');
    try {
      // Vercel이 latin1로 송수신하는 경우 처리
      const buf = Buffer.from(clinicName, 'utf8');
      const decoded = buf.toString('utf8');
      // 또는 explicit latin1 처리
      const asLatin1 = Buffer.from(clinicName, 'latin1').toString('utf8');
      clinicName = asLatin1;
      console.log('[/api/login] ✅ 한글 복구:', clinicName);
    } catch (e) {
      console.warn('[/api/login] 한글 복구 실패:', e.message);
    }
  }

  clinicName = clinicName.trim();

  console.log('[/api/login] 최종 clinicName:', {
    value: clinicName,
    length: clinicName.length,
    hex: Buffer.from(clinicName).toString('hex')
  });

  if (!clinicName || !email || !/^\d{6}$/.test(password)) {
    return res.status(400).json({ error: 'missing fields' });
  }

  try {
    const sb = createClient(url, key);

    console.log('[/api/login] 요청 데이터:', { clinicName, email, pwdLength: password.length });

    // ✅ 1단계: email로 먼저 user 찾기 (한글 인코딩 문제 우회)
    console.log('[/api/login] 1️⃣ email로 user 검색:', email);

    const { data: user, error: userErr } = await sb
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (userErr) {
      console.error('[/api/login] user 조회 오류:', userErr.message);
      throw new Error(`user lookup: ${userErr.message}`);
    }

    let clinic = null;
    let resolvedClinicId = null;

    if (user) {
      // email로 찾은 user가 있으면, user의 clinic_id 사용
      console.log('[/api/login] ✅ user 찾음, clinic_id:', user.clinic_id);
      resolvedClinicId = user.clinic_id;

      const { data: foundClinic, error: clinicErr } = await sb
        .from('clinics')
        .select('*')
        .eq('id', user.clinic_id)
        .maybeSingle();

      if (clinicErr) throw new Error(`clinic lookup: ${clinicErr.message}`);
      clinic = foundClinic;
    } else {
      // email로 못 찾으면, clinicName으로 검색 (시스템 호환성)
      console.log('[/api/login] email로 못 찾음, clinicName으로 검색:', clinicName);

      const { data: allClinics, error: listErr } = await sb
        .from('clinics')
        .select('*');

      if (listErr) {
        console.error('[/api/login] clinic 목록 조회 오류:', listErr.message);
        throw new Error(`clinic list: ${listErr.message}`);
      }

      const normalizedSearch = clinicName.toLowerCase().trim();
      clinic = allClinics?.find(c =>
        c.name === clinicName ||
        c.name.toLowerCase().trim() === normalizedSearch
      );

      if (!clinic) {
        console.warn('[/api/login] ❌ clinic not found:', clinicName);
        return res.status(401).json({
          error: 'clinic not found',
          debug: {
            searchedFor: clinicName,
            storedClinics: (allClinics || []).map(c => ({
              name: c.name,
              id: c.id
            }))
          }
        });
      }

      resolvedClinicId = clinic.id;
    }

    // ✅ 2단계: 비밀번호 검증
    console.log('[/api/login] 2️⃣ clinic 비밀번호 검증');
    const hash = sha256(password);
    console.log('[/api/login] 비밀번호 해시 매칭:', {
      inputHash: hash.substring(0, 20) + '...',
      storedHash: clinic.password_hash?.substring(0, 20) + '...',
      match: clinic.password_hash === hash
    });

    if (clinic.password_hash !== hash) {
      console.warn('[/api/login] ❌ password mismatch');
      return res.status(401).json({ error: 'password mismatch' });
    }

    console.log('[/api/login] ✅ 비밀번호 일치');

    // ✅ 3단계: user 처리
    let userData = user;

    if (!user) {
      // user가 없으면 새로 생성
      console.log('[/api/login] 새 user 생성 중...');
      const { data: nu, error: nErr } = await sb
        .from('users')
        .insert([{
          email,
          name: email.split('@')[0],
          clinic_id: resolvedClinicId,
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
      // 기존 user 업데이트
      console.log('[/api/login] 기존 user 업데이트 중...');
      const { error: uuErr } = await sb
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);

      if (uuErr) throw new Error(`update: ${uuErr.message}`);
      console.log('[/api/login] ✅ user 업데이트 완료');
    }

    console.log('[/api/login] ✅ 로그인 성공:', { clinic_id: resolvedClinicId, user_id: userData.id, email });

    // clinic 정보 조회 (이미 있으면 사용, 없으면 다시 조회)
    const selectedClinic = clinic || (await sb
      .from('clinics')
      .select('*')
      .eq('id', resolvedClinicId)
      .single()).data;

    return res.status(200).json({
      success: true,
      userId: userData.id,
      name: userData.name || email.split('@')[0],
      email,
      role: userData.role || '상담실장',
      clinic: selectedClinic?.name || clinic.name,
      clinic_id: resolvedClinicId,  // ✅ resolvedClinicId 사용
      tier: selectedClinic?.tier || clinic.tier || 'free',
      is_admin: userData.is_admin || false
    });

  } catch (e) {
    console.error('[/api/login] ❌ 예외 발생:', e.message, e.stack);
    return res.status(500).json({ error: e.message });
  }
};
// Force rebuild 04a6550a
