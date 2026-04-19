---
description: "Self-Evolving Harness 자동 구축 — 플랫폼 성격(교육/상담/의료/세일즈/컨설팅 등)을 감지하고 도메인에 맞는 6단계 에이전트 파이프라인 + 자동 진화 루프를 생성"
user-invocable: true
---

# /harness

플랫폼의 성격을 자동으로 감지하고, 그 도메인에 맞는 **Self-Evolving Harness**(6단계 에이전트 파이프라인 + 자동 진화 루프)를 생성·탑재하는 스킬이다.

**핵심 철학**: 하네스는 도메인에 종속되지 않는다. 교육 플랫폼이든, 상담 플랫폼이든, 의료·세일즈·컨설팅 플랫폼이든, 그 도메인의 **반복 행위**에서 데이터가 쌓이고, 그 데이터가 하네스로 흘러들어가 전략을 만들고, 전략이 다시 스킬을 갱신한다. 도메인이 바뀌어도 구조는 같다 — 내용만 자동으로 치환된다.

**사용 방법**:
- `/harness` — 현재 작업 디렉토리를 분석하고 자동으로 적용
- `/harness <디렉토리>` — 지정 디렉토리에 적용
- `/harness --domain=education` 등 명시적 도메인 강제

---

## Phase 0. 핵심 개념 정의 (이 스킬이 다루는 용어)

스킬 작동 전 에이전트가 반드시 내부적으로 명확히 구분해야 한다.

| 개념 | 역할 | 예시 |
|------|------|------|
| **엔진** (Engine) | 실제 일을 수행하는 핵심 로직 | Gemini 호출, DB 쿼리, 점수 계산 |
| **스킬** (Skill) | 엔진을 언제/어떻게 사용할지 결정하는 흐름·규칙 | 상담 스크립트, 평가 루브릭 |
| **하네스** (Harness) | 엔진·스킬·데이터를 묶어 **판단과 진화를 만들어내는 상위 사고 시스템** | 6단계 에이전트 파이프라인 + 자동 진화 루프 |

하네스는 단일 파일이 아니다. **"엔진들의 순서 + 데이터 흐름 + 평가·진화 규칙"의 총체**다.

---

## Phase 1. 플랫폼 성격 자동 감지

### 1-1. 신호 수집

다음을 `Glob`·`Grep`·`Read`로 수집한다:

1. **디렉토리명 / 프로젝트 루트 폴더명** — 한국어 키워드 포함 (예: "치과 상담운영", "SPIN 셀링", "인사이트셀링")
2. **`package.json`의 name/description**
3. **`README.md`·`CLAUDE.md`·`AGENTS.md`** 상단 500자
4. **루트의 대표 HTML 파일명** — `consult.html`, `practice.html`, `patient.html`, `deal.html` 등
5. **Supabase 스키마** (`sql/schema.sql`) — 테이블명에서 도메인 추정: `patients`·`consult_logs` → 의료/상담 / `practice_results`·`training_results` → 교육 / `deals`·`leads` → 세일즈
6. **메뉴/네비게이션 구조** — `renderSidebar` 호출, 사이드바 정의 내 텍스트

### 1-2. 도메인 분류

수집한 신호를 다음 범주 중 하나로 분류 (복수 가능, 가중치 합산):

| 도메인 | 핵심 반복 행위 | 주요 KPI | 진화 대상 |
|--------|----------------|----------|-----------|
| **education** | 실습·과제·퀴즈 | 점수, 완주율, 향상도 | 평가 루브릭, 코칭 멘트 |
| **consultation** (영업/상담) | 상담·설득·전환 | 전환율, 상담시간, 재방문율 | 상담 스크립트, 설득 전략 |
| **medical** | 진단·처치·사후관리 | 치료 성공률, 합병증률, 환자 만족도 | 프로토콜, 설명 스크립트 |
| **sales** | 리드·딜·클로징 | 수주율, 딜 평균 크기, 사이클 | 세일즈 플레이북, 이메일 템플릿 |
| **consulting** | 프로젝트·인터뷰·리포트 | 제안 채택률, NPS, 재계약률 | 방법론, 리포트 프레임워크 |
| **content** | 콘텐츠 생성·발행 | 조회/도달/참여 | 톤·후크·구조 템플릿 |
| **support** | 티켓·문의·해결 | FCR, CSAT, 해결 시간 | 응답 템플릿, 분류 규칙 |
| **custom** | 위에 해당 없음 | 사용자 지정 | 사용자 지정 |

신호가 모호하면 `AskUserQuestion`으로 도메인을 확인한다. `--domain=<id>` 플래그가 주어지면 자동 감지를 건너뛴다.

### 1-3. 감지 결과 보고

```
📋 플랫폼 분석 결과
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
도메인       : consultation (치과 상담/운영)
근거         : 폴더명 "치과 상담운영", consult.html 존재, patients 테이블, 8대 엔진 구조
반복 행위    : 환자 상담
주요 KPI     : 전환율(conversion_rate), 상담시간(avg_consult_min), 재방문율(revisit_rate)
진화 대상    : ConsultEngine 프롬프트, ConversionEngine 설득 전략, AutomationEngine 메시지 템플릿
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Phase 2. 도메인 특화 6단계 에이전트 정의

하네스의 6단계 골격은 **불변**이다. 각 단계에서 다루는 **내용(프롬프트·입출력 스키마)**만 도메인에 맞게 치환한다.

### 2-1. 6단계 골격 (불변)

| # | 단계 | 역할 | 입력 | 출력 |
|---|------|------|------|------|
| 1 | **Curator** | 원본 데이터에서 재료 카드 추출 | 로그·KPI·사례 | SCENE/QUOTE/CASE/COUNTER 카드 8~12개 |
| 2 | **Miner** | 클리셰를 피하며 패턴·역설 채광 | Curator 카드 | PATTERN/PARADOX/SECOND_ORDER 인사이트 3~5개 |
| 3 | **Architect** | 서사 도면 설계 (명제 + 메타포) | Miner 인사이트 | thesis + metaphor + 5~7 섹션 |
| 4 | **Writer** | 도면 위에 산문 집필 | Architect 도면 + 카드 | 마크다운 초안 |
| 5 | **Critic** | 적대적 검토 (클리셰·비약·인용 정확성) | Writer 초안 + 카드 | cliche_risk + must_fix + numeric_check |
| 6 | **Editor** | 문체·리듬 외과적 정련 | Writer 초안 + Critic 비평 | 최종 마크다운 |

### 2-2. 도메인별 프롬프트 치환 매트릭스

각 단계의 프롬프트에 도메인별 용어를 주입한다. 아래는 Phase 1에서 감지된 도메인에 따라 자동으로 채워지는 슬롯이다.

| 슬롯 | education | consultation | medical | sales | consulting |
|------|-----------|--------------|---------|-------|------------|
| `{actor}` | 교육생/학습자 | 환자/고객 | 환자 | 리드/바이어 | 클라이언트 |
| `{session}` | 실습/과제 | 상담 | 진료 | 미팅/콜 | 인터뷰/워크숍 |
| `{artifact}` | 제출물 | 상담 로그 | 차트/처방 | 딜 기록 | 리포트 초안 |
| `{success_metric}` | 합격/향상도 | 계약 | 치료 완료 | 수주 | 제안 채택 |
| `{skill_to_evolve}` | 평가 루브릭 | 상담 스크립트 | 설명 프로토콜 | 세일즈 플레이북 | 방법론 프레임 |
| `{central_tension}` | 이해도 vs 자신감 | 정보 vs 신뢰 | 안전 vs 편의 | 가격 vs 가치 | 명료성 vs 깊이 |

이 매트릭스는 **확장 가능**하다. Phase 1에서 `custom` 도메인이 감지되면 `AskUserQuestion`으로 5개 슬롯을 사용자에게 입력받아 매트릭스에 추가한다.

### 2-3. 에이전트 파일 생성

`js/harness-engine.js`(또는 프로젝트 기술 스택에 맞는 확장자)를 생성한다. 프로젝트가 이미 존재하는 파일을 가지고 있으면 **머지 규칙**을 적용한다 (Phase 5 참조).

코드 골격:

```js
const HarnessEngine = {
  DOMAIN: '{감지된 도메인}',
  STAGES: [
    { id: 'curator',   label: '① Curator',   desc: '{도메인} 재료 카드 추출' },
    { id: 'miner',     label: '② Insight Miner', desc: '패턴·역설 채광' },
    { id: 'architect', label: '③ Architect', desc: '서사 도면 설계' },
    { id: 'writer',    label: '④ Writer',    desc: '산문 초안 집필' },
    { id: 'critic',    label: '⑤ Critic',    desc: '적대적 검증' },
    { id: 'editor',    label: '⑥ Editor',    desc: '문체 정련' },
  ],
  async curate({ topic, data }) { /* 도메인별 프롬프트 */ },
  async mine({ topic, cards }) { /* ... */ },
  async blueprint({ topic, insights, paradox }) { /* ... */ },
  async write({ topic, blueprint, cards, insights }) { /* ... */ },
  async critique({ topic, draft, cards }) { /* ... */ },
  async edit({ topic, draft, critique }) { /* ... */ },
  async structuredSummary(...) { /* 기존 인사이트 포맷 호환 */ },
  async run({ topic, data }, onProgress) { /* 6단계 순차 실행 */ }
};
```

각 함수의 프롬프트 템플릿은 Phase 2-2의 슬롯 치환을 통해 도메인별로 자동 생성된다. 폴백(fallback) 응답도 도메인별 샘플 데이터를 포함해 API 키 없이도 완주하도록 작성한다.

---

## Phase 3. 데이터 바인딩 — 하네스에 무엇을 먹일 것인가

### 3-1. 데이터 소스 감지

프로젝트에서 다음을 탐색하여 **하네스 입력 파이프**를 식별한다:

1. **Supabase 테이블** — `sql/schema.sql` 또는 `js/supabase.js`에서 테이블/뷰 목록 추출
2. **LocalStorage 키** — `Store.get(...)` 호출 전수 검색
3. **샘플 데이터** — `SampleData` 객체 또는 시드 파일
4. **외부 API** — `fetch()` 호출 대상 URL 패턴

### 3-2. 도메인 표준 데이터 맵

| 도메인 | Curator가 먹을 기본 데이터 소스 | Miner의 KPI 참조 |
|--------|--------------------------------|--------------------|
| education | `practice_results`, `training_results`, `kpi_snapshots` | 점수 분포, 완주율 |
| consultation | `consult_logs`, `conversions`, `patients` | 전환율, 상담시간 |
| medical | `consultations`, `treatments`, `outcomes` | 성공률, 재진율 |
| sales | `deals`, `activities`, `pipeline` | 수주율, 사이클 |
| consulting | `projects`, `interviews`, `deliverables` | 채택률, NPS |

감지된 실제 스키마와 맵을 대조하여 **있으면 사용하고, 없으면 fallback SampleData로 대체**한다. 둘 다 없으면 Phase 1-2에서 도메인 확정 시 최소 샘플 데이터를 함께 생성한다.

### 3-3. 데이터 흐름 보고

```
📥 데이터 바인딩
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Curator 입력  : consult_logs (Supabase) + SampleData.kpi (로컬)
Miner 참조    : conversions, kpi_snapshots
저장 대상     : insight_reports (Supabase) + Store('insight_reports') (로컬 fallback)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Phase 4. Self-Evolving 루프 설계

하네스의 진짜 가치는 **반복을 통해 스스로 업그레이드되는 구조**에 있다. 이 Phase에서 진화 루프를 설계·코드화한다.

### 4-1. 진화의 두 층위

1. **스킬 진화 (Skill Evolution)** — 하네스가 전략을 내면, 그 전략이 스킬(프롬프트/스크립트/루브릭)을 갱신한다.
2. **하네스 진화 (Meta Evolution)** — 하네스의 전략이 실제 KPI를 움직였는지 평가하고, 그 결과로 하네스 자체의 분석 기준을 업데이트한다.

### 4-2. 트리거 정책

진화는 함부로 일어나지 않는다. 아래 조건 중 하나를 만족할 때만 실행한다:

| 도메인 | 트리거 조건 (예시) |
|--------|--------------------|
| education | 누적 실습 50건 이상 AND 평균 점수 하락 5%p 이상 |
| consultation | 상담 30건 이상 AND 전환율 목표(예: 40%) 미달 |
| medical | 케이스 20건 이상 AND 재진 사유 상위 1~3위 고정 |
| sales | 딜 10건 이상 종결 AND 수주율 벤치마크 미달 |
| consulting | 프로젝트 3건 완료 AND NPS 하락 |

### 4-3. A/B 테스트 구조 (필수)

진화된 새 스킬은 **기존 스킬과 병행 운영**하며 KPI로 승자를 결정한다.

```js
async function evolveSkill(oldSkill, harnessStrategy) {
  const candidate = await deriveSkillFromStrategy(oldSkill, harnessStrategy);
  // 트래픽의 20%를 candidate에 라우팅 (최소 테스트 창: 도메인별 규정)
  await startABTest({ control: oldSkill, variant: candidate, splitRatio: 0.2 });
}

async function evaluateABTest(testId) {
  const { control, variant } = await getABResult(testId);
  if (variant.kpi > control.kpi * 1.05) promote(variant); // 5% 이상 개선 시 승격
  else rollback(variant);
}
```

자동 승격(auto-promote)과 수동 승인(human-in-the-loop) 두 모드를 지원한다. 의료·세일즈처럼 리스크가 큰 도메인은 기본값을 **수동 승인**으로 둔다.

### 4-4. 롤백·버전 관리

모든 스킬은 버전을 갖는다. 진화된 스킬이 KPI를 **악화**시키면 즉시 이전 버전으로 롤백한다.

```sql
CREATE TABLE skills (
  id UUID PRIMARY KEY,
  name TEXT, prompt TEXT,
  version INT, parent_version INT,
  status TEXT CHECK (status IN ('active','shadow','retired')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Phase 5. 산출물 생성

### 5-1. 파일 생성 규칙

| 파일 | 동작 |
|------|------|
| `js/harness-engine.js` (혹은 해당 스택 언어) | **없으면 생성, 있으면 머지** |
| `<engine-page>.html` (예: insight.html, report.html) | "🧠 하네스 6단계" 버튼 + 스테퍼 UI + 산문 렌더 추가 |
| `css/common.css` (또는 스타일 파일) | `.stepper`, `.step.running`, `.step.done`, `.prose-box` 클래스 추가 (중복 시 skip) |
| `sql/schema.sql` | `insight_reports`, `skills`(버전 관리 포함) 테이블 추가 (존재 시 skip) |
| `docs/harness.md` (옵션) | 생성된 하네스의 사용법·도메인 선택·진화 트리거 문서 |

### 5-2. 머지 규칙 (기존 파일이 있을 때)

- **기존 `HarnessEngine` 객체가 있으면**: `STAGES` 개수가 6인지 확인하고, 도메인 치환이 덜 된 단계가 있으면 해당 단계의 프롬프트만 교체. 사용자 커스텀 단계는 보존.
- **기존 UI 버튼이 있으면**: 재생성하지 않고 콜백만 `runHarness()`로 연결.
- **기존 프롬프트 템플릿이 있으면**: 사용자 작성분을 우선. 스킬은 "추가"만 하고 **덮어쓰지 않는다**.

### 5-3. 검증 단계

생성 후 다음을 자동 수행:

1. **정적 검사**: 생성된 JS 파일을 `Read`로 다시 열어 `HarnessEngine.run` 존재, `STAGES.length === 6` 확인
2. **HTTP 검사**: 로컬 서버가 돌고 있으면 `curl`로 엔진 페이지 200 응답 확인
3. **호출 검사**: API 키가 설정돼 있으면 `curate` 단계만 1회 더미 실행하여 응답 스키마 검증. 없으면 fallback 응답 구조 검증.

---

## Phase 6. CLAUDE.md / AGENTS.md 업데이트

프로젝트 루트에 이들 파일이 있으면 "Self-Evolving Harness" 섹션을 추가한다. 없으면 생성하지 않는다 (CLAUDE.md 규칙 준수).

추가 내용 예:

```markdown
## Self-Evolving Harness

- 도메인: {감지된 도메인}
- 진화 트리거: {Phase 4-2에서 선택된 규칙}
- 진화 모드: auto-promote | human-in-the-loop
- 주요 KPI: {도메인별 KPI 목록}
- 롤백 정책: 신 버전이 기존 대비 KPI 하락 시 24시간 내 자동 롤백
```

---

## Phase 7. 실행 보고

```
✅ Harness 구축 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
도메인          : consultation
생성 파일       : js/harness-engine.js (신규), insight.html (수정), css/common.css (확장)
6단계 에이전트  : Curator → Miner → Architect → Writer → Critic → Editor
데이터 바인딩   : consult_logs + conversions + SampleData.kpi
진화 트리거     : 상담 30건 이상 & 전환율 < 40%
A/B 스플릿      : 20%
승격 기준       : +5%p 개선 시 auto-promote
검증            : 정적 검사 OK, HTTP 200, fallback 스키마 OK
다음 단계       : 엔진 페이지에서 "🧠 하네스 6단계" 버튼으로 실행
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 도메인별 레퍼런스 (참고용 완성 사례)

### A. Consultation (치과 상담 운영 AI — 20-18)

```
Curator    → consult_logs 20건에서 SCENE/QUOTE/CASE/COUNTER 카드 10개 추출
Miner      → "가격 질문 = 실은 불안 질문" 같은 PARADOX + 2회차 상담 패턴
Architect  → thesis: "승패는 두 번째 만남의 구조에서 결정된다" / metaphor: 항해의 두 항구
Writer     → 4~6 섹션 산문 초안 (오후 3시 장면 → 14분 벽 → 반론 → 재정립 → 결말)
Critic     → cliche_risk: low / numeric_check: 14분, 78%, 84% 대조
Editor     → 단락 리듬 정련, 메타포 반복 1회 추가
진화       → 상위 성공 상담 로그 기반 ConsultEngine 프롬프트 교체, A/B 20%, +5%p 시 승격
```

### B. Education (AI 교육 플랫폼)

```
Curator    → practice_results + quiz_scores에서 학습자 장면/오답/성공 케이스 카드
Miner      → "A 유형 오답이 반복되는 학습자는 B 개념 이해가 빈 구조"
Architect  → thesis: "점수는 결과가 아니라 지도다" / metaphor: 등산 경로
Writer     → 학습자 코칭 리포트 산문 (약점 진단 → 다음 스텝 제시)
Critic     → 점수 인용 정확성, 일반화 비약 검출
Editor     → 코칭 톤 정련 (비판 → 동기 부여)
진화       → 평가 루브릭 업데이트 + 코칭 스크립트 자동 수정, 주간 배치, 교수 승인 후 승격
```

### C. Sales (B2B 세일즈 플랫폼)

```
Curator    → CRM deals + call_transcripts에서 반대·저항·결정 장면 카드
Miner      → "가격 저항 중 70%는 예산주기 정보 부족에서 기인" 같은 SECOND_ORDER
Architect  → thesis: "클로징은 타이밍이 아니라 컨텍스트다" / metaphor: 낚시의 입질
Writer     → 세일즈 인사이트 리포트 (분기별 패턴 분석)
Critic     → 인용 정확성, 비약 검출, 반론 강도
Editor     → 경영진용 톤으로 정련
진화       → 세일즈 플레이북 변이 생성, A/B 10%, human-in-the-loop 승인 필수
```

### D. Medical (재생의료/병원)

```
Curator    → 진료 차트 + 처치 기록 + outcome 카드 (민감정보 마스킹 필수)
Miner      → 치료 경로 패턴, 부작용 연관성, 재진 사유 군집
Architect  → thesis: "프로토콜 준수와 결과의 함수" / metaphor: 요리의 레시피 vs 조정
Writer     → 의료진용 리포트 (단정형 회피, 근거 중심)
Critic     → 수치/용량 정확성 필수 검증, 일반화 엄격 검출
Editor     → 의학 전문 용어 보존, 환자용 설명은 별도 버전
진화       → 설명 프로토콜 업데이트만 자동, 임상 프로토콜은 반드시 수동 승인
```

### E. Consulting / Content / Support

동일한 6단계 골격에 Phase 2-2 슬롯만 치환. 상세 예는 생성 시 도메인 확정 후 자동으로 구성된다.

---

## Tools Required

- `Glob`, `Grep`, `Read` — Phase 1 신호 수집
- `AskUserQuestion` — 도메인 모호 시 확인, custom 도메인 슬롯 입력
- `Write`, `Edit` — Phase 5 산출물 생성·머지
- `Bash` — Phase 5-3 HTTP 검증 (선택)

---

## 안티 패턴 (이 스킬이 방지하는 것)

1. **단일 호출 "인사이트 생성기"로 축소되는 것** — 6단계를 한 번에 합치면 클리셰만 남는다. 단계는 반드시 분리.
2. **도메인 하드코딩** — 특정 도메인에만 작동하는 프롬프트는 거부. 슬롯 치환 구조를 유지.
3. **진화 루프 없는 하네스** — 리포트만 내고 끝나면 그것은 "한 번 쓰는 분석기". 반드시 A/B + KPI + 롤백을 포함.
4. **Critic 없는 파이프라인** — Writer에서 바로 출력하면 클리셰가 제거되지 않는다. Critic 단계 생략 금지.
5. **권한 없는 자동 승격** — 의료·금융·법률 도메인에서 human-in-the-loop을 건너뛰지 않는다.

---

## 빠른 시작 (최소 동작)

```
/harness
→ 현재 디렉토리 자동 분석
→ 도메인 감지 및 확정
→ harness-engine.js 생성
→ 메인 엔진 페이지에 6단계 버튼 삽입
→ 진화 루프 스키마·트리거 등록
→ 검증 후 실행 보고
```

이 스킬이 완료되면 플랫폼은 **"스스로 더 잘하게 되는 시스템"**으로 한 단계 진화한다.
