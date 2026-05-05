const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');

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

  const clinic_id = body?.clinic_id;
  const password = (body?.password || '').trim();

  if (!clinic_id || !/^\d{6}$/.test(password)) {
    return res.status(400).json({ error: '병원 ID와 6자리 숫자 비밀번호 필요' });
  }

  try {
    const sb = createClient(url, key);
    const { data: clinic, error } = await sb
      .from('clinics')
      .select('id, password_hash')
      .eq('id', clinic_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!clinic) return res.status(404).json({ error: '병원 없음' });

    const match = clinic.password_hash === sha256(password);
    if (!match) return res.status(401).json({ error: '비밀번호 불일치' });

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
