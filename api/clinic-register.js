// ============================================================
// POST /api/clinic-register — 병원 회원가입
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clinicName, directorName, region, password } = req.body;

  // 유효성 검사
  if (!clinicName?.trim() || !directorName?.trim() || !region?.trim() || !password) {
    return res.status(400).json({ error: '모든 필드가 필요합니다' });
  }

  // 비밀번호 6자리 숫자 검증
  if (!/^\d{6}$/.test(password)) {
    return res.status(400).json({ error: '비밀번호는 숫자 6자리여야 합니다' });
  }

  try {
    // 비밀번호 해시
    const passwordHash = await sha256(password);

    // 병원명 중복 확인
    const { data: existing } = await supabase
      .from('clinics')
      .select('id')
      .eq('name', clinicName.trim())
      .single();

    if (existing) {
      return res.status(409).json({ error: '이미 등록된 병원명입니다' });
    }

    // clinics 테이블에 INSERT
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .insert([{
        name: clinicName.trim(),
        director_name: directorName.trim(),
        region: region.trim(),
        password_hash: passwordHash,
        tier: 'free'
      }])
      .select()
      .single();

    if (clinicError) throw clinicError;

    // users 테이블에 대표원장 정보 추가
    // (나중에 로그인할 때 생성되도록 하는 게 나을 수 있음)

    return res.status(201).json({
      success: true,
      clinicId: clinic.id,
      message: '병원 회원가입이 완료되었습니다. 로그인해주세요.'
    });

  } catch (error) {
    console.error('Clinic register error:', error);
    return res.status(500).json({ error: error.message });
  }
}
