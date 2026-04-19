/* ============================================================
   Dental Ops AI — 8대 엔진 모듈
   Gemini 기반 프롬프트 엔진 통합
   ============================================================ */

// ---------- 공통 응답 보호 ----------
async function safeGemini(prompt, fallbackText) {
  if (!GeminiAPI.getKey()) return { demo: true, text: fallbackText };
  try {
    const text = await GeminiAPI.chat(prompt);
    return { demo: false, text };
  } catch (e) {
    console.warn('Gemini 호출 실패', e);
    return { demo: true, text: fallbackText + '\n\n(API 오류: ' + e.message + ')' };
  }
}

async function safeGeminiJson(prompt, fallback) {
  if (!GeminiAPI.getKey()) return { demo: true, data: fallback };
  try {
    const data = await GeminiAPI.json(prompt);
    return { demo: false, data };
  } catch (e) {
    console.warn('Gemini JSON 호출 실패', e);
    return { demo: true, data: fallback };
  }
}

// ============================================================
// 1. 상담 AI 엔진 (ConsultEngine)
// ============================================================
const ConsultEngine = {
  async reply({ question, patient }) {
    const ctx = patient ? `환자 정보:\n- 이름: ${patient.name}\n- 나이: ${patient.age}\n- 관심 치료: ${patient.treatment || '미정'}\n` : '';
    const prompt = `당신은 15년 경력의 치과 상담실장이다. 환자 질문에 친절하고 정확하게 답변하라.
${ctx}
환자 질문: "${question}"

다음 구조로 답변하라:
1. 직접 답변 (2~3문장)
2. 추천 치료 (이유 1줄)
3. 예상 비용/기간 (개략)
4. 다음 액션 (상담 예약/사진 촬영 등)

어려운 의학 용어는 피하고, 환자가 안심하도록 따뜻한 톤으로.`;

    const fallback = `[데모 응답]
환자님의 질문에 답변드립니다.

**추천 치료**: 환자님 상태에서는 라미네이트 또는 부분 교정이 효과적일 가능성이 높습니다.

**예상 비용**: 약 3~6백만원 / 기간 2~4개월
**다음 액션**: 내원 1회 + CT 촬영 후 정밀 진단을 권해드립니다.

※ Gemini API 키를 설정하면 환자 맞춤 상담이 가능합니다.`;

    return await safeGemini(prompt, fallback);
  },

  async triage(symptoms) {
    const prompt = `환자가 호소하는 증상을 분류하라.
증상: "${symptoms}"

다음 JSON 형식으로 응답:
{
  "urgency": "긴급|보통|여유",
  "category": "통증|미관|기능|예방|교정|임플란트|소아|기타",
  "recommended_treatment": "추천 치료명",
  "estimated_cost_min": 숫자 (원),
  "estimated_cost_max": 숫자,
  "duration_weeks": 숫자,
  "reason": "1줄 근거"
}`;

    const fallback = { urgency: '보통', category: '미관', recommended_treatment: '라미네이트', estimated_cost_min: 3000000, estimated_cost_max: 6000000, duration_weeks: 4, reason: '데모 응답' };
    return await safeGeminiJson(prompt, fallback);
  }
};

// ============================================================
// 2. 전환 엔진 (ConversionEngine)
// ============================================================
const ConversionEngine = {
  async persuade({ objection, treatment, estimate }) {
    const prompt = `당신은 치과 전환 전략 전문가다. 환자가 치료 제안에 망설이거나 거절했을 때, 감정에 공감하며 설득하는 멘트를 생성하라.

치료: ${treatment}
예상 비용: ${estimate ? estimate.toLocaleString() + '원' : '미정'}
환자 반대/우려: "${objection}"

다음 구조로 응답:
1. 공감 표현 (1문장)
2. 반대의 본질 재해석 (1문장)
3. 해소 정보 제공 (2~3문장, 구체적 숫자/사례 포함)
4. 대안 제시 (분할결제/단계별/부분치료 등 1개)
5. 다음 액션 (CTA 1줄)

절대 강매하지 말고, 환자 입장에서 의사결정을 돕는 톤으로.`;

    const fallback = `[데모 응답]
**공감**: 부담되시는 마음 충분히 이해합니다.
**재해석**: 지금의 걱정은 "비용"이 아니라 "이 치료가 정말 필요한가"의 문제일 수 있어요.
**해소**: 유사한 상태의 환자분들 87%가 3년 내 재발을 막고 만족하셨습니다.
**대안**: 3~12개월 무이자 할부, 또는 핵심 부위 우선 치료 후 관찰하는 방식도 가능합니다.
**CTA**: 일주일만 더 생각하시고, 상태 변화 있으시면 언제든 연락주세요.`;

    return await safeGemini(prompt, fallback);
  },

  async predictProbability({ patient, treatment, interactions }) {
    const prompt = `환자의 치료 전환 가능성을 0~100으로 예측하라.

환자: ${patient?.name || '익명'} (${patient?.age || '?'}세, ${patient?.gender || '?'})
치료: ${treatment}
상담 이력: ${interactions || '없음'}

JSON:
{ "probability": 숫자, "signals_positive": ["긍정 신호 1~3개"], "signals_negative": ["부정 신호 1~3개"], "next_best_action": "다음 최선 행동 1줄" }`;

    const fallback = { probability: 62, signals_positive: ['재방문 의사 표시', '가족과 의논하겠다고 언급'], signals_negative: ['비용 부담 반복 언급'], next_best_action: '무이자 할부 + 단계별 치료 옵션 제시' };
    return await safeGeminiJson(prompt, fallback);
  }
};

// ============================================================
// 3. 자동화 엔진 (AutomationEngine)
// ============================================================
const AutomationEngine = {
  templates: {
    new_patient_greeting: '안녕하세요 {name}님, {clinic}에서 방문을 환영합니다. 편하게 문의주세요.',
    consult_followup: '{name}님, 어제 상담 내용 정리해서 보내드립니다. 궁금한 점 있으시면 회신주세요.',
    pre_treatment_reminder: '{name}님, {date} {time}에 {treatment} 시술이 예약되어 있습니다. 식사는 2시간 전까지.',
    post_treatment_care: '{name}님, 시술 후 관리 안내입니다. 하루동안 뜨거운 음식은 피해주세요.',
    revisit_nudge: '{name}님, 마지막 방문 후 {weeks}주가 지났습니다. 정기 검진 예약 잡으시겠어요?',
  },

  render(templateKey, vars) {
    let tpl = this.templates[templateKey] || '';
    Object.keys(vars).forEach(k => { tpl = tpl.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]); });
    return tpl;
  },

  async generateCustom({ scenario, patient }) {
    const prompt = `치과 자동 메시지를 생성하라.
시나리오: ${scenario}
환자: ${patient?.name || '홍길동'} (${patient?.treatment || '미정 치료'})

2~3문장으로 친근하고 신뢰감 있는 메시지. 이모지 1개 이하.`;

    const fallback = `${patient?.name || '환자'}님, 안녕하세요. ${scenario} 관련하여 안내드립니다. 궁금한 점 있으시면 언제든 문의주세요.`;
    return await safeGemini(prompt, fallback);
  },

  async execute({ type, patientId, payload }) {
    // 데모: 실제 발송 대신 로그 저장
    const rec = { type, patientId, payload, sentAt: new Date().toISOString() };
    const logs = Store.get('automation_logs', []);
    logs.unshift(rec);
    Store.set('automation_logs', logs.slice(0, 200));

    if (typeof SupabaseDB !== 'undefined' && SupabaseDB.isReady()) {
      try { await SupabaseDB.saveAutomation({ patientId, type, payload, status: 'sent' }); } catch (e) { console.warn(e); }
    }
    return rec;
  },

  getLogs() { return Store.get('automation_logs', []); }
};

// ============================================================
// 4. KPI 엔진 (KPIEngine)
// ============================================================
const KPIEngine = {
  calculate(data) {
    // data = { consults: [...], conversions: [...], revisits: [...], ai_uses: [...] }
    const total = data.consults?.length || 0;
    const success = data.conversions?.filter(c => c.status === '계약완료' || c.status === '치료완료').length || 0;
    const totalTime = data.consults?.reduce((s, c) => s + (c.duration_min || 0), 0) || 0;
    const avgTime = total ? totalTime / total : 0;
    const revisit = data.revisits?.length || 0;
    const aiUses = data.ai_uses?.length || 0;
    const revenue = data.conversions?.reduce((s, c) => s + (c.estimate || 0), 0) || 0;

    return {
      conversionRate: total ? Math.round((success / total) * 100) : 0,
      avgConsultMin: Math.round(avgTime * 10) / 10,
      revisitRate: total ? Math.round((revisit / total) * 100) : 0,
      aiUsageRate: total ? Math.round((aiUses / total) * 100) : 0,
      revenue,
      total, success, revisit
    };
  },

  benchmark(current) {
    const target = { conversionRate: 70, avgConsultMin: 15, revisitRate: 70, aiUsageRate: 80 };
    const result = {};
    Object.keys(target).forEach(k => {
      const t = target[k], c = current[k] || 0;
      const isLower = k === 'avgConsultMin'; // 낮을수록 좋음
      const delta = isLower ? t - c : c - t;
      result[k] = { current: c, target: t, delta, met: isLower ? c <= t : c >= t };
    });
    return result;
  }
};

// ============================================================
// 5. 교육/훈련 엔진 (TrainingEngine)
// ============================================================
const TrainingEngine = {
  scenarios: [
    { id: 'S01', title: '라미네이트 상담 — 비용 부담 고객', patient: '35세 여성, 디자인팀 근무, 결혼 준비 중', objection: '가격이 생각보다 비싸네요' },
    { id: 'S02', title: '임플란트 상담 — 공포 고객', patient: '52세 남성, 통증과 수술에 두려움', objection: '수술이 무서워요' },
    { id: 'S03', title: '교정 상담 — 기간 고민 고객', patient: '28세 여성, 직장인', objection: '2년은 너무 길어요' },
    { id: 'S04', title: '치아미백 — 재방문 유도', patient: '30세 여성, 6개월 전 치료 완료', objection: '효과가 유지되나요?' },
    { id: 'S05', title: '소아 검진 — 학부모 불신', patient: '엄마가 7세 아이 데리고 내원', objection: '꼭 치료해야 해요?' },
  ],

  async evaluate({ scenario, userResponse }) {
    const prompt = `당신은 치과 상담 교육 평가자다. 다음 상담을 평가하라.

시나리오: ${scenario.title}
환자: ${scenario.patient}
환자의 반대: "${scenario.objection}"
교육생 응답: "${userResponse}"

평가 기준 (각 0~20점, 총 100):
1. 공감 표현
2. 정보 정확성
3. 설득 논리
4. 대안 제시
5. 다음 액션

JSON:
{
  "score_empathy": 숫자,
  "score_accuracy": 숫자,
  "score_persuasion": 숫자,
  "score_alternative": 숫자,
  "score_cta": 숫자,
  "total": 합계,
  "strengths": ["잘한 점 2~3개"],
  "improvements": ["개선점 2~3개"],
  "coach_tip": "다음엔 이렇게 해보세요 1문장"
}`;

    const fallback = {
      score_empathy: 12, score_accuracy: 14, score_persuasion: 10, score_alternative: 8, score_cta: 11, total: 55,
      strengths: ['친절한 톤 유지', '기본 정보 전달'],
      improvements: ['공감 표현 부족', '대안 옵션 제시 미흡', '다음 액션 불명확'],
      coach_tip: '먼저 "부담되시죠"로 공감한 뒤, 무이자 할부 같은 구체 옵션을 제시하세요.'
    };
    return await safeGeminiJson(prompt, fallback);
  }
};

// ============================================================
// 6. 온톨로지 엔진 (OntologyEngine)
// ============================================================
const OntologyEngine = {
  defaultStructure: {
    roles: ['원장', '상담실장', '치위생사', '코디네이터', '데스크'],
    processes: ['예약접수', '상담', '진단', '시술', '사후관리'],
    flows: [
      { from: '예약접수', to: '상담', role: '데스크' },
      { from: '상담', to: '진단', role: '상담실장' },
      { from: '진단', to: '시술', role: '원장' },
      { from: '시술', to: '사후관리', role: '치위생사' },
    ]
  },

  analyze(patientFlowLogs) {
    // 병목 분석 (단순 통계)
    const counts = {};
    patientFlowLogs?.forEach(log => {
      const key = log.from + '→' + log.to;
      counts[key] = (counts[key] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return {
      top_transitions: sorted.slice(0, 5).map(([k, v]) => ({ transition: k, count: v })),
      bottleneck: sorted.length ? sorted[0][0] : null
    };
  },

  async suggestAutomation(structure) {
    const prompt = `치과 프로세스 구조를 분석하고 자동화 가능 영역을 제안하라.
구조: ${JSON.stringify(structure)}

JSON:
{
  "automation_candidates": [
    { "process": "프로세스명", "current_role": "현재 담당", "automation_type": "AI/Bot/Scheduler", "expected_saving_hours_per_week": 숫자, "priority": "high|mid|low" }
  ]
}`;

    const fallback = {
      automation_candidates: [
        { process: '예약접수', current_role: '데스크', automation_type: 'Bot', expected_saving_hours_per_week: 8, priority: 'high' },
        { process: '사후관리', current_role: '치위생사', automation_type: 'Scheduler', expected_saving_hours_per_week: 5, priority: 'mid' },
      ]
    };
    return await safeGeminiJson(prompt, fallback);
  }
};

// ============================================================
// 7. 인사이트 엔진 (InsightEngine) — Harness 하네스
// ============================================================
const InsightEngine = {
  async generate({ topic, data }) {
    const prompt = `당신은 치과 경영 인사이트 생성기다. 데이터에서 통찰을 추출하라.

주제: ${topic}
데이터: ${JSON.stringify(data).slice(0, 3000)}

6단계 하네스 방법론 적용:
1. Curator — 핵심 데이터 카드 추출
2. Insight Miner — 패턴/역설 도출
3. Architect — 서사 구조 설계
4. Writer — 리포트 본문 작성
5. Critic — 클리셰/허점 검증
6. Editor — 최종 톤 조정

JSON:
{
  "summary": "3~5문장 요약",
  "findings": [
    { "pattern": "발견된 패턴", "evidence": "근거 데이터", "implication": "함의" }
  ],
  "paradox": "역설 1줄",
  "strategy": "3~5줄 전략 제안",
  "kpi_to_track": ["추적할 KPI 2~3개"]
}`;

    const fallback = {
      summary: '이번 주 상담 전환율은 상승했으나 평균 상담 시간이 비례해 증가했다. 특정 시간대(오후 3~5시)에 계약 성공률이 집중된 패턴이 관찰된다. 고가 치료(임플란트)의 전환은 2회차 상담에서 급증한다.',
      findings: [
        { pattern: '오후 3~5시 전환율 2배', evidence: '14건 중 9건이 이 시간대', implication: '상담실장 스케줄링 최적화 여지' },
        { pattern: '2회차 상담 후 계약 급증', evidence: '2회차 전환율 78%', implication: '1회차엔 정보 제공에 집중, 2회차에 클로징' },
      ],
      paradox: '상담 시간이 길수록 전환율도 높아지지만, 14분을 넘어가면 다시 하락한다.',
      strategy: '1) 오후 3~5시 핵심 치료 집중 배치\n2) 1-2회 상담 분리 전략 도입\n3) 14분 체크포인트 코칭',
      kpi_to_track: ['2회차 상담 전환율', '시간대별 계약 집중도']
    };
    return await safeGeminiJson(prompt, fallback);
  }
};

// ============================================================
// 8. CEO 엔진 (CEOEngine)
// ============================================================
const CEOEngine = {
  async advise({ kpis, context }) {
    const prompt = `당신은 치과 경영 전략 고문이다. KPI와 컨텍스트를 보고 CEO에게 조언하라.

KPI: ${JSON.stringify(kpis)}
컨텍스트: ${context || '없음'}

JSON:
{
  "state": "growth|steady|caution|danger",
  "top_3_actions": [
    { "priority": 1, "action": "행동", "why": "근거", "expected_impact": "예상 효과", "timeframe": "언제까지" }
  ],
  "risks": ["리스크 1~3개"],
  "roi_estimate": "월 ROI 개략"
}`;

    const fallback = {
      state: 'growth',
      top_3_actions: [
        { priority: 1, action: '상담실장 교육 투자 확대', why: '전환율 68% → 80% 목표', expected_impact: '월 매출 +22%', timeframe: '4주 내' },
        { priority: 2, action: '자동화 메시지 확대 (재방문 유도)', why: '재방문율 76% 방어', expected_impact: '이탈 -8%', timeframe: '2주 내' },
        { priority: 3, action: '고가 치료(임플란트) 마케팅 집중', why: '전환 기여도 최대', expected_impact: '객단가 +15%', timeframe: '6주 내' },
      ],
      risks: ['상담실장 번아웃', '경쟁 병원 광고 가격 인상', '환자 DB 노후화'],
      roi_estimate: '월 1,200~1,800만원 순증 가능'
    };
    return await safeGeminiJson(prompt, fallback);
  }
};

// 전역 노출
window.ConsultEngine = ConsultEngine;
window.ConversionEngine = ConversionEngine;
window.AutomationEngine = AutomationEngine;
window.KPIEngine = KPIEngine;
window.TrainingEngine = TrainingEngine;
window.OntologyEngine = OntologyEngine;
window.InsightEngine = InsightEngine;
window.CEOEngine = CEOEngine;
