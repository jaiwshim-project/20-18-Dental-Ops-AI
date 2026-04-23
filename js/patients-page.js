// [moved to DOMContentLoaded] document.getElementById('app').insertAdjacentHTML('afterbegin', renderSidebar('patients'));

let patients = [];
let activeFilter = 'all';
let usingSupabase = false;

const avatarColors = ['var(--primary)', 'var(--accent)', '#8B5CF6', 'var(--warning)', 'var(--danger)', '#EC4899', '#14B8A6'];
const statusConfig = {
  '상담대기': { bg: 'var(--gray-100)', color: 'var(--gray-600)' },
  '상담중':   { bg: 'var(--primary-bg)', color: 'var(--primary)' },
  '계약완료': { bg: 'var(--success-bg)', color: 'var(--success-text)' },
  '치료중':   { bg: 'var(--warning-bg)', color: 'var(--warning-text)' },
  '치료완료': { bg: '#CCFBF1', color: '#0F766E' },
  '이탈':     { bg: 'var(--danger-bg)', color: 'var(--danger-text)' },
};

async function reload() {
  patients = [];
  if (typeof SupabaseDB !== 'undefined' && SupabaseDB.isReady()) {
    try {
      const data = await SupabaseDB.getPatients({ limit: 200 });
      patients = (data || []).map(p => ({
        id: p.id,
        name: p.name,
        age: p.age || '-',
        phone: p.phone || '-',
        gender: p.gender || '-',
        status: p.status || '상담대기',
        lastVisit: (p.updated_at || p.created_at || '').split('T')[0] || '-',
        treatment: p.treatment || '미정',
        estimate: p.estimate || 0,
        conversionProb: p.conversion_prob || 50,
        memo: p.memo || '',
      }));
      usingSupabase = true;
      document.getElementById('dataSourceBadge').innerHTML = '<span style="color:var(--success);">&#x1F7E2; Supabase 연결</span>';
      showToast(`Supabase에서 ${patients.length}명 로드`, 'success');
    } catch (e) {
      console.warn('Supabase 로드 실패:', e);
      loadSample();
    }
  } else {
    loadSample();
  }
  applyFilters();
}

function loadSample() {
  const local = Store.get('patients_local', null);
  patients = local && local.length ? local : JSON.parse(JSON.stringify(SampleData.patients));
  usingSupabase = false;
  document.getElementById('dataSourceBadge').innerHTML = '<span style="color:var(--warning);">&#x1F7E1; 샘플 데이터 (로컬)</span>';
}

function updateKPI(list) {
  document.getElementById('kpiTotal').textContent = list.length;
  document.getElementById('kpiWaiting').textContent = list.filter(p => p.status === '상담대기').length;
  document.getElementById('kpiContract').textContent = list.filter(p => p.status === '계약완료').length;
  const avgEst = list.length ? Math.round(list.reduce((s, p) => s + (p.estimate || 0), 0) / list.length) : 0;
  document.getElementById('kpiEstimate').textContent = formatCurrency(avgEst);
}

function renderTable(list) {
  const tbody = document.getElementById('patientTable');
  if (!list || !list.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:48px 20px; color:var(--text-tertiary);">
      <div style="font-size:2rem; margin-bottom:12px;">&#x1F465;</div>
      등록된 환자가 없습니다.<br>
      <button class="btn btn-primary btn-sm" style="margin-top:16px;" onclick="openModal('addPatientModal')">+ 신규 환자 등록</button>
    </td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((p, i) => {
    const sc = statusConfig[p.status] || statusConfig['상담대기'];
    const ac = avatarColors[i % avatarColors.length];
    const probColor = p.conversionProb >= 70 ? 'var(--success)' : p.conversionProb >= 50 ? 'var(--warning)' : 'var(--danger)';
    return `<tr class="patient-row" onclick="openDetail('${p.id}')">
      <td>
        <div class="patient-name-cell">
          <div class="patient-avatar" style="background:${ac};">${(p.name || '?').charAt(0)}</div>
          <div><strong>${p.name}</strong></div>
        </div>
      </td>
      <td>${p.age || '-'}세 / ${p.gender || '-'}</td>
      <td style="font-family:monospace; font-size:0.8125rem;">${p.phone || '-'}</td>
      <td>${p.treatment || '-'}</td>
      <td><span class="status-badge" style="background:${sc.bg}; color:${sc.color};">${p.status}</span></td>
      <td style="font-weight:600;">${formatCurrency(p.estimate || 0)}</td>
      <td>
        <div class="prob-bar"><div class="prob-bar-fill" style="width:${p.conversionProb}%; background:${probColor};"></div></div>
        <strong>${p.conversionProb}%</strong>
      </td>
      <td style="font-size:0.8125rem; color:var(--text-tertiary);">${p.lastVisit}</td>
      <td onclick="event.stopPropagation();">
        <a href="consult.html?patient=${p.id}" class="btn btn-sm btn-outline">&#x1F4AC; 상담</a>
      </td>
    </tr>`;
  }).join('');
}

function applyFilters() {
  const q = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  let filtered = patients;
  if (activeFilter !== 'all') filtered = filtered.filter(p => p.status === activeFilter);
  if (q) filtered = filtered.filter(p =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.phone || '').includes(q));
  renderTable(filtered);
  updateKPI(filtered);
}

function filterByStatus(el, status) {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  activeFilter = status;
  applyFilters();
}

async function openDetail(id) {
  const p = patients.find(x => String(x.id) === String(id));
  if (!p) return;

  document.getElementById('detailName').textContent = p.name;
  document.getElementById('detailPanel').classList.add('open');
  document.getElementById('detailOverlay').classList.add('open');

  const sc = statusConfig[p.status] || statusConfig['상담대기'];

  document.getElementById('detailBody').innerHTML = `
    <div class="detail-section">
      <h4>📌 프로필</h4>
      <div class="detail-info-grid">
        <div class="detail-info-item"><label>환자 ID</label><div style="font-size:0.8125rem; font-family:monospace;">${String(p.id).substring(0, 10)}</div></div>
        <div class="detail-info-item"><label>나이 / 성별</label><div>${p.age || '-'}세 / ${p.gender || '-'}</div></div>
        <div class="detail-info-item"><label>전화</label><div>${escapeHTML(p.phone || '-')}</div></div>
        <div class="detail-info-item"><label>상태</label><div><span class="status-badge" style="background:${sc.bg}; color:${sc.color};">${p.status}</span></div></div>
        <div class="detail-info-item"><label>관심 치료</label><div>${escapeHTML(p.treatment || '-')}</div></div>
        <div class="detail-info-item"><label>최근 방문</label><div>${p.lastVisit || p.created_at?.substring(0,10) || '-'}</div></div>
      </div>
      ${p.memo ? `<div style="margin-top:12px; padding:10px 14px; background:var(--warning-bg); border-left:3px solid var(--warning); border-radius:6px; font-size:0.85rem; color:#78350F; white-space:pre-wrap;">${escapeHTML(p.memo)}</div>` : ''}
    </div>
    <div id="reportArea">
      <div style="padding:32px; text-align:center; color:var(--text-tertiary); font-size:0.8125rem;">
        <div class="spinner" style="margin:0 auto;"></div>
        <p style="margin-top:10px;">환자 종합 분석 로딩 중…</p>
      </div>
    </div>
    <div style="display:flex; gap:12px; margin-top:20px;">
      <a href="consult.html?patient=${p.id}" class="btn btn-primary" style="flex:1; text-align:center;">&#x1F4AC; 상담 시작</a>
      <a href="conversion.html?patient=${p.id}" class="btn btn-accent" style="flex:1; text-align:center;">&#x1F3AF; 전환 분석</a>
    </div>
  `;

  await renderPatientReport(p);
}

// ============================================================
// 환자 종합 분석 리포트 (8섹션)
// ============================================================
async function renderPatientReport(p) {
  const area = document.getElementById('reportArea');
  try {
    await _renderPatientReportCore(p, area);
  } catch (e) {
    console.error('환자 리포트 렌더 실패:', e);
    area.innerHTML = `<div style="padding:20px; color:var(--danger); font-size:0.85rem;">
      ⚠️ 리포트 렌더 중 오류: ${escapeHTML(e.message)}<br>
      <span style="font-size:0.72rem; color:var(--text-tertiary);">F12 콘솔에서 자세한 스택을 확인해주세요.</span>
    </div>`;
  }
}

async function _renderPatientReportCore(p, area) {
  if (typeof SupabaseDB === 'undefined' || !SupabaseDB.isReady()) {
    area.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-tertiary); font-size:0.8125rem;">Supabase 연결 필요</div>`;
    return;
  }
  if (!p || !p.id) {
    area.innerHTML = `<div style="padding:20px; color:var(--danger); font-size:0.8125rem;">환자 ID가 없습니다 (p=${JSON.stringify(p)})</div>`;
    return;
  }

  let sessions = [];
  try { sessions = await SupabaseDB.getPatientSessions(p.id, 50); }
  catch (e) {
    console.warn('getPatientSessions 실패', e);
    area.innerHTML = `<div style="padding:20px; color:var(--danger); font-size:0.8125rem;">세션 조회 실패: ${escapeHTML(e.message)}</div>`;
    return;
  }

  if (!sessions.length) {
    area.innerHTML = `<div style="padding:32px; text-align:center; color:var(--text-tertiary); font-size:0.9rem;">
      📭 아직 상담 기록이 없습니다.<br>
      <span style="font-size:0.78rem;">왼쪽의 <strong>💬 상담 시작</strong>을 눌러 첫 상담을 진행해보세요.</span>
    </div>`;
    return;
  }

  // 시간 순 (오래된 → 최신)
  const chrono = [...sessions].reverse();
  const latest = sessions[0];

  // ───────── 데이터 집계 ─────────
  // 1) 준비도 추세
  const readinessTrend = chrono.map(s => {
    const end = s.evaluation?.readiness_trajectory?.end;
    const last = s.coachResults?.slice(-1)[0]?.data?.readiness;
    return { date: (s.startedAt || '').substring(5,10), value: end ?? last ?? 0 };
  });
  const overallScoreTrend = chrono.map(s => ({
    date: (s.startedAt || '').substring(5,10),
    score: s.evaluation?.overall_score || 0
  }));

  // 2) 반복 패턴
  const intentCounts = {};
  const subtextAll = [];
  const cautionsAll = [];
  const allPatientUtterances = [];
  let maxStageReached = 0;
  const stageReachedTrend = chrono.map(s => {
    const m = s.evaluation?.max_reached_stage || 0;
    if (m > maxStageReached) maxStageReached = m;
    return { date: (s.startedAt || '').substring(5,10), stage: m };
  });

  sessions.forEach(s => {
    (s.coachResults || []).forEach(c => {
      const d = c.data || {};
      const k = d.intent_primary;
      if (k) intentCounts[k] = (intentCounts[k] || 0) + 1;
      (d.intent_secondary || []).forEach(t => intentCounts[t] = (intentCounts[t] || 0) + 1);
      (d.subtext || []).forEach(t => subtextAll.push(t));
      (d.cautions || []).forEach(t => cautionsAll.push(t));
    });
    (s.turns || []).forEach(t => {
      if (t.speaker === 'patient' && t.text) allPatientUtterances.push({
        text: t.text,
        when: s.startedAt,
        sessionId: s.id
      });
    });
  });

  const topIntents = Object.entries(intentCounts).sort((a,b) => b[1]-a[1]).slice(0, 5);
  const INTENT_KO = { price:'가격', pain:'통증', fear:'불안', time:'시간', trust:'신뢰', compare:'비교', info:'정보부족', delay:'결정지연' };

  // ───────── HTML 렌더 ─────────
  const safe = escapeHTML;
  const sumSec = sessions.reduce((s, x) => s + (x.durationSec || 0), 0);
  const totalCoach = sessions.reduce((s, x) => s + (x.coachResults?.length || 0), 0);
  const avgScore = sessions.filter(s => s.evaluation?.overall_score)
    .reduce((s, x, _, arr) => s + x.evaluation.overall_score / arr.length, 0);

  area.innerHTML = `
    <!-- 요약 배지 -->
    <div class="detail-section">
      <h4>📊 세션 요약</h4>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:10px;">
        <div class="kv-mini"><div class="kv-mini-label">총 상담 횟수</div><div class="kv-mini-val">${sessions.length}회</div></div>
        <div class="kv-mini"><div class="kv-mini-label">총 대화 시간</div><div class="kv-mini-val">${Math.round(sumSec/60)}분</div></div>
        <div class="kv-mini"><div class="kv-mini-label">누적 코칭</div><div class="kv-mini-val">${totalCoach}건</div></div>
        <div class="kv-mini"><div class="kv-mini-label">평균 평가</div><div class="kv-mini-val" style="color:var(--primary);">${Math.round(avgScore)}점</div></div>
        <div class="kv-mini"><div class="kv-mini-label">최고 도달 단계</div><div class="kv-mini-val">${maxStageReached}/5</div></div>
      </div>
    </div>

    <!-- 세션 타임라인 -->
    <div class="detail-section">
      <h4>📈 세션 타임라인 (최신순)</h4>
      <div class="timeline">
        ${sessions.map((s, i) => {
          const dt = new Date(s.startedAt);
          const mins = Math.round((s.durationSec || 0) / 60);
          const score = s.evaluation?.overall_score;
          const firstPatient = (s.turns || []).find(t => t.speaker === 'patient')?.text || '';
          const lastCoach = (s.coachResults || []).slice(-1)[0]?.data;
          const nextAction = lastCoach?.next_action || '';
          return `
            <div class="timeline-item">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                  <strong style="font-size:0.88rem;">#${sessions.length - i}회차 · ${dt.toLocaleDateString('ko-KR')} ${dt.toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'})}</strong>
                  ${score != null ? `<span class="score-chip ${score>=80?'high':score>=60?'mid':'low'}">${score}점</span>` : ''}
                </div>
                <div style="font-size:0.75rem; color:var(--text-tertiary); margin:3px 0;">${mins}분 · 대화 ${s.turns?.length||0}턴 · 코칭 ${s.coachResults?.length||0}건 · ${safe(s.author || '-')}</div>
                ${firstPatient ? `<div style="font-size:0.78rem; color:var(--text-secondary); margin-top:4px;">💬 "${safe(firstPatient.slice(0, 80))}${firstPatient.length>80?'…':''}"</div>` : ''}
                ${nextAction ? `<div style="font-size:0.75rem; color:var(--success); margin-top:4px;">🤝 ${safe(nextAction.slice(0, 120))}</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- 준비도 추세 -->
    ${readinessTrend.length > 0 ? `
      <div class="detail-section">
        <h4>📉 결정 준비도 추세</h4>
        <div class="mini-chart">
          ${(function() {
            const W = 520, H = 100, pad = 20;
            const innerW = W - pad*2, innerH = H - pad*2;
            const values = readinessTrend.map(t => t.value);
            const max = 100, min = 0;
            const step = innerW / Math.max(readinessTrend.length - 1, 1);
            const pts = readinessTrend.map((t, i) => ({
              x: pad + i*step,
              y: pad + innerH - (t.value/100)*innerH,
              v: t.value, d: t.date
            }));
            const path = pts.map((p, i) => (i===0?'M':'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
            const dots = pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--primary)" stroke="#FFF" stroke-width="2"><title>${p.d}: ${p.v}%</title></circle>`).join('');
            return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%; height:110px;">
              <line x1="${pad}" y1="${pad+innerH/2}" x2="${W-pad}" y2="${pad+innerH/2}" stroke="var(--gray-200)" stroke-dasharray="3,3"/>
              <path d="${path}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round"/>
              ${dots}
            </svg>`;
          })()}
        </div>
        <div style="font-size:0.75rem; color:var(--text-tertiary); text-align:center;">
          첫 상담 <strong>${readinessTrend[0].value}%</strong> → 최근 <strong style="color:var(--primary);">${readinessTrend[readinessTrend.length-1].value}%</strong>
        </div>
      </div>` : ''}

    <!-- 반복 패턴 -->
    ${topIntents.length > 0 ? `
      <div class="detail-section">
        <h4>🔁 반복 등장 패턴 (의도 분류)</h4>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${topIntents.map(([k, cnt]) => `
            <span class="intent-chip">${safe(INTENT_KO[k] || k)} · ${cnt}회</span>
          `).join('')}
        </div>
      </div>` : ''}

    <!-- QLRCQ 진행도 -->
    <div class="detail-section">
      <h4>🧭 QLRCQ 대단계 도달 추이</h4>
      <div style="display:flex; gap:6px; align-items:flex-end; height:80px; margin-bottom:8px;">
        ${stageReachedTrend.map(t => `
          <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;">
            <div style="width:100%; height:${(t.stage/5)*60}px; background:linear-gradient(180deg, var(--primary), var(--primary-dark)); border-radius:4px 4px 0 0; min-height:4px;" title="${t.date}: ${t.stage}단계"></div>
            <div style="font-size:0.65rem; color:var(--text-tertiary);">${t.date}</div>
            <div style="font-size:0.7rem; font-weight:700; color:var(--primary);">${t.stage}</div>
          </div>
        `).join('')}
      </div>
      <div style="font-size:0.75rem; color:var(--text-tertiary); text-align:center;">1(공감)·2(이해)·3(선택권)·4(가치)·5(신뢰) 중 도달</div>
    </div>

    <!-- 환자 발화 모음 -->
    ${allPatientUtterances.length > 0 ? `
      <div class="detail-section">
        <h4>💬 모든 환자 발화 (${allPatientUtterances.length}개)</h4>
        <details>
          <summary style="cursor:pointer; font-size:0.85rem; color:var(--primary); padding:8px 0;">펼쳐서 전체 보기</summary>
          <div class="utterance-list">
            ${allPatientUtterances.slice(0, 100).map(u => `
              <div class="utterance-item">
                <div class="utterance-meta">${new Date(u.when).toLocaleString('ko-KR', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}</div>
                <div class="utterance-text">"${safe(u.text)}"</div>
              </div>
            `).join('')}
          </div>
        </details>
      </div>` : ''}

    <!-- 주의사항 누적 -->
    ${cautionsAll.length > 0 ? `
      <div class="detail-section">
        <h4>⚠️ 누적 주의사항 (${cautionsAll.length}개)</h4>
        <ul style="margin:0; padding-left:18px; font-size:0.82rem; color:#7F1D1D; line-height:1.6;">
          ${[...new Set(cautionsAll)].slice(0, 10).map(c => `<li>${safe(c)}</li>`).join('')}
        </ul>
      </div>` : ''}

    <!-- 최종 권장 액션 -->
    ${latest?.coachResults?.slice(-1)[0]?.data?.next_action ? `
      <div class="detail-section" style="background:linear-gradient(135deg, var(--success-light-bg), #BBF7D0); padding:16px 18px; border-radius:10px; border-left:4px solid var(--success);">
        <h4 style="margin-bottom:8px; color:#14532D;">🤝 다음 상담 시 권장 액션</h4>
        <div style="font-size:0.88rem; color:#14532D; line-height:1.6;">
          ${safe(latest.coachResults.slice(-1)[0].data.next_action)}
        </div>
      </div>` : ''}
  `;
}

function closeDetail() {
  document.getElementById('detailPanel').classList.remove('open');
  document.getElementById('detailOverlay').classList.remove('open');
}

async function addPatient() {
  const name = document.getElementById('newName').value.trim();
  const phone = document.getElementById('newPhone').value.trim();
  if (!name) { showToast('이름을 입력하세요', 'warning'); return; }
  if (!phone) { showToast('전화번호를 입력하세요', 'warning'); return; }

  const data = {
    name,
    phone,
    age: parseInt(document.getElementById('newAge').value) || null,
    gender: document.getElementById('newGender').value,
    treatment: document.getElementById('newTreatment').value,
    memo: document.getElementById('newMemo').value.trim(),
  };

  if (typeof SupabaseDB !== 'undefined' && SupabaseDB.isReady()) {
    try {
      const created = await SupabaseDB.createPatient(data);
      patients.unshift({
        id: created.id,
        name: created.name,
        age: created.age || '-',
        phone: created.phone,
        gender: created.gender || '-',
        status: created.status || '상담대기',
        lastVisit: new Date().toISOString().split('T')[0],
        treatment: created.treatment || '미정',
        estimate: 0,
        conversionProb: 50,
        memo: created.memo || '',
      });
      showToast(`${name}님이 Supabase에 등록되었습니다`, 'success');
    } catch (e) {
      showToast('Supabase 저장 실패: ' + e.message, 'error');
      return;
    }
  } else {
    patients.unshift({
      id: 'P' + Date.now(),
      ...data,
      age: data.age || 30,
      status: '상담대기',
      lastVisit: new Date().toISOString().split('T')[0],
      estimate: 0,
      conversionProb: 50,
    });
    Store.set('patients_local', patients);
    showToast(`${name}님이 등록되었습니다 (로컬)`, 'success');
  }

  // 입력 필드 초기화
  ['newName', 'newPhone', 'newAge', 'newMemo'].forEach(id => document.getElementById(id).value = '');
  closeModal('addPatientModal');
  applyFilters();
}

// 초기 로드
setTimeout(reload, 300);
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

// ===== 사이드바 지속적 유지 (강력한 방식) =====
(function maintainSidebar() {
  function ensureSidebar() {
    const appDiv = document.getElementById('app');
    const sidebar = document.getElementById('sidebar');
    const renderFunc = window.renderSidebar;
    
    // 사이드바가 없으면 추가
    if (appDiv && !sidebar && renderFunc) {
      const pageName = document.body.getAttribute('data-page') || 'page';
      try {
        appDiv.insertAdjacentHTML('afterbegin', renderFunc(pageName));
        console.log('[✅ Sidebar maintained]', pageName);
      } catch (e) {
        console.error('[Sidebar error]', e);
      }
    }
  }
  
  // 초기 로드
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureSidebar);
  } else {
    setTimeout(ensureSidebar, 100);
  }
  
  // 주기적 확인 (1초마다 - 사이드바가 사라지면 다시 추가)
  setInterval(ensureSidebar, 1000);
})();
