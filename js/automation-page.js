  <script>
document.getElementById('app').insertAdjacentHTML('afterbegin', renderSidebar('automation'));

const TPL_META = {
  new_patient_greeting: { icon: '👋', title: '신규 환자 인사', desc: '첫 방문 감사 메시지' },
  consult_followup: { icon: '📞', title: '상담 후속', desc: '상담 다음날 정리 메시지' },
  pre_treatment_reminder: { icon: '⏰', title: '시술 전 리마인더', desc: '예약 1일 전 준비사항' },
  post_treatment_care: { icon: '💊', title: '시술 후 관리', desc: '시술 당일/익일 케어 안내' },
  revisit_nudge: { icon: '🔔', title: '재방문 유도', desc: '정기 검진 리마인더' }
};

const SETTINGS = [
  { key: 'auto_new_greet', label: '신규 환자 자동 인사', desc: '예약 등록 즉시 인사 메시지 발송' },
  { key: 'auto_followup_24h', label: '상담 후 24h 후속', desc: '상담 하루 뒤 자동 후속 메시지' },
  { key: 'auto_pre_reminder', label: '시술 1일 전 리마인더', desc: '예약일 24시간 전 알림' },
  { key: 'auto_post_care', label: '시술 후 관리 안내', desc: '시술 당일 저녁 케어 메시지' },
  { key: 'auto_revisit_12w', label: '12주 후 재방문 유도', desc: '마지막 방문 후 3개월 시점 알림' }
];

// ---------- 환자 옵션 (Supabase 전용) ----------
let patientCache = [];
async function populatePatients() {
  if (typeof SupabaseDB !== 'undefined' && SupabaseDB.isReady()) {
    try { patientCache = await SupabaseDB.getPatients({ limit: 200 }); }
    catch (e) { console.warn(e); patientCache = []; }
  }
  const sels = document.querySelectorAll('#customPatient, .patient-inline-sel');
  sels.forEach(sel => {
    // 기본 옵션 외 기존 동적 옵션 제거
    while (sel.options.length > 1) sel.remove(1);
    patientCache.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      const ageTxt = p.age ? `${p.age}세` : '-';
      opt.textContent = `${p.name} (${ageTxt})`;
      sel.appendChild(opt);
    });
  });
}

// ---------- 템플릿 그리드 ----------
function renderTemplates() {
  const el = document.getElementById('tplGrid');
  el.innerHTML = Object.keys(AutomationEngine.templates).map(key => {
    const meta = TPL_META[key] || { icon: '✉️', title: key, desc: '' };
    const tpl = AutomationEngine.templates[key];
    return `
      <div class="tpl-card">
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="tpl-icon">${meta.icon}</div>
          <div>
            <div class="tpl-title">${meta.title}</div>
            <div style="font-size:0.75rem; color:var(--text-tertiary);">${meta.desc}</div>
          </div>
        </div>
        <div class="tpl-preview">${tpl}</div>
        <div class="tpl-actions">
          <select class="form-input patient-inline-sel" data-key="${key}" style="flex:1; padding:6px 10px; font-size:0.8125rem;">
            <option value="">환자 선택...</option>
          </select>
          <button class="btn btn-primary btn-sm" onclick="runTemplate('${key}', this)">▶ 실행</button>
        </div>
      </div>`;
  }).join('');
  // 템플릿 렌더 이후 환자 옵션 주입
  populatePatients();
}

function getPatientById(id) {
  return patientCache.find(p => p.id === id);
}

async function runTemplate(key, btn) {
  const card = btn.closest('.tpl-card');
  const sel = card.querySelector('.patient-inline-sel');
  const pid = sel.value;
  if (!pid) { showToast('환자를 선택하세요', 'warning'); return; }
  const patient = getPatientById(pid);
  if (!patient) { showToast('환자 정보를 찾을 수 없습니다', 'error'); return; }

  const vars = {
    name: patient.name,
    clinic: '미소치과',
    date: '2026-04-22',
    time: '14:00',
    treatment: patient.treatment || '치료',
    weeks: 12
  };
  const payload = AutomationEngine.render(key, vars);

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-inline"></span>';
  try {
    const rec = await AutomationEngine.execute({ type: key, patientId: pid, payload });
    showToast(`✅ ${patient.name}님께 "${TPL_META[key].title}" 발송`, 'success');
    refreshLogs();
  } catch (e) {
    showToast('실행 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '▶ 실행';
  }
}

// ---------- 커스텀 생성 ----------
async function runCustom() {
  const scenario = document.getElementById('scenarioInput').value.trim();
  const pid = document.getElementById('customPatient').value;
  const patient = pid ? getPatientById(pid) : null;

  if (!scenario) { showToast('시나리오를 입력하세요', 'warning'); return; }

  const btn = document.getElementById('customBtn');
  const resultEl = document.getElementById('customResult');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-inline"></span> 생성 중...';
  resultEl.classList.remove('empty');
  resultEl.textContent = 'AI가 메시지를 작성하고 있습니다...';

  try {
    const res = await AutomationEngine.generateCustom({ scenario, patient });
    resultEl.textContent = res.text;

    // 생성만 하고 끝낼지? 로그에도 남기자 (status=draft 대신 sent 처리: 데모 목적)
    await AutomationEngine.execute({
      type: 'custom',
      patientId: patient?.id || null,
      payload: res.text
    });
    showToast(res.demo ? '데모 응답 생성됨 (API 키 미설정)' : '커스텀 메시지 생성 완료', 'success');
    refreshLogs();
  } catch (e) {
    resultEl.textContent = '⚠️ 오류: ' + e.message;
    showToast('생성 실패', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '✨ AI로 메시지 생성';
  }
}

// ---------- 설정 토글 ----------
function renderSettings() {
  const el = document.getElementById('settingsList');
  const saved = Store.get('automation_settings', {});
  el.innerHTML = SETTINGS.map(s => {
    const checked = saved[s.key] !== false; // 기본 ON
    return `
      <div class="setting-row">
        <div>
          <div class="setting-label">${s.label}</div>
          <div class="setting-desc">${s.desc}</div>
        </div>
        <label class="switch">
          <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleSetting('${s.key}', this.checked)">
          <span class="slider"></span>
        </label>
      </div>`;
  }).join('');
}
function toggleSetting(key, val) {
  const cur = Store.get('automation_settings', {});
  cur[key] = val;
  Store.set('automation_settings', cur);
  showToast((val ? 'ON: ' : 'OFF: ') + key, 'info', 1500);
}

// ---------- 로그 테이블 (Supabase 전용) ----------
async function refreshLogs() {
  const tbody = document.getElementById('logTbody');
  if (typeof SupabaseDB === 'undefined' || !SupabaseDB.isReady()) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-tertiary); padding:32px;">Supabase 연결 필요</td></tr>';
    return;
  }
  let logs = [];
  try {
    const { data, error } = await SupabaseDB.client.from('automations')
      .select('*').order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    logs = data || [];
  } catch (e) {
    console.warn(e);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--danger); padding:32px;">조회 실패: ' + escapeHTML(e.message) + '</td></tr>';
    return;
  }
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-tertiary); padding:32px;">실행 로그가 없습니다</td></tr>';
    return;
  }
  tbody.innerHTML = logs.map(log => {
    const p = getPatientById(log.patient_id);
    const pName = p ? escapeHTML(p.name) : escapeHTML(log.patient_id || '-');
    const typeTitle = escapeHTML((TPL_META[log.type] && TPL_META[log.type].title) || log.type);
    const payloadText = log.payload ? (typeof log.payload === 'string' ? log.payload : JSON.stringify(log.payload)) : '';
    const preview = escapeHTML(payloadText.slice(0, 50) + (payloadText.length > 50 ? '...' : ''));
    const time = new Date(log.created_at).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    const statusCls = log.status === 'failed' ? 'status-failed' : 'status-sent';
    const statusIcon = log.status === 'failed' ? '❌' : '✅';
    return `
      <tr>
        <td style="white-space:nowrap;">${escapeHTML(time)}</td>
        <td>${pName}</td>
        <td><span class="badge badge-primary">${typeTitle}</span></td>
        <td style="max-width:380px; color:var(--text-secondary);">${preview || '-'}</td>
        <td><span class="status-pill ${statusCls}">${statusIcon} ${escapeHTML(log.status || 'sent')}</span></td>
      </tr>`;
  }).join('');
}

// ---------- 초기화 ----------
renderTemplates();
renderSettings();
refreshLogs();
  </script>
