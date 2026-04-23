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

  console.log('[/api/login] 원본 clinicName:', {
    value: clinicName,
    type: typeof clinicName,
    length: clinicName.length,
    hex: Buffer.from(clinicName).toString('hex'),
    hasNonASCII: clinicName && /[^\x00-\x7F]/.test(clinicName)
  });

  // 한글 인코딩 처리
  if (clinicName && /[^\x00-\x7F]/.test(clinicName)) {
    console.log('[/api/login] 한글 감지, latin1 → utf8 변환 시도');
    try {
      const decoded = Buffer.from(clinicName, 'latin1').toString('utf8');
      console.log('[/api/login] 변환 결과:', {
        before: clinicName,
        after: decoded,
        beforeHex: Buffer.from(clinicName).toString('hex'),
        afterHex: Buffer.from(decoded).toString('hex')
      });
      clinicName = decoded;
    } catch (e) {
      console.warn('[/api/login] 변환 실패:', e.message);
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

    // ✅ 1단계: clinicName으로 clinic 찾기
    console.log('[/api/login] 1️⃣ clinic 검색 시작:',{
      searchTerm: clinicName,
      searchTermHex: Buffer.from(clinicName).toString('hex'),
      searchNormalized: clinicName.toLowerCase().trim()
    });

    const { data: allClinics, error: listErr } = await sb
      .from('clinics')
      .select('*');

    if (listErr) {
      console.error('[/api/login] clinic 목록 조회 오류:', listErr.message);
      throw new Error(`clinic list: ${listErr.message}`);
    }

    console.log('[/api/login] 📊 저장된 clinic:', allClinics?.map(c => ({
      id: c.id,
      name: c.name,
      nameHex: Buffer.from(c.name).toString('hex'),
      nameNormalized: c.name.toLowerCase().trim()
    })));

    const normalizedSearch = clinicName.toLowerCase().trim();
    let clinic = null;

    if (allClinics && allClinics.length > 0) {
      // 정확한 매칭 또는 정규화 매칭
      clinic = allClinics.find(c => {
        const isExactMatch = c.name === clinicName;
        const isNormalizedMatch = c.name.toLowerCase().trim() === normalizedSearch;
        console.log(`[/api/login] 매칭 확인: "${c.name}" vs "${clinicName}" => exact:${isExactMatch}, normalized:${isNormalizedMatch}`);
        return isExactMatch || isNormalizedMatch;
      });
    }

    if (!clinic) {
      console.warn('[/api/login] ❌ clinic not found:', clinicName);
      console.warn('[/api/login] 저장된 clinic 정보:', allClinics);

      // 디버그 정보를 응답에 포함
      return res.status(401).json({
        error: 'clinic not found',
        debug: {
          searchedFor: clinicName,
          storedClinics: (allClinics || []).map(c => ({
            name: c.name,
            hex: Buffer.from(c.name).toString('hex'),
            id: c.id
          }))
        }
      });
    }

    console.log('[/api/login] ✅ clinic 찾음:', {
      id: clinic.id,
      name: clinic.name
    });

    console.log('[/api/login] clinic 정보:', { id: clinic.id, name: clinic.name, hasPasswordHash: !!clinic.password_hash });

    const hash = sha256(password);
    console.log('[/api/login] 비밀번호 검증:', { inputHash: hash, storedHash: clinic.password_hash, match: clinic.password_hash === hash });

    if (clinic.password_hash !== hash) {
      console.warn('[/api/login] ❌ password mismatch for clinic:', clinicName);
      return res.status(401).json({ error: 'password mismatch' });
    }

    console.log('[/api/login] ✅ 비밀번호 일치');

    // user 조회 (clinic에서 찾기)
    const { data: user, error: uErr } = await sb
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('clinic_id', clinic.id)
      .maybeSingle();

    console.log('[/api/login] clinic.id로 user 조회:', { found: !!user, error: uErr?.message });

    if (uErr) throw new Error(`user: ${uErr.message}`);

    let userData = user;
    let resolvedClinicId = clinic.id;  // ✅ clinic에서 찾은 user 사용

    if (!user) {
      console.log('[/api/login] clinic에서 user 못 찾음, email로 직원 조회 시도...');
      // 직원이 clinic명을 모르고 로그인한 경우, email로 직원 찾기
      const { data: staffUser, error: staffErr } = await sb
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (staffErr) throw new Error(`user lookup: ${staffErr.message}`);

      if (staffUser) {
        console.log('[/api/login] ✅ email로 직원 찾음:', { id: staffUser.id, clinic_id: staffUser.clinic_id });
        userData = staffUser;
        resolvedClinicId = staffUser.clinic_id;  // ✅ 직원의 clinic_id 사용
      } else {
        // 새 user 생성 (기존 로직 유지)
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
      }
    } else {
      console.log('[/api/login] 기존 user 업데이트 중...');
      const { error: uuErr } = await sb
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);

      if (uuErr) throw new Error(`update: ${uuErr.message}`);
      console.log('[/api/login] ✅ user 업데이트 완료');
    }

    console.log('[/api/login] ✅✅✅ 로그인 성공:', { clinic_id: resolvedClinicId, user_id: userData.id, email });

    // Supabase에서 clinic 정보 조회 (clinic_id로)
    const { data: selectedClinic } = await sb
      .from('clinics')
      .select('*')
      .eq('id', resolvedClinicId)
      .single();

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
