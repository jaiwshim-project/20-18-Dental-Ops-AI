const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: '서버 환경 변수 미설정' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { staff_id: staffId, clinic_id: clinicId } = req.query;

  console.log('[staff-info] 요청:', { staffId, clinicId });

  if (!staffId || !clinicId) {
    return res.status(400).json({ error: '직원 ID와 병원 ID가 필요합니다' });
  }

  try {
    // 직원 정보 조회
    const { data: staff, error: staffError } = await supabase
      .from('users')
      .select('id, name, email, phone, role, created_at, clinic_id')
      .eq('id', staffId)
      .eq('clinic_id', clinicId);

    console.log('[staff-info] 직원 쿼리:', { staff, error: staffError });

    if (staffError) throw staffError;
    if (!staff || staff.length === 0) {
      return res.status(404).json({ error: '직원을 찾을 수 없습니다' });
    }

    const staffData = staff[0];

    // 병원명 조회
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name')
      .eq('id', clinicId);

    console.log('[staff-info] 병원 쿼리:', { clinic, error: clinicError });

    if (clinicError) throw clinicError;
    const clinicData = clinic && clinic.length > 0 ? clinic[0] : null;

    // 직원 비밀번호 조회
    const { data: staffPass, error: passError } = await supabase
      .from('users')
      .select('password')
      .eq('id', staffId);

    console.log('[staff-info] 비밀번호 쿼리:', { password: staffPass ? '****' : null, error: passError });

    if (passError) console.error('[staff-info] password fetch error:', passError);

    res.status(200).json({
      staff: {
        ...staffData,
        clinic_name: clinicData?.name || '-'
      },
      password: (staffPass && staffPass.length > 0) ? staffPass[0].password : ''
    });
  } catch (error) {
    console.error('[staff-info] Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
