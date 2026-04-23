const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'No env' });

  const { clinicName, newPassword } = req.body || {};

  console.log('[update-clinic-password] 요청:', { clinicName, newPassword: newPassword ? '입력됨' : '없음' });

  if (!clinicName || !newPassword || !/^\d{6}$/.test(newPassword)) {
    return res.status(400).json({ error: '병원명과 6자리 숫자 비밀번호 필요' });
  }

  try {
    const sb = createClient(url, key);

    // 병원 찾기
    const { data: clinic, error: clinicErr } = await sb
      .from('clinics')
      .select('*')
      .eq('name', clinicName.trim())
      .maybeSingle();

    if (clinicErr) throw new Error(`clinic lookup: ${clinicErr.message}`);
    if (!clinic) return res.status(404).json({ error: 'clinic not found' });

    // 비밀번호 해시 생성 및 업데이트
    const passwordHash = sha256(newPassword);
    console.log('[update-clinic-password] 해시 계산:', {
      input: newPassword,
      hash: passwordHash.substring(0, 16) + '...'
    });

    const { error: updateErr } = await sb
      .from('clinics')
      .update({ password_hash: passwordHash })
      .eq('id', clinic.id);

    if (updateErr) throw new Error(`update failed: ${updateErr.message}`);

    console.log('[update-clinic-password] ✅ 완료:', { clinic_id: clinic.id, clinic_name: clinic.name });

    return res.status(200).json({
      success: true,
      message: `"${clinic.name}" 병원의 비밀번호가 ${newPassword}로 설정되었습니다`
    });

  } catch (e) {
    console.error('[update-clinic-password] ❌', e.message);
    return res.status(500).json({ error: e.message });
  }
};
