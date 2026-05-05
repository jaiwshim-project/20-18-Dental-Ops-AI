const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'No env' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch {}
  }

  const { clinic_id, patient_lang, staff_lang, messages, started_at, ended_at } = body || {};

  if (!patient_lang || !staff_lang || !Array.isArray(messages)) {
    return res.status(400).json({ error: '필수 파라미터 누락' });
  }

  try {
    const sb = createClient(url, key);
    const { error } = await sb.from('translate_logs').insert({
      clinic_id: clinic_id || null,
      patient_lang,
      staff_lang,
      messages,
      started_at: started_at || new Date().toISOString(),
      ended_at: ended_at || new Date().toISOString()
    });

    if (error) throw new Error(error.message);
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
