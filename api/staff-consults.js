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

  if (!staffId || !clinicId) {
    return res.status(400).json({ error: '직원 ID와 병원 ID가 필요합니다' });
  }

  try {
    // consult_logs 테이블에서 해당 직원의 상담 목록 조회
    const { data: consults, error } = await supabase
      .from('consult_logs')
      .select('id, title, patient_name, status, created_at, content')
      .eq('staff_id', staffId)
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      consults: consults || []
    });
  } catch (error) {
    console.error('[staff-consults]', error);

    // consult_logs 테이블이 없는 경우 빈 배열 반환
    if (error.code === '42P01') {
      console.warn('[staff-consults] consult_logs 테이블이 없습니다. 빈 배열 반환');
      return res.status(200).json({ consults: [] });
    }

    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
