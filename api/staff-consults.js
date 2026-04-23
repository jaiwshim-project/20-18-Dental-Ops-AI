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
    // consult_logs 테이블에서 해당 직원의 세션 상담 목록 조회
    // metadata.staff_id와 metadata.clinic_id로 필터링
    // type='session'만 (중간 coach_turn 제외)
    const { data: logs, error } = await supabase
      .from('consult_logs')
      .select('id, created_at, metadata')
      .eq('engine', 'consult')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // 클라이언트 측 필터링: metadata.staff_id, metadata.clinic_id, metadata.type='session'
    const consults = (logs || [])
      .filter(log =>
        log.metadata &&
        log.metadata.staff_id === staffId &&
        log.metadata.clinic_id === clinicId &&
        (log.metadata.type === 'session' || !log.metadata.type)
      )
      .map(log => ({
        id: log.id,
        title: log.metadata.patient_name ? `${log.metadata.patient_name}님 상담` : '제목 없음',
        patient_name: log.metadata.patient_name || '-',
        status: log.metadata.evaluation ? 'completed' : 'pending',
        created_at: log.created_at,
        session_id: log.metadata.session_id,
        duration_sec: log.metadata.duration_sec || 0,
        turns_count: log.metadata.turns_count || 0
      }));

    res.status(200).json({ consults });
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
