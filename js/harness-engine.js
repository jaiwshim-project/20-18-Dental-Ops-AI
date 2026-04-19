/* ============================================================
   Dental Ops AI — Harness Engine (6-Stage Insight Pipeline)
   Curator → Miner → Architect → Writer → Critic → Editor
   ============================================================ */

const HarnessEngine = {
  STAGES: [
    { id: 'curator',   label: '① Curator',   desc: '재료 카드 추출' },
    { id: 'miner',     label: '② Insight Miner', desc: '패턴·역설 채광' },
    { id: 'architect', label: '③ Architect', desc: '서사 도면 설계' },
    { id: 'writer',    label: '④ Writer',    desc: '산문 초안 집필' },
    { id: 'critic',    label: '⑤ Critic',    desc: '적대적 검증' },
    { id: 'editor',    label: '⑥ Editor',    desc: '문체 정련' },
  ],

  // ------------------------------------------------------------
  // Stage 1. Material Curator
  // ------------------------------------------------------------
  async curate({ topic, data }) {
    const prompt = `당신은 인사이트 블로그 집필 파이프라인의 첫 단계인 Material Curator다.
원본 자료를 정독하고 글에 인용·소환할 가치가 있는 "재료 카드"를 추출한다.

주제: ${topic}
원본 자료(JSON): ${JSON.stringify(data).slice(0, 3500)}

카드 유형:
- SCENE: 작가가 본문에 풀어낼 구체적 묘사
- QUOTE: 제출자/저자의 직접 표현 (원문 보존)
- CASE: 도메인+문제+해결 패턴이 묶인 단위
- COUNTER: 통념과 충돌하는 예외

JSON으로만 출력 (8~12개):
{
  "cards": [
    { "id": "CARD-01", "type": "SCENE|QUOTE|CASE|COUNTER", "content": "1~2문장", "source": "출처 위치", "confidence": "high|medium|low" }
  ],
  "cross_refs": [ "CARD-03과 CARD-07이 모두 자기 개선 루프" ]
}`;

    const fallback = {
      cards: [
        { id: 'CARD-01', type: 'CASE', content: '상담 전환율 68%, 오후 3~5시 구간 집중', source: 'kpi.conversionRate', confidence: 'high' },
        { id: 'CARD-02', type: 'COUNTER', content: '상담 시간이 길수록 전환율 높지만 14분 넘으면 하락', source: 'kpi.avgConsultMin', confidence: 'medium' },
        { id: 'CARD-03', type: 'CASE', content: '임플란트 전환은 2회차 상담에서 78%로 급증', source: 'treatmentMix.임플란트', confidence: 'high' },
        { id: 'CARD-04', type: 'SCENE', content: '가격 부담 환자가 "생각보다 비싸네요" 한마디 후 침묵하는 장면', source: 'consult_logs', confidence: 'medium' },
        { id: 'CARD-05', type: 'QUOTE', content: '"이 상태를 방치하면 6개월 뒤 더 큰 수술로 이어집니다"', source: 'script template', confidence: 'high' },
        { id: 'CARD-06', type: 'COUNTER', content: 'AI 활용률 84%인데 재방문율은 76%로 정체', source: 'kpi.aiUsageRate vs revisitRate', confidence: 'high' },
      ],
      cross_refs: ['CARD-01과 CARD-03은 전환 밀도가 시간·회차에 종속됨을 보여줌']
    };
    return await safeGeminiJson(prompt, fallback);
  },

  // ------------------------------------------------------------
  // Stage 2. Insight Miner
  // ------------------------------------------------------------
  async mine({ topic, cards }) {
    const prompt = `당신은 Insight Miner다. 적은 클리셰 하나뿐이다.
"AI는 도구다", "사람과 도구의 협업이 중요하다" 같은 익숙한 결론은 인사이트의 시체다.
카드에서 표면 한 겹을 더 벗긴 통찰을 길어내라.

주제: ${topic}
카드: ${JSON.stringify(cards).slice(0, 3500)}

인사이트 유형:
- PATTERN: 여러 카드에 반복되는 비자명한 구조
- PARADOX: 통념과 충돌하는 사실
- CONSTRAINT_AS_FREEDOM: 제약이 자유로 작용한 구조
- CROSS_DOMAIN_ECHO: 본 도메인 밖에서 발견되는 같은 형태
- SECOND_ORDER: 1차가 아니라 2차 효과

규칙:
- 각 인사이트는 최소 2개 CARD 근거
- 각 인사이트에 "깨지는 경우(반례)" 한 줄 필수
- 보고서에 이미 적힌 결론 반복 금지

JSON (3~5개):
{
  "insights": [
    { "id":"INS-01", "type":"PATTERN", "claim":"1문장", "anchors":["CARD-01","CARD-03"], "counter":"이 인사이트가 깨지는 경우" }
  ],
  "strongest_paradox": "단 하나의 가장 날카로운 역설 한 문장"
}`;

    const fallback = {
      insights: [
        { id: 'INS-01', type: 'PARADOX', claim: '상담 시간은 길수록 전환율이 오르지만, 14분을 넘기면 오히려 떨어진다.', anchors: ['CARD-02'], counter: '고난이도 임플란트 초진 상담은 20분 이상이 되어도 전환율이 유지됨' },
        { id: 'INS-02', type: 'SECOND_ORDER', claim: 'AI 활용률을 높여도 재방문율은 오르지 않는다 — AI가 "첫 상담을 잘 만들지만 관계를 잇지는 못한다"는 신호.', anchors: ['CARD-06', 'CARD-01'], counter: '사후관리 자동화만 별도로 켠 병원에서는 재방문율이 AI 활용률을 따라 상승' },
        { id: 'INS-03', type: 'PATTERN', claim: '계약은 정보가 아니라 "두 번째 만남"에서 일어난다 — 1회차는 정보 제공, 2회차에서 결정.', anchors: ['CARD-03', 'CARD-04'], counter: '통증 호소 환자군은 1회차에서 즉시 결정되는 비율이 70% 이상' },
      ],
      strongest_paradox: '환자가 "비싸다"고 할 때, 그는 돈이 아니라 불안을 말하고 있다.'
    };
    return await safeGeminiJson(prompt, fallback);
  },

  // ------------------------------------------------------------
  // Stage 3. Narrative Architect
  // ------------------------------------------------------------
  async blueprint({ topic, insights, paradox }) {
    const prompt = `당신은 Narrative Architect다. 글을 쓰지 않는다. 도면을 그린다.
한 편의 글이 시작-전개-전환-결말을 지나는 동안 하나의 명제가 점점 더 깊어지도록 설계하라.

주제: ${topic}
인사이트: ${JSON.stringify(insights).slice(0, 2500)}
중심 역설: ${paradox}

설계 요건:
- 단일 명제(thesis): 글 전체가 변호할 한 문장
- 메타포: 치과 도메인 밖(항해/요리/작곡 등)에서 끌어온 일관된 비유 1개
- 5~7개 섹션 도면 (섹션은 정보 단위가 아니라 호흡 단위)
- 반론 위치 지정 (강요로 읽히지 않도록)
- 진입 장면 + 결말 장면 (호응 구조)

JSON:
{
  "thesis": "한 문장 명제",
  "metaphor": { "image": "비유 이미지", "why": "왜 이 비유가 글에 필요한가" },
  "opening_scene": "진입 장면 1~2문장",
  "closing_scene": "결말 장면 1~2문장 (opening과 호응)",
  "sections": [
    { "n":1, "role":"진입", "beat":"호흡 묘사", "key_insight":"INS-XX", "anchors":["CARD-XX"], "length":"짧음|중간|긺" }
  ],
  "counter_argument_position": "섹션 n번에 배치"
}`;

    const fallback = {
      thesis: '치과 상담의 승패는 "답변의 품질"이 아니라 "두 번째 만남을 만드는 구조"에서 결정된다.',
      metaphor: { image: '항해의 첫 항구와 두 번째 항구', why: '첫 상담은 배를 띄우는 일이고, 두 번째 상담은 목적지에 정박시키는 일이다. 승객은 첫 항구의 풍경이 아니라 두 번째 항구의 안전을 보고 표를 산다.' },
      opening_scene: '오후 세 시, 상담실의 침묵. 환자는 "생각보다 비싸네요"라고 말하고 15초간 입을 다문다. 이 15초가 전환율을 가른다.',
      closing_scene: '다시 오후 세 시. 같은 환자가 일주일 뒤 두 번째로 문을 연다. 이번엔 그가 먼저 묻는다 — "언제부터 시작할 수 있나요?"',
      sections: [
        { n: 1, role: '진입', beat: '오후 3시 침묵 장면', key_insight: 'INS-03', anchors: ['CARD-04'], length: '짧음' },
        { n: 2, role: '문제 제기', beat: '왜 첫 상담만으로는 부족한가', key_insight: 'INS-03', anchors: ['CARD-03'], length: '중간' },
        { n: 3, role: '핵심 역설', beat: '시간이 길수록 좋지만 14분 벽', key_insight: 'INS-01', anchors: ['CARD-02'], length: '중간' },
        { n: 4, role: '반론', beat: '"그래도 답변 품질이 전부다"라는 반박', key_insight: 'INS-02', anchors: ['CARD-06'], length: '짧음' },
        { n: 5, role: '재정립', beat: '관계를 잇는 자동화의 역할', key_insight: 'INS-02', anchors: ['CARD-06', 'CARD-05'], length: '중간' },
        { n: 6, role: '결말', beat: '두 번째 항구 — 같은 오후 3시', key_insight: 'INS-03', anchors: ['CARD-03'], length: '짧음' },
      ],
      counter_argument_position: '섹션 4번'
    };
    return await safeGeminiJson(prompt, fallback);
  },

  // ------------------------------------------------------------
  // Stage 4. Prose Writer
  // ------------------------------------------------------------
  async write({ topic, blueprint, cards, insights }) {
    const prompt = `당신은 Prose Writer다. 도면 위에 글을 짓는다.
두 가지 유혹 — 친절해지려는 유혹(모든 것을 설명), 현학에 기대는 유혹(멋진 단어로 빈약한 통찰 덮기) — 모두 글을 죽인다.

주제: ${topic}
도면: ${JSON.stringify(blueprint).slice(0, 2500)}
카드(인용 원문): ${JSON.stringify(cards).slice(0, 1500)}
인사이트: ${JSON.stringify(insights).slice(0, 1500)}

집필 원칙:
- 도면의 명제·메타포·섹션 순서를 그대로 지킨다
- 한 단락 안에 짧은 문장과 긴 문장을 교차시킨다
- 카드 원문 인용은 자연스럽게 직조 (앞뒤로 작가의 사유가 한 호흡씩 흐르게)
- 숫자의 의미가 한 번의 호흡으로 와 닿도록 리듬을 만든다
- 반론은 약하게 만들지 않는다. 가장 강한 반론을 그대로 적고, 인정한 뒤 명제를 더 좁고 단단하게 다시 진술한다

마크다운으로 출력. 섹션 헤딩 사용. 분량 800~1400자 (한글 기준).`;

    const fallback = `# ${topic}

## 오후 3시, 그 15초

오후 세 시. 상담실은 갑자기 조용해진다. 환자가 방금 "생각보다 비싸네요"라고 말했고, 그 뒤로 15초가 흘렀다. 대부분의 상담자는 이 15초를 불편해한다. 그래서 메운다. 할인 구조를 설명하고, 치료의 장기 비용을 계산해주고, 비슷한 사례를 꺼낸다.

그런데 이 15초를 메우는 상담일수록 전환율이 낮다.

## 길게 답해도 지는 싸움

우리가 가진 데이터는 단순하다. 평균 상담 시간이 길수록 계약률은 오른다. 하지만 14분을 넘기는 순간, 그래프가 꺾인다. 이건 상담자의 자질 문제가 아니라 상담의 본질 문제다.

환자는 정보를 더 듣고 싶어서 앉아 있는 것이 아니다. 그는 결정을 내릴 이유를 찾고 있다. 그리고 결정의 이유는 두 번째 만남에서만 나온다.

> 임플란트 상담의 78%가 2회차에서 계약된다.

한 번 더 오는 환자와 오지 않는 환자를 가르는 건 첫 상담의 답변이 아니다. 첫 상담이 다음 만남을 **필요하게 만들었는지 여부**다.

## 반론 — "그래도 답변의 품질이 전부다"

물론 이런 반론이 있을 수 있다. AI 활용률을 84%까지 끌어올린 우리 병원은 실제로 답변 품질에서 우위를 가져갔다. 이 숫자는 사실이다.

그런데 같은 기간 재방문율은 76%에서 움직이지 않았다.

답변을 잘해서 계약은 는다. 그러나 관계는 답변에 따라오지 않는다. 답변은 "첫 항구"를 아름답게 만들 뿐, "두 번째 항구"까지 배를 데려다주지 않는다.

## 두 번째 항구

승객은 첫 항구의 풍경을 보고 배를 타지 않는다. 두 번째 항구의 안전을 보고 표를 산다.

그래서 상담 자동화의 진짜 전장은 첫 응답의 속도가 아니라, **두 번째 접점을 만드는 구조**다. 재방문 리마인더, 사후관리 메시지, 2회차 상담 예약 유도 — 이 셋이 AI 활용률과 별개로 움직일 때, 병원의 KPI는 멈춘다.

## 다시 오후 3시

같은 환자가 일주일 뒤 문을 연다. 이번엔 그가 먼저 묻는다. "언제부터 시작할 수 있나요?"

그 15초의 침묵은 메워야 할 공백이 아니었다. 두 번째 항구로 가는 배편을 준비할 시간이었다.`;

    return await safeGemini(prompt, fallback);
  },

  // ------------------------------------------------------------
  // Stage 5. Critical Reader
  // ------------------------------------------------------------
  async critique({ topic, draft, cards }) {
    const prompt = `당신은 Critical Reader다. 이 글을 처음 본다. 도면도 의도도 모른다.
완성된 초안이 자기 발로 설 수 있는지 시험하라.

주제: ${topic}
초안: ${draft.slice(0, 3500)}
원문 카드(대조용): ${JSON.stringify(cards).slice(0, 1500)}

점검 항목:
- 클리셰 적출: "AI는 도구다", "사람이 중요하다" 같은 무한 반박 가능 명제
- 논리 비약: A→B에 빠진 단계
- 반론 강도: 반론이 허수아비인가
- 진입/결말 효력
- 인용 정확성 (카드와 숫자 일치)

JSON:
{
  "cliche_risk": "low|medium|high",
  "cliche_instances": ["의심 문장 1~3개"],
  "logical_gaps": ["비약 지점 1~3개"],
  "weak_counter": true|false,
  "opening_passes": true|false,
  "closing_passes": true|false,
  "numeric_check": [ {"cited":"인용 숫자", "source_card":"CARD-XX", "match":true|false} ],
  "must_fix": ["반드시 고칠 것 1~2개"],
  "nice_to_fix": ["권장 1~2개"]
}`;

    const fallback = {
      cliche_risk: 'low',
      cliche_instances: [],
      logical_gaps: ['섹션 4에서 "재방문율이 움직이지 않았다"와 "답변은 관계를 못 만든다" 사이에 인과 연결이 얇음'],
      weak_counter: false,
      opening_passes: true,
      closing_passes: true,
      numeric_check: [
        { cited: '14분', source_card: 'CARD-02', match: true },
        { cited: '78%', source_card: 'CARD-03', match: true },
        { cited: '84%', source_card: 'CARD-06', match: true },
      ],
      must_fix: ['섹션 4의 인과 연결 한 문장 보강'],
      nice_to_fix: ['"두 번째 항구" 메타포가 한 번 더 등장하면 닫힘이 강해짐']
    };
    return await safeGeminiJson(prompt, fallback);
  },

  // ------------------------------------------------------------
  // Stage 6. Style Editor
  // ------------------------------------------------------------
  async edit({ topic, draft, critique }) {
    const prompt = `당신은 Style Editor다. 글을 새로 쓰지 않는다.
이미 거의 완성된 글의 삐걱거리는 단어, 늘어진 호흡, 어긋난 단정의 강도를 외과적으로 수정한다.
잘못 큰 손이 닿으면 글이 표준화되고, 표준화된 글은 인사이트가 빠져나간다.

주제: ${topic}
초안: ${draft.slice(0, 3500)}
비평: ${JSON.stringify(critique).slice(0, 1500)}

수정 원칙:
- 비평의 must_fix만 반드시 반영 (문체·리듬 차원)
- 구조·내용 차원 약점은 주석으로 남기고 건드리지 않음
- 죽은 단어(추상명사 남용, 기능적 동사, 접속어 과잉) → 살아있는 단어
- 한 단락 3회 이상 반복 단어는 변주 (단, 의도된 주문은 보존)
- 시각 리듬: 단락 사이 구분선, 강조, 인용 들여쓰기

마크다운으로 최종본만 출력 (서문·해설 없이).`;

    return await safeGemini(prompt, draft);
  },

  // ------------------------------------------------------------
  // 구조화 요약 추출 (기존 InsightEngine 호환)
  // ------------------------------------------------------------
  async structuredSummary({ topic, insights, blueprint, final }) {
    const prompt = `하네스로 생성한 리포트를 기존 인사이트 포맷으로 요약하라.

주제: ${topic}
인사이트: ${JSON.stringify(insights).slice(0, 1500)}
도면 명제: ${blueprint.thesis || ''}
최종 산문(앞 1000자): ${(final || '').slice(0, 1000)}

JSON:
{
  "summary": "3~5문장 executive summary",
  "findings": [ {"pattern":"", "evidence":"", "implication":""} ],
  "paradox": "가장 날카로운 역설 한 줄",
  "strategy": "3~5줄 전략 제안 (줄바꿈 구분)",
  "kpi_to_track": ["추적 KPI 2~3개"]
}`;

    const fallback = {
      summary: (blueprint.thesis || '') + ' ' + (insights?.[0]?.claim || ''),
      findings: (insights || []).slice(0, 3).map(i => ({
        pattern: i.claim || '',
        evidence: (i.anchors || []).join(', '),
        implication: i.counter || '',
      })),
      paradox: (insights || []).find(i => i.type === 'PARADOX')?.claim || '',
      strategy: '1) 2회차 상담 예약 유도 자동화 강화\n2) 14분 체크포인트 상담 코칭\n3) 사후관리 메시지를 AI 활용률과 분리 운영',
      kpi_to_track: ['2회차 상담 전환율', '상담 14분 이상 계약률', '재방문율']
    };
    return await safeGeminiJson(prompt, fallback);
  },

  // ------------------------------------------------------------
  // 전체 파이프라인 실행
  // onProgress(stageId, result, { demo }) — UI 업데이트 콜백
  // ------------------------------------------------------------
  async run({ topic, data }, onProgress) {
    const emit = (id, payload, meta = {}) => {
      try { onProgress && onProgress(id, payload, meta); } catch (e) { console.warn(e); }
    };
    const out = { topic, demoChain: [] };

    // 1. Curator
    emit('curator', null, { status: 'running' });
    const r1 = await this.curate({ topic, data });
    out.cards = r1.data?.cards || r1.cards || [];
    out.crossRefs = r1.data?.cross_refs || r1.cross_refs || [];
    out.demoChain.push(!!r1.demo);
    emit('curator', { cards: out.cards, cross_refs: out.crossRefs }, { status: 'done', demo: r1.demo });

    // 2. Miner
    emit('miner', null, { status: 'running' });
    const r2 = await this.mine({ topic, cards: out.cards });
    out.insights = r2.data?.insights || r2.insights || [];
    out.paradox = r2.data?.strongest_paradox || r2.strongest_paradox || '';
    out.demoChain.push(!!r2.demo);
    emit('miner', { insights: out.insights, paradox: out.paradox }, { status: 'done', demo: r2.demo });

    // 3. Architect
    emit('architect', null, { status: 'running' });
    const r3 = await this.blueprint({ topic, insights: out.insights, paradox: out.paradox });
    out.blueprint = r3.data || r3;
    out.demoChain.push(!!r3.demo);
    emit('architect', out.blueprint, { status: 'done', demo: r3.demo });

    // 4. Writer
    emit('writer', null, { status: 'running' });
    const r4 = await this.write({ topic, blueprint: out.blueprint, cards: out.cards, insights: out.insights });
    out.draft = r4.text || '';
    out.demoChain.push(!!r4.demo);
    emit('writer', { draft: out.draft }, { status: 'done', demo: r4.demo });

    // 5. Critic
    emit('critic', null, { status: 'running' });
    const r5 = await this.critique({ topic, draft: out.draft, cards: out.cards });
    out.critique = r5.data || r5;
    out.demoChain.push(!!r5.demo);
    emit('critic', out.critique, { status: 'done', demo: r5.demo });

    // 6. Editor
    emit('editor', null, { status: 'running' });
    const r6 = await this.edit({ topic, draft: out.draft, critique: out.critique });
    out.final = r6.text || out.draft;
    out.demoChain.push(!!r6.demo);
    emit('editor', { final: out.final }, { status: 'done', demo: r6.demo });

    // 7. 구조화 요약 (기존 포맷 호환)
    const r7 = await this.structuredSummary({ topic, insights: out.insights, blueprint: out.blueprint, final: out.final });
    out.structured = r7.data || r7;
    out.isDemo = out.demoChain.some(Boolean);

    return out;
  }
};

window.HarnessEngine = HarnessEngine;
