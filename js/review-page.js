  <script>
document.getElementById('app').insertAdjacentHTML('afterbegin', renderSidebar('review'));

let allSessions = [];       // DB에서 가져온 원본
let filteredSessions = [];  // 필터/정렬 적용본
let sortKey = 'startedAt';
let sortDir = 'desc';

async function loadAllSessions() {
  if (!SupabaseDB || !SupabaseDB.isReady()) {
    if (typeof supabase !== 'undefined') { try { SupabaseDB.init(); } catch {} }
  }
  if (!SupabaseDB || !SupabaseDB.isReady()) {
    document.getElementById('reviewTbody').innerHTML = `
      <tr><td colspan="9" class="empty-state">Supabase 연결 필요</td></tr>`;
    return;
  }
  try {
    allSessions = await SupabaseDB.getRecentSessions(500);
  } catch (e) {
    console.warn(e);
    document.getElementById('reviewTbody').innerHTML = `
      <tr><td colspan="9" class="empty-state" style="color:var(--danger);">조회 실패: ${escapeHTML(e.message)}</td></tr>`;
    return;
  }
  populateFilters();
  applyFilters();
  renderSummary();
  renderStaffChart();
}

function populateFilters() {
  const patients = [...new Set(allSessions.map(s => s.patientName).filter(Boolean))].sort();
  const authors  = [...new Set(allSessions.map(s => s.author).filter(Boolean))].sort();
  const pSel = document.getElementById('filterPatient');
  const aSel = document.getElementById('filterAuthor');
  patients.forEach(n => {
    const o = document.createElement('option'); o.value = n; o.textContent = n; pSel.appendChild(o);
  });
  authors.forEach(n => {
    const o = document.createElement('option'); o.value = n; o.textContent = n; aSel.appendChild(o);
  });
}

// 필터 적용
let _filterTimer = null;
function applyFiltersDebounced() {
  clearTimeout(_filterTimer);
  _filterTimer = setTimeout(applyFilters, 200);
}

function applyFilters() {
  const range = document.getElementById('filterRange').value;
  const pat   = document.getElementById('filterPatient').value;
  const auth  = document.getElementById('filterAuthor').value;
  const scr   = document.getElementById('filterScore').value;
  const q     = (document.getElementById('filterSearch').value || '').trim().toLowerCase();

  const now = Date.now();
  const dayMs = 86400000;
  const cutoff = range === 'today' ? now - dayMs
               : range === 'week'  ? now - 7 * dayMs
               : range === 'month' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
               : range === '30d'   ? now - 30 * dayMs
               : 0;

  filteredSessions = allSessions.filter(s => {
    const t = typeof s.startedAt === 'number' ? s.startedAt : new Date(s.startedAt).getTime();
    if (cutoff && (!t || t < cutoff)) return false;
    if (pat  && s.patientName !== pat) return false;
    if (auth && s.author !== auth)    return false;
    const sc = s.evaluation?.overall_score;
    if (scr === 'high' && !(sc >= 80)) return false;
    if (scr === 'mid'  && !(sc >= 60 && sc < 80)) return false;
    if (scr === 'low'  && !(sc != null && sc < 60)) return false;
    if (scr === 'none' && sc != null) return false;
    if (q) {
      const hay = [
        s.patientName || '',
        s.author || '',
        ...(s.turns || []).map(t => t.text || '')
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  sortSessions();
  renderTable();
  document.getElementById('pagingInfo').textContent = `${filteredSessions.length}건 / 전체 ${allSessions.length}건`;
}

function sortSessions() {
  const k = sortKey, dir = sortDir === 'asc' ? 1 : -1;
  const getVal = (s) => {
    switch (k) {
      case 'startedAt':   return typeof s.startedAt === 'number' ? s.startedAt : new Date(s.startedAt).getTime();
      case 'patientName': return s.patientName || '';
      case 'author':      return s.author || '';
      case 'durationSec': return s.durationSec || 0;
      case 'turnsCount':  return s.turns?.length || 0;
      case 'coachCount':  return s.coachResults?.length || 0;
      case 'score':       return s.evaluation?.overall_score ?? -1;
      case 'readiness':   return (s.evaluation?.readiness_trajectory?.end ?? 0);
      default:            return '';
    }
  };
  filteredSessions.sort((a, b) => {
    const va = getVal(a), vb = getVal(b);
    if (va < vb) return -1 * dir;
    if (va > vb) return  1 * dir;
    return 0;
  });
  // 헤더 표시
  document.querySelectorAll('#reviewTable th[data-sort]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === k) th.classList.add(dir === 1 ? 'sort-asc' : 'sort-desc');
  });
}

// 헤더 클릭 정렬
document.querySelectorAll('#reviewTable th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const k = th.dataset.sort;
    if (sortKey === k) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = k; sortDir = 'desc'; }
    sortSessions();
    renderTable();
  });
});

function renderTable() {
  const tb = document.getElementById('reviewTbody');
  if (!filteredSessions.length) {
    tb.innerHTML = `<tr><td colspan="9" class="empty-state">조건에 맞는 세션이 없습니다</td></tr>`;
    return;
  }
  tb.innerHTML = filteredSessions.map((s, i) => {
    const t = typeof s.startedAt === 'number' ? new Date(s.startedAt) : new Date(s.startedAt);
    const dtStr = isNaN(t) ? '-' : t.toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    const mins = Math.max(1, Math.round((s.durationSec || 0) / 60));
    const sc = s.evaluation?.overall_score;
    const scClass = sc == null ? 'none' : sc >= 80 ? 'high' : sc >= 60 ? 'mid' : 'low';
    const scDisp = sc == null ? '—' : sc;
    const start = s.evaluation?.readiness_trajectory?.start;
    const end = s.evaluation?.readiness_trajectory?.end;
    const delta = (start != null && end != null) ? end - start : null;
    const deltaCls = delta > 0 ? 'up' : delta < 0 ? 'down' : '';
    const deltaSym = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
    const topic = s.evaluation?.summary?.[0] || (s.turns || []).find(x => x.speaker === 'patient')?.text || '';
    return `
      <tr onclick="openDetailByIdx(${i})">
        <td>${escapeHTML(dtStr)}</td>
        <td><strong>${escapeHTML(s.patientName || '-')}</strong></td>
        <td>${escapeHTML(s.author || '-')}</td>
        <td>${mins}</td>
        <td>${s.turns?.length || 0}</td>
        <td>${s.coachResults?.length || 0}</td>
        <td><span class="score-pill ${scClass}">${scDisp}</span></td>
        <td class="readiness-delta">${start ?? '-'}→${end ?? '-'} ${delta != null ? `<span class="${deltaCls}">${deltaSym}${Math.abs(delta)}</span>` : ''}</td>
        <td style="color:var(--text-tertiary); font-size:0.82rem;">${escapeHTML((topic || '').slice(0, 40))}${(topic || '').length > 40 ? '…' : ''}</td>
      </tr>`;
  }).join('');
}

function renderSummary() {
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const weekSessions = allSessions.filter(s => {
    const t = typeof s.startedAt === 'number' ? s.startedAt : new Date(s.startedAt).getTime();
    return t >= weekAgo;
  });
  const withScore = allSessions.filter(s => s.evaluation?.overall_score != null);
  const avgScore = withScore.length
    ? Math.round(withScore.reduce((sum, s) => sum + s.evaluation.overall_score, 0) / withScore.length)
    : 0;
  const staffCounts = {};
  allSessions.forEach(s => { if (s.author) staffCounts[s.author] = (staffCounts[s.author] || 0) + 1; });
  const topStaff = Object.entries(staffCounts).sort((a,b) => b[1]-a[1])[0];
  const totalMin = allSessions.reduce((s, x) => s + (x.durationSec || 0), 0) / 60;
  const avgMin = allSessions.length ? Math.round(totalMin / allSessions.length) : 0;

  document.getElementById('sumThisWeek').textContent = weekSessions.length;
  document.getElementById('sumThisWeekSub').textContent = `지난 7일간`;
  document.getElementById('sumTotal').textContent = allSessions.length;
  document.getElementById('sumAvgScore').textContent = avgScore || '—';
  document.getElementById('sumStaff').textContent = Object.keys(staffCounts).length;
  document.getElementById('sumTopStaff').textContent = topStaff ? `Top: ${topStaff[0]} (${topStaff[1]}세션)` : 'Top: -';
  document.getElementById('sumAvgMin').textContent = avgMin || '-';
}

function renderStaffChart() {
  const by = {};
  allSessions.forEach(s => {
    if (!s.author) return;
    if (!by[s.author]) by[s.author] = { count: 0, scoreSum: 0, scored: 0 };
    by[s.author].count++;
    if (s.evaluation?.overall_score != null) {
      by[s.author].scoreSum += s.evaluation.overall_score;
      by[s.author].scored++;
    }
  });
  const rows = Object.entries(by).map(([name, v]) => ({
    name, count: v.count,
    avg: v.scored ? Math.round(v.scoreSum / v.scored) : null
  })).sort((a,b) => (b.avg || 0) - (a.avg || 0));

  const el = document.getElementById('staffBars');
  if (!rows.length) {
    el.innerHTML = '<div style="color:var(--text-tertiary); font-size:0.85rem; padding:12px; text-align:center;">상담사 데이터 없음</div>';
    return;
  }
  el.innerHTML = rows.map(r => {
    const pct = r.avg != null ? r.avg : 0;
    return `
      <div class="staff-row">
        <div class="staff-name">${escapeHTML(r.name)}</div>
        <div class="staff-bar-track"><div class="staff-bar-fill" style="width:${pct}%;"></div></div>
        <div class="staff-score">${r.avg != null ? r.avg + '점' : '미평가'}</div>
        <div class="staff-count">${r.count}건</div>
      </div>`;
  }).join('');
}

// ===== 상세 패널 =====
function openDetailByIdx(i) {
  const s = filteredSessions[i];
  if (!s) return;
  renderDetail(s);
  document.getElementById('detailPanel').classList.add('open');
  document.getElementById('detailOverlay').classList.add('open');
}
function closeDetail() {
  document.getElementById('detailPanel').classList.remove('open');
  document.getElementById('detailOverlay').classList.remove('open');
}

function renderDetail(s) {
  const t = typeof s.startedAt === 'number' ? new Date(s.startedAt) : new Date(s.startedAt);
  const mins = Math.max(1, Math.round((s.durationSec || 0) / 60));
  document.getElementById('detailTitle').textContent = `${s.patientName || '-'} · ${isNaN(t) ? '-' : t.toLocaleString('ko-KR')}`;
  document.getElementById('detailMeta').textContent = `${mins}분 · 대화 ${s.turns?.length || 0} · 코칭 ${s.coachResults?.length || 0} · 상담사 ${s.author || '-'}${s.clinic ? ' · ' + s.clinic : ''}`;

  const body = document.getElementById('detailBody');
  const turns = s.turns || [];
  const coaches = s.coachResults || [];
  const ev = s.evaluation || {};

  let html = '';

  // 대화
  if (turns.length) {
    html += `<div class="detail-section"><h4>🗣 대화 녹취 (${turns.length})</h4>
      <div class="dlog-turns">
        ${turns.map(t => {
          const cls = t.speaker === 'staff' ? 'staff' : t.speaker === 'patient' ? 'patient' : 'patient';
          const label = t.speaker === 'staff' ? '실장' : t.speaker === 'patient' ? '환자' : '발화';
          return `<div class="dlog-bubble ${cls}"><div class="meta">${label}</div>${escapeHTML(t.text || '')}</div>`;
        }).join('')}
      </div>
    </div>`;
  }

  // 코칭
  if (coaches.length) {
    html += `<div class="detail-section"><h4>🧑‍⚕️ 코칭 답변 (${coaches.length}턴)</h4>`;
    coaches.forEach((c, i) => {
      const d = c.data || c || {};
      const reply = Array.isArray(d.recommended_reply) ? d.recommended_reply.join('\n') : (d.recommended_reply || '');
      html += `
        <div class="dlog-coach">
          <div class="dlog-coach-head">📤 #${i+1} · ${escapeHTML(d.intent_primary || '')} · 준비도 ${d.readiness ?? '-'}%</div>
          ${d.subtext ? `<div style="font-size:0.78rem; color:#78350F; margin-bottom:6px;">🔎 ${escapeHTML(Array.isArray(d.subtext) ? d.subtext.join(' / ') : d.subtext)}</div>` : ''}
          <div class="dlog-coach-reply">${escapeHTML(reply)}</div>
        </div>`;
    });
    html += `</div>`;
  }

  // 평가
  if (ev && Object.keys(ev).length) {
    const scores = ev.scores || {};
    const LABEL = {
      empathy_completion:'공감 완결도', understanding_depth:'이해 깊이',
      choice_respect:'선택권 존중', value_clarity:'가치 전달', trust_depth:'신뢰 구축',
      empathy:'공감', autonomy:'자율성', information_balance:'정보균형', no_pressure:'비강요', silence_allowance:'침묵 허용'
    };
    html += `<div class="detail-section"><h4>📋 세션 평가 · ${ev.overall_score ?? '-'}점</h4>`;
    html += `<div class="eval-scores">`;
    Object.keys(LABEL).forEach(k => {
      if (scores[k] != null) {
        html += `<div class="eval-score-cell">${LABEL[k]}: <strong>${scores[k]}/20</strong></div>`;
      }
    });
    html += `</div>`;
    if (ev.readiness_trajectory) {
      html += `<div style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:8px;">준비도 ${ev.readiness_trajectory.start ?? '-'} → ${ev.readiness_trajectory.end ?? '-'} · ${escapeHTML(ev.readiness_trajectory.note || '')}</div>`;
    }
    if (Array.isArray(ev.summary) && ev.summary.length) {
      html += `<div style="background:var(--gray-50); padding:10px 12px; border-radius:6px; font-size:0.82rem; line-height:1.55; margin-bottom:8px;">${ev.summary.map(x => `• ${escapeHTML(x)}`).join('<br>')}</div>`;
    }
    if (Array.isArray(ev.staff_strengths) && ev.staff_strengths.length) {
      html += `<div style="font-size:0.8rem; margin-bottom:6px;"><strong style="color:var(--success-text);">✅ 잘한 점</strong><ul style="margin:4px 0 0; padding-left:18px;">${ev.staff_strengths.map(x => `<li>${escapeHTML(x)}</li>`).join('')}</ul></div>`;
    }
    if (Array.isArray(ev.staff_improvements) && ev.staff_improvements.length) {
      html += `<div style="font-size:0.8rem; margin-bottom:6px;"><strong style="color:var(--warning-text);">🔧 개선 기회</strong><ul style="margin:4px 0 0; padding-left:18px;">${ev.staff_improvements.map(x => `<li>${escapeHTML(x)}</li>`).join('')}</ul></div>`;
    }
    if (Array.isArray(ev.suggested_followup) && ev.suggested_followup.length) {
      html += `<div style="font-size:0.8rem;"><strong style="color:var(--primary);">🤝 후속 조치</strong><ul style="margin:4px 0 0; padding-left:18px;">${ev.suggested_followup.map(x => `<li>${escapeHTML(x)}</li>`).join('')}</ul></div>`;
    }
    html += `</div>`;
  }

  body.innerHTML = html || '<div class="empty-state">표시할 데이터가 없습니다.</div>';
}

// ===== CSV =====
function downloadCSV() {
  if (!filteredSessions.length) { showToast('다운로드할 세션이 없습니다', 'warning'); return; }
  const rows = [[
    '시작일시','환자','상담사','병원','분','대화수','코칭수','점수','준비도_시작','준비도_끝','요약'
  ]];
  filteredSessions.forEach(s => {
    const t = typeof s.startedAt === 'number' ? new Date(s.startedAt) : new Date(s.startedAt);
    const mins = Math.round((s.durationSec || 0) / 60);
    rows.push([
      isNaN(t) ? '' : t.toISOString(),
      s.patientName || '',
      s.author || '',
      s.clinic || '',
      mins,
      s.turns?.length || 0,
      s.coachResults?.length || 0,
      s.evaluation?.overall_score ?? '',
      s.evaluation?.readiness_trajectory?.start ?? '',
      s.evaluation?.readiness_trajectory?.end ?? '',
      (s.evaluation?.summary || []).join(' | ').replace(/"/g, '""')
    ]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  // UTF-8 BOM (엑셀 한글 깨짐 방지)
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `consult_review_${new Date().toISOString().substring(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`CSV 다운로드 (${filteredSessions.length}건)`, 'success');
}

// ESC로 상세 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDetail();
});

// 초기 로딩
setTimeout(loadAllSessions, 200);
  </script>
