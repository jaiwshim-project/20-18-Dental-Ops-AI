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

  const { clinicId, directorName, region } = req.body;

  if (!clinicId || !directorName?.trim() || !region?.trim()) {
    return res.status(400).json({ error: '필수 필드가 누락되었습니다' });
  }

  try {
    const { error } = await supabase
      .from('clinics')
      .update({
        director_name: directorName.trim(),
        region: region.trim()
      })
      .eq('id', clinicId);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: '병원 정보가 업데이트되었습니다'
    });
  } catch (error) {
    console.error('[update-clinic]', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
