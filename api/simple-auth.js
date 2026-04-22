const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'ENV NOT SET' });

  const { clinicName, password } = req.body;

  if (!clinicName || !password) {
    return res.status(400).json({ error: 'Missing fields', clinicName, password });
  }

  try {
    const supabase = createClient(url, key);
    const trimmed = clinicName.trim();
    const hash = sha256(password);

    // Step 1: Find clinic
    const { data: clinic } = await supabase
      .from('clinics')
      .select('id, name, password_hash, tier, director_name, region')
      .eq('name', trimmed)
      .maybeSingle();

    if (!clinic) {
      return res.status(401).json({
        error: 'Clinic not found',
        searched: trimmed,
        clinicName: clinicName
      });
    }

    // Step 2: Check password
    if (clinic.password_hash !== hash) {
      return res.status(401).json({
        error: 'Password mismatch',
        clinicFound: true,
        passwordMatch: false
      });
    }

    // Step 3: Success
    return res.status(200).json({
      success: true,
      message: 'Authenticated',
      clinicId: clinic.id,
      name: clinic.name,
      tier: clinic.tier
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
