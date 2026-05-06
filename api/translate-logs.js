const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'No env' });

  const { clinic_id, limit = '20', offset = '0' } = req.query;
  if (!clinic_id) return res.status(400).json({ error: 'clinic_id 필요' });

  try {
    const sb = createClient(url, key);
    const { data, error, count } = await sb
      .from('translate_logs')
      .select('id, patient_lang, staff_lang, messages, started_at, ended_at', { count: 'exact' })
      .eq('clinic_id', clinic_id)
      .order('started_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw new Error(error.message);
    return res.status(200).json({ logs: data || [], total: count || 0 });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
