// [moved to DOMContentLoaded] document.getElementById('app').insertAdjacentHTML('afterbegin', renderSidebar('conversion'));

const QUICK_OBJECTIONS = [
  { icon: '💸', label: '비싸요', text: '가격이 너무 비싸서 부담됩니다. 생각보다 훨씬 많은 금액이네요.' },
  { icon: '😰', label: '무서워요', text: '치료 과정이 아프거나 무서울 것 같아서 엄두가 안 납니다.' },
  { icon: '⏳', label: '급하지 않아요', text: '지금 당장 급한 건 아니라서, 조금 더 생각해보고 나중에 결정하고 싶어요.' },
  { icon: '🔍', label: '다른 곳 알아볼게요', text: '다른 치과 몇 군데도 비교해보고 결정하고 싶습니다.' },
  { icon: '👨‍👩', label: '가족과 상의', text: '금액이 커서 가족(배우자)과 상의해본 뒤에 다시 연락드릴게요.' },
];

let patientCache = [];

async function fillPatientSelect() {
  const sel = document.getElementById('patientSelect');
  sel.innerHTML = '<option value="">환자 선택</option>';
  if (typeof SupabaseDB === 'undefined' || !SupabaseDB.isReady()) {
    showToast('Supabase 미연결 — 환자 목록을 불러올 수 없습니다', 'warning');
    return;
  }
  try {
    patientCache = await SupabaseDB.getPatients({ limit: 200 });
    patientCache.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      const ageTxt = p.age ? `${p.age}세` : '-';
      opt.textContent = `${p.name} (${ageTxt}, ${p.treatment || '미정'})`;
      sel.appendChild(opt);
    });
  } catch (e) { console.warn('환자 조회 실패', e); }
  sel.addEventListener('change', syncPatient);
  syncPatient();
}

function syncPatient() {
  const id = document.getElementById('patientSelect').value;
  const p = patientCache.find(x => x.id === id);
  if (!p) return;
  if (p.treatment) document.getElementById('treatmentSelect').value = p.treatment;
  // estimate 컬럼이 없을 수 있음 — 비워두기
}

function fillQuickGrid() {
  const html = QUICK_OBJECTIONS.map((q, i) =>
    `<button class="quick-btn" onclick="applyQuick(${i})">
      <span class="qi">${q.icon}</span>
      <span class="ql">${q.label}</span>
    </button>`
  ).join('');
  document.getElementById('quickGrid').innerHTML = html;
}

function applyQuick(idx) {
  document.getElementById('objectionInput').value = QUICK_OBJECTIONS[idx].text;
  showToast('반대 의견이 입력되었습니다', 'info', 1500);
}

function parseSteps(text) {
  // 1/2/3/4/5 번호 또는 **공감** 등 라벨로 분할
  const labels = [
    { key: 'empathy', name: '공감', kw: ['공감'] },
    { key: 'reframe', name: '재해석', kw: ['재해석', '본질'] },
    { key: 'resolve', name: '해소', kw: ['해소', '정보'] },
    { key: 'alternative', name: '대안', kw: ['대안'] },
    { key: 'cta', name: 'CTA', kw: ['CTA', '다음 액션', '액션'] },
  ];
  // 먼저 ** 라벨 기반 분할 시도
  const out = labels.map(l => ({ ...l, text: '' }));
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  let current = -1;
  lines.forEach(line => {
    const clean = line.replace(/^\*\*/, '').replace(/\*\*/g, '').replace(/^#+\s*/, '');
    // 번호 패턴
    const numMatch = line.match(/^([1-5])[.)\s]/);
    if (numMatch) {
      current = parseInt(numMatch[1]) - 1;
      const rest = line.replace(/^[1-5][.)\s]+/, '').replace(/^\*\*[^*]+\*\*:?/, '').trim();
      if (rest && out[current]) out[current].text += (out[current].text ? '\n' : '') + rest;
      return;
    }
    // 라벨 패턴
    let matched = false;
    for (let i = 0; i < labels.length; i++) {
      if (labels[i].kw.some(k => clean.startsWith(k))) {
        current = i;
        const rest = clean.replace(new RegExp('^(' + labels[i].kw.join('|') + ')[:\\-\\s]*'), '').trim();
        if (rest) out[i].text += (out[i].text ? '\n' : '') + rest;
        matched = true;
        break;
      }
    }
    if (matched) return;
    // 현재 카드에 이어쓰기
    if (current >= 0 && out[current]) {
      out[current].text += (out[current].text ? '\n' : '') + clean;
    }
  });
  // 전부 비면 전체 텍스트를 공감으로 fallback
  if (out.every(o => !o.text)) {
    out[0].text = text;
  }
  return out;
}

async function runPersuade() {
  const btn = document.getElementById('persuadeBtn');
  const objection = document.getElementById('objectionInput').value.trim();
  const treatment = document.getElementById('treatmentSelect').value;
  const estimate = parseInt(document.getElementById('estimateInput').value) || 0;
  if (!objection) { showToast('환자의 반대/우려를 입력하세요', 'warning'); return; }

  btn.disabled = true;
  btn.textContent = '⏳ 생성 중...';

  const area = document.getElementById('stepsArea');
  area.innerHTML = '<div class="card"><div class="card-body" style="display:flex; justify-content:center; padding:40px;"><div class="spinner"></div></div></div>';

  try {
    const res = await ConversionEngine.persuade({ objection, treatment, estimate });
    const steps = parseSteps(res.text);
    const labels = [
      { key: 'empathy', name: '1. 공감' },
      { key: 'reframe', name: '2. 재해석' },
      { key: 'resolve', name: '3. 해소' },
      { key: 'alternative', name: '4. 대안' },
      { key: 'cta', name: '5. CTA' },
    ];
    area.innerHTML = steps.map((s, i) =>
      `<div class="step-card ${labels[i].key}">
        <span class="step-label ${labels[i].key}">${labels[i].name}</span>
        <div class="step-text">${(s.text || '(내용 없음)').replace(/</g, '&lt;')}</div>
      </div>`
    ).join('') + (res.demo ? '<p style="font-size:0.75rem; color:var(--warning); margin-top:8px;">※ Gemini API 키 미설정 — 데모 응답</p>' : '');

    // Supabase 저장 — conversions + consult_logs(engine=conversion)
    const patientId = document.getElementById('patientSelect').value || null;
    const patient = patientCache.find(p => p.id === patientId);
    if (typeof SupabaseDB !== 'undefined' && SupabaseDB.isReady()) {
      try {
        const strategyText = steps.map(s => `[${s.key}] ${s.text}`).join('\n');
        await SupabaseDB.saveConversion({
          patientId,
          treatmentType: treatment,
          estimate: Number(estimate) || 0,
          probability: 0,
          strategy: strategyText,
          status: '상담중'
        });
        await SupabaseDB.saveConsultLog({
          patientId,
          engine: 'conversion',
          input: objection,
          output: strategyText,
          metadata: {
            treatment, estimate, objection,
            patient_name: patient?.name || '-',
            author: Session.get()?.name,
            clinic: Session.get()?.clinic,
            steps: steps.map(s => ({ key: s.key, text: s.text }))
          }
        });
        showToast('설득 멘트 생성 · Supabase 저장 완료', 'success');
      } catch (e) {
        console.warn('Supabase 저장 실패', e);
        showToast('저장 실패: ' + e.message, 'error');
      }
    } else {
      showToast('설득 멘트 생성 (Supabase 미연결 — 저장 안 됨)', 'warning');
    }
    renderHistory();
  } catch (e) {
    area.innerHTML = '<div class="card"><div class="card-body"><p style="color:var(--danger);">오류: ' + e.message + '</p></div></div>';
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ 설득 멘트 생성';
  }
}

async function runProbability() {
  const btn = document.getElementById('probBtn');
  const patientId = document.getElementById('patientSelect').value;
  const patient = patientCache.find(p => p.id === patientId);
  const treatment = document.getElementById('treatmentSelect').value;
  const objection = document.getElementById('objectionInput').value.trim();
  btn.disabled = true;
  btn.textContent = '⏳ 분석 중...';
  try {
    const res = await ConversionEngine.predictProbability({
      patient, treatment,
      interactions: objection ? ('반대 의견: ' + objection) : '초회 상담'
    });
    const data = res.data;
    const prob = Math.max(0, Math.min(100, parseInt(data.probability) || 0));
    // 게이지 애니메이션
    const circumference = 2 * Math.PI * 76; // ~477.5
    const fg = document.getElementById('gaugeFg');
    fg.style.strokeDashoffset = circumference * (1 - prob / 100);
    // 색상 변경
    if (prob >= 70) fg.style.stroke = 'var(--success)';
    else if (prob >= 40) fg.style.stroke = 'var(--warning)';
    else fg.style.stroke = 'var(--danger)';

    // 숫자 카운트업
    const valEl = document.getElementById('gaugeValue');
    const start = parseInt(valEl.textContent) || 0;
    const steps = 30;
    let i = 0;
    const anim = setInterval(() => {
      i++;
      valEl.textContent = Math.round(start + (prob - start) * (i / steps));
      if (i >= steps) { valEl.textContent = prob; clearInterval(anim); }
    }, 20);

    document.getElementById('posSignals').innerHTML = (data.signals_positive || [])
      .map(s => `<div class="signal-item pos"><span class="signal-icon">✓</span>${s}</div>`).join('')
      || '<div class="signal-item pos"><span class="signal-icon">–</span>없음</div>';
    document.getElementById('negSignals').innerHTML = (data.signals_negative || [])
      .map(s => `<div class="signal-item neg"><span class="signal-icon">!</span>${s}</div>`).join('')
      || '<div class="signal-item neg"><span class="signal-icon">–</span>없음</div>';
    document.getElementById('nbaText').textContent = data.next_best_action || '추가 상담 필요';

    if (res.demo) showToast('데모 응답 (API 키 미설정)', 'warning');
    else showToast('확률 분석 완료', 'success');
  } catch (e) {
    showToast('오류: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🎯 확률 분석 실행';
  }
}

async function renderHistory() {
  const el = document.getElementById('historyList');
  if (typeof SupabaseDB === 'undefined' || !SupabaseDB.isReady()) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">🔌</span>Supabase 연결 필요</div>';
    return;
  }
  try {
    const logs = await SupabaseDB.getConsultLogs({ engine: 'conversion', limit: 10 });
    if (!logs.length) {
      el.innerHTML = '<div class="empty"><span class="empty-icon">📭</span>아직 이력이 없습니다.</div>';
      return;
    }
    el.innerHTML = logs.map(h => {
      const m = h.metadata || {};
      const objection = (h.input || '').slice(0, 60);
      return `<div class="history-item">
        <div>
          <strong>${escapeHTML(m.patient_name || '-')}</strong> · ${escapeHTML(m.treatment || '-')}${m.estimate ? ' · ' + formatCurrency(m.estimate) : ''}
          <div style="font-size:0.8rem; color:var(--text-tertiary); margin-top:2px;">"${escapeHTML(objection)}${(h.input || '').length > 60 ? '...' : ''}"</div>
        </div>
        <div class="history-meta">${formatDate(h.created_at)} ${formatTime(h.created_at)}</div>
      </div>`;
    }).join('');
  } catch (e) {
    console.warn(e);
    el.innerHTML = '<div class="empty"><span class="empty-icon">⚠️</span>조회 실패</div>';
  }
}

// 초기화
fillPatientSelect();
fillQuickGrid();
renderHistory();
  </script>

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
