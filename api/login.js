const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = async (req, res) => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[login] 환경 변수 미설정', {
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

  const { clinicName, email, password } = req.body;

  if (!clinicName?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: '모든 필드가 필요합니다' });
  }

  if (!/^\d{6}$/.test(password)) {
    return res.status(400).json({ error: '비밀번호는 숫자 6자리여야 합니다' });
  }

  try {
    console.log('[login] 요청:', { clinicName, email, passwordLength: password?.length });

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, password_hash, tier')
      .eq('name', clinicName.trim())
      .maybeSingle();

    console.log('[login] Supabase 조회:', { found: !!clinic, error: clinicError?.message });
    if (clinic) {
      console.log('[login] 병원 데이터:', { id: clinic.id, hashLength: clinic.password_hash?.length });
    }

    if (clinicError) throw new Error(`병원 조회: ${clinicError.message}`);
    if (!clinic) return res.status(401).json({ error: '병원명 또는 비밀번호가 틀렸습니다' });

    const passwordHash = sha256(password);
    console.log('[login] 비밀번호 검증:', {
      inputHash: passwordHash,
      storedHash: clinic.password_hash,
      match: passwordHash === clinic.password_hash
    });

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
      clinic: clinicName.trim(),
      clinic_id: clinic.id,
      tier: clinic.tier,
      is_admin: userData.is_admin || false
    });

  } catch (error) {
    console.error('[login]', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
