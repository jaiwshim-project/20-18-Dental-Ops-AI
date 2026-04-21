const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: '서버 환경 변수 미설정' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { id: clinicId } = req.query;

  if (!clinicId) {
    return res.status(400).json({ error: '병원 ID가 필요합니다' });
  }

  try {
    const { data: staff, error } = await supabase
      .from('users')
      .select('id, name, email, phone, role, created_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json(staff || []);
  } catch (error) {
    console.error('[clinic-staff]', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
