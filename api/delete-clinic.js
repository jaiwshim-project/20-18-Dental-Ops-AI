const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'No env' });

  const { clinicId } = req.body;
  if (!clinicId) {
    return res.status(400).json({ error: 'clinicId required' });
  }

  try {
    const sb = createClient(url, key);

    console.log('[/api/delete-clinic] 시작. clinicId:', clinicId);

    // 1단계: 해당 clinic의 모든 users 삭제
    console.log('[/api/delete-clinic] 1️⃣ users 삭제 중...');
    const { error: usersErr } = await sb
      .from('users')
      .delete()
      .eq('clinic_id', clinicId);

    if (usersErr) {
      console.error('[/api/delete-clinic] ❌ users 삭제 실패:', usersErr);
      throw new Error(`users 삭제 실패: ${usersErr.message}`);
    }
    console.log('[/api/delete-clinic] ✅ users 삭제 완료');

    // 2단계: clinic 삭제
    console.log('[/api/delete-clinic] 2️⃣ clinic 삭제 중...');
    const { error: clinicErr } = await sb
      .from('clinics')
      .delete()
      .eq('id', clinicId);

    if (clinicErr) {
      console.error('[/api/delete-clinic] ❌ clinic 삭제 실패:', clinicErr);
      throw new Error(`clinic 삭제 실패: ${clinicErr.message}`);
    }
    console.log('[/api/delete-clinic] ✅ clinic 삭제 완료');

    return res.status(200).json({
      success: true,
      message: '병원이 삭제되었습니다',
      clinicId
    });

  } catch (e) {
    console.error('[/api/delete-clinic] ❌ 예외:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
