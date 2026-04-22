const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1시간 캐시

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
      .select('id, name, director_name, region')
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);

    return res.status(200).json({
      success: true,
      clinics: clinics || []
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
