const { createClient } = require('@supabase/supabase-js');

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

  const { clinicId, name, email, phone, role } = req.body;

  if (!clinicId || !name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: '필수 필드가 누락되었습니다' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .insert([{
        clinic_id: clinicId,
        name: name.trim(),
        email: email.trim(),
        phone: phone?.trim() || null,
        role: role || '직원',
        is_admin: false
      }])
      .select()
      .single();

    if (error) throw new Error(`직원 추가 실패: ${error.message}`);

    res.status(201).json({
      success: true,
      user,
      message: '직원이 추가되었습니다'
    });
  } catch (error) {
    console.error('[add-staff]', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
