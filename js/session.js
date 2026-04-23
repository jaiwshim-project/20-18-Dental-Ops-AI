function updateSessionUI() {
  const s = Session.get();
  const el = document.getElementById('sessionBadge');
  if (!el) return;
  if (s) {
    // textContent로 사용자 입력 안전 삽입 후 DOM 조립 (XSS 방지)
    el.textContent = '';
    const badge = document.createElement('span');
    badge.style.cssText = 'padding:6px 12px; background:var(--primary-bg); color:var(--primary); border-radius:var(--radius-full); font-size:0.8125rem; font-weight:600; display:inline-flex; align-items:center; gap:8px;';
    const nameEl = document.createElement('strong');
    nameEl.textContent = s.name;
    badge.appendChild(nameEl);
    const metaEl = document.createElement('span');
    metaEl.style.cssText = 'font-weight:500; color:var(--text-tertiary);';
    metaEl.textContent = `· ${s.clinic || ''} · ${s.role}`;
    badge.appendChild(metaEl);

    // 🎖 회원 등급 배지 (tier / is_admin)
    const tier = (s.tier || 'free').toLowerCase();
    const tierMap = {
      free: { label: 'Free',  bg: 'var(--gray-100)', fg: 'var(--gray-600)' },
      pro:  { label: 'Pro',   bg: 'var(--warning-bg)', fg: 'var(--warning-text)' },
      max:  { label: 'Max',   bg: 'var(--info-bg)', fg: '#1D4ED8' }
    };
    const tm = tierMap[tier] || tierMap.free;
    const tierEl = document.createElement('span');
    tierEl.style.cssText = `padding:2px 8px; background:${tm.bg}; color:${tm.fg}; border-radius:var(--radius-full); font-size:0.6875rem; font-weight:700; letter-spacing:0.03em;`;
    tierEl.textContent = s.is_admin ? `${tm.label} · ADMIN` : tm.label;
    badge.appendChild(tierEl);

    // 대시보드 버튼 추가 (clinic_id 포함)
    const dashBtn = document.createElement('a');
    const clinicIdParam = s.clinic_id ? `?id=${s.clinic_id}` : '';
    dashBtn.href = `clinic-dashboard.html${clinicIdParam}`;
    dashBtn.className = 'btn btn-sm btn-primary';
    dashBtn.style.cssText = 'margin-left:8px; padding:4px 12px; text-decoration:none;';
    dashBtn.textContent = '📋 대시보드';
    console.log('[updateSessionUI] 대시보드 버튼 링크:', dashBtn.href);
    badge.appendChild(dashBtn);

    const out = document.createElement('a');
    out.href = '#';
    out.style.cssText = 'color:var(--danger); text-decoration:none;';
    out.textContent = '로그아웃';
    out.onclick = (e) => { e.preventDefault(); logoutAndRefresh(); };
    badge.appendChild(out);
    el.appendChild(badge);
  } else {
    el.innerHTML = `<button class="btn btn-sm btn-primary" onclick="openModal('loginModal')">로그인</button>`;
  }
}
document.addEventListener('DOMContentLoaded', updateSessionUI);

// ============================================================
// 세션 자동 동기화 — 페이지 로드마다 DB에서 최신 tier/is_admin/role 갱신
// ============================================================
async function refreshSessionFromDb() {
  const s = Session.get();
  if (!s?.email) return;
  if (typeof SupabaseDB === 'undefined' || !SupabaseDB.isReady()) return;
  try {
    const u = await SupabaseDB.getUserByEmail(s.email);
    if (!u) return;
    Session.login({
      userId: u.id,
      name: u.name || s.name,
      role: u.role || s.role,
      clinic: u.clinic || s.clinic,
      clinic_id: s.clinic_id,  // 🔥 clinic_id 유지 (api/login 응답값 유지 - clinic-dashboard에서 필수)
      email: u.email,
      tier: s.tier,  // 🔥 tier는 api/login에서 설정한 값 유지 (clinic-dashboard에서 업데이트)
      is_admin: u.is_admin === true
    });
    updateSessionUI();
  } catch (e) {
    console.warn('session refresh 실패', e);
  }
}
document.addEventListener('DOMContentLoaded', () => {
  // SupabaseDB.init()이 DOMContentLoaded에서 실행되므로 약간의 딜레이
  setTimeout(refreshSessionFromDb, 300);
});

// ============================================================
// 사이드바 — 8메뉴 + 홈/매뉴얼/구조도
// ============================================================
