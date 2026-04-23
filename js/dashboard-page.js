document.getElementById('app').insertAdjacentHTML('afterbegin', renderSidebar('dashboard'));

// ============================================================
// 데이터 상태 — SampleData로 초기화 후 Supabase로 덮어쓰기
// ============================================================
const MIX_COLORS = ['var(--primary)', 'var(--accent)', 'var(--warning)', '#8B5CF6', 'var(--danger)', '#0F766E', 'var(--gray-500)'];
let currentData = buildFromSample();

function buildFromSample() {
  return {
    kpi: SampleData.kpi,
    patients: SampleData.patients.slice(),
    daily: SampleData.dailyRevenue.slice(),
    mix: SampleData.treatmentMix.slice(),
    isLive: false
  };
}

function buildFromLive(agg, delta) {
  const k = agg.kpi;
  const funnel = agg.funnel || {};
  // funnel을 SampleData.patients 형태의 status 배열로 변환 (렌더 호환)
  const virtualPatients = [];
  Object.entries(funnel).forEach(([status, count]) => {
    for (let i = 0; i < count; i++) virtualPatients.push({ status });
  });
  const mixSum = (agg.treatmentMix || []).reduce((s, m) => s + (m.value || 0), 0) || 1;
  const mixWithColor = (agg.treatmentMix || []).map((m, i) => ({
    name: m.name,
    value: Math.round(m.value / mixSum * 100),
    color: MIX_COLORS[i % MIX_COLORS.length]
  }));
  return {
    kpi: {
      conversionRate: k.conversionRate,
      conversionRateDelta: delta.conversionRate || 0,
      avgConsultMin: k.avgConsultMin,
      avgConsultMinDelta: delta.avgConsultMin || 0,
      revisitRate: k.revisitRate,
      revisitRateDelta: delta.revisitRate || 0,
      aiUsageRate: k.aiUsageRate,
      aiUsageRateDelta: delta.aiUsageRate || 0,
      monthlyRevenue: k.monthlyRevenue,
      monthlyRevenueDelta: delta.monthlyRevenue || 0,
      todayConsults: k.todayConsults
    },
    patients: virtualPatients,
    daily: agg.dailyRevenue,
    mix: mixWithColor.length ? mixWithColor : SampleData.treatmentMix,
    isLive: true
  };
}

// ---- KPI ----
function setDelta(id, delta, isLower = false, suffix = '%') {
  const el = document.getElementById(id);
  if (!el) return;
  const good = isLower ? delta < 0 : delta > 0;
  el.className = 'kpi-change ' + (delta === 0 ? '' : (good ? 'up' : 'down'));
  const arrow = delta > 0 ? '&#8593;' : (delta < 0 ? '&#8595;' : '&#8594;');
  el.innerHTML = `${arrow} ${Math.abs(delta)}${suffix} vs 지난주`;
}

function renderKPIs(data) {
  const kpi = data.kpi, patients = data.patients;
  document.getElementById('kpiConv').textContent = kpi.conversionRate + '%';
  setDelta('kpiConvDelta', kpi.conversionRateDelta, false);
  document.getElementById('kpiTime').textContent = kpi.avgConsultMin + '분';
  setDelta('kpiTimeDelta', kpi.avgConsultMinDelta, true, '분');
  document.getElementById('kpiRevisit').textContent = kpi.revisitRate + '%';
  setDelta('kpiRevisitDelta', kpi.revisitRateDelta, false);
  document.getElementById('kpiAI').textContent = kpi.aiUsageRate + '%';
  setDelta('kpiAIDelta', kpi.aiUsageRateDelta, false);
  document.getElementById('kpiRevenue').textContent = formatCurrency(kpi.monthlyRevenue);
  setDelta('kpiRevenueDelta', kpi.monthlyRevenueDelta, false);
  document.getElementById('kpiToday').textContent = kpi.todayConsults != null
    ? kpi.todayConsults
    : patients.filter(p => p.status === '상담대기' || p.status === '상담중').length;
}

// ---- Line Chart (Revenue) ----
function drawLineChart() {
  const daily = currentData.daily;
  if (!daily || !daily.length) return;
  const wrap = document.getElementById('revenueChartWrap');
  const W = 600, H = 260, pad = 40;
  const innerW = W - pad * 2, innerH = H - pad * 2;
  const maxV = Math.max(...daily.map(d => d.revenue), 1);
  const minV = 0;
  const xStep = innerW / Math.max(daily.length - 1, 1);

  const points = daily.map((d, i) => {
    const x = pad + i * xStep;
    const y = pad + innerH - ((d.revenue - minV) / (maxV - minV)) * innerH;
    return { x, y, ...d };
  });

  const path = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
  const area = path + ` L${points[points.length - 1].x},${pad + innerH} L${points[0].x},${pad + innerH} Z`;

  // y-axis ticks (4)
  const yTicks = [];
  for (let i = 0; i <= 4; i++) {
    const val = Math.round(minV + (maxV - minV) * (i / 4));
    const y = pad + innerH - (i / 4) * innerH;
    yTicks.push(`<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="var(--gray-100)" stroke-width="1"/>
                 <text x="${pad - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--gray-400)">${val}</text>`);
  }

  const xLabels = points.map(p => `<text x="${p.x}" y="${H - 12}" text-anchor="middle" font-size="10" fill="var(--gray-400)">${p.date}</text>`).join('');
  const dots = points.map(p => `
    <circle cx="${p.x}" cy="${p.y}" r="5" fill="var(--primary)" stroke="#FFF" stroke-width="2">
      <title>${p.date}: ${p.revenue}만원</title>
    </circle>`).join('');

  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    ${yTicks.join('')}
    <path d="${area}" fill="url(#revGrad)" opacity="0.2"/>
    <path d="${path}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
    ${xLabels}
    <defs>
      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/>
      </linearGradient>
    </defs>
  </svg>`;
}

// ---- Pie/Donut Chart (Treatment Mix) ----
function drawPieChart() {
  const mix = currentData.mix;
  const wrap = document.getElementById('mixChartWrap');
  if (!mix || !mix.length) { wrap.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-tertiary); font-size:0.85rem;">데이터 없음</div>'; return; }
  const W = 240, H = 240;
  const cx = W / 2, cy = H / 2, r = 90, ir = 55;
  const total = mix.reduce((s, m) => s + m.value, 0) || 1;
  let angle = -Math.PI / 2;

  const segments = mix.map(m => {
    const fraction = m.value / total;
    const a2 = angle + fraction * Math.PI * 2;
    const large = fraction > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy + r * Math.sin(a2);
    const x3 = cx + ir * Math.cos(a2);
    const y3 = cy + ir * Math.sin(a2);
    const x4 = cx + ir * Math.cos(angle);
    const y4 = cy + ir * Math.sin(angle);
    const d = `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${ir},${ir} 0 ${large} 0 ${x4},${y4} Z`;
    angle = a2;
    return `<path d="${d}" fill="${m.color}" stroke="#FFF" stroke-width="2">
      <title>${m.name}: ${m.value}%</title>
    </path>`;
  }).join('');

  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    ${segments}
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="13" fill="var(--gray-500)">총합</text>
    <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="22" font-weight="800" fill="var(--gray-900)">${total}%</text>
  </svg>`;

  document.getElementById('mixLegend').innerHTML = mix.map(m => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${m.color};"></span>
      <span style="flex:1;">${m.name}</span>
      <strong>${m.value}%</strong>
    </div>
  `).join('');
}

// ---- Funnel ----
function renderFunnel() {
  const patients = currentData.patients;
  const funnelData = [
    { label: '상담대기', count: patients.filter(p => p.status === '상담대기').length, color: 'var(--gray-400)' },
    { label: '상담중',   count: patients.filter(p => p.status === '상담중').length, color: 'var(--primary)' },
    { label: '계약완료', count: patients.filter(p => p.status === '계약완료').length, color: 'var(--accent)' },
    { label: '치료중',   count: patients.filter(p => p.status === '치료중').length, color: 'var(--warning)' },
    { label: '치료완료', count: patients.filter(p => p.status === '치료완료').length, color: '#0F766E' },
  ];
  const maxCount = Math.max(...funnelData.map(f => f.count), 1);
  const total = funnelData.reduce((s, f) => s + f.count, 0) || 1;
  document.getElementById('funnel').innerHTML = funnelData.map(f => `
    <div class="funnel-step">
      <div class="funnel-label">${f.label}</div>
      <div class="funnel-bar" style="width:${Math.max((f.count / maxCount) * 100, 10)}%; background:${f.color};">${f.count}명</div>
      <div class="funnel-count">${Math.round((f.count / total) * 100)}%</div>
    </div>
  `).join('');
}

// ---- Benchmark ----
function renderBenchmark() {
  const bm = KPIEngine.benchmark(currentData.kpi);
  const bmLabels = { conversionRate: '전환율', avgConsultMin: '평균 상담시간', revisitRate: '재방문율', aiUsageRate: 'AI 활용률' };
  const bmUnits = { conversionRate: '%', avgConsultMin: '분', revisitRate: '%', aiUsageRate: '%' };
  document.getElementById('benchmark').innerHTML = Object.keys(bm).map(k => {
    const item = bm[k];
    const unit = bmUnits[k];
    const color = item.met ? 'var(--success)' : 'var(--danger)';
    const icon = item.met ? '&#10003;' : '&#10005;';
    return `<div class="benchmark-row">
      <div>
        <div class="bm-label">${bmLabels[k]}</div>
        <div class="bm-values">현재 <strong style="color:${color};">${item.current}${unit}</strong> / 목표 ${item.target}${unit}</div>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <span style="font-size:0.8125rem; color:${color}; font-weight:700;">${item.delta > 0 ? '+' : ''}${item.delta}${unit}</span>
        <span class="bm-check" style="background:${color};">${icon}</span>
      </div>
    </div>`;
  }).join('');
}

// ---- Insights ----
function renderInsights() {
  const kpi = currentData.kpi;
  const insights = currentData.isLive ? [
    { icon: '📈', title: '실데이터 연결됨', desc: `Supabase에서 실시간으로 집계 중입니다. 7일 매출·치료믹스·퍼널·6대 KPI 모두 DB 기반.`, color: 'var(--success)' },
    { icon: '🎯', title: '전환율', desc: `현재 ${kpi.conversionRate}% — 목표 70% 대비 ${kpi.conversionRate >= 70 ? '달성' : (70 - kpi.conversionRate) + '%p 여유'}.`, color: 'var(--primary)' },
    { icon: '⚠️', title: 'AI 활용률', desc: `${kpi.aiUsageRate}% — 상담 로그에 코칭 결과가 남은 세션 비중.`, color: 'var(--warning)' },
  ] : [
    { icon: '📈', title: '매출 상승 추세', desc: '최근 7일 매출이 평균 대비 24% 상승했습니다. 임플란트 상담 증가가 주 원인입니다.', color: 'var(--success)' },
    { icon: '🎯', title: '전환율 개선 기회', desc: `AI 활용 상담의 계약 성공률이 비활용 대비 ${Math.max(1, Math.round((kpi.aiUsageRate || 0) / 35))}배 높습니다.`, color: 'var(--primary)' },
    { icon: '⚠️', title: '주의: 고가치료 이탈', desc: '임플란트 상담 중 2회차 미도달 환자 3명. 자동화 리마인더 발송을 추천합니다.', color: 'var(--warning)' },
  ];
  document.getElementById('insights').innerHTML = insights.map(i => `
    <div style="padding:18px; background:var(--gray-50); border-radius:var(--radius-md); border-left:4px solid ${i.color};">
      <div style="font-size:1.4rem; margin-bottom:6px;">${i.icon}</div>
      <h4 style="margin-bottom:6px; color:var(--text-primary);">${i.title}</h4>
      <p style="font-size:0.8125rem;">${i.desc}</p>
    </div>
  `).join('');
}

// ---- 상단 데이터 소스 배지 ----
function renderSourceBadge() {
  const existing = document.getElementById('dataSourceBadge');
  if (existing) existing.remove();
  const badge = document.createElement('div');
  badge.id = 'dataSourceBadge';
  badge.style.cssText = 'display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:var(--radius-full); font-size:0.72rem; font-weight:800; letter-spacing:0.04em; margin-bottom:14px;';
  if (currentData.isLive) {
    badge.style.background = 'var(--success-light-bg)';
    badge.style.color = '#14532D';
    badge.innerHTML = '<span style="width:8px; height:8px; border-radius:50%; background:var(--success); display:inline-block; animation:pulse 1.6s infinite;"></span> 🔴 LIVE · Supabase';
  } else {
    badge.style.background = 'var(--warning-bg)';
    badge.style.color = 'var(--warning-text)';
    badge.textContent = '📊 DEMO · SampleData';
  }
  const content = document.querySelector('.content');
  if (content) content.insertBefore(badge, content.firstChild);
}

// ---- 오케스트레이터 ----
function renderAll() {
  renderKPIs(currentData);
  renderFunnel();
  renderBenchmark();
  renderInsights();
  drawLineChart();
  drawPieChart();
  renderSourceBadge();
}
renderAll();
window.addEventListener('resize', () => { drawLineChart(); drawPieChart(); });

// ---- Supabase 실데이터 로드 (있을 때) ----
(async () => {
  if (typeof SupabaseDB === 'undefined' || !SupabaseDB.isReady()) return;
  try {
    const [agg, prevSnaps] = await Promise.all([
      SupabaseDB.getDashboardAggregates(),
      SupabaseDB.getKPIs({ limit: 7 }).catch(() => [])
    ]);
    // 어제 스냅샷(있으면) vs 오늘 집계 delta 계산
    const yesterday = (prevSnaps || [])[0];
    const delta = {};
    if (yesterday) {
      delta.conversionRate = Math.round((agg.kpi.conversionRate - (yesterday.conversion_rate || 0)) * 10) / 10;
      delta.avgConsultMin = Math.round((agg.kpi.avgConsultMin - (yesterday.avg_consult_min || 0)) * 10) / 10;
      delta.revisitRate = Math.round((agg.kpi.revisitRate - (yesterday.revisit_rate || 0)) * 10) / 10;
      delta.aiUsageRate = Math.round((agg.kpi.aiUsageRate - (yesterday.ai_usage_rate || 0)) * 10) / 10;
      delta.monthlyRevenue = Math.round(((agg.kpi.monthlyRevenue - (yesterday.revenue || 0)) / Math.max(yesterday.revenue || 1, 1)) * 100);
    }
    // 데이터 없으면 SampleData 유지 (Supabase에 환자 0명이면 혼란)
    const hasAnyData = agg.kpi.totalPatients > 0 || agg.kpi.totalConsults > 0 || (agg.dailyRevenue || []).some(d => d.revenue > 0);
    if (!hasAnyData) {
      showToast('Supabase 연결됨 (데이터 없음) — SampleData로 표시합니다', 'info');
      return;
    }
    currentData = buildFromLive(agg, delta);
    renderAll();
    showToast('🔴 LIVE — Supabase 실데이터 반영', 'success');
  } catch (e) {
    console.warn('대시보드 실데이터 로드 실패', e);
  }
})();

// ============================================================
// 직원 관리 (원장 / 관리자만 접근)
// ============================================================
function showStaffSection() {
  const session = typeof Session !== 'undefined' ? Session.get() : null;
  const isDirector = session && (session.role === '원장' || session.is_admin);
  const staffSection = document.getElementById('staffSection');
  if (staffSection) staffSection.style.display = isDirector ? 'block' : 'none';
  if (isDirector) renderStaffTable();
}

async function renderStaffTable() {
  const tbody = document.getElementById('staffTable');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">불러오는 중...</td></tr>';

  try {
    const session = typeof Session !== 'undefined' ? Session.get() : null;
    if (!session || !session.clinic_id) throw new Error('세션 정보 없음');

    const users = await SupabaseDB.getClinicUsers(session.clinic_id);
    const rows = users.map(u => `
      <tr>
        <td>${safe(u.name)}</td>
        <td style="font-family:monospace; font-size:0.8125rem;">${safe(u.email)}</td>
        <td>${safe(u.phone || '-')}</td>
        <td>${safe(u.role)}</td>
        <td style="font-size:0.75rem; color:var(--text-tertiary);">${(u.created_at || '').slice(0, 10)}</td>
        <td>
          ${u.id !== session.userId ? `<button class="btn btn-sm btn-danger" onclick="deleteStaff('${u.id}')" style="padding:4px 8px;">삭제</button>` : '(본인)'}
        </td>
      </tr>
    `).join('');

    tbody.innerHTML = rows || '<tr><td colspan="6" style="text-align:center; padding:20px;">직원 없음</td></tr>';
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--danger); padding:20px;">조회 실패: ${e.message}</td></tr>`;
  }
}

async function registerStaff() {
  const name = (document.getElementById('staffName')?.value || '').trim();
  const email = (document.getElementById('staffEmail')?.value || '').trim();
  const phone = (document.getElementById('staffPhone')?.value || '').trim();
  const role = document.getElementById('staffRole')?.value || '상담실장';

  if (!name || !email || !phone) {
    showToast('모든 필드를 입력하세요', 'warning');
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('이메일 형식이 올바르지 않습니다', 'warning');
    return;
  }

  try {
    const session = typeof Session !== 'undefined' ? Session.get() : null;
    if (!session || !session.clinic_id) throw new Error('세션 정보 없음');

    await SupabaseDB.addClinicUser({
      clinicId: session.clinic_id,
      name,
      email,
      phone,
      role
    });

    showToast('직원이 등록되었습니다', 'success');
    document.getElementById('staffName').value = '';
    document.getElementById('staffEmail').value = '';
    document.getElementById('staffPhone').value = '';
    await renderStaffTable();
  } catch (e) {
    console.error('Register staff error:', e);
    showToast('등록 실패: ' + e.message, 'error');
  }
}

async function deleteStaff(staffId) {
  if (!confirm('이 직원을 삭제하시겠습니까?')) return;

  try {
    await SupabaseDB.deleteClinicUser(staffId);
    showToast('직원이 삭제되었습니다', 'success');
    await renderStaffTable();
  } catch (e) {
    console.error('Delete staff error:', e);
    showToast('삭제 실패: ' + e.message, 'error');
  }
}

// 초기화
showStaffSection();
