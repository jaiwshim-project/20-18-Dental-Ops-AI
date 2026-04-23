  <script>
// [moved to DOMContentLoaded] document.getElementById('app').insertAdjacentHTML('afterbegin', renderSidebar('training'));

// ============================================================
// QLRCQ 스킬 카드 라이브러리 렌더
// ============================================================
function renderQlrcqCards() {
  if (typeof QLRCQFramework === 'undefined') return;
  const cycle = document.getElementById('qlrcqCycle');
  if (cycle) {
    cycle.innerHTML = QLRCQFramework.qlrcq.map(q => `
      <div class="qlrcq-cycle-step">
        <span class="qlrcq-cycle-key">${escapeHTML(q.key)}</span>
        <div class="qlrcq-cycle-label">${escapeHTML(q.label)}</div>
        <div class="qlrcq-cycle-desc">${escapeHTML(q.desc)}</div>
      </div>
    `).join('');
  }
  const grid = document.getElementById('qcardsGrid');
  if (grid) {
    grid.innerHTML = QLRCQFramework.stages.map(s => `
      <div class="qcard">
        <div class="qcard-head">
          <span class="qcard-num">${s.num}</span>
          <span class="qcard-name">${escapeHTML(s.name)}</span>
          <span class="qcard-en">${escapeHTML(s.english)}</span>
        </div>
        <div class="qcard-goal"><strong>목표</strong> · ${escapeHTML(s.goal)}</div>

        <div class="qcard-section">
          <div class="qcard-label success">✅ SUCCESS SIGNALS</div>
          <ul class="qcard-list success">
            ${s.success_signals.map(x => `<li>${escapeHTML(x)}</li>`).join('')}
          </ul>
        </div>

        <div class="qcard-section">
          <div class="qcard-label core">🎯 CORE PRINCIPLES</div>
          <ul class="qcard-list core">
            ${s.core_principles.map(x => `<li>${escapeHTML(x)}</li>`).join('')}
          </ul>
        </div>

        <div class="qcard-section">
          <div class="qcard-label avoid">❌ CRITICAL AVOIDANCE</div>
          <ul class="qcard-list avoid">
            ${s.critical_avoidance.map(x => `<li>${escapeHTML(x)}</li>`).join('')}
          </ul>
        </div>

        <div class="qcard-examples">
          <div class="qcard-examples-label">예시 문장</div>
          ${s.example_quotes.map(x => `<div class="qcard-example">${escapeHTML(x)}</div>`).join('')}
        </div>
      </div>
    `).join('');
  }
}
renderQlrcqCards();

let selectedScenario = null;

function renderScenarios() {
  const list = document.getElementById('scenarioList');
  list.innerHTML = TrainingEngine.scenarios.map(s =>
    `<div class="scenario-card" data-id="${s.id}" onclick="selectScenario('${s.id}')">
      <div class="scenario-id">${s.id}</div>
      <div class="scenario-title">${s.title}</div>
      <div class="scenario-sub">👤 ${s.patient}</div>
      <div class="scenario-sub" style="margin-top:4px;">💬 "${s.objection}"</div>
    </div>`
  ).join('');
}

function selectScenario(id) {
  selectedScenario = TrainingEngine.scenarios.find(s => s.id === id);
  document.querySelectorAll('.scenario-card').forEach(c => {
    c.classList.toggle('active', c.dataset.id === id);
  });
  document.getElementById('patientInfo').textContent = selectedScenario.patient;
  document.getElementById('patientObj').textContent = '"' + selectedScenario.objection + '"';
}

async function submitEval() {
  if (!selectedScenario) { showToast('시나리오를 먼저 선택하세요', 'warning'); return; }
  const userResponse = document.getElementById('userResponse').value.trim();
  if (!userResponse) { showToast('응답을 작성해주세요', 'warning'); return; }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = '⏳ 평가 중...';

  const area = document.getElementById('resultArea');
  area.innerHTML = '<div class="card"><div class="card-body" style="display:flex; justify-content:center; padding:40px;"><div class="spinner"></div></div></div>';

  try {
    const res = await TrainingEngine.evaluate({ scenario: selectedScenario, userResponse });
    const data = res.data;
    const total = Math.max(0, Math.min(100, parseInt(data.total) || 0));

    renderResult(data, res.demo);

    // Supabase 전용 저장
    const session = Session.get();
    if (typeof SupabaseDB === 'undefined' || !SupabaseDB.isReady()) {
      showToast('Supabase 미연결 — 결과가 저장되지 않습니다', 'warning');
    } else {
      try {
        await SupabaseDB.saveTrainingResult({
          userId: session?.userId,
          userName: session?.name || '익명',
          scenario: selectedScenario.title,
          score: total,
          feedback: data.coach_tip || '',
          detail: {
            ...data,
            scenario_id: selectedScenario.id,
            user_response: userResponse,
            clinic: session?.clinic
          }
        });
        showToast('평가 결과 DB 저장 완료', 'success');
      } catch (e) {
        console.warn('DB 저장 실패', e);
        showToast('저장 실패: ' + e.message, 'error');
      }
    }
    renderHistory();
  } catch (e) {
    area.innerHTML = '<div class="card"><div class="card-body"><p style="color:var(--danger);">오류: ' + e.message + '</p></div></div>';
  } finally {
    btn.disabled = false;
    btn.textContent = '📤 제출하고 AI 평가 받기';
  }
}

function renderResult(data, isDemo) {
  const area = document.getElementById('resultArea');
  const total = Math.max(0, Math.min(100, parseInt(data.total) || 0));
  const circumference = 2 * Math.PI * 76;
  const offset = circumference * (1 - total / 100);
  const color = total >= 70 ? 'var(--success)' : total >= 50 ? 'var(--warning)' : 'var(--danger)';

  const bars = [
    { name: '공감', key: 'score_empathy' },
    { name: '정확성', key: 'score_accuracy' },
    { name: '설득', key: 'score_persuasion' },
    { name: '대안', key: 'score_alternative' },
    { name: 'CTA', key: 'score_cta' },
  ];

  area.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>📊 AI 평가 결과 ${isDemo ? '<span class="badge badge-warning" style="margin-left:8px;">데모</span>' : ''}</h3>
      </div>
      <div class="card-body">
        <div class="result-grid">
          <div>
            <div class="score-gauge">
              <svg viewBox="0 0 180 180">
                <circle class="score-bg" cx="90" cy="90" r="76"></circle>
                <circle class="score-fg" cx="90" cy="90" r="76"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${offset}"
                        style="stroke:${color};"></circle>
              </svg>
              <div class="score-center">
                <div class="score-value" style="color:${color};">${total}</div>
                <div class="score-label">/ 100점</div>
              </div>
            </div>
            <p style="text-align:center; margin-top:10px; font-size:0.85rem; color:var(--text-tertiary);">
              ${total >= 80 ? '🏆 우수' : total >= 60 ? '✨ 양호' : total >= 40 ? '📚 보통' : '💪 분발'}
            </p>
          </div>
          <div>
            <div class="section-title">세부 평가 (각 20점 만점)</div>
            <div class="detail-bars">
              ${bars.map(b => {
                const v = Math.max(0, Math.min(20, parseInt(data[b.key]) || 0));
                const pct = (v / 20) * 100;
                return `<div class="detail-row">
                  <div class="detail-name">${b.name}</div>
                  <div class="detail-track"><div class="detail-fill" style="width:${pct}%;"></div></div>
                  <div class="detail-score">${v}/20</div>
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>

        <div class="mt-24">
          <div class="section-title">✅ 잘한 점</div>
          <div class="badge-list">
            ${(data.strengths || []).map(s => `<span class="feedback-badge strength">✓ ${s}</span>`).join('') || '<span class="feedback-badge strength">—</span>'}
          </div>
        </div>
        <div class="mt-24">
          <div class="section-title">⚠️ 개선점</div>
          <div class="badge-list">
            ${(data.improvements || []).map(s => `<span class="feedback-badge improve">! ${s}</span>`).join('') || '<span class="feedback-badge improve">—</span>'}
          </div>
        </div>

        <div class="coach-box">
          <span class="coach-label">💡 COACH TIP</span>
          <div class="coach-text">${data.coach_tip || '—'}</div>
        </div>
      </div>
    </div>
  `;
}

function scorePillClass(s) {
  if (s >= 70) return 'high';
  if (s >= 50) return 'mid';
  return 'low';
}

async function renderHistory() {
  const el = document.getElementById('historyArea');
  if (typeof SupabaseDB === 'undefined' || !SupabaseDB.isReady()) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">🔌</span>Supabase 연결 필요</div>';
    return;
  }
  let list = [];
  try {
    const session = Session.get();
    list = await SupabaseDB.getTrainingResults({ userId: session?.userId, limit: 10 });
  } catch (e) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">⚠️</span>조회 실패</div>';
    return;
  }
  if (!list.length) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">📭</span>아직 교육 이력이 없습니다.</div>';
    return;
  }
  el.innerHTML = `
    <div class="table-wrap">
      <table class="history-table">
        <thead>
          <tr>
            <th>일시</th>
            <th>시나리오</th>
            <th>점수</th>
            <th>응답 요약</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(h => {
            const userResp = (h.detail && h.detail.user_response) || '';
            const sid = (h.detail && h.detail.scenario_id) || '';
            return `
            <tr>
              <td>${formatDate(h.created_at)} ${formatTime(h.created_at)}</td>
              <td><strong>${escapeHTML(sid)}</strong> · ${escapeHTML(h.scenario || '')}</td>
              <td><span class="score-pill ${scorePillClass(h.score)}">${h.score}점</span></td>
              <td style="color:var(--text-tertiary); font-size:0.85rem;">${escapeHTML(userResp.slice(0, 50))}${userResp.length > 50 ? '...' : ''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// 초기화
renderScenarios();
renderHistory();
// 기본 첫 시나리오 선택
if (TrainingEngine.scenarios.length > 0) selectScenario(TrainingEngine.scenarios[0].id);
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
