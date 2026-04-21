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

  const { clinicId, tier } = req.body;

  if (!clinicId || !tier) {
    return res.status(400).json({ error: '병원 ID와 요금제가 필요합니다' });
  }

  if (!['free', 'pro', 'max'].includes(tier)) {
    return res.status(400).json({ error: '유효하지 않은 요금제입니다' });
  }

  try {
    const { error } = await supabase
      .from('clinics')
      .update({ tier })
      .eq('id', clinicId);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: '요금제가 변경되었습니다'
    });
  } catch (error) {
    console.error('[change-tier]', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
