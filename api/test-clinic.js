const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  console.log('[test-clinic] 환경 변수 확인');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('URL 있는지:', !!url);
  console.log('KEY 있는지:', !!key);

  if (!url || !key) {
    return res.status(500).json({ error: 'ENV NOT SET', hasUrl: !!url, hasKey: !!key });
  }

  try {
    const supabase = createClient(url, key);
    console.log('[test-clinic] Supabase 클라이언트 생성');

    // 모든 clinic 조회
    const { data: allClinics, error: allError } = await supabase
      .from('clinics')
      .select('id, name, password_hash')
      .limit(10);

    if (allError) {
      console.error('[test-clinic] 전체 clinic 조회 실패:', allError);
      return res.status(500).json({ error: 'Query failed', details: allError.message });
    }

    console.log(`[test-clinic] 조회된 clinic: ${allClinics.length}개`);

    // 디지털스마일치과 찾기
    const target = allClinics.find(c => c.name === '디지털스마일치과');

    res.status(200).json({
      success: true,
      allClinicCount: allClinics.length,
      allClinics: allClinics.map(c => ({ id: c.id.substring(0, 8), name: c.name })),
      targetFound: !!target,
      target: target ? { id: target.id.substring(0, 8), name: target.name } : null
    });

  } catch (e) {
    console.error('[test-clinic] 예외:', e.message);
    res.status(500).json({ error: e.message });
  }
};
