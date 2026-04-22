const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(500).json({ error: 'No env' });
  }

  try {
    const sb = createClient(url, key);

    // 모든 clinic 조회
    const { data: clinics, error } = await sb
      .from('clinics')
      .select('*');

    if (error) throw error;

    console.log('[debug-clinics] 조회된 clinic 수:', clinics?.length || 0);

    // 각 clinic의 상세 정보
    const details = (clinics || []).map(c => ({
      id: c.id,
      name: c.name,
      nameHex: Buffer.from(c.name).toString('hex'),
      nameLength: c.name.length,
      hasPassword: !!c.password_hash,
      passwordHash: c.password_hash?.substring(0, 16) + '...',
      tier: c.tier,
      createdAt: c.created_at
    }));

    console.log('[debug-clinics] clinic 목록:', details);

    return res.status(200).json({
      success: true,
      count: clinics?.length || 0,
      clinics: details
    });

  } catch (e) {
    console.error('[debug-clinics] 에러:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
