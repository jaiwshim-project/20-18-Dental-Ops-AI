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

    console.log('[test-create-clinic] 테스트 clinic 처리 시작:', {
      name: testClinic.name,
      nameHex: Buffer.from(testClinic.name).toString('hex')
    });

    // 1️⃣ 모든 clinic 조회
    console.log('[test-create-clinic] 1️⃣ 모든 clinic 조회 중...');
    const { data: allClinics, error: listError } = await sb
      .from('clinics')
      .select('id, name');

    if (listError) {
      throw new Error(`조회 오류: ${listError.message}`);
    }

    console.log('[test-create-clinic] 조회된 clinic 수:', allClinics?.length || 0);
    if (allClinics && allClinics.length > 0) {
      console.log('[test-create-clinic] clinic 목록:', allClinics.map(c => ({
        id: c.id,
        name: c.name,
        hex: Buffer.from(c.name).toString('hex')
      })));
    }

    // 2️⃣ 정확한 이름 또는 정규화된 이름으로 기존 clinic 찾기
    console.log('[test-create-clinic] 2️⃣ 기존 clinic 검색 중...');
    const normalizedSearch = testClinic.name.toLowerCase().trim();

    let existingClinic = null;
    if (allClinics) {
      existingClinic = allClinics.find(c =>
        c.name === testClinic.name ||
        c.name.toLowerCase().trim() === normalizedSearch
      );
    }

    if (existingClinic) {
      console.log('[test-create-clinic] ✅ clinic 이미 존재:', existingClinic.id);

      // 기존 clinic의 이름을 올바르게 업데이트
      if (existingClinic.name !== testClinic.name) {
        console.log('[test-create-clinic] 3️⃣ clinic 이름 업데이트 중...');
        const { error: updateError } = await sb
          .from('clinics')
          .update({ name: testClinic.name })
          .eq('id', existingClinic.id);

        if (updateError) {
          console.error('[test-create-clinic] 이름 업데이트 오류:', updateError.message);
        } else {
          console.log('[test-create-clinic] ✅ clinic 이름 업데이트 완료');
        }
      }

      return res.status(200).json({
        success: true,
        message: 'clinic 준비 완료',
        clinic: {
          id: existingClinic.id,
          name: testClinic.name
        },
        testData: {
          name: '디지털스마일치과',
          email: 'digitalsmiledc@gmail.com',
          password: '036323'
        }
      });
    }

    // 3️⃣ clinic이 없으면 생성
    console.log('[test-create-clinic] 3️⃣ clinic 생성 중...');
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

    // 4️⃣ 테스트 user 생성
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
    } else {
      console.log('[test-create-clinic] ✅ user 생성 완료:', user.id);
    }

    return res.status(200).json({
      success: true,
      message: '✅ clinic 준비 완료',
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
