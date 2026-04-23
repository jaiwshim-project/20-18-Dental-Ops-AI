  <script>
// [moved to DOMContentLoaded] document.getElementById('app').insertAdjacentHTML('afterbegin', renderSidebar('insight'));

let currentReport = null;

function getTopic() {
  const custom = document.getElementById('customTopic').value.trim();
  return custom || document.getElementById('topicSelect').value;
}

function parseStrategy(strategyText) {
  if (Array.isArray(strategyText)) return strategyText;
  if (!strategyText) return [];
  return strategyText.split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/^[0-9]+[)\.)]\s*/, '').replace(/^[-•]\s*/, ''));
}

async function runReport() {
  const topic = getTopic();
  if (!topic) { showToast('주제를 선택하거나 입력하세요', 'warning'); return; }

  const btn = document.getElementById('runBtn');
  btn.disabled = true;
  btn.textContent = '⏳ 생성 중...';

  const area = document.getElementById('reportArea');
  area.innerHTML = '<div class="card"><div class="card-body" style="display:flex; flex-direction:column; align-items:center; padding:60px;"><div class="spinner" style="margin-bottom:20px;"></div><p>6단계 하네스 분석 중...</p></div></div>';

  try {
    const res = await InsightEngine.generate({ topic, data: SampleData });
    const data = res.data;
    currentReport = { topic, data, isDemo: res.demo, createdAt: new Date().toISOString() };
    renderReport(topic, data, res.demo);
    document.getElementById('actionBar').style.display = 'block';
    if (res.demo) showToast('데모 응답 생성됨 (API 키 미설정)', 'warning');
    else showToast('인사이트 리포트 생성 완료', 'success');
  } catch (e) {
    area.innerHTML = '<div class="card"><div class="card-body"><p style="color:var(--danger);">오류: ' + e.message + '</p></div></div>';
  } finally {
    btn.disabled = false;
    btn.textContent = '🚀 리포트 생성';
  }
}

function renderReport(topic, data, isDemo) {
  const area = document.getElementById('reportArea');
  const findings = data.findings || [];
  const strategy = parseStrategy(data.strategy);
  const kpis = data.kpi_to_track || [];

  area.innerHTML = `
    <div id="reportContent">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
        <div>
          <h2 style="font-size:1.5rem; margin-bottom:4px;">${topic}</h2>
          <p style="font-size:0.85rem; color:var(--text-tertiary);">생성일 ${formatDate(new Date())} · Harness 6-Stage ${isDemo ? '· <span style="color:var(--warning);">데모 모드</span>' : ''}</p>
        </div>
        <span class="badge badge-primary">🧠 Insight Report</span>
      </div>

      <div class="section-header">
        <span class="section-num">1</span>
        <span class="section-title">Summary (큐레이터 요약)</span>
      </div>
      <div class="harness-summary">
        <div class="harness-label">Executive Summary</div>
        <div class="harness-summary-text">${data.summary || '요약 없음'}</div>
      </div>

      <div class="section-header">
        <span class="section-num">2</span>
        <span class="section-title">Findings (발견된 패턴 · 근거 · 함의)</span>
      </div>
      <div class="findings-grid">
        ${findings.length ? findings.map((f, i) => `
          <div class="finding-card">
            <div class="finding-col">
              <div class="finding-label">🔍 Pattern ${i + 1}</div>
              <div class="finding-text">${f.pattern || '—'}</div>
            </div>
            <div class="finding-col">
              <div class="finding-label evidence">📊 Evidence</div>
              <div class="finding-text">${f.evidence || '—'}</div>
            </div>
            <div class="finding-col">
              <div class="finding-label implication">💡 Implication</div>
              <div class="finding-text">${f.implication || '—'}</div>
            </div>
          </div>
        `).join('') : '<div class="empty">발견된 패턴 없음</div>'}
      </div>

      ${data.paradox ? `
        <div class="section-header">
          <span class="section-num">3</span>
          <span class="section-title">Paradox (역설)</span>
        </div>
        <div class="paradox-box">
          <div class="paradox-label">역설 · PARADOX</div>
          <div class="paradox-text">${data.paradox}</div>
        </div>
      ` : ''}

      <div class="section-header">
        <span class="section-num">4</span>
        <span class="section-title">Strategy (전략 제안)</span>
      </div>
      <div class="strategy-list">
        ${strategy.length ? strategy.map((s, i) => `
          <div class="strategy-item">
            <div class="strategy-num">${i + 1}</div>
            <div class="strategy-text">${s}</div>
          </div>
        `).join('') : '<p style="color:var(--text-tertiary);">전략 없음</p>'}
      </div>

      <div class="section-header">
        <span class="section-num">5</span>
        <span class="section-title">KPI to Track (추적 지표)</span>
      </div>
      <div class="kpi-tags">
        ${kpis.length ? kpis.map(k => `<span class="kpi-tag">${k}</span>`).join('') : '<span class="kpi-tag">—</span>'}
      </div>
    </div>
  `;
}

async function saveReport() {
  if (!currentReport) { showToast('저장할 리포트가 없습니다', 'warning'); return; }
  const { topic, data } = currentReport;
  const session = Session.get();
  const payload = {
    title: topic,
    type: 'harness',
    summary: data.summary || '',
    findings: data.findings || [],
    strategy: data.strategy || '',
    author: session?.name || '익명'
  };

  // Supabase 전용
  if (typeof SupabaseDB === 'undefined' || !SupabaseDB.isReady()) {
    showToast('Supabase 미연결 — 리포트가 저장되지 않습니다', 'error');
    return;
  }
  try {
    await SupabaseDB.saveInsightReport({
      ...payload,
      // findings JSONB에 raw data도 함께 저장 (loadReport용)
      findings: Array.isArray(payload.findings) && payload.findings.length
        ? payload.findings
        : [{ _raw: data }]
    });
    showToast('Supabase에 저장되었습니다', 'success');
    await renderReportList();
  } catch (e) {
    console.warn('Supabase 저장 실패', e);
    showToast('저장 실패: ' + e.message, 'error');
  }
}

function downloadPDF() {
  if (!currentReport) { showToast('다운로드할 리포트가 없습니다', 'warning'); return; }
  showToast('인쇄 대화상자에서 PDF로 저장하세요', 'info');
  setTimeout(() => window.print(), 500);
}

async function renderReportList() {
  const el = document.getElementById('reportList');
  let list = [];
  if (typeof SupabaseDB === 'undefined' || !SupabaseDB.isReady()) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">🔌</span>Supabase 연결 필요</div>';
    return;
  }
  try {
    list = await SupabaseDB.getInsightReports({ limit: 5 });
  } catch (e) {
    console.warn(e);
    el.innerHTML = '<div class="empty"><span class="empty-icon">⚠️</span>조회 실패</div>';
    return;
  }

  if (!list || !list.length) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">📭</span>저장된 리포트가 없습니다.</div>';
    return;
  }
  el.innerHTML = list.map((r, i) => `
    <div class="report-item" onclick="loadReport(${i})">
      <div class="report-title">${r.title || '(제목 없음)'}</div>
      <div class="report-meta">👤 ${r.author || '-'} · ${formatDate(r.created_at || r.createdAt || new Date())}</div>
      <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:6px; line-height:1.5;">
        ${((r.summary || '') + '').slice(0, 120)}${((r.summary || '') + '').length > 120 ? '...' : ''}
      </div>
    </div>
  `).join('');
  // 리스트 캐시
  window.__reportCache = list;
}

function loadReport(i) {
  const list = window.__reportCache || [];
  const r = list[i];
  if (!r) return;
  // Supabase 포맷 또는 로컬 포맷 모두 지원
  const data = r.data || {
    summary: r.summary,
    findings: r.findings || [],
    strategy: r.strategy || '',
    paradox: r.paradox || '',
    kpi_to_track: r.kpi_to_track || []
  };
  currentReport = { topic: r.title, data, isDemo: false, createdAt: r.created_at || r.createdAt };
  renderReport(r.title, data, false);
  document.getElementById('actionBar').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('리포트를 불러왔습니다', 'info');
}

// ============================================================
// Harness 6-Stage Pipeline
// ============================================================

function stepperHTML() {
  const stages = (window.HarnessEngine && HarnessEngine.STAGES) || [];
  return `
    <div class="card mb-24">
      <div class="card-body">
        <div class="stepper" id="stepper">
          ${stages.map(s => `
            <div class="step" id="step-${s.id}">
              <div class="step-dot"></div>
              <div class="step-label">${s.label}</div>
              <div class="step-desc">${s.desc}</div>
              <div class="step-status"></div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>`;
}

function setStep(id, status) {
  const el = document.getElementById('step-' + id);
  if (!el) return;
  el.classList.remove('running', 'done');
  if (status) el.classList.add(status);
}

// 간단한 마크다운 → HTML (XSS 안전: 먼저 escape 후 패턴 복원)
function renderMarkdown(md) {
  if (!md) return '';
  let h = escapeHTML(md);
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  h = h.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  h = h.replace(/^---$/gm, '<hr>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  const blocks = h.split(/\n\s*\n/).map(b => {
    const t = b.trim();
    if (!t) return '';
    if (/^<(h[1-3]|blockquote|hr|ul|ol|pre)/.test(t)) return t;
    return '<p>' + t.replace(/\n/g, '<br>') + '</p>';
  });
  return blocks.join('\n');
}

async function runHarness() {
  const topic = getTopic();
  if (!topic) { showToast('주제를 선택하거나 입력하세요', 'warning'); return; }

  const hBtn = document.getElementById('harnessBtn');
  const qBtn = document.getElementById('runBtn');
  hBtn.disabled = true; qBtn.disabled = true;
  hBtn.textContent = '⏳ 하네스 가동 중...';

  const area = document.getElementById('reportArea');
  area.innerHTML = stepperHTML() +
    '<div class="card"><div class="card-body"><div class="card-loading"><span class="spinner-sm"></span> 하네스 파이프라인을 시작합니다...</div></div></div>';

  const stageResults = {};
  try {
    const result = await HarnessEngine.run(
      { topic, data: SampleData },
      (stageId, payload, meta) => {
        if (meta.status === 'running') setStep(stageId, 'running');
        else if (meta.status === 'done') {
          setStep(stageId, 'done');
          stageResults[stageId] = payload;
        }
      }
    );

    currentReport = {
      topic,
      data: result.structured,
      harness: result,
      isDemo: result.isDemo,
      createdAt: new Date().toISOString()
    };

    renderHarnessReport(topic, result);
    document.getElementById('actionBar').style.display = 'block';

    if (result.isDemo) showToast('일부 단계가 데모 응답으로 생성됨', 'warning');
    else showToast('하네스 6단계 인사이트 생성 완료', 'success');
  } catch (e) {
    const err = document.createElement('div');
    err.className = 'card';
    const body = document.createElement('div');
    body.className = 'card-body';
    const p = document.createElement('p');
    p.style.color = 'var(--danger)';
    p.textContent = '하네스 실행 오류: ' + e.message;
    body.appendChild(p);
    err.appendChild(body);
    area.appendChild(err);
  } finally {
    hBtn.disabled = false; qBtn.disabled = false;
    hBtn.textContent = '🧠 하네스 6단계';
  }
}

function renderHarnessReport(topic, h) {
  const area = document.getElementById('reportArea');
  const s = h.structured || {};
  const findings = s.findings || [];
  const strategy = parseStrategy(s.strategy);
  const kpis = s.kpi_to_track || [];

  // 헤더 + 스테퍼는 유지 (최상단)
  const header = `
    <div id="reportContent">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
        <div>
          <h2 style="font-size:1.5rem; margin-bottom:4px;">${escapeHTML(topic)}</h2>
          <p style="font-size:0.85rem; color:var(--text-tertiary);">생성일 ${formatDate(new Date())} · Harness 6-Stage ${h.isDemo ? '· <span style="color:var(--warning);">데모 응답 포함</span>' : ''}</p>
        </div>
        <span class="badge badge-primary">🧠 Harness Report</span>
      </div>
  `;

  // ① 최종 산문 (Writer+Editor 결과)
  const proseSection = `
    <div class="section-header">
      <span class="section-num">★</span>
      <span class="section-title">최종 산문 (Writer → Editor)</span>
    </div>
    <div class="prose-box">${renderMarkdown(h.final || h.draft || '')}</div>
  `;

  // ② 구조화 요약 (기존 포맷 재사용)
  const summarySection = `
    <div class="section-header">
      <span class="section-num">1</span>
      <span class="section-title">Summary</span>
    </div>
    <div class="harness-summary">
      <div class="harness-label">Executive Summary</div>
      <div class="harness-summary-text">${escapeHTML(s.summary || h.blueprint?.thesis || '요약 없음')}</div>
    </div>

    <div class="section-header">
      <span class="section-num">2</span>
      <span class="section-title">Findings</span>
    </div>
    <div class="findings-grid">
      ${findings.length ? findings.map((f, i) => `
        <div class="finding-card">
          <div class="finding-col">
            <div class="finding-label">🔍 Pattern ${i + 1}</div>
            <div class="finding-text">${escapeHTML(f.pattern || '—')}</div>
          </div>
          <div class="finding-col">
            <div class="finding-label evidence">📊 Evidence</div>
            <div class="finding-text">${escapeHTML(f.evidence || '—')}</div>
          </div>
          <div class="finding-col">
            <div class="finding-label implication">💡 Implication</div>
            <div class="finding-text">${escapeHTML(f.implication || '—')}</div>
          </div>
        </div>
      `).join('') : '<div class="empty">발견된 패턴 없음</div>'}
    </div>

    ${s.paradox ? `
      <div class="section-header">
        <span class="section-num">3</span>
        <span class="section-title">Paradox</span>
      </div>
      <div class="paradox-box">
        <div class="paradox-label">역설 · PARADOX</div>
        <div class="paradox-text">${escapeHTML(s.paradox)}</div>
      </div>
    ` : ''}

    <div class="section-header">
      <span class="section-num">4</span>
      <span class="section-title">Strategy</span>
    </div>
    <div class="strategy-list">
      ${strategy.length ? strategy.map((x, i) => `
        <div class="strategy-item">
          <div class="strategy-num">${i + 1}</div>
          <div class="strategy-text">${escapeHTML(x)}</div>
        </div>
      `).join('') : '<p style="color:var(--text-tertiary);">전략 없음</p>'}
    </div>

    <div class="section-header">
      <span class="section-num">5</span>
      <span class="section-title">KPI to Track</span>
    </div>
    <div class="kpi-tags">
      ${kpis.length ? kpis.map(k => `<span class="kpi-tag">${escapeHTML(k)}</span>`).join('') : '<span class="kpi-tag">—</span>'}
    </div>
  `;

  // ③ 단계별 원시 결과 (접힌 상태)
  const detailsSection = `
    <div class="section-header">
      <span class="section-num">⚙</span>
      <span class="section-title">파이프라인 원시 결과 (단계별)</span>
    </div>
    <details class="stage-detail">
      <summary>① Curator — 재료 카드 ${h.cards?.length || 0}개</summary>
      <pre>${escapeHTML(JSON.stringify(h.cards || [], null, 2))}</pre>
    </details>
    <details class="stage-detail">
      <summary>② Miner — 인사이트 ${h.insights?.length || 0}개 + 중심 역설</summary>
      <pre>${escapeHTML(JSON.stringify({ insights: h.insights, paradox: h.paradox }, null, 2))}</pre>
    </details>
    <details class="stage-detail">
      <summary>③ Architect — 도면 (명제 + 메타포 + ${h.blueprint?.sections?.length || 0}섹션)</summary>
      <pre>${escapeHTML(JSON.stringify(h.blueprint || {}, null, 2))}</pre>
    </details>
    <details class="stage-detail">
      <summary>④ Writer — 초안 (수정 전)</summary>
      <div class="prose-box" style="margin-top:10px;">${renderMarkdown(h.draft || '')}</div>
    </details>
    <details class="stage-detail">
      <summary>⑤ Critic — 클리셰 ${h.critique?.cliche_risk || '-'} · 비약 ${h.critique?.logical_gaps?.length || 0}건</summary>
      <pre>${escapeHTML(JSON.stringify(h.critique || {}, null, 2))}</pre>
    </details>
  `;

  area.insertAdjacentHTML(
    'beforeend',
    header + proseSection + summarySection + detailsSection + '</div>'
  );
}

// 초기화
renderReportList();
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
