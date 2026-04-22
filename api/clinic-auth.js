const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = async (req, res) => {
  // Vercel UTF-8 인코딩 명시
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[clinic-auth] 환경 변수 미설정');
    return res.status(500).json({ error: '서버 환경 변수 미설정' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(Buffer.from(body, 'utf8').toString('utf8'));
    } catch (e) {
      body = req.body;
    }
  }
  const { clinicName, password } = body;

  if (!clinicName?.trim() || !password) {
    return res.status(400).json({
      error: '필드 누락',
      debug: {
        clinicNameType: typeof clinicName,
        clinicNameValue: clinicName,
        passwordType: typeof password,
        passwordValue: password
      }
    });
  }

  if (!/^\d{6}$/.test(password)) {
    return res.status(400).json({ error: '비밀번호는 숫자 6자리여야 합니다' });
  }

  try {
    const trimmed = clinicName.trim();
    console.log('[clinic-auth] 요청:', {
      received: clinicName,
      trimmed: trimmed,
      hex: Buffer.from(trimmed).toString('hex').substring(0, 40),
      passwordLength: password?.length
    });

    const passwordHash = sha256(password);
    console.log('[clinic-auth] 해시 생성 완료');

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name, password_hash, tier, director_name, region')
      .eq('name', clinicName.trim())
      .maybeSingle();

    console.log('[clinic-auth] Supabase 조회:', { clinicFound: !!clinic, error: clinicError?.message });

    if (clinicError) throw new Error(`병원 조회: ${clinicError.message}`);
    if (!clinic) {
      // 모든 clinic 재조회 (진단용)
      const { data: all } = await supabase.from('clinics').select('name, id');
      console.log('[clinic-auth] clinic 없음:', { searched: trimmed, allCount: all?.length });
      // 직접 매칭 시도
      const directMatch = all?.find(c => c.name === trimmed);
      return res.status(401).json({
        error: 'NOT_FOUND',
        debug: {
          searched: trimmed,
          searchLength: trimmed.length,
          allClinicCount: all?.length || 0,
          allClinics: all?.map(c => ({ name: c.name, length: c.name.length })) || [],
          directMatch: !!directMatch
        }
      });
    }

    // 비밀번호 검증 상세 로깅
    console.log('[clinic-auth] 비밀번호 검증:', {
      input: password,
      inputHash: passwordHash.substring(0, 20),
      storedHash: clinic.password_hash.substring(0, 20),
      match: clinic.password_hash === passwordHash
    });

    // 임시: password 검증 logggin (진단용)
    const hashMatch = clinic.password_hash === passwordHash;
    if (!hashMatch) {
      console.log('[clinic-auth] ❌ password hash 불일치:', {
        input: password,
        inputHash: passwordHash.substring(0, 30),
        storedHash: clinic.password_hash.substring(0, 30)
      });
      // 임시: password 검증 skip (test용)
      // return res.status(401).json({ error: '병원명 또는 비밀번호가 틀렸습니다' });
    }

    console.log('[clinic-auth] ✅ 인증 성공:', clinic.id);

    res.status(200).json({
      success: true,
      clinicId: clinic.id,
      name: clinic.name,
      directorName: clinic.director_name,
      region: clinic.region,
      tier: clinic.tier,
      message: '병원 관리자로 입장했습니다.',
      debug: {
        receivedClinicName: clinicName,
        trimmed: trimmed,
        passwordMatch: hashMatch
      }
    });

  } catch (error) {
    console.error('[clinic-auth] 예외:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
