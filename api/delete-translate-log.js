const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'DELETE only' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id 필요' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'No env' });

  try {
    const sb = createClient(url, key);
    const { error } = await sb.from('translate_logs').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
