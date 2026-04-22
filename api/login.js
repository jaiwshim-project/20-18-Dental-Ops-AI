const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: '서버 환경 변수 미설정' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { clinicName, email, password } = req.body;

  if (!clinicName?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: '모든 필드가 필요합니다' });
  }

  if (!/^\d{6}$/.test(password)) {
    return res.status(400).json({ error: '비밀번호는 숫자 6자리여야 합니다' });
  }

  try {
    // 고정 clinic ID (한글 인코딩 문제 우회)
    const CLINIC_ID = '1242772f-622d-4c2f-a2ec-16bfa11a5444';

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, password_hash, tier')
      .eq('id', CLINIC_ID)
      .maybeSingle();

    if (clinicError) throw new Error(`병원 조회: ${clinicError.message}`);
    if (!clinic) return res.status(401).json({ error: '병원명 또는 비밀번호가 틀렸습니다' });

    const passwordHash = sha256(password);

    if (clinic.password_hash !== passwordHash) {
      return res.status(401).json({ error: '병원명 또는 비밀번호가 틀렸습니다' });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, role, is_admin')
      .eq('email', email.trim())
      .eq('clinic_id', clinic.id)
      .maybeSingle();

    if (userError) throw new Error(`직원 조회: ${userError.message}`);

    let userData = user;
    if (!user) {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          email: email.trim(),
          name: email.trim().split('@')[0],
          clinic_id: clinic.id,
          role: '상담실장',
          is_admin: false,
          last_login_at: new Date().toISOString()
        }])
        .select('id, name, role, is_admin')
        .single();

      if (insertError) throw new Error(`직원 등록: ${insertError.message}`);
      userData = newUser;
    } else {
      const { error: updateError } = await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) throw new Error(`로그인 업데이트: ${updateError.message}`);
    }

    res.status(200).json({
      success: true,
      userId: userData.id,
      name: userData.name,
      email: email.trim(),
      role: userData.role,
      clinic: '디지털스마일치과',
      clinic_id: clinic.id,
      tier: clinic.tier,
      is_admin: userData.is_admin || false
    });

  } catch (error) {
    console.error('[login]', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
