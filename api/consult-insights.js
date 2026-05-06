const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const { clinic_id } = req.query;
  if (!clinic_id) return res.status(400).json({ error: 'clinic_id 필요' });

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

    // clinic_id로 필터 + type='session' (또는 type 없는 것도 포함)
    const logs = (allLogs || []).filter(l =>
      l.metadata &&
      l.metadata.clinic_id === clinic_id &&
      (l.metadata.type === 'session' || !l.metadata.type)
    );

    if (!logs.length) {
      return res.status(200).json({
        empty: true,
        reason: 'no_match',
        debug_total_records: debugTotal,    // 전체 레코드 수 (진단용)
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
