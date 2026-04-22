const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const clinicName = '디지털스마일치과';
  const password = '036323';
  const email = 'admin@digitalsmile.com';

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return res.status(500).json({ error: 'ENV NOT SET' });
    }

    const supabase = createClient(url, key);

    // Step 1: Get all clinics
    const { data: allClinics } = await supabase.from('clinics').select('id, name, password_hash').limit(10);
    console.log('Step 1: allClinics count:', allClinics?.length);

    // Step 2: Find clinic
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, password_hash, tier')
      .eq('name', clinicName)
      .maybeSingle();

    console.log('Step 2: clinic found:', !!clinic, clinicError?.message);
    if (!clinic) {
      return res.status(401).json({
        error: 'CLINIC NOT FOUND',
        searched: clinicName,
        allClinics: allClinics.map(c => c.name)
      });
    }

    // Step 3: Check password
    const inputHash = sha256(password);
    const storedHash = clinic.password_hash;
    const hashMatch = inputHash === storedHash;

    console.log('Step 3: password check');
    console.log('  input:', password);
    console.log('  inputHash:', inputHash);
    console.log('  storedHash:', storedHash);
    console.log('  match:', hashMatch);

    if (!hashMatch) {
      return res.status(401).json({
        error: 'PASSWORD MISMATCH',
        inputHash,
        storedHash,
        clinicId: clinic.id
      });
    }

    // Step 4: Get/create user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .eq('email', email)
      .eq('clinic_id', clinic.id)
      .maybeSingle();

    console.log('Step 4: user found:', !!user, userError?.message);

    return res.status(200).json({
      success: true,
      message: 'ALL CHECKS PASSED',
      clinic: { id: clinic.id.substring(0, 8), tier: clinic.tier },
      user: user ? { id: user.id.substring(0, 8) } : null
    });

  } catch (e) {
    console.error('ERROR:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
