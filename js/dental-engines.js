/* ============================================================
   Dental Ops AI — 8대 엔진 모듈
   Gemini 기반 프롬프트 엔진 통합
   ============================================================ */

// ---------- 공통 응답 보호 ----------
// 서버(/api/gemini)가 GEMINI_API_KEY를 관리하므로 브라우저에서는 키 체크 불필요
async function safeGemini(prompt, fallbackText) {
  try {
    const text = await GeminiAPI.chat(prompt);
    return { demo: false, text };
  } catch (e) {
    console.warn('Gemini 호출 실패', e);
    return { demo: true, text: fallbackText + '\n\n(API 오류: ' + e.message + ')' };
  }
}

async function safeGeminiJson(prompt, fallback, model = null, engine = null) {
  try {
    const data = await GeminiAPI.json(prompt, model, engine);
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

  // 상담실장(병원 관계자)용 코칭 답변
  // utterances: [{text, at}] — 화자 미구분 발화 배열 (AI가 문맥으로 화자 자동 분리)
  // (호환) transcript: [{speaker, text}] — 이미 라벨링된 배열이면 그대로 사용
  async coachReply({ question, patient, utterances, transcript, history, language }) {
    const ctx = patient ? `환자: ${patient.name} (${patient.age}세, 관심 치료: ${patient.treatment || '미정'})\n` : '';
    const hist = history && history.length
      ? '이전 세션 이력:\n' + history.slice(-5).map((h, i) => `${i + 1}. ${h}`).join('\n') + '\n'
      : '';

    // 입력 소스 판별
    const hasLabeled = Array.isArray(transcript) && transcript.length && transcript.every(t => t.speaker === 'patient' || t.speaker === 'staff');
    const raw = !hasLabeled ? (utterances || transcript || []) : [];
    const rawBlock = raw.length
      ? '대화 녹취 (화자 미구분, 시간 순):\n' +
        raw.map((u, i) => `[${i + 1}] "${u.text}"`).join('\n') + '\n' +
        '\n👉 먼저 각 발화의 화자를 추론하여 "patient" 또는 "staff"로 라벨링하라.\n' +
        '기준: 어미(습니다체 vs 반말/존댓말 혼용), 업무 용어(치료/비용/예약/상담), 질문 주체, 의료 지식 수준, 불안·요구 표현 유무.\n' +
        '같은 발화 내 여러 화자가 섞여 있으면 의미 단위로 나눠 라벨링해도 된다.\n'
      : '';
    const labeledBlock = hasLabeled
      ? '현재 세션 대화 녹취 (시간 순):\n' +
        transcript.map(t => (t.speaker === 'staff' ? '[상담실장] ' : '[환자] ') + t.text).join('\n') + '\n'
      : '';

    // 최근 환자 발화 자동 추출 (라벨 있으면 그대로, 없으면 AI가 추론 후 last_patient_utterance 필드로 반환)
    const lastPatient = hasLabeled
      ? (transcript.filter(t => t.speaker === 'patient').slice(-1)[0]?.text || question || '')
      : (question || '');

    // 다언어 지시문
    const langInstruction = language && language !== 'ko-KR'
      ? `⚠️ LANGUAGE INSTRUCTION: The patient is speaking ${language}. You MUST write ALL fields in the SAME language as the patient's input. This includes: subtext, recommended_reply, next_action, key_points, cautions, treatment_options, diarized_turns, and all other text fields. Do NOT translate or use Korean in any field.\n\n`
      : '';

    const prompt = `${langInstruction}⚠️ 실시간 상담 도중 코칭이다. 2~3초 내 응답이 절대적으로 중요.
- 핵심 필드(subtext, recommended_reply, next_action)만 충실히 채움
- 나머지 필드(key_points, treatment_options, cautions, avoidance_violations 등)는 빈 배열 또는 1줄로 간결히
- 불필요한 중복·장문 설명 금지
- JSON 외 텍스트 절대 금지

당신은 15년 경력의 **환자 중심(patient-centered)** 치과 상담 코치다. 상담실장이 방금 환자와 실제 대화를 나눴다.
아래 녹취 전체를 읽고 **대화의 결**과 **환자의 불안·두려움·속마음**을 이해한 뒤, 상담실장이 이어서 말할 답변을 준비하라.

${ctx}${hist}${rawBlock}${labeledBlock}
${lastPatient ? `참고 — 가장 최근 환자 발화(외부 제공): "${lastPatient}"` : '화자 라벨링 후 diarized_turns 내 마지막 patient 발화를 기준으로 분석하라.'}

${typeof QLRCQFramework !== 'undefined' ? '[QLRCQ Framework 참조 — 단계별 3요소]\n' + QLRCQFramework.serializeForPrompt() + '\n\n' : ''}[덴탈클리닉파인더 5단계 × QLRCQ 방법론 — 반드시 적용]

## 5 대단계 (Macro Phases) — 대화는 1→5 순서로 나선형 심화
1. **공감 (Empathy)** — 감정을 먼저 언어로 인정
2. **이해 (Understanding)** — 환자의 상황·맥락·우려를 구조적으로 파악
3. **선택권 제공 (Providing Choice / Decision Rights)** — 2~3개 선택지를 나란히 제시, 결정권을 환자에게
4. **가치 전달 (Delivering Value)** — 선택 각각의 가치를 담담히 공유 (판매 아님)
5. **신뢰 구축 (Building Trust)** — 재방문·추가 질문·재연락의 문을 여는 관계 확립

## QLRCQ 마이크로 사이클 — 각 단계 내에서 반복
- **Q (Question)** — 질문으로 문 열기
- **L (Listen)** — 경청 (끊지 않고 완성된 반응 받기)
- **R (Reaction)** — 반응·공명 (판단 없이 감정 되비추기)
- **C (Confirm)** — 확인 ("제가 이해한 게 맞나요?"로 확인)
- **Q' (Re-Question)** — 재질문 ⭐ 이 방법론의 핵심 차별화. Confirm에서 멈추지 않고 다시 질문으로 대화를 한 단계 더 깊이 이끎

## 각 단계의 3요소
- **Success Signals**: 이 단계가 성공적으로 작동 중임을 보여주는 환자 반응·발화
- **Core Principles**: 상담사가 지켜야 할 태도 원칙
- **Critical Avoidance**: ❌ 이 단계에서 절대 피할 어휘·행동 (예: "지금 안 하면 큰일납니다" 류 압박)

## 절대 금지 어휘 (출력 시 사용 금지)
- "전환율", "클로징", "설득", "오늘만 할인", "지금 결정하셔야", "미루면 큰일납니다"

[스킬·하네스 원칙 적용]
1) 의도 파악: 가격·통증·불안·시간·신뢰·비교·정보부족·결정지연 중 어디에 속하는지 (복수 가능)
2) 클리셰 금지: "AI는 도구다" 수준의 뻔한 답변은 폐기
3) 반례 고려: 이 환자에게 오히려 역효과일 수 있는 접근 명시
4) 두 번째 만남 설계: 한 번에 계약을 몰지 말고, "다음 접점"을 만드는 방향

JSON으로만 출력:
{
  "diarized_turns": [ { "speaker": "patient|staff", "text": "발화 내용" } ],
  "last_patient_utterance": "라벨링 결과 중 마지막 환자 발화 원문",
  "macro_stage": 1~5 숫자 (현재 대단계),
  "macro_stage_name": "공감|이해|선택권 제공|가치 전달|신뢰 구축",
  "qlrcq_position": "Q|L|R|C|Q'  (현재 상담사가 수행해야 할 마이크로 사이클 위치)",
  "qlrcq_reason": "왜 지금 이 사이클 위치인지 1문장",
  "success_signals_detected": ["현재 발화에서 감지된 성공 신호 0~3개 (없으면 빈 배열)"],
  "principle_alignment": "준수|부분준수|위반",
  "avoidance_violations": ["상담사 발화 중 Critical Avoidance에 해당하는 것 0~2개 (없으면 빈 배열)"],
  "next_stage_gate": "다음 대단계로 넘어가려면 충족돼야 할 조건 1문장",
  "intent_primary": "주 의도(price|pain|fear|time|trust|compare|info|delay)",
  "intent_secondary": ["2~3개 보조 태그"],
  "subtext": ["환자의 불안·두려움·속마음을 1줄씩 2~3개 (판단 없이 관찰만)"],
  "recommended_reply": ["상담실장이 그대로 말할 핵심 문장 4~6개 — 현재 macro_stage의 Core Principles와 qlrcq_position에 맞춰 구성"],
  "key_points": ["현재 단계에서 환자 자율성을 존중하며 짚을 포인트 3~4개"],
  "treatment_options": [
    { "name": "옵션 A (예: 즉시 치료)", "pros": "장점 1줄", "cons": "고려할 점 1줄", "estimate_range": "예: 300~500만원" },
    { "name": "옵션 B (예: 부분 치료 또는 관찰)", "pros": "장점", "cons": "고려할 점", "estimate_range": "비용" }
  ],
  "readiness": 0~100 숫자 (환자의 심리적 결정 준비도 — 판매 전환율 아님),
  "next_action": "QLRCQ 다음 위치에서 상담사가 할 구체 행동 1문장 (예: '방금 확인한 감정을 다시 Q'로 되물어 깊이 탐색')",
  "cautions": ["현재 단계에서 피해야 할 어휘·태도 2~3개 (Critical Avoidance 기반)"],
  "risk_level": "low|medium|high"
}`;

    // 폴백용 간단 휴리스틱 화자 분리 (라벨 없을 때만)
    const fbDiarized = hasLabeled
      ? transcript
      : raw.map(u => {
          const t = (u.text || '').trim();
          // 매우 단순한 규칙: 의료 용어/제안 어휘 있으면 staff 가중
          const staffKeywords = /치료|비용|예약|진단|처방|말씀드리|도와드리|추천드립니다|설명드리/;
          const patientKeywords = /아파|무서|부담|걱정|싫|얼마|어떻게|해야|꼭|진짜/;
          let speaker = 'patient';
          if (staffKeywords.test(t) && !patientKeywords.test(t)) speaker = 'staff';
          return { speaker, text: t };
        });
    const fbLastPatient = fbDiarized.filter(t => t.speaker === 'patient').slice(-1)[0]?.text || question || '';

    const fallback = {
      diarized_turns: fbDiarized,
      last_patient_utterance: fbLastPatient,
      macro_stage: 1,
      macro_stage_name: '공감',
      qlrcq_position: 'R',
      qlrcq_reason: '환자가 불안을 드러냈으므로 Listen 이후 Reaction(공명 반응) 단계',
      success_signals_detected: [],
      principle_alignment: '부분준수',
      avoidance_violations: [],
      next_stage_gate: '환자가 "이해받고 있다"는 반응을 보이면 2단계(이해)로 진입',
      intent_primary: 'price',
      intent_secondary: ['fear'],
      subtext: [
        '비용에 대한 걱정 뒤에 치료 필요성과 실패 가능성에 대한 불안이 함께 있음',
        '중요한 결정을 혼자 내리기 부담스럽고, 가족과 의논할 시간이 필요해 보임',
        '여러 가능성을 비교하며 스스로 납득하고 싶어함'
      ],
      recommended_reply: [
        '공감: "비용 부담이 크게 느껴지시는 거 충분히 이해합니다. 누구라도 쉽지 않은 결정이에요."',
        '감정 인정: "걱정되시는 게 당연합니다. 꼭 지금 결정하지 않으셔도 됩니다."',
        '정보 공유: "참고로 말씀드리면, 현재 상태에서 가능한 선택지가 몇 가지 있어서 편하게 알려드릴게요."',
        '선택지 제시: "① 오늘 정밀 진단만 받아보시고 자료를 드리는 것, ② 부분만 먼저 치료하는 것, ③ 지금은 관찰하고 3~6개월 후 재평가하는 것 — 세 가지 모두 가능합니다."',
        '자율 존중: "원장님께 정보만 충분히 들으시고, 집에서 가족분과 의논하신 후 편한 날 다시 말씀 주셔도 좋습니다. 저희가 재촉하지 않습니다."'
      ],
      key_points: [
        '환자의 "비싸다"는 말 뒤의 불안을 먼저 언어로 인정하기',
        '치료를 권유하기 전에 "결정은 천천히 하셔도 됩니다"를 먼저 말하기',
        '2~3개 선택지를 나란히 제시하고 각 장단점 중립적으로 안내',
        '추가 질문·상담 기회를 언제든 열어두고 있음을 명시'
      ],
      treatment_options: [
        { name: '정밀 진단 + 자료 제공 (결정 보류)', pros: '환자가 정보를 충분히 검토한 뒤 판단 가능', cons: '치료가 길어질 경우 손상 진행 가능', estimate_range: '진단비 10~20만원' },
        { name: '부분 치료 우선', pros: '부담을 낮추면서 핵심 부위부터 보호', cons: '전체 치료 시 총비용은 유사', estimate_range: '200~300만원' },
        { name: '경과 관찰 후 3~6개월 재평가', pros: '결정에 시간 확보, 경제적 부담 최소', cons: '상태 변화 시 치료 범위가 늘 수 있음', estimate_range: '정기 검진 비용만' }
      ],
      readiness: 45,
      next_action: '환자에게 선택지 자료(팸플릿·견적서)를 드리고 "일주일 안에 편한 때 다시 연락 주시면 됩니다"라고 시간 여지를 열어두기',
      cautions: [
        '"지금 안 하시면 큰일납니다", "미루면 더 비싸집니다" 같은 공포 기반 설득 금지',
        '"결정을 도와드린다"는 말 뒤에 사실상 압박(할인 한정·오늘만 등)을 붙이지 말 것',
        '환자가 침묵할 때 빈 공간을 조급하게 메우지 말고 기다릴 것'
      ],
      risk_level: 'medium'
    };
    return await safeGeminiJson(prompt, fallback, null, 'consult_coach');
  },

  // ⚡ 빠른 즉시 응답 (Phase 2 — 실시간 상담 맥 유지용)
  // 1~1.5초 내 응답을 목표로 최소 3필드만 반환
  async coachReplyQuick({ patient, utterances, transcript, language }) {
    const hasLabeled = Array.isArray(transcript) && transcript.length &&
                       transcript.every(t => t.speaker === 'patient' || t.speaker === 'staff');
    const raw = !hasLabeled ? (utterances || transcript || []) : [];

    const block = hasLabeled
      ? transcript.slice(-8).map(t => (t.speaker === 'staff' ? '[실장] ' : '[환자] ') + t.text).join('\n')
      : raw.slice(-8).map((u, i) => `[${i + 1}] "${u.text}"`).join('\n');

    const ctx = patient ? `환자: ${patient.name} (${patient.age || '?'}세, 관심: ${patient.treatment || '미정'})` : '';

    // 다언어 지시문
    const langInstruction = language && language !== 'ko-KR'
      ? `⚠️ CRITICAL: Respond ENTIRELY in the language of the conversation (detected: ${language}). All fields (intent, subtext, recommended_reply) MUST be written in that language.\n\n`
      : '';

    const prompt = `${langInstruction}⚡ 실시간 즉시 코칭 (1초 이내 필수). 핵심 3필드만, 장문 금지.

${ctx}
녹취(최근):
${block}

JSON만 출력 (마크다운/설명 금지):
{
  "intent": "환자 주 의도 1~2단어 (예: 라미네이트 / 비용 걱정 / 정보 확인)",
  "subtext": "환자 속마음 관찰 1줄 (판단 없이)",
  "recommended_reply": "상담실장이 바로 말할 문장 1~2줄 (공감→질문 순, 압박·설득·판매 어휘 금지)"
}`;

    const fallback = {
      intent: '정보수집',
      subtext: '환자가 충분한 정보를 얻지 못한 상태일 수 있음',
      recommended_reply: '말씀해주셔서 감사합니다. 조금 더 여쭤봐도 될까요?'
    };

    return await safeGeminiJson(prompt, fallback, null, 'consult_quick');
  },

  // 세션 전체 평가 + 상담사 피드백
  // session: { turns[], coachResults[], startedAt, endedAt, patientName, author, durationSec }
  // history: 동일 환자의 과거 세션 요약 배열 (선택)
  async evaluateSession({ session, patient, history }) {
    const turns = (session?.turns || []).map((t, i) => {
      const label = t.speaker === 'staff' ? '[실장]' : t.speaker === 'patient' ? '[환자]' : '[미구분]';
      return `${i + 1}. ${label} ${t.text}`;
    }).join('\n');
    const coachSummaries = (session?.coachResults || []).map((c, i) => {
      const d = c.data || {};
      return `${i + 1}. readiness=${d.readiness ?? d.conversion_probability ?? '-'} / ${d.intent_primary || ''} / 권장: ${Array.isArray(d.recommended_reply) ? d.recommended_reply[0] : d.recommended_reply || ''}`;
    }).join('\n');
    const ctx = patient ? `환자: ${patient.name} (${patient.age}세, 관심: ${patient.treatment || '미정'})\n` : '';
    const meta = session
      ? `세션: ${Math.round((session.durationSec || 0) / 60)}분 · 대화 ${session.turns?.length || 0}회 · 코칭 ${session.coachResults?.length || 0}회\n`
      : '';
    const pastBlock = history && history.length
      ? '동일 환자 이전 세션 요약:\n' + history.slice(0, 5).map((h, i) => `${i + 1}. ${h}`).join('\n') + '\n'
      : '';

    const prompt = `당신은 **환자 중심(patient-centered) 상담** 평가 코치다.
아래는 방금 끝난 실제 상담 세션 전체 녹취다. 상담사의 수행을 **덴탈클리닉파인더 5단계 × QLRCQ 방법론**에 비추어 평가하라.

${typeof QLRCQFramework !== 'undefined' ? '[QLRCQ Framework 참조]\n' + QLRCQFramework.serializeForPrompt() + '\n\n' : ''}${ctx}${meta}${pastBlock}
[대화 녹취]
${turns || '(비어있음)'}

[세션 중 생성된 코칭 스냅샷]
${coachSummaries || '(없음)'}

[평가 기준 — 덴탈클리닉파인더 공식 5축, 각 0~20점, 총 100점]
1. **공감 완결도 (Empathy Completion)** — 1단계에서 환자 감정을 언어로 충분히 인정했는가
2. **이해 깊이 (Understanding Depth)** — 2단계에서 환자 상황·맥락을 구조적으로 파악했는가
3. **선택권 존중 (Choice Respect)** — 3단계에서 2~3개 선택지를 나란히 제시하고 결정권을 환자에게 넘겼는가
4. **가치 전달 명료성 (Value Clarity)** — 4단계에서 각 선택의 가치를 판매 아닌 공유 톤으로 전달했는가
5. **신뢰 구축 강도 (Trust Depth)** — 5단계에서 재방문·추가 질문·재연락의 문을 열었는가

[보조 지표]
- **QLRCQ 사이클 완주율 (0~100%)** — 대화가 Q→L→R→C→Q' 사이클을 얼마나 완결적으로 수행했는가
- **Critical Avoidance 위반 횟수** — 금지 어휘·태도 사용 횟수

JSON으로만 출력:
{
  "summary": ["세션 핵심 요약 3~5줄 (환자 상태·주제·전개 흐름)"],
  "patient_concerns": ["환자가 표현한 주요 우려·불안 2~4개"],
  "key_moments": [
    { "when": "몇 번째 turn 또는 시점", "quote": "해당 발화 원문 일부", "why": "왜 중요한 순간인가" }
  ],
  "staff_strengths": ["상담사가 잘한 점 3~4개 (구체적 인용과 함께)"],
  "staff_improvements": ["개선 기회 2~3개 — 다음에 이렇게 해보세요"],
  "principle_violations": [
    { "principle": "강요 금지|자율성 존중|공감 우선|정보 균형|침묵 허용", "quote": "위반 의심 발화", "suggestion": "대안 문장" }
  ],
  "suggested_followup": ["상담 이후 권장 조치 2~3개 (시간 제공·자료 발송·재방문 제안 등, 재촉 금지)"],
  "scores": {
    "empathy_completion": 0~20,
    "understanding_depth": 0~20,
    "choice_respect": 0~20,
    "value_clarity": 0~20,
    "trust_depth": 0~20
  },
  "qlrcq_cycle_completion": 0~100 (QLRCQ 사이클 완주율 %),
  "max_reached_stage": 1~5 (세션이 도달한 최고 대단계),
  "stage_distribution": { "1": 0~100, "2": 0~100, "3": 0~100, "4": 0~100, "5": 0~100 } (각 단계에 대화가 머문 비중 %),
  "avoidance_violation_count": 0 이상 정수,
  "overall_score": 0~100 (scores 합산),
  "readiness_trajectory": { "start": 0~100, "end": 0~100, "note": "변화의 의미 1줄" }
}`;

    const fallback = {
      summary: [
        '초기 가격·불안 혼합 저항 환자. 상담 중반 실장이 선택지 3개를 중립적으로 제시한 뒤 환자 긴장이 낮아졌음.',
        '환자는 가족과 의논할 시간을 원한다는 신호를 두 번 보냈고, 실장이 이를 수용함.',
        '의료적 결정은 유보되었지만 "재방문에 열려 있음" 상태로 세션 종료.'
      ],
      patient_concerns: [
        '비용이 가족 재정에 부담을 줄까 걱정',
        '치료 실패·부작용 가능성에 대한 막연한 두려움',
        '결정을 혼자 내리는 것에 대한 심리적 부담'
      ],
      key_moments: [
        { when: 'turn 3', quote: '"생각보다 비싸네요"', why: '표면은 가격이지만 실제는 불안 표현 — 이 순간 실장이 공감으로 받은 것이 세션 톤을 결정' },
        { when: 'turn 7', quote: '"오늘 결정 안 하셔도 됩니다"', why: '자율성 존중 언어가 환자의 방어를 풀어 다음 정보 수용으로 이어짐' },
      ],
      staff_strengths: [
        '환자의 "부담스럽다" 발화에 판단 없이 "충분히 이해합니다"로 공감한 점',
        '치료 옵션을 ①즉시 ②부분 ③관찰 세 가지로 제시해 균형을 유지',
        '"결정은 천천히 하셔도 됩니다"를 대화 중 두 번 명시해 자율성 보장'
      ],
      staff_improvements: [
        '환자가 침묵한 15초 구간에서 정보를 덧붙이기보다 "생각해보실 시간 드릴게요"로 기다려 보는 것도 좋음',
        '마지막 단계에서 "자료를 문자로 드릴까요"로 선택권을 한 번 더 넘기기'
      ],
      principle_violations: [],
      suggested_followup: [
        '상담 자료(팸플릿·옵션별 견적)를 환자가 원한 방식(문자/메일)으로 발송',
        '"일주일 안에 편한 때 연락 주시면 됩니다" — 연락 주체를 환자에게 넘기기',
        '2주 후까지 연락이 없으면 간단한 안부 메시지 1회만 (재촉 아님)'
      ],
      scores: {
        empathy_completion: 17,
        understanding_depth: 16,
        choice_respect: 18,
        value_clarity: 15,
        trust_depth: 16
      },
      qlrcq_cycle_completion: 72,
      max_reached_stage: 3,
      stage_distribution: { '1': 32, '2': 28, '3': 30, '4': 8, '5': 2 },
      avoidance_violation_count: 0,
      overall_score: 82,
      readiness_trajectory: { start: 35, end: 58, note: '결정 자체는 유보했지만 심리적 문이 열린 상태' }
    };
    return await safeGeminiJson(prompt, fallback);
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
