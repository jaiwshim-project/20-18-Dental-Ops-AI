const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = async (req, res) => {
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('[clinic-register] 환경 변수 체크:', {
    NEXT_PUBLIC_SUPABASE_URL: hasUrl ? process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30) : 'MISSING',
    SUPABASE_SERVICE_ROLE_KEY: hasKey ? 'SET' : 'MISSING',
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('NEXT_PUBLIC')).join(',')
  });

  if (!hasUrl || !hasKey) {
    console.error('[clinic-register] 환경 변수 미설정!', {
      url: hasUrl,
      key: hasKey,
      NODE_ENV: process.env.NODE_ENV
    });
    return res.status(500).json({ error: '서버 환경 변수 미설정', debug: { hasUrl, hasKey } });
  }

  // Vercel UTF-8 인코딩 명시
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(Buffer.from(body, 'utf8').toString('utf8'));
    } catch (e) {
      body = req.body;
    }
  }
  let { clinicName, directorName, directorEmail, directorPhone, region, password } = body;

  // 🔧 한글 인코딩 처리 (latin1 → utf8)
  const decodeKorean = (str) => {
    if (!str || /[^\x00-\x7F]/.test(str)) {
      try {
        return Buffer.from(str, 'latin1').toString('utf8');
      } catch (e) {
        return str;
      }
    }
    return str;
  };

  clinicName = decodeKorean(clinicName);
  directorName = decodeKorean(directorName);
  region = decodeKorean(region);

  console.log('[clinic-register] 한글 인코딩 처리:', {
    clinicName,
    clinicNameHex: Buffer.from(clinicName).toString('hex'),
    directorName,
    region
  });

  if (!clinicName?.trim() || !directorName?.trim() || !directorEmail?.trim() || !directorPhone?.trim() || !region?.trim() || !password) {
    return res.status(400).json({ error: '모든 필드가 필요합니다' });
  }

  // 이메일 형식 검증
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(directorEmail.trim())) {
    return res.status(400).json({ error: '유효한 이메일 주소를 입력하세요' });
  }

  if (!/^\d{6}$/.test(password)) {
    return res.status(400).json({ error: '비밀번호는 숫자 6자리여야 합니다' });
  }

  try {
    const passwordHash = sha256(password);

    const { data: existing, error: existError } = await supabase
      .from('clinics')
      .select('id')
      .eq('name', clinicName.trim())
      .maybeSingle();

    if (existError) throw new Error(`중복 확인: ${existError.message}`);
    if (existing) return res.status(409).json({ error: '이미 등록된 병원명입니다' });

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .insert([{
        name: clinicName.trim(),
        director_name: directorName.trim(),
        region: region.trim(),
        password_hash: passwordHash,
        password_plain: password,
        tier: 'free'
      }])
      .select()
      .single();

    if (clinicError) throw new Error(`병원 등록: ${clinicError.message}`);

    // 대표원장을 users 테이블에 추가
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{
        clinic_id: clinic.id,
        email: directorEmail.trim(),
        name: directorName.trim(),
        phone: directorPhone.trim(),
        role: '원장',
        is_admin: true
      }])
      .select()
      .single();

    if (userError) throw new Error(`사용자 등록: ${userError.message}`);

    res.status(201).json({
      success: true,
      clinicId: clinic.id,
      userId: user.id,
      message: '병원 회원가입이 완료되었습니다. 로그인해주세요.'
    });

  } catch (error) {
    console.error('[clinic-register]', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
