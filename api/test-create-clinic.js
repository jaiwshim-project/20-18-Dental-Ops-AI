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

    // 테스트 clinic 데이터
    const testClinic = {
      name: '디지털스마일치과',
      director_name: '김재우',
      region: '서울',
      password_hash: sha256('036323'),
      tier: 'free'
    };

    console.log('[test-create-clinic] 테스트 clinic 생성 시도:', testClinic.name);

    // 기존 clinic 확인
    const { data: existing, error: checkError } = await sb
      .from('clinics')
      .select('id, name')
      .eq('name', testClinic.name)
      .maybeSingle();

    if (checkError) {
      console.error('[test-create-clinic] 확인 오류:', checkError.message);
      throw new Error(`확인 오류: ${checkError.message}`);
    }

    if (existing) {
      console.log('[test-create-clinic] ✅ clinic 이미 존재:', existing.id);
      return res.status(200).json({
        success: true,
        message: '테스트 clinic이 이미 존재합니다',
        clinic: existing,
        testData: {
          name: testClinic.name,
          email: 'digitalsmiledc@gmail.com',
          password: '036323'
        }
      });
    }

    // clinic 생성
    const { data: clinic, error: insertError } = await sb
      .from('clinics')
      .insert([testClinic])
      .select()
      .single();

    if (insertError) {
      console.error('[test-create-clinic] 생성 오류:', insertError.message);
      throw new Error(`생성 오류: ${insertError.message}`);
    }

    console.log('[test-create-clinic] ✅ clinic 생성 완료:', clinic.id);

    // 테스트 user 생성
    const { data: user, error: userError } = await sb
      .from('users')
      .insert([{
        email: 'digitalsmiledc@gmail.com',
        name: '김재우',
        clinic_id: clinic.id,
        role: '대표원장',
        is_admin: true,
        last_login_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (userError) {
      console.error('[test-create-clinic] user 생성 오류:', userError.message);
      // user 생성 실패해도 clinic은 생성됨
    } else {
      console.log('[test-create-clinic] ✅ user 생성 완료:', user.id);
    }

    return res.status(200).json({
      success: true,
      message: '✅ 테스트 clinic 생성 완료',
      clinic: {
        id: clinic.id,
        name: clinic.name
      },
      testData: {
        name: '디지털스마일치과',
        email: 'digitalsmiledc@gmail.com',
        password: '036323'
      }
    });

  } catch (e) {
    console.error('[test-create-clinic] ❌ 예외 발생:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
