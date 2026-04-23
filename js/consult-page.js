// 30개 언어 지원
// 🧪 테스트 모드 (URL ?test=true 파라미터로 활성화)
const isTestMode = new URLSearchParams(window.location.search).has("test");
if (isTestMode) {
  console.warn("🧪 [TEST MODE] 로그인 없이 상담 AI 사용 중. Supabase에 저장되지 않습니다.");
  document.body.style.borderTop = "3px solid #FF9500";
}

const LANG_OPTIONS = [
  { code: 'ko-KR', label: '한국어' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'zh-CN', label: '中文 (简体)' },
  { code: 'zh-TW', label: '中文 (繁體)' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'es-ES', label: 'Español' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'it-IT', label: 'Italiano' },
  { code: 'pt-BR', label: 'Português (BR)' },
  { code: 'ru-RU', label: 'Русский' },
  { code: 'ar-SA', label: 'العربية' },
  { code: 'hi-IN', label: 'हिन्दी' },
  { code: 'vi-VN', label: 'Tiếng Việt' },
  { code: 'th-TH', label: 'ภาษาไทย' },
  { code: 'id-ID', label: 'Bahasa Indonesia' },
  { code: 'ms-MY', label: 'Bahasa Melayu' },
  { code: 'fil-PH', label: 'Filipino' },
  { code: 'tr-TR', label: 'Türkçe' },
  { code: 'pl-PL', label: 'Polski' },
  { code: 'nl-NL', label: 'Nederlands' },
  { code: 'sv-SE', label: 'Svenska' },
  { code: 'nb-NO', label: 'Norsk' },
  { code: 'da-DK', label: 'Dansk' },
  { code: 'fi-FI', label: 'Suomi' },
  { code: 'el-GR', label: 'Ελληνικά' },
  { code: 'cs-CZ', label: 'Čeština' },
  { code: 'hu-HU', label: 'Magyar' },
  { code: 'ro-RO', label: 'Română' },
  { code: 'uk-UA', label: 'Українська' },
];

function initLangSelect() {
  const sel = document.getElementById('langSelect');
  if (!sel) return;
  LANG_OPTIONS.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.code;
    opt.textContent = l.label;
    sel.appendChild(opt);
  });
  sel.value = 'ko-KR';
}

function onLangChange() {
  if (!isRecording && recognition) {
    recognition.lang = document.getElementById('langSelect').value;
  }
}

// [moved to DOMContentLoaded] document.getElementById('app').insertAdjacentHTML('afterbegin', renderSidebar('consult'));

// 환자 옵션 채우기 — Supabase 전용
// 상담 이력 있는 환자를 위쪽 optgroup에, 신규 환자를 아래 optgroup에 배치
let patientCache = []; // Supabase 환자 레코드 캐시
let patientCountsCache = {}; // { patientId: count }
let patientLastDateCache = {}; // { patientId: iso }

async function populatePatients() {
  const sel = document.getElementById('patientSelect');
  sel.innerHTML = '<option value="">환자 정보 없이 상담</option>';

  // 지연 초기화 — DOMContentLoaded 전에 호출되어도 안전하게
  if (typeof SupabaseDB !== 'undefined' && !SupabaseDB.isReady() && typeof supabase !== 'undefined') {
    try { SupabaseDB.init(); } catch (e) { console.warn('SupabaseDB.init 실패', e); }
  }

  if (typeof SupabaseDB === 'undefined' || !SupabaseDB.isReady()) {
    // 최초 로드일 수 있으니 500ms 후 한 번 더 재시도
    if (!window.__populateRetried) {
      window.__populateRetried = true;
      setTimeout(() => populatePatients(), 500);
      return;
    }
    showToast('Supabase 미연결 — 환자 목록을 불러올 수 없습니다', 'warning');
    return;
  }
  try {
    const [list, countResult] = await Promise.all([
      SupabaseDB.getPatients({ limit: 300 }),
      SupabaseDB.getPatientSessionCounts().catch(e => { console.warn(e); return { counts: {}, lastDate: {} }; })
    ]);
    patientCache = list || [];
    patientCountsCache = countResult.counts || {};
    patientLastDateCache = countResult.lastDate || {};

    // 분류
    const withHistory = [];
    const newbies = [];
    patientCache.forEach(p => {
      if (patientCountsCache[p.id] > 0) withHistory.push(p);
      else newbies.push(p);
    });

    // 상담 이력 많은 순, 같으면 최근 상담일(ms) 기준
    withHistory.sort((a, b) => {
      const cDiff = (patientCountsCache[b.id] || 0) - (patientCountsCache[a.id] || 0);
      if (cDiff !== 0) return cDiff;
      return (patientLastDateCache[b.id] || 0) - (patientLastDateCache[a.id] || 0);
    });
    // 신규는 최근 등록 순 (list는 이미 created_at desc)

    const fmtLast = (v) => {
      if (v == null || v === '') return '';
      try {
        // 숫자(ms) or ISO 문자열 모두 허용
        const d = typeof v === 'number' ? new Date(v) : new Date(v);
        if (isNaN(d.getTime())) return '';
        const now = new Date();
        const days = Math.round((now - d) / 86400000);
        if (days === 0) return '오늘';
        if (days === 1) return '어제';
        if (days < 7) return `${days}일 전`;
        if (days < 30) return `${Math.round(days/7)}주 전`;
        if (days < 365) return `${Math.round(days/30)}개월 전`;
        return `${Math.round(days/365)}년 전`;
      } catch { return ''; }
    };

    // 📚 이력 있음 그룹 — 비어있어도 항상 표시 (UX 명확성)
    {
      const og = document.createElement('optgroup');
      og.label = `📚 상담 이력 있음 (${withHistory.length}명)`;
      if (withHistory.length === 0) {
        const info = document.createElement('option');
        info.disabled = true;
        info.value = '';
        info.textContent = '— 아직 저장된 상담 세션이 없습니다 —';
        og.appendChild(info);
      } else {
        withHistory.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          const ageTxt = p.age ? `${p.age}세` : '';
          const treat = p.treatment || '미정';
          const cnt = patientCountsCache[p.id];
          const last = fmtLast(patientLastDateCache[p.id]);
          const metaParts = [ageTxt, treat].filter(Boolean).join(', ');
          opt.textContent = `${p.name} (${metaParts}) · ${cnt}회${last ? ' · ' + last : ''}`;
          og.appendChild(opt);
        });
      }
      sel.appendChild(og);
    }
    // 🆕 신규 그룹 — 비어있어도 표시
    {
      const og = document.createElement('optgroup');
      og.label = `🆕 신규 (상담 이력 없음, ${newbies.length}명)`;
      if (newbies.length === 0) {
        const info = document.createElement('option');
        info.disabled = true;
        info.value = '';
        info.textContent = '— 신규 환자가 없습니다. ➕ 버튼으로 추가하세요 —';
        og.appendChild(info);
      } else {
        newbies.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          const ageTxt = p.age ? `${p.age}세` : '';
          const treat = p.treatment || '미정';
          const metaParts = [ageTxt, treat].filter(Boolean).join(', ');
          opt.textContent = `${p.name} (${metaParts})`;
          og.appendChild(opt);
        });
      }
      sel.appendChild(og);
    }
  } catch (e) {
    console.warn('환자 조회 실패', e);
    showToast('환자 목록 조회 실패: ' + e.message, 'error');
  }
}
populatePatients();


// ============================================================
// 데모 시드 — 제거됨 (Supabase 전용 운영)
// ============================================================
(function seedDemoSessions_disabled() { return;
  const existing = Store.get('consult_sessions', []) || [];
  if (existing.some(s => s.patientId === 'P001')) return;

  const dayAgo = (d) => Date.now() - d * 86400000;
  const demos = [
    {
      id: 'SES_DEMO_P001_1',
      patientId: 'P001', patientName: '김민수',
      author: '박상담', clinic: '스마일치과',
      startedAt: dayAgo(14), endedAt: dayAgo(14) + 12 * 60000, durationSec: 720,
      turns: [
        { speaker: 'staff',   text: '안녕하세요 김민수님. 오늘 어떤 점 때문에 오셨어요?', at: dayAgo(14) + 10000 },
        { speaker: 'patient', text: '임플란트 해야 한다고 해서 왔는데, 비용이 너무 걱정돼요.', at: dayAgo(14) + 40000 },
        { speaker: 'staff',   text: '비용이 크게 느껴지시는 마음 충분히 이해합니다. 지금은 설명만 들어보시고 결정은 천천히 하셔도 괜찮아요.', at: dayAgo(14) + 80000 },
        { speaker: 'patient', text: '실패하면 어쩌나 그게 더 무섭기도 하고요.', at: dayAgo(14) + 140000 },
        { speaker: 'staff',   text: '그 걱정 자연스러워요. 실패 확률과 관리 방법을 먼저 설명드리고, 궁금하신 점부터 하나씩 짚어볼게요.', at: dayAgo(14) + 180000 },
      ],
      coachResults: [
        {
          at: dayAgo(14) + 190000,
          question: '실패하면 어쩌나 그게 더 무섭기도 하고요.',
          data: {
            intent_primary: 'fear', intent_secondary: ['price'],
            subtext: ['비용보다 치료 실패·부작용 불안이 더 크다', '결정을 혼자 내리기 부담스러움'],
            recommended_reply: [
              '공감: "그 걱정 너무 자연스럽습니다."',
              '정보 공유: "저희 병원 10년 기준 실패율과 관리 기준을 보여드릴 수 있어요."',
              '선택지: "오늘은 설명만 듣고 가시거나, 정밀 진단만 받아보시거나, 두 방법 모두 가능합니다."',
              '자율 존중: "결정은 가족과 의논하시고 편한 때 다시 말씀 주세요."'
            ],
            readiness: 42,
            next_action: '실패율·관리 자료를 문자로 발송하고, 환자 연락을 기다리기',
            risk_level: 'medium',
            cautions: ['"지금 안 하면 큰일납니다" 금지']
          }
        }
      ],
      evaluation: {
        summary: [
          '임플란트 상담 초진. 표면 우려는 비용이었으나 핵심은 실패 두려움.',
          '실장이 공감 먼저 표현하고 결정 시간을 열어둔 것이 방어를 낮춤.',
          '결정은 유보되었으나 재방문 여지가 남음.'
        ],
        patient_concerns: ['비용 부담', '수술 실패 가능성', '혼자 결정하는 부담'],
        staff_strengths: [
          '"비용이 크게 느껴지시는 마음 충분히 이해합니다"로 공감 우선',
          '결정 재촉 없이 "천천히 하셔도 괜찮아요" 언어로 자율성 존중'
        ],
        staff_improvements: [
          '실패 확률 구체 숫자를 카드로 제시하면 설득력이 더 올라감',
          '환자 침묵 10초 이상일 때 기다리는 습관'
        ],
        principle_violations: [],
        suggested_followup: [
          '실패율·관리 기준 자료 문자 발송',
          '"편한 때 연락 주시면 됩니다" — 연락 주체를 환자에게'
        ],
        scores: { empathy: 17, autonomy: 18, information_balance: 14, no_pressure: 18, silence_allowance: 13 },
        overall_score: 80,
        readiness_trajectory: { start: 30, end: 50, note: '결정 자체는 유보되었지만 재방문 문이 열린 상태' }
      }
    },
    {
      id: 'SES_DEMO_P001_2',
      patientId: 'P001', patientName: '김민수',
      author: '박상담', clinic: '스마일치과',
      startedAt: dayAgo(3), endedAt: dayAgo(3) + 9 * 60000, durationSec: 540,
      turns: [
        { speaker: 'staff',   text: '다시 와주셔서 감사해요. 지난번 자료는 보셨어요?', at: dayAgo(3) + 5000 },
        { speaker: 'patient', text: '네, 가족이랑 같이 봤어요. 그래도 결정은 쉽지 않네요.', at: dayAgo(3) + 30000 },
        { speaker: 'staff',   text: '쉽지 않은 게 당연해요. 오늘은 궁금하셨던 부분만 같이 정리해볼게요.', at: dayAgo(3) + 60000 },
        { speaker: 'patient', text: '부분만 먼저 해도 된다고 하셨는데 그게 어떤 방식이에요?', at: dayAgo(3) + 120000 },
      ],
      coachResults: [
        {
          at: dayAgo(3) + 150000,
          question: '부분만 먼저 해도 된다고 하셨는데 그게 어떤 방식이에요?',
          data: {
            intent_primary: 'info', intent_secondary: ['price'],
            subtext: ['결정 단계에 한 걸음 접근함', '구체 실행 방식을 원함'],
            recommended_reply: [
              '정보 공유: "핵심 부위 1~2개만 먼저 진행하고 나머지는 경과 보며 결정하는 방식입니다."',
              '비교: "비용은 약 40% 선에서 시작하고, 장점은 부담 분산·단점은 치료 기간이 길어질 수 있음입니다."',
              '자율 존중: "이 방식이 맞을지 제가 결정해드리기보다 장단점을 보시고 선택하세요."'
            ],
            readiness: 68, risk_level: 'low',
            next_action: '부분 치료 견적서와 스케줄 예시를 제공하고 1주 안에 편한 때 회신 받기',
            cautions: ['"오늘 결정하시면 할인" 식 압박 금지']
          }
        }
      ],
      evaluation: {
        summary: [
          '재방문 상담. 환자가 가족과 논의한 상태로 정보 탐색 단계 진입.',
          '부분 치료 옵션에 관심 표명, 실장이 중립적으로 장단점 제시.',
          '결정에 가까워진 상태 — 구체 견적과 스케줄 전달 단계.'
        ],
        patient_concerns: ['비용 분산 가능성', '기간 장기화 우려'],
        staff_strengths: ['"쉽지 않은 게 당연하다"로 감정 인정 유지', '장단점을 중립적으로 제시'],
        staff_improvements: ['환자가 질문한 순간을 기회로 삼아 자료를 더 구체적으로 시각화해도 좋음'],
        principle_violations: [],
        suggested_followup: ['부분 치료 견적서 · 스케줄 표 발송', '1주 내 환자 회신 기다리기 — 재촉 없음'],
        scores: { empathy: 18, autonomy: 19, information_balance: 17, no_pressure: 19, silence_allowance: 15 },
        overall_score: 88,
        readiness_trajectory: { start: 50, end: 72, note: '정보 수용과 함께 심리적 준비도 상승' }
      }
    }
  ];
  Store.set('consult_sessions', demos.concat(existing));
})();

refreshPatientHistoryBadge();

// ============================================================
// 빠른 환자 추가 (drop-down 옆 ➕ 버튼)
// ============================================================
function openQuickAddPatient() {
  if (currentSession) {
    showToast('진행 중인 상담을 먼저 종료하고 신규 환자를 추가해주세요', 'warning');
    return;
  }
  if (typeof SupabaseDB === 'undefined' || !SupabaseDB.isReady()) {
    showToast('Supabase 미연결 — 환자를 저장할 수 없습니다', 'error');
    return;
  }
  // 이전 입력값 초기화
  ['quickPatientName','quickPatientPhone','quickPatientAge','quickPatientMemo'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('quickPatientGender').value = '';
  document.getElementById('quickPatientTreatment').value = '';
  openModal('quickPatientModal');
  setTimeout(() => document.getElementById('quickPatientName')?.focus(), 100);
}

async function saveQuickPatient() {
  const name = (document.getElementById('quickPatientName').value || '').trim();
  const phone = (document.getElementById('quickPatientPhone').value || '').trim();
  const ageRaw = (document.getElementById('quickPatientAge').value || '').trim();
  const gender = document.getElementById('quickPatientGender').value || '';
  const treatment = document.getElementById('quickPatientTreatment').value || '';
  const memo = (document.getElementById('quickPatientMemo').value || '').trim();

  if (!name) { showToast('이름을 입력해주세요', 'warning'); return; }
  if (name.length > 30) { showToast('이름은 30자 이내로 입력해주세요', 'warning'); return; }

  const age = ageRaw ? parseInt(ageRaw, 10) : null;
  if (ageRaw && (isNaN(age) || age < 0 || age > 120)) { showToast('나이는 0~120 사이 숫자로 입력해주세요', 'warning'); return; }

  const btn = document.getElementById('quickPatientSaveBtn');
  btn.disabled = true;
  btn.textContent = '💾 저장 중...';
  try {
    const row = await SupabaseDB.createPatient({
      name,
      phone: phone || null,
      age,
      gender: gender || null,
      treatment: treatment || null,
      memo: memo || null
    });
    // 드롭다운 전체 재생성 (optgroup 구조 유지)
    await populatePatients();
    const sel = document.getElementById('patientSelect');
    sel.value = row.id;
    refreshPatientHistoryBadge();
    closeModal('quickPatientModal');
    showToast(`✅ ${row.name}님 등록 완료 · 이제 🎙 상담 시작하세요`, 'success');
  } catch (e) {
    console.error(e);
    showToast('저장 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 저장 · 바로 상담 시작';
  }
}

function getSelectedPatient() {
  const id = document.getElementById('patientSelect').value;
  if (!id) return null;
  return patientCache.find(p => p.id === id) || null;
}

// ============================================================
// 환자별 세션 이력 (Supabase 전용)
// ============================================================
const _sessionCache = {}; // patientId -> sessions[] (짧은 캐시)

async function getPatientSessions(patientId) {
  if (!patientId) return [];
  if (_sessionCache[patientId]) return _sessionCache[patientId];
  if (typeof SupabaseDB === 'undefined' || !SupabaseDB.isReady()) return [];
  try {
    const list = await SupabaseDB.getPatientSessions(patientId, 20);
    _sessionCache[patientId] = list;
    return list;
  } catch (e) { console.warn('세션 조회 실패', e); return []; }
}

function invalidateSessionCache(patientId) {
  if (patientId) delete _sessionCache[patientId];
  else Object.keys(_sessionCache).forEach(k => delete _sessionCache[k]);
}

async function refreshPatientHistoryBadge() {
  const el = document.getElementById('patientHistBadge');
  const patient = getSelectedPatient();
  if (!patient) { el.innerHTML = ''; return; }
  invalidateSessionCache(patient.id);
  const sessions = await getPatientSessions(patient.id);
  if (!sessions.length) {
    el.innerHTML = `<div class="patient-hist-badge" style="background:var(--gray-50); border-color:var(--gray-200); color:var(--text-tertiary);">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
        <span>📭 ${escapeHTML(patient.name)}님의 이전 상담 이력이 없습니다</span>
        <button onclick="openPastSessionsModal()" class="btn btn-sm btn-outline" style="flex-shrink:0; font-size:0.72rem; padding:4px 10px;">📂 불러오기</button>
      </div>
    </div>`;
    return;
  }
  const last = sessions[0];
  const lastDate = new Date(last.startedAt).toLocaleDateString('ko-KR');
  const mins = Math.max(1, Math.round((last.durationSec || 0) / 60));
  const lastScore = last.evaluation?.overall_score;
  el.innerHTML = `<div class="patient-hist-badge">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
      <div style="flex:1; min-width:0;">
        📚 <strong>${escapeHTML(patient.name)}</strong>님의 이전 상담 <strong>${sessions.length}회</strong> 자동 반영됨<br>
        <span style="font-size:0.72rem; color:var(--text-secondary);">
          최근: ${lastDate} · ${mins}분 · 대화 ${last.turns?.length || 0}${lastScore != null ? ` · 점수 ${lastScore}` : ''}
        </span>
      </div>
      <div style="display:flex; gap:4px; flex-shrink:0;">
        <button onclick="openReviewPage('${patient.id}', 'wide')" class="btn btn-sm btn-primary" style="font-size:0.72rem; padding:5px 10px;" title="3단 화면 모두 펼쳐 보기">📑 Wide</button>
        <button onclick="openReviewPage('${patient.id}', 'tab')" class="btn btn-sm btn-outline" style="font-size:0.72rem; padding:5px 10px;" title="탭으로 전환하며 보기">📋 Tab</button>
      </div>
    </div>
  </div>`;
}

// ============================================================
// 이전 상담 세션 불러오기 (읽기 전용 모드)
// ============================================================
let viewingPastSession = null; // 읽기 전용 모드 중인 세션

function openPastSessionsModal() {
  const patient = getSelectedPatient();
  if (!patient) { showToast('환자를 먼저 선택하세요', 'warning'); return; }
  if (currentSession) { showToast('진행 중인 상담을 먼저 종료해주세요', 'warning'); return; }
  // 기본: Wide 뷰로 이동. Shift+클릭은 Tab 뷰로
  openReviewPage(patient.id, 'wide');
}

function openReviewPage(patientId, viewType) {
  const file = viewType === 'tab' ? 'consult_review_tab.html' : 'consult_review_wide.html';
  window.location.href = file + '?patient=' + encodeURIComponent(patientId);
}

// (사용 안 함 — 과거 모달 방식, 참조 호환용으로 남겨둠)
async function openPastSessionsModal_legacy() {
  const patient = getSelectedPatient();
  if (!patient) { showToast('환자를 먼저 선택하세요', 'warning'); return; }
  if (currentSession) { showToast('진행 중인 상담을 먼저 종료해주세요', 'warning'); return; }

  invalidateSessionCache(patient.id);
  const sessions = await getPatientSessions(patient.id);
  const body = document.getElementById('pastSessionsList');
  if (!sessions.length) {
    body.innerHTML = '<div class="empty" style="padding:28px; text-align:center; color:var(--text-tertiary);">이전 상담 기록이 없습니다.</div>';
  } else {
    body.innerHTML = sessions.map((s, i) => {
      const date = new Date(s.startedAt).toLocaleString('ko-KR');
      const mins = Math.max(1, Math.round((s.durationSec || 0) / 60));
      const score = s.evaluation?.overall_score;
      const firstPatient = (s.turns || []).find(t => t.speaker === 'patient')?.text || '';
      const preview = firstPatient.slice(0, 70) + (firstPatient.length > 70 ? '…' : '');
      return `
        <div class="past-session-item" onclick="loadPastSession('${s.id}')">
          <div class="past-session-head">
            <div class="past-session-title">🗂 ${i + 1}회차 — ${escapeHTML(date)}</div>
            ${score != null ? `<div class="past-session-score">${score}</div>` : ''}
          </div>
          <div class="past-session-meta">${mins}분 · 대화 ${s.turns?.length || 0} · 코칭 ${s.coachResults?.length || 0} · ${escapeHTML(s.author || '-')}</div>
          ${preview ? `<div class="past-session-preview">💬 ${escapeHTML(preview)}</div>` : ''}
        </div>`;
    }).join('');
  }
  openModal('pastSessionsModal');
}

async function loadPastSession(sessionId) {
  const patient = getSelectedPatient();
  if (!patient) return;
  const sessions = await getPatientSessions(patient.id);
  const s = sessions.find(x => x.id === sessionId);
  if (!s) { showToast('세션을 찾을 수 없습니다', 'error'); return; }
  if (currentSession) { showToast('진행 중인 상담을 먼저 종료해주세요', 'warning'); return; }

  viewingPastSession = s;
  closeModal('pastSessionsModal');

  // 1) 대화 녹취 재구성
  turns = (s.turns || []).map(t => ({ ...t }));
  renderTurns();

  // 2) 모든 코칭 카드 재렌더 (불러오기 시 이전 카드 초기화 후 순차 렌더)
  document.getElementById('coachArea').innerHTML = '';
  const coachList = (s.coachResults || []).map(c => c.data).filter(Boolean);
  const area = document.getElementById('replyArea');
  if (coachList.length) {
    area.style.display = 'none';
    coachList.forEach(c => renderCoach(c, false));
    renderQlrcqTracker(coachList[coachList.length - 1]);
  } else {
    area.style.display = 'block';
    area.classList.add('empty');
    area.innerHTML = '이 세션에는 생성된 코칭이 없습니다.';
    document.getElementById('coachArea').innerHTML = '';
  }

  // 3) 평가 재렌더
  if (s.evaluation) {
    renderEvaluation(s.evaluation, false);
  }

  // 4) 읽기 전용 배지 + 마이크 비활성화
  const card = document.getElementById('sessionCard');
  card.style.display = 'block';
  card.style.background = 'var(--warning-bg)';
  card.style.borderColor = 'var(--warning-border)';
  card.style.color = '#78350F';
  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
      <span>📖 <strong>읽기 전용</strong> · ${new Date(s.startedAt).toLocaleString('ko-KR')}</span>
      <button onclick="exitPastSession()" class="btn btn-sm" style="background:#78350F; color:#FFF; font-size:0.7rem; padding:4px 10px;">✕ 닫기</button>
    </div>`;
  document.getElementById('micBtn').disabled = true;
  document.getElementById('submitBtn').disabled = true;
  document.getElementById('evalNowBtn').disabled = true;
  document.getElementById('patientSelect').disabled = true;

  showToast(`${new Date(s.startedAt).toLocaleDateString('ko-KR')} 상담을 불러왔습니다 (읽기 전용)`, 'info');
}

function exitPastSession() {
  viewingPastSession = null;
  clearTranscript();
  const card = document.getElementById('sessionCard');
  card.style.display = 'none';
  // 원래 상태 복원 (세션 시작 시 다시 설정됨)
  card.style.background = '';
  card.style.borderColor = '';
  card.style.color = '';
  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
      <span>🟢 <strong>상담 중</strong> · <span id="sessionTimer">00:00</span></span>
      <span id="sessionMeta" style="color:#166534; font-weight:600;">대화 0회 · 코칭 0회</span>
    </div>`;
  document.getElementById('coachArea').innerHTML = '';
  const area = document.getElementById('replyArea');
  area.style.display = 'block';
  area.classList.add('empty');
  area.innerHTML = '환자 발화를 녹음하거나 입력한 후 <strong>전송</strong> 버튼을 눌러주세요.<br>AI가 환자의 속마음을 간파하고 상담실장이 그대로 쓸 수 있는 답변 스크립트를 생성합니다.';
  const evalArea = document.getElementById('evaluationArea');
  evalArea.innerHTML = `
    <div style="text-align:center; color:var(--text-tertiary); font-size:0.8125rem; padding:40px 0; line-height:1.7;">
      🛑 <strong>상담 종료</strong> 시<br>전체 세션을 분석하여<br>핵심 내용·상담사 평가·<br>개선 피드백이<br>여기에 표시됩니다
    </div>`;
  document.getElementById('micBtn').disabled = false;
  document.getElementById('submitBtn').disabled = false;
  document.getElementById('patientSelect').disabled = false;
}

// 환자의 이전 세션을 Gemini 프롬프트용 문자열 히스토리로 압축
async function buildPatientHistory(patientId) {
  const sessions = (await getPatientSessions(patientId)).slice(0, 5);
  if (!sessions.length) return [];
  return sessions.map((s, idx) => {
    const date = new Date(s.startedAt).toLocaleDateString('ko-KR');
    const lastPatient = (s.turns || []).filter(t => t.speaker === 'patient').slice(-1)[0]?.text || '';
    const lastCoach = (s.coachResults || []).slice(-1)[0]?.data;
    const lastReply = lastCoach
      ? (Array.isArray(lastCoach.recommended_reply) ? lastCoach.recommended_reply.join(' / ') : lastCoach.recommended_reply) || ''
      : '';
    const evalSummary = s.evaluation?.summary?.[0] || '';
    return `[${idx + 1}회차 · ${date}] 주 우려: ${lastPatient.slice(0, 80)} / 마지막 코칭: ${lastReply.slice(0, 100)} / 평가: ${evalSummary.slice(0, 80)}`;
  });
}

// ============================================================
// 세션 평가 렌더
// ============================================================
// 덴탈클리닉파인더 공식 5축
const SCORE_LABEL = {
  empathy_completion: '① 공감 완결도',
  understanding_depth: '② 이해 깊이',
  choice_respect: '③ 선택권 존중',
  value_clarity: '④ 가치 전달 명료성',
  trust_depth: '⑤ 신뢰 구축 강도'
};
// 구버전 호환
const SCORE_LABEL_LEGACY = {
  empathy: '공감·감정 인정', autonomy: '자율성 존중',
  information_balance: '정보 균형', no_pressure: '비강요', silence_allowance: '침묵 허용'
};

function renderEvaluation(data, isDemo) {
  const area = document.getElementById('evaluationArea');
  if (!data) return;
  const safe = (v) => escapeHTML(String(v == null ? '' : v));
  const overall = Math.max(0, Math.min(100, data.overall_score || 0));
  const scores = data.scores || {};
  const trajectory = data.readiness_trajectory || {};

  area.textContent = '';
  const html = [];
  html.push(`
    <div class="eval-score-card">
      <div class="eval-score-val">${overall}</div>
      <div class="eval-score-label">Overall Score ${isDemo ? '· DEMO' : ''}</div>
      ${trajectory && (trajectory.start != null || trajectory.end != null) ? `
        <div class="eval-score-note">
          준비도 ${trajectory.start ?? '-'} → ${trajectory.end ?? '-'}
          ${trajectory.note ? '<br>' + safe(trajectory.note) : ''}
        </div>` : ''}
    </div>
  `);

  // 점수 바 — 새 5축 우선, 구버전 키도 있으면 함께 표시
  const useLabels = { ...SCORE_LABEL };
  Object.keys(SCORE_LABEL_LEGACY).forEach(k => {
    if (scores[k] != null && useLabels[k] == null) useLabels[k] = SCORE_LABEL_LEGACY[k];
  });
  const bars = Object.keys(useLabels).map(k => {
    const v = Math.max(0, Math.min(20, scores[k] || 0));
    return `
      <div class="score-bar">
        <div>${useLabels[k]}</div>
        <div class="score-bar-track"><div class="score-bar-fill" style="width:${(v / 20) * 100}%;"></div></div>
        <div class="score-bar-val">${v}/20</div>
      </div>`;
  }).join('');
  html.push(`<div class="eval-section"><div class="eval-section-title">📊 5축 평가 · ⓒ Dental Clinic Finder</div><div class="score-bars">${bars}</div></div>`);

  // QLRCQ 사이클 완주율 + 단계 분포 + 위반 횟수
  if (data.qlrcq_cycle_completion != null || data.max_reached_stage != null || data.avoidance_violation_count != null) {
    const cycle = Math.max(0, Math.min(100, data.qlrcq_cycle_completion || 0));
    const maxStage = data.max_reached_stage || 1;
    const violations = data.avoidance_violation_count || 0;
    const dist = data.stage_distribution || {};
    const distBars = [1,2,3,4,5].map(n => {
      const pct = Math.max(0, Math.min(100, parseInt(dist[n] || dist[String(n)]) || 0));
      return `<div style="display:flex; align-items:center; gap:6px; font-size:0.72rem; margin-bottom:3px;">
        <span style="width:80px; color:var(--text-tertiary);">${n}. ${safe(MACRO_STAGES[n-1].name)}</span>
        <div style="flex:1; height:6px; background:var(--gray-200); border-radius:3px; overflow:hidden;">
          <div style="width:${pct}%; height:100%; background:var(--primary);"></div>
        </div>
        <span style="width:30px; text-align:right; color:var(--text-secondary);">${pct}%</span>
      </div>`;
    }).join('');
    html.push(`<div class="eval-section">
      <div class="eval-section-title">🧭 QLRCQ 진행 분석</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
        <div class="kv-card">
          <div class="kv-label">사이클 완주율</div>
          <div class="kv-value" style="color:var(--primary);">${cycle}%</div>
        </div>
        <div class="kv-card">
          <div class="kv-label">최고 도달 단계</div>
          <div class="kv-value">${maxStage} · ${safe(MACRO_STAGES[maxStage-1]?.name || '-')}</div>
        </div>
      </div>
      ${violations > 0 ? `<div class="eval-violation" style="margin-bottom:10px;">
        <div class="eval-violation-head">⚠️ Critical Avoidance 위반 ${violations}건 감지</div>
      </div>` : ''}
      <div style="font-size:0.72rem; color:var(--text-tertiary); font-weight:700; margin:4px 0 6px;">단계별 대화 비중</div>
      ${distBars}
    </div>`);
  }
  // MACRO_STAGES 전역은 트래커 섹션에서 선언됨
  const _unused = MACRO_STAGES;

  // 요약
  if (Array.isArray(data.summary) && data.summary.length) {
    html.push(`<div class="eval-section">
      <div class="eval-section-title">📝 세션 요약</div>
      <ul class="eval-list">${data.summary.map(s => `<li>${safe(s)}</li>`).join('')}</ul>
    </div>`);
  }

  // 환자 우려
  if (Array.isArray(data.patient_concerns) && data.patient_concerns.length) {
    html.push(`<div class="eval-section">
      <div class="eval-section-title">🎐 환자 우려</div>
      <ul class="eval-list concern">${data.patient_concerns.map(s => `<li>${safe(s)}</li>`).join('')}</ul>
    </div>`);
  }

  // 핵심 순간
  if (Array.isArray(data.key_moments) && data.key_moments.length) {
    html.push(`<div class="eval-section">
      <div class="eval-section-title">⏱ 핵심 순간</div>
      ${data.key_moments.map(m => `
        <div class="eval-moment">
          <div class="eval-moment-when">${safe(m.when || '')}</div>
          <div class="eval-moment-quote">"${safe(m.quote || '')}"</div>
          <div class="eval-moment-why">${safe(m.why || '')}</div>
        </div>
      `).join('')}
    </div>`);
  }

  // 강점
  if (Array.isArray(data.staff_strengths) && data.staff_strengths.length) {
    html.push(`<div class="eval-section">
      <div class="eval-section-title">✅ 상담사가 잘한 점</div>
      <ul class="eval-list strength">${data.staff_strengths.map(s => `<li>${safe(s)}</li>`).join('')}</ul>
    </div>`);
  }

  // 개선
  if (Array.isArray(data.staff_improvements) && data.staff_improvements.length) {
    html.push(`<div class="eval-section">
      <div class="eval-section-title">🔧 개선 기회</div>
      <ul class="eval-list improve">${data.staff_improvements.map(s => `<li>${safe(s)}</li>`).join('')}</ul>
    </div>`);
  }

  // 원칙 위반
  if (Array.isArray(data.principle_violations) && data.principle_violations.length) {
    html.push(`<div class="eval-section">
      <div class="eval-section-title">⚠️ 환자 중심 원칙 위반 감지</div>
      ${data.principle_violations.map(v => `
        <div class="eval-violation">
          <div class="eval-violation-head">원칙: ${safe(v.principle || '-')}</div>
          <div class="eval-violation-quote">"${safe(v.quote || '')}"</div>
          <div class="eval-violation-suggest">→ 대안: ${safe(v.suggestion || '')}</div>
        </div>
      `).join('')}
    </div>`);
  }

  // 후속 조치
  if (Array.isArray(data.suggested_followup) && data.suggested_followup.length) {
    html.push(`<div class="eval-section">
      <div class="eval-section-title">🤝 후속 조치 제안</div>
      <ul class="eval-list followup">${data.suggested_followup.map(s => `<li>${safe(s)}</li>`).join('')}</ul>
    </div>`);
  }

  area.innerHTML = html.join('');
}

async function evaluateNow() {
  if (!currentSession) { showToast('진행 중인 상담이 없습니다', 'warning'); return; }
  if (!currentSession.turns?.length) { showToast('분석할 대화가 없습니다', 'warning'); return; }
  const btn = document.getElementById('evalNowBtn');
  const area = document.getElementById('evaluationArea');
  btn.disabled = true; btn.textContent = '분석 중...';
  area.innerHTML = '<div class="card-loading"><span class="spinner-sm"></span> 세션 전체를 분석하고 있습니다...</div>';
  try {
    const patient = getSelectedPatient();
    const hist = patient ? await buildPatientHistory(patient.id) : [];
    const res = await ConsultEngine.evaluateSession({
      session: currentSession, patient, history: hist
    });
    currentSession.evaluation = res.data;
    renderEvaluation(res.data, res.demo);
  } catch (e) {
    area.textContent = '분석 실패: ' + e.message;
    showToast('분석 실패', 'error');
  } finally {
    btn.disabled = false; btn.textContent = '🔍 다시 분석';
  }
}

async function renderHistory() {
  const el = document.getElementById('historyList');
  if (typeof SupabaseDB === 'undefined' || !SupabaseDB.isReady()) {
    el.innerHTML = '<div style="color:var(--text-tertiary); font-size:0.8125rem; padding:12px; text-align:center;">Supabase 연결 필요</div>';
    return;
  }
  let sessions = [];
  try { sessions = await SupabaseDB.getRecentSessions(5); }
  catch (e) {
    el.innerHTML = '<div style="color:var(--danger); font-size:0.8125rem; padding:12px; text-align:center;">세션 조회 실패</div>';
    return;
  }
  if (!sessions.length) {
    el.innerHTML = '<div style="color:var(--text-tertiary); font-size:0.8125rem; padding:12px; text-align:center;">아직 상담 이력이 없습니다</div>';
    return;
  }
  el.textContent = '';
  sessions.forEach(s => {
    const item = document.createElement('div');
    item.className = 'history-item';
    const mins = Math.max(1, Math.round((s.durationSec || 0) / 60));
    const lastPatient = (s.turns || []).filter(t => t.speaker === 'patient').slice(-1)[0]?.text || '';
    const lastCoach = (s.coachResults || []).slice(-1)[0]?.data || null;
    const lastReply = lastCoach
      ? (Array.isArray(lastCoach.recommended_reply) ? lastCoach.recommended_reply.join(' / ') : lastCoach.recommended_reply) || ''
      : '';

    const q = document.createElement('div');
    q.className = 'history-q';
    q.textContent = `🗂 ${s.patientName || '익명'} · ${mins}분 · 대화 ${s.turns?.length || 0} · 코칭 ${s.coachResults?.length || 0}`;
    item.appendChild(q);

    const meta = document.createElement('div');
    meta.className = 'history-meta';
    meta.textContent = `${s.author || '-'} · ${new Date(s.startedAt).toLocaleString('ko-KR')} 시작`;
    item.appendChild(meta);

    if (lastPatient) {
      const body = document.createElement('div');
      body.className = 'history-a';
      body.textContent = '마지막 환자 발화: ' + lastPatient;
      item.appendChild(body);
    }
    if (lastReply) {
      const body2 = document.createElement('div');
      body2.className = 'history-a';
      body2.style.color = 'var(--primary)';
      body2.textContent = '최종 코칭: ' + lastReply;
      item.appendChild(body2);
    }
    el.appendChild(item);
  });
}
renderHistory();

// ============================================================
// Web Speech API — 한국어 실시간 대화 녹취 (환자 ↔ 상담실장)
// ============================================================
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;
let turns = [];        // [{speaker:'unknown'|'patient'|'staff', text, at}]
let interimEl = null;  // 임시 DOM 노드

// ============================================================
// 상담 세션 (🎙 첫 시작 ~ 🛑 종료까지 하나의 세션)
// ============================================================
let currentSession = null; // { id, patientId, patientName, startedAt, turns[], coachResults[], author }
let sessionTimerHandle = null;

function startSession() {
  if (currentSession) return;
  const patient = getSelectedPatient();
  const author = Session.get();
  currentSession = {
    id: 'SES_' + Date.now(),
    patientId: patient?.id || null,
    patientName: patient?.name || '익명',
    author: author?.name || '익명',
    clinic: author?.clinic || '',
    clinic_id: author?.clinic_id || '',
    staff_id: author?.userId || '',
    startedAt: Date.now(),
    endedAt: null,
    turns: [],
    coachResults: []
  };
  document.getElementById('sessionCard').style.display = 'block';
  document.getElementById('endSessionBtn').disabled = false;
  document.getElementById('evalNowBtn').disabled = false;
  // 세션 중에는 환자·언어 변경 금지 (일관성)
  document.getElementById('patientSelect').disabled = true;
  document.getElementById('langSelect').disabled = true;
  startSessionTimer();
  updateSessionMeta();
  showToast('상담 세션이 시작되었습니다', 'info');
}

function startSessionTimer() {
  stopSessionTimer();
  sessionTimerHandle = setInterval(() => {
    if (!currentSession) return;
    const s = Math.floor((Date.now() - currentSession.startedAt) / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    const t = document.getElementById('sessionTimer');
    if (t) t.textContent = `${mm}:${ss}`;
  }, 1000);
}
function stopSessionTimer() {
  if (sessionTimerHandle) { clearInterval(sessionTimerHandle); sessionTimerHandle = null; }
}

function updateSessionMeta() {
  const el = document.getElementById('sessionMeta');
  if (!el || !currentSession) return;
  el.textContent = `대화 ${currentSession.turns.length}회 · 코칭 ${currentSession.coachResults.length}회`;
}

async function endSession() {
  if (!currentSession) { showToast('진행 중인 상담이 없습니다', 'warning'); return; }
  // 오클릭 방지 — 2단계 확인
  const hasContent = currentSession.turns?.length || currentSession.coachResults?.length;
  if (hasContent) {
    const mins = Math.max(1, Math.round((Date.now() - currentSession.startedAt) / 60000));
    const step1 = confirm(
      `[1/2] 상담을 종료하시겠습니까?\n\n` +
      `· 진행 시간: ${mins}분\n` +
      `· 대화 ${currentSession.turns.length}회\n` +
      `· 코칭 ${currentSession.coachResults.length}회\n\n` +
      `종료 후에는 이 세션에 새 대화를 이어갈 수 없습니다.`
    );
    if (!step1) return;
    const step2 = confirm(
      `[2/2] 정말 종료하시겠습니까?\n\n` +
      `확인을 누르면 전체 대화 녹취와 코칭 이력이 저장되고 세션이 영구히 마감됩니다.\n\n` +
      `취소를 원하시면 "취소"를 눌러주세요.`
    );
    if (!step2) { showToast('종료를 취소했습니다', 'info'); return; }
  }
  if (isRecording) stopMic();

  currentSession.endedAt = Date.now();
  currentSession.durationSec = Math.floor((currentSession.endedAt - currentSession.startedAt) / 1000);
  // 현재 turns 스냅샷을 세션에 저장 (진행 중 덮어쓰기 포함)
  currentSession.turns = turns.map(t => ({ ...t }));

  const btn = document.getElementById('endSessionBtn');
  btn.disabled = true;
  btn.textContent = '🔍 분석 중...';

  // 1) 세션 전체 평가 (환자 중심 원칙 기반)
  try {
    const patient = getSelectedPatient();
    const hist = patient ? await buildPatientHistory(patient.id) : [];
    const evalRes = await ConsultEngine.evaluateSession({ session: currentSession, patient, history: hist });
    currentSession.evaluation = evalRes.data;
    renderEvaluation(evalRes.data, evalRes.demo);
  } catch (e) {
    console.warn('세션 평가 실패', e);
  }

  btn.textContent = '💾 저장 중...';

  // Supabase 전용 저장 — 로컬 저장 없음
  if (isTestMode) { showToast('🧪 테스트 모드: 세션이 저장되지 않습니다', 'info'); btn.disabled = false; btn.textContent = '🛑 상담 종료 및 저장'; return; } if (typeof SupabaseDB === 'undefined' || !SupabaseDB.isReady()) {
    showToast('Supabase 미연결 — 세션을 저장할 수 없습니다', 'error');
    btn.disabled = false;
    btn.textContent = '🛑 상담 종료 및 저장';
    return;
  }
  try {
    await SupabaseDB.saveConsultLog({
      patientId: currentSession.patientId,
      engine: 'consult',
      input: currentSession.turns.map(t =>
        (t.speaker === 'staff' ? '[실장] ' : t.speaker === 'patient' ? '[환자] ' : '') + t.text
      ).join('\n'),
      output: (currentSession.coachResults.slice(-1)[0]?.data?.recommended_reply || []).join(' / ') || '',
      metadata: {
        type: 'session',                        // coach_turn과 구분
        session_id: currentSession.id,
        staff_id: currentSession.staff_id,
        clinic_id: currentSession.clinic_id,
        started_at: currentSession.startedAt,
        ended_at: currentSession.endedAt,
        duration_sec: currentSession.durationSec,
        turns: currentSession.turns,            // 대화 복원용
        turns_count: currentSession.turns.length,
        coach_count: currentSession.coachResults.length,
        author: currentSession.author,
        clinic: currentSession.clinic,
        patient_name: currentSession.patientName,
        coach_snapshots: currentSession.coachResults.map(c => c.data),
        evaluation: currentSession.evaluation || null
      }
    });
  } catch (e) {
    console.error('Supabase 세션 저장 실패', e);
    showToast('세션 저장 실패: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = '🛑 상담 종료 및 저장';
    return;
  }
  const saved = 'supabase';

  // 2.5) 당일 KPI 스냅샷 자동 수집 (Supabase 연결 시만)
  if (typeof SupabaseDB !== 'undefined' && SupabaseDB.isReady()) {
    try {
      const agg = await SupabaseDB.getDashboardAggregates();
      await SupabaseDB.upsertDailyKPI({
        conversion_rate: agg.kpi.conversionRate,
        avg_consult_min: agg.kpi.avgConsultMin,
        revisit_rate: agg.kpi.revisitRate,
        ai_usage_rate: agg.kpi.aiUsageRate,
        revenue: agg.kpi.monthlyRevenue,
        patient_count: agg.kpi.totalPatients,
        contract_count: agg.kpi.contractCount,
        raw: { funnel: agg.funnel, treatmentMix: agg.treatmentMix }
      });
    } catch (e) { console.warn('KPI 스냅샷 저장 실패', e); }
  }

  showToast(`상담 세션 저장 완료 (${saved}) · ${Math.round(currentSession.durationSec / 60)}분 · 대화 ${currentSession.turns.length}회`, 'success');

  const savedPatientId = currentSession.patientId;

  // 3) UI 초기화 — 단, 평가 결과는 유지 (상담사가 확인할 수 있도록)
  stopSessionTimer();
  currentSession = null;
  clearTranscript();
  document.getElementById('sessionCard').style.display = 'none';
  document.getElementById('endSessionBtn').disabled = true;
  document.getElementById('evalNowBtn').disabled = true;
  document.getElementById('patientSelect').disabled = false;
  document.getElementById('langSelect').disabled = false;
  document.getElementById('coachArea').innerHTML = '';
  const tracker = document.getElementById('qlrcqTracker');
  if (tracker) tracker.style.display = 'none';
  const area = document.getElementById('replyArea');
  if (area) {
    area.style.display = 'block';
    area.classList.add('empty');
    area.innerHTML = '환자 발화를 녹음하거나 입력한 후 <strong>전송</strong> 버튼을 눌러주세요.<br>AI가 환자의 속마음을 간파하고 상담실장이 그대로 쓸 수 있는 답변 스크립트를 생성합니다.';
  }
  btn.disabled = false;
  btn.textContent = '🛑 상담 종료 및 저장';
  renderHistory();
  // 같은 환자로 다시 상담할 가능성에 대비해 이력 뱃지 갱신
  if (savedPatientId) { invalidateSessionCache(savedPatientId); refreshPatientHistoryBadge(); }
}

function labelText(speaker) {
  if (speaker === 'patient') return '👤 환자';
  if (speaker === 'staff')   return '🧑‍⚕️ 상담실장';
  return '🗣 발화';
}

function renderTurns() {
  const log = document.getElementById('chatLog');
  log.textContent = '';
  // 마지막 환자 발화 인덱스 (있을 때만 강조)
  let lastPatientIdx = -1;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].speaker === 'patient') { lastPatientIdx = i; break; }
  }
  turns.forEach((t, idx) => {
    const bubble = document.createElement('div');
    bubble.className = 'turn ' + (t.speaker || 'unknown');
    if (idx === lastPatientIdx) bubble.classList.add('turn-last-patient');

    const meta = document.createElement('div');
    meta.className = 'turn-meta';
    meta.textContent = labelText(t.speaker);
    bubble.appendChild(meta);

    const text = document.createElement('div');
    text.className = 'turn-text';
    text.textContent = t.text;
    bubble.appendChild(text);

    log.appendChild(bubble);
  });
  log.scrollTop = log.scrollHeight;
}

function appendInterim(text) {
  const log = document.getElementById('chatLog');
  if (!interimEl) {
    interimEl = document.createElement('div');
    interimEl.className = 'turn unknown interim';
    const meta = document.createElement('div');
    meta.className = 'turn-meta';
    meta.textContent = '🗣 발화 중…';
    interimEl.appendChild(meta);
    const body = document.createElement('div');
    body.className = 'turn-text';
    interimEl.appendChild(body);
    log.appendChild(interimEl);
  }
  interimEl.querySelector('.turn-text').textContent = text;
  log.scrollTop = log.scrollHeight;
}

function commitFinal(text) {
  const trimmed = (text || '').trim();
  if (interimEl) { interimEl.remove(); interimEl = null; }
  if (!trimmed) return;
  turns.push({ speaker: 'unknown', text: trimmed, at: Date.now() });
  renderTurns();
  if (currentSession) {
    currentSession.turns = turns.map(t => ({ ...t }));
    updateSessionMeta();
  }
}

// 전송 후 AI가 분리한 diarized_turns로 재라벨링
function applyDiarization(diarized) {
  if (!Array.isArray(diarized) || !diarized.length) return;
  turns = diarized.map(t => ({
    speaker: (t.speaker === 'staff' || t.speaker === 'patient') ? t.speaker : 'unknown',
    text: t.text || '',
    at: Date.now()
  }));
  renderTurns();
  if (currentSession) {
    currentSession.turns = turns.map(t => ({ ...t }));
    updateSessionMeta();
  }
}

function initSpeech() {
  const btn = document.getElementById('micBtn');
  const status = document.getElementById('micStatus');
  // 명시적으로 활성화 (읽기 전용 모드 잔여 상태 방지)
  btn.disabled = false;

  if (!SpeechRec) {
    btn.disabled = true;
    status.innerHTML = '⚠️ 이 브라우저는 음성 인식을 지원하지 않습니다<br>Chrome 또는 Edge에서 열어주세요';
    return;
  }
  recognition = new SpeechRec();
  recognition.lang = document.getElementById('langSelect')?.value || 'ko-KR';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (evt) => {
    for (let i = evt.resultIndex; i < evt.results.length; i++) {
      const r = evt.results[i];
      const text = r[0].transcript;
      if (r.isFinal) commitFinal(text);
      else appendInterim(text);
    }
  };

  recognition.onerror = (e) => {
    console.warn('speech error:', e.error);
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      const fileHint = location.protocol === 'file:'
        ? '\n\n💡 file:// 에서 차단된 것일 수 있습니다. http://localhost:8018/consult.html 로 열면 대부분 해결됩니다.'
        : '\n\n브라우저 주소창 좌측 자물쇠 아이콘 → 사이트 설정 → 마이크 허용 후 다시 시도해주세요.';
      alert('❌ 마이크 권한이 거부되었습니다.' + fileHint);
      stopMic();
    } else if (e.error === 'no-speech') {
      // 무음 — 조용히 넘어감
    } else if (e.error === 'aborted') {
      // 사용자 중단 — 무시
    } else if (e.error === 'network') {
      showToast('네트워크 오류로 음성 인식이 중단되었습니다 (Google 음성 서버 연결 필요)', 'error');
      stopMic();
    } else {
      showToast('음성 인식 오류: ' + e.error, 'warning');
    }
  };

  recognition.onend = () => {
    // continuous 모드에서 브라우저가 자동 종료할 수 있음 — 녹음 중이면 재시작
    if (isRecording) {
      try { recognition.start(); } catch (e) { /* 이미 시작됨 */ }
    }
  };
}

function startMic() {
  if (!recognition) return;
  try {
    // 세션이 없으면 자동 시작 (🎙 첫 클릭 = 상담 시작)
    if (!currentSession) startSession();
    recognition.start();
    isRecording = true;
    document.getElementById('micBtn').classList.add('recording');
    document.getElementById('micBtn').textContent = '⏹';
    const s = document.getElementById('micStatus');
    s.textContent = '🔴 녹음 중… 자연스럽게 대화하세요';
    s.classList.add('recording');
    document.getElementById('chatLog').classList.add('recording');
  } catch (e) {
    showToast('녹음 시작 실패: ' + e.message, 'error');
  }
}

function stopMic() {
  if (recognition && isRecording) {
    isRecording = false;
    try { recognition.stop(); } catch (e) { /* noop */ }
  }
  if (interimEl) { interimEl.remove(); interimEl = null; }
  document.getElementById('micBtn').classList.remove('recording');
  document.getElementById('micBtn').textContent = '🎙';
  const s = document.getElementById('micStatus');
  s.textContent = '상담 시작 버튼을 누르세요';
  s.classList.remove('recording');
  document.getElementById('chatLog').classList.remove('recording');
}

function toggleMic() {
  if (!SpeechRec) {
    alert('❌ 이 브라우저는 음성 인식을 지원하지 않습니다.\n\nChrome 또는 Edge 브라우저에서 열어주세요.');
    return;
  }
  if (!recognition) {
    alert('❌ 음성 인식 초기화에 실패했습니다.\n\n페이지를 새로고침하거나 브라우저 콘솔(F12)의 오류를 확인해주세요.');
    return;
  }
  if (isRecording) stopMic(); else startMic();
}

// 환경 진단 배너 (실제 문제가 있을 때만 상단 노출)
(function renderEnvDiag() {
  const el = document.getElementById('envDiag');
  if (!el) return;
  const problems = [];
  if (!SpeechRec) {
    problems.push({
      color: 'var(--warning-bg)', border: 'var(--warning)', text: '#78350F',
      msg: '⚠️ <strong>이 브라우저는 음성 인식을 지원하지 않습니다.</strong> Chrome 또는 Edge에서 열어주세요. (현재는 수동 입력만 가능합니다)'
    });
  }
  if (!problems.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.style.background = problems[0].color;
  el.style.border = '1px solid ' + problems[0].border;
  el.style.color = problems[0].text;
  el.innerHTML = problems.map(p => p.msg).join('<br><br>');
})();

function clearTranscript() {
  turns = [];
  if (interimEl) { interimEl.remove(); interimEl = null; }
  document.getElementById('chatLog').textContent = '';
  document.getElementById('questionInput').value = '';
}

initLangSelect();
initSpeech();

// ============================================================
// 상담실장 코칭 답변 렌더링
// ============================================================
const INTENT_LABEL = {
  price: '가격', pain: '통증', fear: '불안', time: '시간',
  trust: '신뢰', compare: '비교', info: '정보부족', delay: '결정지연'
};

// ============================================================
// QLRCQ 5단계 트래커 렌더링
// ============================================================
const MACRO_STAGES = [
  { num: 1, name: '공감', en: 'Empathy' },
  { num: 2, name: '이해', en: 'Understanding' },
  { num: 3, name: '선택권 제공', en: 'Choice' },
  { num: 4, name: '가치 전달', en: 'Value' },
  { num: 5, name: '신뢰 구축', en: 'Trust' },
];
const QLRCQ_POS = [
  { key: 'Q',  label: 'Q',  desc: 'Question' },
  { key: 'L',  label: 'L',  desc: 'Listen' },
  { key: 'R',  label: 'R',  desc: 'Reaction' },
  { key: 'C',  label: 'C',  desc: 'Confirm' },
  { key: "Q'", label: "Q'", desc: 'Re-Question' },
];

function renderQlrcqTracker(d) {
  const el = document.getElementById('qlrcqTracker');
  if (!el) return;
  const stage = Math.max(1, Math.min(5, parseInt(d.macro_stage) || 1));
  const stageName = d.macro_stage_name || MACRO_STAGES[stage - 1].name;
  const pos = (d.qlrcq_position || 'Q').trim();
  const safe = (v) => escapeHTML(String(v == null ? '' : v));

  const macroHtml = MACRO_STAGES.map(s => {
    const cls = s.num < stage ? 'done' : s.num === stage ? 'active' : '';
    return `<div class="qlrcq-macro-step ${cls}">
      <span class="qlrcq-macro-step-num">${s.num}</span>${s.name}
    </div>`;
  }).join('');

  const microHtml = QLRCQ_POS.map(p => {
    const active = p.key === pos;
    return `<div>
      <div class="qlrcq-micro-step ${active ? 'active' : ''}">${p.label}</div>
      <div class="qlrcq-micro-label">${p.desc}</div>
    </div>`;
  }).join('');

  const alignClass = d.principle_alignment === '준수' ? 'ok'
    : d.principle_alignment === '위반' ? 'bad' : 'warn';
  const violations = Array.isArray(d.avoidance_violations) ? d.avoidance_violations : [];
  const signals = Array.isArray(d.success_signals_detected) ? d.success_signals_detected : [];

  el.innerHTML = `
    <div class="qlrcq-title">
      <span>🧭 5단계 × QLRCQ 좌표</span>
      <span class="qlrcq-title-note">© Dental Clinic Finder</span>
    </div>
    <div class="qlrcq-macro">${macroHtml}</div>
    <div class="qlrcq-micro">${microHtml}</div>
    <div class="qlrcq-meta">
      <div style="margin-bottom:4px;">
        <span class="qlrcq-meta-pill ${alignClass}">원칙 ${safe(d.principle_alignment || '-')}</span>
        <strong>${safe(stageName)}</strong> 단계의 <strong>${safe(pos)}</strong> 위치
      </div>
      ${d.qlrcq_reason ? `<div style="color:var(--text-tertiary); margin-bottom:4px;">왜 여기: ${safe(d.qlrcq_reason)}</div>` : ''}
      ${signals.length ? `<div style="margin-bottom:4px;">✅ 성공 신호: ${signals.map(s => safe(s)).join(' · ')}</div>` : ''}
      ${violations.length ? `<div style="color:var(--danger-text); margin-bottom:4px;">❌ 피해야 할 것 감지: ${violations.map(v => safe(v)).join(' · ')}</div>` : ''}
      ${d.next_stage_gate ? `<div style="color:var(--text-secondary);">🔓 다음 단계 조건: ${safe(d.next_stage_gate)}</div>` : ''}
    </div>`;
  el.style.display = 'block';
}

// 코칭 카드 토글 (헤더 클릭)
function toggleCoachCard(card) {
  card.classList.toggle('collapsed');
}

function renderCoach(d, isDemo) {
  console.log('[renderCoach] 호출됨, data:', d);
  const area = document.getElementById('replyArea');
  const wrap = document.getElementById('coachArea');
  console.log('[renderCoach] area:', area, 'wrap:', wrap);

  if (!wrap) {
    console.error('[renderCoach] ❌ coachArea 요소 없음!');
    return;
  }

  area.classList.add('empty');
  area.style.display = 'none';

  // 기존 카드들을 모두 접힘 + active 제거
  wrap.querySelectorAll('.coach-card-wrap').forEach(c => {
    c.classList.add('collapsed');
    c.classList.remove('active');
  });

  // readiness(신규) 우선, 없으면 conversion_probability(구버전 호환)
  const prob = Math.max(0, Math.min(100, (d.readiness != null ? d.readiness : d.conversion_probability) || 0));
  const probColor = prob >= 70 ? 'var(--success)' : prob >= 40 ? 'var(--warning)' : 'var(--gray-400)';
  const C = 28, R = C - 4, LEN = 2 * Math.PI * R;

  const intentPrimary = d.intent_primary || '';
  const intentSecondary = d.intent_secondary || [];
  const keyPoints = d.key_points || [];
  const cautions = d.cautions || [];
  // 구버전(treatment_suggestion) 호환: 단일 객체면 배열로 래핑
  const options = Array.isArray(d.treatment_options) && d.treatment_options.length
    ? d.treatment_options
    : (d.treatment_suggestion ? [{
        name: d.treatment_suggestion.name,
        pros: d.treatment_suggestion.why,
        cons: '',
        estimate_range: d.treatment_suggestion.estimate_range
      }] : []);

  // 모두 escapeHTML 처리 (사용자 입력 유래)
  const safe = (v) => escapeHTML(String(v == null ? '' : v));

  // 턴 번호·시간
  const turnNum = (currentSession?.coachResults?.length) || (wrap.querySelectorAll('.coach-card-wrap').length + 1);
  const nowTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  const intentLabelForHeader = INTENT_LABEL[intentPrimary] || intentPrimary || '—';

  // 새 카드 wrap 만들어서 append (최신은 하단에 쌓임 — 시간 순 읽기 자연스러움)
  const card = document.createElement('div');
  card.className = 'coach-card-wrap active';

  const header = document.createElement('div');
  header.className = 'coach-card-header';
  header.innerHTML = `
    <span class="coach-turn-pill">📤 #${turnNum}</span>
    <div class="coach-header-meta">
      <span>${nowTime}</span>
      <span class="coach-header-intent">· ${safe(intentLabelForHeader)}</span>
      ${prob != null ? `<span class="coach-header-readiness">준비도 ${prob}%</span>` : ''}
      ${isDemo ? '<span class="demo-badge">DEMO</span>' : ''}
    </div>
    <span class="coach-toggle-icon">▸</span>
  `;
  header.addEventListener('click', () => toggleCoachCard(card));
  card.appendChild(header);

  const body = document.createElement('div');
  body.className = 'coach-card-body';
  body.innerHTML = `
    <div class="coach-header">
      <span class="coach-header-icon">🧑‍⚕️</span>
      <div class="coach-header-text">
        <strong>상담실장 코칭 스크립트 ${isDemo ? '<span class="demo-badge">DEMO</span>' : ''}</strong>
        <span>환자의 속마음을 읽고 바로 쓸 수 있는 답변을 준비했습니다</span>
      </div>
    </div>

    <div class="intent-tags">
      ${intentPrimary ? `<span class="intent-tag primary">주의도 · ${safe(INTENT_LABEL[intentPrimary] || intentPrimary)}</span>` : ''}
      ${intentSecondary.map(t => `<span class="intent-tag secondary">${safe(INTENT_LABEL[t] || t)}</span>`).join('')}
      <span class="intent-tag" style="background:${d.risk_level === 'high' ? 'var(--danger-bg)' : d.risk_level === 'medium' ? 'var(--warning-bg)' : 'var(--success-bg)'}; color:${d.risk_level === 'high' ? 'var(--danger-text)' : d.risk_level === 'medium' ? 'var(--warning-text)' : 'var(--success-text)'};">리스크 · ${safe(d.risk_level || 'low')}</span>
    </div>

    ${(() => {
      const arr = Array.isArray(d.subtext) ? d.subtext.filter(Boolean) : (d.subtext ? [d.subtext] : []);
      if (!arr.length) return '';
      return `
        <div class="subtext-box">
          <strong>🔎 SUBTEXT · 환자의 진짜 속마음</strong>
          <ul class="subtext-list">${arr.map(s => `<li>${safe(s)}</li>`).join('')}</ul>
        </div>`;
    })()}

    ${(() => {
      const arr = Array.isArray(d.recommended_reply) ? d.recommended_reply.filter(Boolean) : (d.recommended_reply ? [d.recommended_reply] : []);
      if (!arr.length) return '';
      return `
        <div class="reply-script">
          <button class="reply-script-copy" onclick="copyReply()" id="copyBtn">📋 복사</button>
          <div class="reply-script-label">📢 이 그대로 말씀하세요</div>
          <ul class="reply-script-list" id="replyScript" data-lines='${escapeHTML(JSON.stringify(arr))}'>
            ${arr.map(s => `<li>${safe(s)}</li>`).join('')}
          </ul>
        </div>`;
    })()}

    ${keyPoints.length ? `
      <div style="margin-bottom:8px; font-weight:700; font-size:0.85rem;">🎯 대화 중 짚을 포인트</div>
      <ul class="kp-list">${keyPoints.map(k => `<li>${safe(k)}</li>`).join('')}</ul>` : ''}

    ${options.length ? `
      <div style="margin:4px 0 8px; font-weight:700; font-size:0.85rem;">🧭 환자가 고를 수 있는 선택지</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; margin-bottom:14px;">
        ${options.map((o, i) => `
          <div class="kv-card" style="border-top:3px solid var(--primary);">
            <div style="font-size:0.7rem; color:var(--primary); font-weight:800; letter-spacing:0.06em;">옵션 ${i + 1}</div>
            <div class="kv-value" style="margin:4px 0 8px;">${safe(o.name || '-')}</div>
            ${o.pros ? `<div style="font-size:0.78rem; color:var(--success-text); margin-bottom:4px;">✓ ${safe(o.pros)}</div>` : ''}
            ${o.cons ? `<div style="font-size:0.78rem; color:var(--warning-text); margin-bottom:6px;">△ ${safe(o.cons)}</div>` : ''}
            ${o.estimate_range ? `<div style="font-size:0.78rem; color:var(--text-tertiary); border-top:1px dashed var(--gray-200); padding-top:6px; margin-top:6px;">💰 ${safe(o.estimate_range)}</div>` : ''}
          </div>
        `).join('')}
      </div>` : ''}

    <div class="prob-gauge">
      <div class="prob-ring">
        <svg width="64" height="64">
          <circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--gray-200)" stroke-width="6"/>
          <circle cx="32" cy="32" r="${R}" fill="none" stroke="${probColor}" stroke-width="6"
                  stroke-dasharray="${LEN}" stroke-dashoffset="${LEN - LEN * prob / 100}" stroke-linecap="round"/>
        </svg>
        <div class="prob-ring-val">${prob}%</div>
      </div>
      <div>
        <div style="font-size:0.72rem; color:var(--text-tertiary); font-weight:700; letter-spacing:0.05em;">심리적 결정 준비도</div>
        <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:2px;">${prob >= 70 ? '결정에 가까워진 상태 — 환자의 속도를 따르세요' : prob >= 40 ? '고민 중 — 정보를 충분히 드리고 시간을 허용하세요' : '결정에 이르려면 시간이 더 필요한 상태'}</div>
      </div>
    </div>

    ${cautions.length ? `
      <div class="caution-box">
        <strong>⚠️ 강요·압박 금지 — 이 환자에게 피할 말투</strong>
        <ul>${cautions.map(c => `<li>${safe(c)}</li>`).join('')}</ul>
      </div>` : ''}

    ${d.next_action ? `
      <div class="next-action-box">
        <strong>🤝 다음 동반 단계 — 환자의 결정을 돕는 방향</strong>
        ${safe(d.next_action)}
      </div>` : ''}
  `;

  card.appendChild(body);
  wrap.appendChild(card);
  console.log('[renderCoach] ✅ 코칭 카드 렌더링 완료, wrap.childElementCount:', wrap.childElementCount);
  // 최신 카드로 스크롤
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function copyReply() {
  const el = document.getElementById('replyScript');
  if (!el) return;
  let text = '';
  const raw = el.getAttribute('data-lines');
  if (raw) {
    try { text = JSON.parse(raw).filter(Boolean).join('\n'); }
    catch { text = el.textContent.trim(); }
  } else {
    text = el.textContent.trim();
  }
  navigator.clipboard?.writeText(text).then(
    () => { showToast('답변 스크립트가 복사되었습니다', 'success'); },
    () => { showToast('복사 실패', 'error'); }
  );
}

async function runCoach() {
  const manualQ = (document.getElementById('questionInput').value || '').trim();
  const hasTurns = turns.length > 0;
  if (!hasTurns && !manualQ) { showToast('환자 발화가 필요합니다 (녹음 또는 직접 입력)', 'warning'); return; }
  if (isRecording) stopMic(); // 전송 시 녹음 자동 정지

  const patient = getSelectedPatient();
  const btn = document.getElementById('submitBtn');
  const area = document.getElementById('replyArea');
  const coachArea = document.getElementById('coachArea');
  const badge = document.getElementById('replyBadge');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-inline"></span> 분석 중...';
  area.classList.remove('empty');
  area.style.display = 'block';
  area.innerHTML = '<span class="spinner-inline"></span> ⚡ 즉시 코칭 생성 중 (1~2초)...';
  coachArea.innerHTML = '<div style="padding:12px; color:var(--text-tertiary); font-size:0.875rem;"><span class="spinner-inline"></span> 상세 분석은 3~5초 후 업데이트됩니다...</div>';
  badge.innerHTML = '';

  let quickData = null;

  try {
    // 이전 세션 요약 (Supabase에서만 조회)
    const hist = patient ? await buildPatientHistory(patient.id) : [];

    // 화자 미구분 발화 배열 구성 (녹음된 turns 또는 수동 입력 1개)
    const utterances = hasTurns
      ? turns.map(t => ({ text: t.text, at: t.at, speaker: t.speaker }))
      : [{ text: manualQ, at: Date.now() }];

    // 현재 선택된 언어 전달
    const lang = document.getElementById('langSelect')?.value || 'ko-KR';

    // ⚡ 투-스테이지 병렬 호출 (Phase 2)
    const quickPromise = ConsultEngine.coachReplyQuick({ patient, utterances, language: lang });
    const fullPromise = ConsultEngine.coachReply({ patient, utterances, history: hist, language: lang });

    // 1단계: 빠른 응답 먼저 UI 표시
    const quickRes = await quickPromise;
    quickData = quickRes.data;
    area.innerHTML = '';
    const quickBox = document.createElement('div');
    quickBox.style.cssText = 'padding:14px 16px; background:var(--primary-bg); border-left:4px solid var(--primary); border-radius:var(--radius-sm); font-size:0.9375rem; line-height:1.7;';
    const label = document.createElement('div');
    label.style.cssText = 'font-size:0.75rem; color:var(--primary); font-weight:700; margin-bottom:8px; letter-spacing:0.02em;';
    label.textContent = `⚡ 즉시 응답 · ${quickData.intent || ''}`;
    quickBox.appendChild(label);
    const subEl = document.createElement('div');
    subEl.style.cssText = 'margin-bottom:8px; color:var(--text-secondary);';
    subEl.innerHTML = '<strong style="color:var(--text-primary);">속마음:</strong> ';
    subEl.appendChild(document.createTextNode(quickData.subtext || ''));
    quickBox.appendChild(subEl);
    const replyEl = document.createElement('div');
    replyEl.innerHTML = '<strong>말할 문장:</strong> ';
    replyEl.appendChild(document.createTextNode(quickData.recommended_reply || ''));
    quickBox.appendChild(replyEl);
    area.appendChild(quickBox);

    // 2단계: 상세 응답 (30초 타임아웃 추가)
    let coachRes;
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI 응답 타임아웃 (30초 초과)')), 30000)
      );
      coachRes = await Promise.race([fullPromise, timeoutPromise]);
    } catch (timeoutErr) {
      console.error('[runCoach] AI 응답 실패:', timeoutErr);
      showToast('⚠️ AI 응답이 지연됩니다. 다시 시도해주세요.', 'warning');
      coachArea.innerHTML = '<div style="padding:12px; color:var(--danger);">⚠️ 상세 분석 실패 · 다시 시도해주세요</div>';
      throw timeoutErr;
    }

    console.log('[runCoach] AI 응답 수신:', coachRes);
    const data = coachRes?.data;
    if (!data) throw new Error('AI 응답 데이터 없음');

    // ① AI가 분리한 화자 라벨을 대화창에 반영
    if (data.diarized_turns && data.diarized_turns.length) {
      console.log('[runCoach] 화자 구분 적용:', data.diarized_turns.length);
      applyDiarization(data.diarized_turns);
    } else {
      console.warn('[runCoach] 화자 구분 데이터 없음');
    }

    // ② QLRCQ 트래커 + 코칭 카드 렌더
    console.log('[runCoach] 렌더링 시작');
    renderQlrcqTracker(data);
    renderCoach(data, coachRes.demo);
    console.log('[runCoach] 렌더링 완료');
    if (coachRes.demo) badge.innerHTML = '<span class="demo-badge">DEMO</span>';


    // 세션에 누적 + Supabase 즉시 중간 저장 (방식 A)
    const qSaved = data.last_patient_utterance || manualQ || '';
    if (currentSession) {
      const turnIndex = currentSession.coachResults.length + 1;
      currentSession.coachResults.push({ at: Date.now(), question: qSaved, data });
      updateSessionMeta();

      // Supabase에 즉시 저장 (coach_turn)
      if (!isTestMode && typeof SupabaseDB !== 'undefined' && SupabaseDB.isReady()) {
        try {
          const turnsSnapshot = currentSession.turns.map(t => (
            (t.speaker === 'staff' ? '[실장] ' : t.speaker === 'patient' ? '[환자] ' : '') + t.text
          )).join('\n');
          await SupabaseDB.saveConsultLog({
            patientId: currentSession.patientId,
            engine: 'consult',
            input: qSaved,
            output: (Array.isArray(data.recommended_reply) ? data.recommended_reply.join(' / ') : data.recommended_reply) || '',
            metadata: {
              type: 'coach_turn',
              session_id: currentSession.id,
              staff_id: currentSession.staff_id,
              clinic_id: currentSession.clinic_id,
              turn_index: turnIndex,
              at: Date.now(),
              turns_snapshot: turnsSnapshot,
              turns_count_at_turn: currentSession.turns.length,
              patient_name: currentSession.patientName,
              author: currentSession.author,
              clinic: currentSession.clinic,
              coach: data,
              quick: quickData
            }
          });
          showToast(`코칭 #${turnIndex} 생성 · Supabase 저장 완료`, 'success');
        } catch (e) {
          console.warn('중간 저장 실패', e);
          showToast('코칭 생성됨 · ⚠️ DB 저장 실패 (종료 시 재시도됩니다)', 'warning');
        }
      } else {
        showToast('코칭 생성됨 · Supabase 미연결 (종료 전 유실 위험)', 'warning');
      }
    } else {
      showToast('🎙 상담을 시작한 뒤 전송하면 세션에 누적·저장됩니다', 'info');
    }

    renderHistory();
  } catch (e) {
    console.error(e);
    area.textContent = '';
    const p = document.createElement('p');
    p.style.color = 'var(--danger)';
    p.textContent = '⚠️ 오류: ' + e.message;
    area.appendChild(p);
    showToast('코칭 생성 실패', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '📤 전송 (상담실장 답변)';
  }
}


// ===== 사이드바 렌더링 (DOMContentLoaded 대기) =====
document.addEventListener('DOMContentLoaded', function() {
  const appDiv = document.getElementById('app');
  const pageName = document.body.getAttribute('data-page') || 'consult';
  if (appDiv && !document.getElementById('sidebar')) {
    appDiv.insertAdjacentHTML('afterbegin', renderSidebar(pageName));
    console.log('[✅ Sidebar loaded]', pageName);
  }
});

// ===== 사이드바 렌더링 (setTimeout으로 지연) =====
(function initSidebar() {
  const maxAttempts = 50;
  let attempts = 0;
  
  function tryLoadSidebar() {
    const appDiv = document.getElementById('app');
    const renderFunc = window.renderSidebar;
    
    if (appDiv && renderFunc && !document.getElementById('sidebar')) {
      const pageName = document.body.getAttribute('data-page') || 'page';
      try {
        appDiv.insertAdjacentHTML('afterbegin', renderFunc(pageName));
        console.log('[✅ Sidebar loaded]', pageName);
        return true;
      } catch (e) {
        console.error('[❌ Sidebar load error]', e);
        return false;
      }
    }
    
    if (attempts < maxAttempts) {
      attempts++;
      setTimeout(tryLoadSidebar, 100);
    } else {
      console.warn('[⚠️ Sidebar load timeout]');
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryLoadSidebar);
  } else {
    setTimeout(tryLoadSidebar, 100);
  }
})();
