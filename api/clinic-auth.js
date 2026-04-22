const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = async (req, res) => {
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

  const { clinicName, password } = req.body;

  if (!clinicName?.trim() || !password) {
    return res.status(400).json({ error: '모든 필드가 필요합니다' });
  }

  if (!/^\d{6}$/.test(password)) {
    return res.status(400).json({ error: '비밀번호는 숫자 6자리여야 합니다' });
  }

  try {
    console.log('[clinic-auth] 요청:', { clinicName, passwordLength: password?.length });

    const passwordHash = sha256(password);
    console.log('[clinic-auth] 해시 생성 완료');

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name, password_hash, tier, director_name, region')
      .eq('name', clinicName.trim())
      .maybeSingle();

    console.log('[clinic-auth] Supabase 조회:', { clinicFound: !!clinic, error: clinicError?.message });

    if (clinicError) throw new Error(`병원 조회: ${clinicError.message}`);
    if (!clinic) return res.status(401).json({ error: '병원명 또는 비밀번호가 틀렸습니다' });

    if (clinic.password_hash !== passwordHash) {
      console.log('[clinic-auth] 비밀번호 불일치');
      return res.status(401).json({ error: '병원명 또는 비밀번호가 틀렸습니다' });
    }

    console.log('[clinic-auth] 인증 성공:', clinic.id);

    res.status(200).json({
      success: true,
      clinicId: clinic.id,
      name: clinic.name,
      directorName: clinic.director_name,
      region: clinic.region,
      tier: clinic.tier,
      message: '병원 관리자로 입장했습니다.'
    });

  } catch (error) {
    console.error('[clinic-auth] 예외:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
