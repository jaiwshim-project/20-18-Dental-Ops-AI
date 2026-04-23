const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST method required' });
  }

  const { clinic_id: clinicId, tier } = req.body;

  if (!clinicId || !tier) {
    return res.status(400).json({ error: '병원 ID와 요금제가 필요합니다' });
  }

  if (!['free', 'pro', 'max'].includes(tier)) {
    return res.status(400).json({ error: '유효하지 않은 요금제입니다' });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Server config error' });

  try {
    const supabase = createClient(url, key);

    console.log('[change-tier] 요금제 변경 시작:', { clinicId, tier });

    // 병원 존재 확인
    const { data: clinic, error: checkError } = await supabase
      .from('clinics')
      .select('id, name, tier')
      .eq('id', clinicId);

    if (checkError) throw checkError;
    if (!clinic || clinic.length === 0) {
      return res.status(404).json({ error: '병원을 찾을 수 없습니다' });
    }

    const oldTier = clinic[0].tier;
    console.log('[change-tier] 현재 요금제:', oldTier, '→ 변경할 요금제:', tier);

    // 요금제 업데이트
    const { data: updated, error: updateError } = await supabase
      .from('clinics')
      .update({ tier })
      .eq('id', clinicId)
      .select();

    if (updateError) throw updateError;

    console.log('[change-tier] ✅ 요금제 변경 완료:', { clinicId, oldTier, newTier: tier, updated });

    res.status(200).json({
      success: true,
      message: '요금제 변경 완료',
      clinic: updated && updated.length > 0 ? updated[0] : null
    });

  } catch (error) {
    console.error('[change-tier] Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
