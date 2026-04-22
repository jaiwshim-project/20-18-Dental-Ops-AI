const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'No env' });

  let clinicName = req.body?.clinicName || '';
  const email = (req.body?.email || '').trim();
  const password = req.body?.password || '';

  if (clinicName && /[^\x00-\x7F]/.test(clinicName)) {
    try {
      clinicName = Buffer.from(clinicName, 'latin1').toString('utf8');
    } catch (e) {}
  }

  clinicName = clinicName.trim();

  if (!clinicName || !email || !/^\d{6}$/.test(password)) {
    return res.status(400).json({ error: 'missing fields' });
  }

  try {
    const sb = createClient(url, key);
    const CLINIC_ID = '1242772f-622d-4c2f-a2ec-16bfa11a5444';
    
    const { data: clinic, error: cErr } = await sb
      .from('clinics')
      .select('*')
      .eq('id', CLINIC_ID)
      .maybeSingle();

    if (cErr) throw new Error(`clinic: ${cErr.message}`);
    if (!clinic) return res.status(401).json({ error: 'clinic not found' });

    const hash = sha256(password);
    if (clinic.password_hash !== hash) {
      return res.status(401).json({ error: 'password mismatch' });
    }

    const { data: user, error: uErr } = await sb
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('clinic_id', clinic.id)
      .maybeSingle();

    if (uErr) throw new Error(`user: ${uErr.message}`);

    let userData = user;
    if (!user) {
      const { data: nu, error: nErr } = await sb
        .from('users')
        .insert([{
          email,
          name: email.split('@')[0],
          clinic_id: clinic.id,
          role: '상담실장',
          is_admin: false,
          last_login_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (nErr) throw new Error(`insert: ${nErr.message}`);
      userData = nu;
    } else {
      const { error: uuErr } = await sb
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);

      if (uuErr) throw new Error(`update: ${uuErr.message}`);
    }

    return res.status(200).json({
      success: true,
      userId: userData.id,
      name: userData.name || email.split('@')[0],
      email,
      role: userData.role || '상담실장',
      clinic: clinic.name,
      clinic_id: clinic.id,
      tier: clinic.tier || 'free',
      is_admin: userData.is_admin || false
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
