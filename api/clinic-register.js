const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = async (req, res) => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[clinic-register] 환경 변수 미설정', {
      url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });
    return res.status(500).json({ error: '서버 환경 변수 미설정' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clinicName, directorName, region, password } = req.body;

  if (!clinicName?.trim() || !directorName?.trim() || !region?.trim() || !password) {
    return res.status(400).json({ error: '모든 필드가 필요합니다' });
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
        tier: 'free'
      }])
      .select()
      .single();

    if (clinicError) throw new Error(`병원 등록: ${clinicError.message}`);

    res.status(201).json({
      success: true,
      clinicId: clinic.id,
      message: '병원 회원가입이 완료되었습니다. 로그인해주세요.'
    });

  } catch (error) {
    console.error('[clinic-register]', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
