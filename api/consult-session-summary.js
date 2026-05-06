const { createClient } = require('@supabase/supabase-js');
const { callAI } = require('./ai-selector');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'No env' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch {} }
  const { log_id } = body || {};
  if (!log_id) return res.status(400).json({ error: 'log_id 필요' });

  try {
    const sb = createClient(url, key);

    const { data: log, error } = await sb
      .from('consult_logs')
      .select('id, created_at, metadata')
      .eq('id', log_id)
      .single();

    if (error) throw new Error(error.message);
    if (!log) return res.status(404).json({ error: '기록 없음' });

    const meta = log.metadata || {};
    const turns = Array.isArray(meta.turns) ? meta.turns : [];
    const coachResults = Array.isArray(meta.coachResults) ? meta.coachResults : [];
    const patientName = meta.patient_name || '익명';
    const staffName   = meta.author || meta.staff_name || '직원';
    const durMin = meta.duration_sec ? Math.round(meta.duration_sec / 60 * 10) / 10 : null;
    const dateLabel = new Date(log.created_at).toLocaleDateString('ko-KR');

    // 대화 내용 포맷
    const conversation = turns.map(t => {
      const who = t.speaker === 'patient' ? '환자' : t.speaker === 'staff' ? '상담실장' : 'AI코치';
      return `[${who}] ${t.text || ''}`;
    }).join('\n');

    // AI 코치 조언 요약
    const coachSummary = coachResults.slice(0, 3).map((c, i) => {
      const d = c.data || {};
      const reply = Array.isArray(d.recommended_reply) ? d.recommended_reply.join(' / ') : (d.recommended_reply || '');
      return `${i + 1}턴 코치 조언: ${reply}`;
    }).join('\n');

    const prompt = `당신은 치과 병원 수석 상담 코디네이터입니다.
아래는 상담 AI 코치 시스템이 기록한 실제 상담 대화입니다.

[상담 정보]
- 환자명: ${patientName}
- 담당 상담실장: ${staffName}
- 상담 일자: ${dateLabel}
- 상담 시간: ${durMin !== null ? durMin + '분' : '기록 없음'}
- 대화 턴 수: ${turns.length}회

[상담 대화록]
${conversation || '(대화 내용 없음)'}

${coachSummary ? `[AI 코치 주요 조언]\n${coachSummary}` : ''}

[요청]
위 상담 내용을 분석하여 아래 형식으로 한국어 분석 레포트를 작성해주세요.
각 섹션 제목 앞에 이모지를 포함하세요.

1. 🦷 환자 주訴 요약 (환자가 호소한 주된 증상이나 요청 사항을 2~3문장으로)
2. 💬 상담 흐름 분석 (상담실장의 응대 방식, 설명 방식, 강점과 개선점)
3. 🎯 AI 코치 활용도 (코치 조언을 얼마나 활용했는지, 실제 효과)
4. ⚠️ 아쉬운 점 (놓친 기회, 보완이 필요한 부분, 없으면 "특이사항 없음")
5. 📋 다음 상담 준비사항 (후속 조치, 환자에게 필요한 안내)

간결하고 실용적으로 작성해주세요.`;

    const result = await callAI(prompt, { maxTokens: 900, temperature: 0.5 });
    return res.status(200).json({
      summary: result.text,
      model: result.model,
      generated_at: new Date().toISOString(),
    });

  } catch (e) {
    console.error('[consult-session-summary]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
