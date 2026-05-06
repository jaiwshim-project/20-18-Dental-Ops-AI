const { createClient } = require('@supabase/supabase-js');
const { callAI } = require('./ai-selector');

const LANG_NAMES = {
  ko:'한국어', en:'영어', zh:'중국어', ja:'일본어', vi:'베트남어',
  ru:'러시아어', th:'태국어', ar:'아랍어', es:'스페인어', fr:'프랑스어',
  de:'독일어', pt:'포르투갈어', id:'인도네시아어', mn:'몽골어',
  uz:'우즈베크어', kk:'카자흐어', tl:'필리핀어', my:'미얀마어', km:'크메르어', hi:'힌디어'
};

const STOP_WORDS = new Set([
  '이','가','을','를','은','는','의','에','에서','과','와','도','으로','로','이다',
  '있다','없다','그','저','것','수','때','등','및','더','좀','제','어떻게','어디',
  '언제','왜','뭐','아','네','예','아니요','안','못','할','하다','해요','해서',
  '있어요','없어요','같아요','싶어요','주세요','해주세요','합니다','입니다',
  '치과','병원','선생님','의사','저는','제가','우리','나는','나','저','그게',
]);

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'No env' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch {} }
  const { clinic_id, clinic_name, messages: sessionMsgs, patient_lang: sessionLang,
          started_at: sessionStart, ended_at: sessionEnd } = body || {};
  if (!clinic_id) return res.status(400).json({ error: 'clinic_id 필요' });

  // ── 건별 세션 분석 모드 (messages 배열이 제공된 경우)
  if (Array.isArray(sessionMsgs)) {
    try {
      const conversation = sessionMsgs.map(m =>
        `[${m.who === 'patient' ? '환자' : '직원'}] ${m.original || ''}${m.translated ? ` → (번역) ${m.translated}` : ''}`
      ).join('\n');
      const dur = sessionStart && sessionEnd
        ? Math.round((new Date(sessionEnd) - new Date(sessionStart)) / 60000 * 10) / 10
        : null;
      const langLabel = LANG_NAMES[sessionLang] || sessionLang || '알 수 없음';
      const dateLabel = sessionStart ? new Date(sessionStart).toLocaleDateString('ko-KR') : '알 수 없음';

      const sessionPrompt = `당신은 치과 병원 수석 상담 코디네이터입니다.
아래는 외국인 환자와의 실제 통역 상담 기록입니다.

[상담 정보]
- 환자 언어: ${langLabel}
- 상담 일자: ${dateLabel}
- 상담 시간: ${dur !== null ? dur + '분' : '기록 없음'}
- 대화 수: ${sessionMsgs.length}회

[상담 대화록]
${conversation}

[요청]
위 상담 내용을 분석하여 아래 형식으로 한국어 분석 레포트를 작성해주세요.
각 섹션 제목 앞에 이모지를 포함하세요.

1. 🦷 환자 주訴 요약 (환자가 호소한 주된 증상이나 요청 사항을 2~3문장으로)
2. 💬 상담 내용 (논의된 치료 옵션, 비용, 일정 등 핵심 내용)
3. ⚠️ 의사소통 이슈 (언어 장벽이나 오해 가능성이 있었던 부분, 없으면 "특이사항 없음"으로 표기)
4. 📋 후속 조치 권고 (다음 방문 전 준비사항, 직원에게 알릴 사항)
5. 💡 원장 메모 (이 환자 응대에서 참고할 특이사항이나 개선점)

간결하고 실용적으로 작성해주세요.`;

      const result = await callAI(sessionPrompt, { maxTokens: 800, temperature: 0.5 });
      return res.status(200).json({
        summary: result.text,
        model: result.model,
        mode: 'session',
        generated_at: new Date().toISOString()
      });
    } catch (e) {
      console.error('[translate-summary/session]', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  try {
    const sb = createClient(url, key);

    // 최근 30일 데이터
    const thirtyAgo = new Date();
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);

    const { data: logs, error } = await sb
      .from('translate_logs')
      .select('patient_lang, messages, started_at, ended_at')
      .eq('clinic_id', clinic_id)
      .gte('started_at', thirtyAgo.toISOString())
      .order('started_at', { ascending: false });

    if (error) throw new Error(error.message);
    if (!logs || !logs.length) {
      return res.status(200).json({ summary: null, reason: 'no_data' });
    }

    // ── 데이터 집계
    const total = logs.length;

    const durations = logs.filter(l => l.ended_at)
      .map(l => (new Date(l.ended_at) - new Date(l.started_at)) / 60000);
    const avgDuration = durations.length
      ? Math.round(durations.reduce((a,b) => a+b,0) / durations.length * 10) / 10 : 0;
    const shortCount = durations.filter(d => d < 1).length;

    const msgCounts = logs.map(l => Array.isArray(l.messages) ? l.messages.length : 0);
    const avgMsg = msgCounts.length
      ? Math.round(msgCounts.reduce((a,b) => a+b,0) / msgCounts.length * 10) / 10 : 0;

    // 언어별
    const langMap = {};
    logs.forEach(l => { const g = l.patient_lang||'?'; langMap[g] = (langMap[g]||0)+1; });
    const langList = Object.entries(langMap).sort((a,b)=>b[1]-a[1])
      .map(([l,c]) => `${LANG_NAMES[l]||l} ${c}건(${Math.round(c/total*100)}%)`).join(', ');

    // 요일별
    const wdMap = Array(7).fill(0);
    logs.forEach(l => { wdMap[new Date(l.started_at).getDay()]++; });
    const wdNames = ['일','월','화','수','목','금','토'];
    const topWd = wdMap.map((c,i)=>({n:wdNames[i],c})).sort((a,b)=>b.c-a.c).slice(0,3)
      .map(x=>`${x.n}요일(${x.c}건)`).join(', ');

    // 시간대별
    const hrMap = Array(24).fill(0);
    logs.forEach(l => { hrMap[new Date(l.started_at).getHours()]++; });
    const topHr = hrMap.map((c,h)=>({h,c})).sort((a,b)=>b.c-a.c).slice(0,3)
      .map(x=>`${x.h}시(${x.c}건)`).join(', ');

    // 키워드
    const wc = {};
    logs.forEach(l => {
      if (!Array.isArray(l.messages)) return;
      l.messages.forEach(m => {
        if (m.who !== 'patient' || !m.original) return;
        (m.original.match(/[가-힣]{2,}|[a-zA-Z]{4,}/g)||[]).forEach(w => {
          if (!STOP_WORDS.has(w) && !STOP_WORDS.has(w.toLowerCase()))
            wc[w] = (wc[w]||0)+1;
        });
      });
    });
    const topKw = Object.entries(wc).sort((a,b)=>b[1]-a[1]).slice(0,10)
      .map(([w,c]) => `'${w}'(${c}회)`).join(', ');

    // ── 프롬프트 구성
    const clinicLabel = clinic_name || '해당 치과';
    const today = new Date().toLocaleDateString('ko-KR');

    const prompt = `당신은 치과 병원 경영 컨설턴트입니다.
아래는 ${clinicLabel}의 최근 30일간 상담 AI 통역 기록 통계입니다.

[통계 데이터]
- 기간: ${thirtyAgo.toLocaleDateString('ko-KR')} ~ ${today}
- 총 외국인 환자 통역 건수: ${total}건
- 환자 언어 분포: ${langList}
- 집중 요일: ${topWd}
- 피크 시간대: ${topHr}
- 평균 상담 시간: ${avgDuration}분
- 평균 대화 수: ${avgMsg}회
- 의사소통 주의 건수(1분 미만 종료): ${shortCount}건
- 환자 주요 키워드: ${topKw || '(데이터 없음)'}

[요청]
위 데이터를 분석하여 병원 원장에게 드리는 월간 외국인 환자 상담 인사이트 레포트를 한국어로 작성해주세요.

아래 구조로 작성하되, 각 섹션 제목 앞에 이모지를 넣어주세요:
1. 이달의 핵심 요약 (2~3문장, 가장 중요한 발견 중심)
2. 외국인 환자 현황 분석 (언어별 특이사항, 증감 해석)
3. 피크 시간대·요일 인사이트 (직원 배치·통역 준비 권고 포함)
4. 환자 주요 관심사 분석 (키워드 기반, 마케팅/상담 활용 방안)
5. 주의사항 및 개선 권고 (짧은 상담 등 문제점 해석)
6. 다음 달 액션 아이템 3가지 (구체적이고 실행 가능한 것)

실용적이고 간결하게 작성하며, 병원 운영에 바로 활용할 수 있는 인사이트를 제공해주세요.`;

    const result = await callAI(prompt, { maxTokens: 1500, temperature: 0.6 });

    return res.status(200).json({
      summary: result.text,
      model: result.model,
      generated_at: new Date().toISOString(),
      data_period: `${thirtyAgo.toLocaleDateString('ko-KR')} ~ ${today}`,
      total_logs: total
    });

  } catch (e) {
    console.error('[translate-summary]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
