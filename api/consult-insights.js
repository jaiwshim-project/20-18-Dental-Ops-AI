const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const { clinic_id, debug } = req.query;
  const isDebug = debug === '1';
  if (!clinic_id && !isDebug) return res.status(400).json({ error: 'clinic_id 필요' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'No env' });

  try {
    const sb = createClient(url, key);

    const sixAgo = new Date();
    sixAgo.setMonth(sixAgo.getMonth() - 6);

    // staff-consults.js와 동일하게: JSONB 필터 없이 전체 조회 후 클라이언트 필터
    const { data: allLogs, error } = await sb
      .from('consult_logs')
      .select('id, created_at, metadata')
      .eq('engine', 'consult')
      .gte('created_at', sixAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      if (error.code === '42P01') return res.status(200).json({ empty: true, reason: 'no_table' });
      throw error;
    }

    const debugTotal = allLogs?.length || 0;

    // debug=1: 필터 없이 원본 데이터 구조 반환
    if (isDebug) {
      const sample = (allLogs || []).slice(0, 10).map(l => ({
        id: l.id,
        created_at: l.created_at,
        metadata_keys: l.metadata ? Object.keys(l.metadata) : [],
        clinic_id: l.metadata?.clinic_id ?? '(없음)',
        staff_id: l.metadata?.staff_id ?? '(없음)',
        type: l.metadata?.type ?? '(없음)',
        patient_name: l.metadata?.patient_name ?? '(없음)',
        author: l.metadata?.author ?? '(없음)',
        duration_sec: l.metadata?.duration_sec ?? '(없음)',
      }));
      const distinctClinicIds = [...new Set((allLogs || []).map(l => l.metadata?.clinic_id).filter(Boolean))];
      return res.status(200).json({
        total_records: debugTotal,
        distinct_clinic_ids: distinctClinicIds,
        your_clinic_id: clinic_id || '(파라미터 없음)',
        sample,
      });
    }

    // clinic_id 매칭 + clinic_id가 없는 레코드도 포함 (구버전 호환)
    const logs = (allLogs || []).filter(l =>
      l.metadata &&
      (l.metadata.clinic_id === clinic_id || !l.metadata.clinic_id) &&
      (l.metadata.type === 'session' || !l.metadata.type)
    );
    const unlinkedCount = logs.filter(l => !l.metadata.clinic_id).length;

    if (!logs.length) {
      // 어떤 clinic_id / type 값이 실제로 저장되어 있는지 진단
      const distinctClinicIds = [...new Set((allLogs || []).map(l => l.metadata?.clinic_id ?? '(없음)'))];
      const distinctTypes     = [...new Set((allLogs || []).map(l => l.metadata?.type     ?? '(없음)'))];
      return res.status(200).json({
        empty: true,
        reason: 'no_match',
        debug_total_records: debugTotal,
        debug_your_clinic_id: clinic_id,
        debug_stored_clinic_ids: distinctClinicIds,
        debug_stored_types: distinctTypes,
      });
    }

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = logs.filter(l => new Date(l.created_at) >= thisMonthStart);

    // 평균 상담 시간 (초 → 분)
    const durations = logs.map(l => l.metadata?.duration_sec || 0).filter(d => d > 0);
    const avgDurationMin = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60 * 10) / 10 : 0;

    // 평균 코칭 턴
    const turnsList = logs.map(l => l.metadata?.turns_count || 0);
    const avgTurns = turnsList.length
      ? Math.round(turnsList.reduce((a, b) => a + b, 0) / turnsList.length * 10) / 10 : 0;

    // AI 평가 완료 건수
    const evaluatedCount = logs.filter(l => l.metadata?.evaluation).length;

    // 직원별 집계 (staff_name 우선, 없으면 staff_id 짧게)
    const staffMap = {};
    logs.forEach(l => {
      const sid = l.metadata?.staff_id || 'unknown';
      const name = l.metadata?.author || l.metadata?.staff_name || null;
      if (!staffMap[sid]) staffMap[sid] = { staff_id: sid, name, count: 0, duration_total: 0 };
      if (name && !staffMap[sid].name) staffMap[sid].name = name;
      staffMap[sid].count++;
      staffMap[sid].duration_total += l.metadata?.duration_sec || 0;
    });
    const byStaff = Object.values(staffMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map(s => ({
        staff_id: s.staff_id,
        name: s.name || s.staff_id.slice(-6),
        count: s.count,
        avg_duration_min: s.duration_total > 0
          ? Math.round(s.duration_total / s.count / 60 * 10) / 10 : 0,
      }));

    // 월별 트렌드 (최근 6개월)
    const monthlyMap = {};
    logs.forEach(l => {
      const d = new Date(l.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = (monthlyMap[key] || 0) + 1;
    });
    const monthly = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly.push({ month: key, count: monthlyMap[key] || 0 });
    }

    // 최근 상담 기록 10건
    const recent = logs.slice(0, 10).map(l => ({
      id: l.id,
      created_at: l.created_at,
      patient_name: l.metadata?.patient_name || '익명',
      staff_name: l.metadata?.author || l.metadata?.staff_name || l.metadata?.staff_id?.slice(-6) || '-',
      duration_sec: l.metadata?.duration_sec || 0,
      turns_count: l.metadata?.turns_count || 0,
      has_evaluation: !!l.metadata?.evaluation,
    }));

    return res.status(200).json({
      summary: {
        total: logs.length,
        this_month: thisMonth.length,
        avg_duration_min: avgDurationMin,
        avg_turns: avgTurns,
        evaluated_count: evaluatedCount,
        unlinked_count: unlinkedCount,
      },
      by_staff: byStaff,
      monthly,
      recent,
      debug_total_records: debugTotal,
    });

  } catch (e) {
    console.error('[consult-insights]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
