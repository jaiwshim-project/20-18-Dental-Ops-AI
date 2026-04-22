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
    return res.status(500).json({ error: '서버 환경 변수 미설정' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { clinicId, password } = req.body;

  if (!clinicId || !password) {
    return res.status(400).json({ error: '필수 필드가 누락되었습니다' });
  }

  if (!/^\d{6}$/.test(password)) {
    return res.status(400).json({ error: '비밀번호는 숫자 6자리여야 합니다' });
  }

  try {
    const passwordHash = sha256(password);

    const { error } = await supabase
      .from('clinics')
      .update({ password_hash: passwordHash, password })
      .eq('id', clinicId);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: '비밀번호가 변경되었습니다'
    });
  } catch (error) {
    console.error('[update-clinic-password]', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
