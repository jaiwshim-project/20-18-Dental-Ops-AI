const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(500).json({ error: 'No env' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = req.body;
    }
  }

  const email = (body?.email || '').trim();
  const password = (body?.password || '').trim();

  if (!email || !password || !/^\d{6}$/.test(password)) {
    return res.status(400).json({ error: 'missing fields' });
  }

  try {
    const sb = createClient(url, key);

    // EMAIL로 USER 조회
    const { data: user, error: userErr } = await sb
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (userErr) throw new Error(`user: ${userErr.message}`);
    if (!user) return res.status(401).json({ error: 'user not found' });

    // CLINIC 조회
    const { data: clinic, error: clinicErr } = await sb
      .from('clinics')
      .select('*')
      .eq('id', user.clinic_id)
      .maybeSingle();

    if (clinicErr) throw new Error(`clinic: ${clinicErr.message}`);
    if (!clinic) return res.status(401).json({ error: 'clinic not found' });

    // 비밀번호 검증
    const hash = sha256(password);
    if (clinic.password_hash !== hash) {
      return res.status(401).json({ error: 'password mismatch' });
    }

    // LAST LOGIN 업데이트
    await sb
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)
      .catch(() => {});

    return res.status(200).json({
      success: true,
      userId: user.id,
      name: user.name || email.split('@')[0],
      email,
      role: user.role || '상담실장',
      clinic: clinic.name,
      clinic_id: clinic.id,
      tier: clinic.tier || 'free',
      is_admin: user.is_admin || false
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
