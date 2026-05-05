const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // 캐시 비활성화

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'POST only' });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'No env' });

  try {
    const sb = createClient(url, key);

    const { data: clinics, error } = await sb
      .from('clinics')
      .select('id, name, director_name, region, tier, created_at, password_plain')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    console.log('[/api/clinics] ✅ 병원 목록 조회:', clinics?.length || 0, '개');

    return res.status(200).json({
      success: true,
      clinics: clinics || []
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
