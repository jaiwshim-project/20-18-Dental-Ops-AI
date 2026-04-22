const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Auth-New', 'CLAUDE-20250422');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 한글 복구
  if (req.body?.clinicName && /[^\x00-\x7F]/.test(req.body.clinicName)) {
    try {
      req.body.clinicName = Buffer.from(req.body.clinicName, 'latin1').toString('utf8');
    } catch (e) {}
  }

  const { clinicName, email, password } = req.body;

  if (!clinicName?.trim() || !email?.trim() || !password || !/^\d{6}$/.test(password)) {
    return res.status(400).json({ error: '필드 오류' });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 고정 clinic ID로 조회
    const { data: clinic } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', '1242772f-622d-4c2f-a2ec-16bfa11a5444')
      .maybeSingle();

    if (!clinic) {
      return res.status(401).json({ error: '병원 없음' });
    }

    const inputHash = sha256(password);
    if (clinic.password_hash !== inputHash) {
      return res.status(401).json({ 
        error: '비밀번호 불일치',
        inputHash: inputHash.substring(0, 8),
        storedHash: clinic.password_hash ? clinic.password_hash.substring(0, 8) : 'null'
      });
    }

    // 직원 조회/생성
    const { data: user } = await supabase
      .from('users')
      .select('id, name, role, is_admin')
      .eq('email', email.trim())
      .eq('clinic_id', clinic.id)
      .maybeSingle();

    let userData = user;
    if (!user) {
      const { data: newUser } = await supabase
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
      userData = newUser;
    } else {
      await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);
    }

    return res.status(200).json({
      success: true,
      userId: userData.id,
      name: userData.name || email.split('@')[0],
      email: email.trim(),
      role: userData.role || '상담실장',
      clinic: clinic.name || '디지털스마일치과',
      clinic_id: clinic.id,
      tier: clinic.tier || 'free',
      is_admin: userData.is_admin || false
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
