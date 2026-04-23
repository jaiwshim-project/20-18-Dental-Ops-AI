    console.log('[Admin Auth] app 요소:', app);

    lock.style.display = 'none';
    content.style.display = 'block';

    console.log('[Admin Auth] ✅ Display 변경 완료');
    console.log('[Admin Auth] authLock display:', lock.style.display);
    console.log('[Admin Auth] authedContent display:', content.style.display);

    // renderSidebar 호출 전 확인
    console.log('[Admin Auth] renderSidebar 함수:', typeof renderSidebar);
    const sidebarHtml = renderSidebar('');
    console.log('[Admin Auth] renderSidebar 결과:', sidebarHtml?.substring(0, 100));

    app.insertAdjacentHTML('afterbegin', sidebarHtml);
    console.log('[Admin Auth] ✅ Sidebar 렌더링 완료');

    // updateSessionUI 호출
    if (typeof updateSessionUI === 'function') {
      updateSessionUI();
      console.log('[Admin Auth] ✅ updateSessionUI 완료');
    } else {
      console.log('[Admin Auth] ⚠️  updateSessionUI 함수 없음');
    }

    // loadDashData 호출
    console.log('[Admin Auth] loadDashData 시작...');
    loadDashData().then(() => {
      console.log('[Admin Auth] ✅ loadDashData 완료');
    }).catch(e => {
      console.error('[Admin Auth] ❌ loadDashData 에러:', e);
    });

  } catch (e) {
    console.error('[Admin Auth] ❌ unlockDash 에러:', e.message, e.stack);
  }
}

function lockDash() {
  sessionStorage.removeItem(AUTH_KEY);
  location.reload();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const lock = document.getElementById('authLock');
    if (lock && lock.style.display !== 'none') {
      e.preventDefault();
      checkAdminPass();
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Admin Auth] DOMContentLoaded 이벤트');
  console.log('[Admin Auth] AUTH_KEY:', AUTH_KEY);
  console.log('[Admin Auth] sessionStorage 값:', sessionStorage.getItem(AUTH_KEY));

  if (sessionStorage.getItem(AUTH_KEY) === '1') {
    console.log('[Admin Auth] 이미 인증됨, unlockDash 실행');
    unlockDash();
  } else {
    console.log('[Admin Auth] 미인증 상태, 비밀번호 입력 필드 포커스');
    setTimeout(() => document.getElementById('authPass')?.focus(), 100);
  }
});

async function loadDashData() {
  await renderKpi();
  await renderMembersTable();
  await renderRecentLogs();
}

async function renderKpi() {
  const el = document.getElementById('dashKpi');
  try {
    const [users, usage] = await Promise.all([
      SupabaseDB.listUsers(),
      SupabaseDB.getAllMonthlyUsage()
    ]);
    const totalUsers = users.length;
    const totalCalls = Object.values(usage).reduce((a, b) => a + b, 0);
    const tierLimits = { free: 3, pro: 20, max: 60 };
    const counts = { free: 0, pro: 0, max: 0 };
    let overCount = 0;
    users.forEach(u => {
      const tier = u.tier || 'free';
      counts[tier] = (counts[tier] || 0) + 1;
      if (!u.is_admin) {
        const used = usage[u.id] || 0;
        if (used >= tierLimits[tier]) overCount++;
      }
    });

    el.innerHTML = `
      <div class="dash-kpi-card">
        <div class="label">총 회원</div>
        <div class="value">${totalUsers}</div>
        <div class="hint">🆓 ${counts.free} · ⭐ ${counts.pro} · 🚀 ${counts.max}</div>
      </div>
      <div class="dash-kpi-card">
        <div class="label">이번달 API 호출</div>
        <div class="value">${totalCalls.toLocaleString()}</div>
        <div class="hint">성공+실패 전체 집계</div>
      </div>
      <div class="dash-kpi-card">
        <div class="label">한도 초과 회원</div>
        <div class="value" style="color:${overCount ? 'var(--danger)' : 'var(--success)'};">${overCount}</div>
        <div class="hint">${overCount ? '업그레이드 권유 대상' : '정상 사용 중'}</div>
      </div>
      <div class="dash-kpi-card">
        <div class="label">Gemini 모델</div>
        <div class="value" style="font-size:1.125rem;">2.5 Flash Lite</div>
        <div class="hint">Tier 1 · dental-ops-ai</div>
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<div style="color:var(--danger); padding:20px; grid-column:1/-1;">KPI 조회 실패: ${e.message}</div>`;
  }
}

function safe(x) { return String(x || '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'})[c]); }

async function renderClinicsTable() {
  const tbody = document.getElementById('membersTable');
  const summary = document.getElementById('membersSummary');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">불러오는 중...</td></tr>';

  try {
    // /api/clinics에서 관리자용 병원 목록 조회
    const res = await fetch('/api/clinics');
    if (!res.ok) throw new Error(`API 오류: ${res.status}`);
    const data = await res.json();
    const clinics = data.clinics || [];

    console.log('[renderClinicsTable] ✅ 병원 목록 로드:', clinics.length, '개');

    let free = 0, pro = 0, max = 0;

    const rows = await Promise.all(clinics.map(async c => {
      const tier = c.tier || 'free';
      const userCount = await SupabaseDB.getClinicUsers(c.id).catch(() => []).then(users => users.length);

      if (tier === 'free') free++;
      else if (tier === 'pro') pro++;
      else if (tier === 'max') max++;

      return `
        <tr>
          <td style="font-weight:600; color:var(--primary); cursor:pointer;" onclick="window.location.href='clinic-dashboard.html?id=${c.id}';">${safe(c.name)}</td>
          <td onclick="event.stopPropagation();">${safe(c.director_name)}</td>
          <td onclick="event.stopPropagation();">${safe(c.region)}</td>
          <td style="text-align:center;" onclick="event.stopPropagation();">${userCount}명</td>
          <td onclick="event.stopPropagation();">
            <select onchange="changeClinicTier('${c.id}', this.value)" onclick="event.stopPropagation();" style="padding:4px 8px; font-size:0.8125rem; border:1px solid var(--gray-300); border-radius:var(--radius-sm);">
              <option value="free" ${tier === 'free' ? 'selected' : ''}>🆓 Free (3회)</option>
              <option value="pro" ${tier === 'pro' ? 'selected' : ''}>⭐ Pro (20회)</option>
              <option value="max" ${tier === 'max' ? 'selected' : ''}>🚀 Max (60회)</option>
            </select>
          </td>
          <td style="font-size:0.75rem; color:var(--text-tertiary);" onclick="event.stopPropagation();">${(c.created_at || '').slice(0, 10)}</td>
          <td style="text-align:center;" onclick="event.stopPropagation();">
            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteClinic('${c.id}', '${safe(c.name)}');" style="padding:4px 10px; font-size:0.75rem;">🗑️ 삭제</button>
          </td>
        </tr>
      `;
    }));

    tbody.innerHTML = rows.join('') || '<tr><td colspan="6" style="text-align:center; padding:20px;">병원 없음</td></tr>';

    if (summary) {
      summary.innerHTML = `
        <div style="display:flex; gap:20px; padding:12px 16px; background:var(--primary-bg); border-radius:var(--radius-md); margin-bottom:16px; font-size:0.875rem; flex-wrap:wrap;">
          <span><strong>전체 병원:</strong> ${clinics.length}개</span>
          <span>🆓 Free <strong>${free}</strong></span>
          <span>⭐ Pro <strong>${pro}</strong></span>
          <span>🚀 Max <strong>${max}</strong></span>
        </div>
      `;
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--danger); padding:20px;">조회 실패: ${e.message}</td></tr>`;
  }
}

async function renderMembersTable() {
  return renderClinicsTable(); // 호환성 유지
}

async function changeClinicTier(clinicId, tier) {
  try {
    console.log('[changeClinicTier] 요금제 변경 요청:', { clinicId, tier });
    const res = await fetch('/api/change-tier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinic_id: clinicId, tier })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '요금제 변경 실패');
    }

    const data = await res.json();
    console.log('[changeClinicTier] ✅ 요금제 변경 완료:', data);
    showToast('요금제 변경 완료', 'success');

    // 50ms 딜레이 후 재로드 (DB 반영 대기)
    await new Promise(r => setTimeout(r, 50));
    await renderMembersTable();
    await renderKpi();
  } catch (e) {
    console.error('[changeClinicTier] Error:', e);
    showToast('변경 실패: ' + e.message, 'error');
  }
}

async function deleteClinic(clinicId, clinicName) {
  // 1단계: 확인 절차
  const confirmed = confirm(`⚠️ 주의!\n\n병원 "${clinicName}"을(를) 정말 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.\n- 병원 정보\n- 모든 직원 및 사용자\n- 모든 상담 기록\n\n이 모든 데이터가 영구 삭제됩니다.`);

  if (!confirmed) {
    console.log('[deleteClinic] 삭제 취소됨');
    return;
  }

  try {
    console.log('[deleteClinic] 병원 삭제 중...', { clinicId, clinicName });

    // /api/delete-clinic API 호출 (SERVICE_ROLE_KEY 사용)
    console.log('[deleteClinic] API 요청:', { method: 'POST', url: '/api/delete-clinic', body: { clinicId } });

    const res = await fetch('/api/delete-clinic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId })
    });

    console.log('[deleteClinic] API 응답 수신:', { status: res.status, statusText: res.statusText });

    const responseText = await res.text();
    console.log('[deleteClinic] API 응답 본문:', responseText);

    if (!res.ok) {
      try {
        const err = JSON.parse(responseText);
        throw new Error(err.error || '삭제 실패');
      } catch {
        throw new Error(`API 오류 (${res.status}): ${responseText}`);
      }
