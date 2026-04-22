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

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: '병원 ID가 필요합니다' });
  }

  try {
    const { data: clinic, error } = await supabase
      .from('clinics')
      .select('id, name, director_name, region, tier, created_at')
      .eq('id', id)
      .single();

    // password 필드는 별도로 조회 시도 (스키마에 있으면 추가)
    if (clinic) {
      try {
        const { data: pwdData } = await supabase
          .from('clinics')
          .select('password')
          .eq('id', id)
          .single();
        if (pwdData?.password) clinic.password = pwdData.password;
      } catch (e) {
        // password 필드가 없거나 조회 실패 - 무시
      }
    }

    if (error) throw error;
    if (!clinic) return res.status(404).json({ error: '병원을 찾을 수 없습니다' });

    res.status(200).json(clinic);
  } catch (error) {
    console.error('[clinic-info]', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
