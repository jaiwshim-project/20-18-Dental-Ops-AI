const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(500).json({ error: 'No env' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const sb = createClient(url, key);

    const testData = {
      clinicName: '디지털스마일치과',
      directorEmail: 'digitalsmiledc@gmail.com',
      password: '036323'
    };

    console.log('[reset-and-create-clinic] 강제 재생성 시작');

    // 1️⃣ 모든 clinic 삭제
    console.log('[reset-and-create-clinic] 1️⃣ 기존 clinic 모두 삭제');
    const { error: delErr } = await sb.from('clinics').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delErr && delErr.message !== 'No rows found') {
      console.warn('[reset-and-create-clinic] 삭제 경고:', delErr.message);
    }

    // 2️⃣ 새 clinic 생성
    console.log('[reset-and-create-clinic] 2️⃣ 새 clinic 생성');
    const { data: clinic, error: createErr } = await sb
      .from('clinics')
      .insert([{
        name: testData.clinicName,
        director_name: '김재우',
        region: '서울',
        password_hash: sha256(testData.password),
        tier: 'free'
      }])
      .select()
      .single();

    if (createErr) {
      console.error('[reset-and-create-clinic] clinic 생성 실패:', createErr.message);
      throw createErr;
    }

    console.log('[reset-and-create-clinic] ✅ clinic 생성:', {
      id: clinic.id,
      name: clinic.name,
      nameHex: Buffer.from(clinic.name).toString('hex')
    });

    // 3️⃣ 새 user 생성
    console.log('[reset-and-create-clinic] 3️⃣ 새 user 생성');
    const { data: user, error: userErr } = await sb
      .from('users')
      .insert([{
        email: testData.directorEmail,
        name: '김재우',
        clinic_id: clinic.id,
        role: '대표원장',
        is_admin: true,
        last_login_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (userErr) {
      console.error('[reset-and-create-clinic] user 생성 실패:', userErr.message);
      throw userErr;
    }

    console.log('[reset-and-create-clinic] ✅ user 생성:', user.id);

    // 4️⃣ 검증
    console.log('[reset-and-create-clinic] 4️⃣ 검증');
    const { data: verifyClinic } = await sb
      .from('clinics')
      .select('*')
      .eq('id', clinic.id)
      .single();

    const { data: verifyUser } = await sb
      .from('users')
      .select('*')
      .eq('email', testData.directorEmail)
      .single();

    console.log('[reset-and-create-clinic] ✅ 검증 완료');
    console.log('[reset-and-create-clinic] 최종 clinic:', {
      id: verifyClinic?.id,
      name: verifyClinic?.name,
      nameHex: verifyClinic?.name ? Buffer.from(verifyClinic.name).toString('hex') : 'N/A'
    });
    console.log('[reset-and-create-clinic] 최종 user:', {
      id: verifyUser?.id,
      email: verifyUser?.email,
      clinic_id: verifyUser?.clinic_id
    });

    return res.status(200).json({
      success: true,
      message: '✅ clinic 및 user 강제 재생성 완료',
      clinic: {
        id: clinic.id,
        name: clinic.name
      },
      user: {
        id: user.id,
        email: user.email
      },
      testData: {
        clinicName: testData.clinicName,
        email: testData.directorEmail,
        password: testData.password
      }
    });

  } catch (e) {
    console.error('[reset-and-create-clinic] ❌ 예외:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
