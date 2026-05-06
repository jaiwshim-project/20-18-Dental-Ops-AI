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

    // 최근 6개월 세션 로그 (type='session'만)
    const sixAgo = new Date();
    sixAgo.setMonth(sixAgo.getMonth() - 6);

    const { data: logs, error } = await sb
      .from('consult_logs')
      .select('id, created_at, metadata')
      .eq('engine', 'consult')
      .filter('metadata->>type', 'eq', 'session')
      .filter('metadata->>clinic_id', 'eq', clinic_id)
      .gte('created_at', sixAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      // 테이블 없으면 빈 데이터
      if (error.code === '42P01') return res.status(200).json({ empty: true });
      throw error;
    }
    if (!logs || !logs.length) return res.status(200).json({ empty: true });

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 이번달 세션
    const thisMonth = logs.filter(l => new Date(l.created_at) >= thisMonthStart);

    // 평균 상담 시간 (초 → 분)
    const durations = logs.map(l => (l.metadata?.duration_sec || 0)).filter(d => d > 0);
    const avgDurationMin = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60 * 10) / 10 : 0;

    // 평균 코칭 턴
    const turns = logs.map(l => (l.metadata?.turns_count || 0));
    const avgTurns = turns.length
      ? Math.round(turns.reduce((a, b) => a + b, 0) / turns.length * 10) / 10 : 0;

    // AI 평가 완료 건수
    const evaluatedCount = logs.filter(l => l.metadata?.evaluation).length;

    // 직원별 집계
    const staffMap = {};
    logs.forEach(l => {
      const sid = l.metadata?.staff_id || 'unknown';
      if (!staffMap[sid]) staffMap[sid] = { staff_id: sid, count: 0, duration_total: 0 };
      staffMap[sid].count++;
      staffMap[sid].duration_total += l.metadata?.duration_sec || 0;
    });
    const byStaff = Object.values(staffMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map(s => ({
        staff_id: s.staff_id,
        count: s.count,
        avg_duration_min: s.duration_total > 0
          ? Math.round(s.duration_total / s.count / 60 * 10) / 10 : 0
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
      staff_id: l.metadata?.staff_id || '-',
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
    });

  } catch (e) {
    console.error('[consult-insights]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
