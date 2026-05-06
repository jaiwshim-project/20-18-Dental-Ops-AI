const { createClient } = require('@supabase/supabase-js');

// 임시 진단 전용 API — 배포 후 확인하고 삭제할 것
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'No env' });

  try {
    const sb = createClient(url, key);

    // consult_logs 전체 최근 20건 (필터 없음)
    const { data: all, error: e1 } = await sb
      .from('consult_logs')
      .select('id, engine, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(20);

    if (e1) return res.status(200).json({ table_error: e1.message, code: e1.code });

    // engine='consult' 건만
    const consultOnly = (all || []).filter(r => r.engine === 'consult');

    // 각 레코드의 metadata 핵심 필드만 추출
    const sample = consultOnly.slice(0, 10).map(r => ({
      id: r.id,
      created_at: r.created_at,
      metadata_keys: r.metadata ? Object.keys(r.metadata) : [],
      clinic_id: r.metadata?.clinic_id || '(없음)',
      staff_id: r.metadata?.staff_id || '(없음)',
      type: r.metadata?.type || '(없음)',
      patient_name: r.metadata?.patient_name || '(없음)',
      author: r.metadata?.author || '(없음)',
      duration_sec: r.metadata?.duration_sec ?? '(없음)',
    }));

    return res.status(200).json({
      total_all_engines: all?.length || 0,
      total_consult_engine: consultOnly.length,
      sample,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
