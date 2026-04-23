const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const sb = createClient(url, key);

    // 테스트 병원 목록
    const testClinics = [
      {
        name: '디지털스마일치과',
        director_name: '김재우',
        region: '서울 강남',
        password_hash: sha256('036323'),
        tier: 'free'
      },
      {
        name: '프리미엄치과',
        director_name: '이영희',
        region: '서울 강북',
        password_hash: sha256('123456'),
        tier: 'free'
      },
      {
        name: '메드보치과',
        director_name: '박준호',
        region: '부산',
        password_hash: sha256('111111'),
        tier: 'free'
      }
    ];

    console.log('[create-test-clinic] 테스트 병원 생성 시작...');

    // 기존 clinic 확인
    const { data: existing } = await sb
      .from('clinics')
      .select('name');

    const existingNames = new Set((existing || []).map(c => c.name));
    console.log('[create-test-clinic] 기존 clinic:', existingNames);

    // 새로운 clinic만 추가
    const toCreate = testClinics.filter(c => !existingNames.has(c.name));

    if (toCreate.length === 0) {
      return res.status(200).json({
        message: 'Test clinics already exist',
        existingClinics: Array.from(existingNames)
      });
    }

    const { data: created, error } = await sb
      .from('clinics')
      .insert(toCreate)
      .select();

    if (error) {
      console.error('[create-test-clinic] 생성 실패:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('[create-test-clinic] ✅ 생성 성공:', created?.length);

    return res.status(201).json({
      message: 'Test clinics created successfully',
      created: (created || []).map(c => ({
        id: c.id,
        name: c.name,
        director: c.director_name,
        region: c.region,
        password: '(해당하는 테스트 비밀번호 참고)'
      })),
      testPasswords: {
        '디지털스마일치과': '036323',
        '프리미엄치과': '123456',
        '메드보치과': '111111'
      }
    });

  } catch (err) {
    console.error('[create-test-clinic] 에러:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
