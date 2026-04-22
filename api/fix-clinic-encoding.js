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

    console.log('[fix-clinic-encoding] 1️⃣ 모든 clinic 조회');

    // 모든 clinic 조회
    const { data: allClinics, error: listError } = await sb
      .from('clinics')
      .select('*');

    if (listError) throw listError;

    console.log('[fix-clinic-encoding] 조회된 clinic:', allClinics?.length || 0);

    const correctName = '디지털스마일치과';
    const correctPasswordHash = sha256('036323');

    // 각 clinic 확인 및 수정
    const fixes = [];

    for (const clinic of allClinics || []) {
      const nameHex = Buffer.from(clinic.name).toString('hex');
      const correctHex = Buffer.from(correctName).toString('hex');

      console.log(`[fix-clinic-encoding] clinic "${clinic.name}":`, {
        currentHex: nameHex,
        expectedHex: correctHex,
        match: nameHex === correctHex
      });

      // 이름이 잘못되었거나 비밀번호가 잘못된 경우 수정
      if (clinic.name !== correctName || clinic.password_hash !== correctPasswordHash) {
        console.log(`[fix-clinic-encoding] 수정 필요: ${clinic.id}`);

        const { error: updateError } = await sb
          .from('clinics')
          .update({
            name: correctName,
            password_hash: correctPasswordHash
          })
          .eq('id', clinic.id);

        if (updateError) {
          console.error(`[fix-clinic-encoding] 수정 오류:`, updateError.message);
          fixes.push({
            id: clinic.id,
            name: clinic.name,
            status: '❌ 수정 실패',
            error: updateError.message
          });
        } else {
          console.log(`[fix-clinic-encoding] ✅ 수정 완료: ${clinic.id}`);
          fixes.push({
            id: clinic.id,
            name: clinic.name,
            status: '✅ 수정 완료',
            newName: correctName
          });
        }
      } else {
        console.log(`[fix-clinic-encoding] ✅ 이미 올바름: ${clinic.id}`);
        fixes.push({
          id: clinic.id,
          name: clinic.name,
          status: '✅ 이미 올바름'
        });
      }
    }

    // 결과 반환
    return res.status(200).json({
      success: true,
      message: 'clinic 인코딩 확인 및 수정 완료',
      correctName,
      correctPassword: '036323',
      corrections: fixes,
      summary: {
        total: allClinics?.length || 0,
        fixed: fixes.filter(f => f.status === '✅ 수정 완료').length,
        correct: fixes.filter(f => f.status === '✅ 이미 올바름').length
      }
    });

  } catch (e) {
    console.error('[fix-clinic-encoding] ❌ 예외:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
