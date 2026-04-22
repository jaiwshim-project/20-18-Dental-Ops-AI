


// === Enter 키 로그인 (간단함) ===
document.addEventListener('DOMContentLoaded', () => {
  // 비밀번호 입력 필드들에 Enter 키 리스너 추가
  ['loginPwd1', 'loginPwd2', 'loginPwd3', 'loginPwd4', 'loginPwd5', 'loginPwd6'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          console.log('⌨️ Enter 키 감지 → 로그인 시도');
          submitClinicLogin();
        }
      });
    }
  });
});

/* ============================================================
   Dental Ops AI — Common JavaScript
   치과 상담·진단·운영 AI 플랫폼
   ============================================================ */

// --- Sidebar Toggle (Mobile) ---
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

document.addEventListener('click', (e) => {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  if (sidebar.classList.contains('open') &&
      !sidebar.contains(e.target) &&
      !e.target.closest('.hamburger')) {
    sidebar.classList.remove('open');
  }
});

// --- Active Nav Highlight ---
function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('href');
    if (href === path) item.classList.add('active');
    else item.classList.remove('active');
  });
}
document.addEventListener('DOMContentLoaded', setActiveNav);

// --- A11y: 공통 레이블 보강 ---
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.hamburger').forEach(b => {
    if (!b.hasAttribute('aria-label')) b.setAttribute('aria-label', '메뉴 열기');
  });
  document.querySelectorAll('.sidebar').forEach(s => s.setAttribute('role', 'navigation'));
  document.querySelectorAll('.sidebar-nav').forEach(n => n.setAttribute('aria-label', '주 메뉴'));
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
  });
});

// --- Toast ---
function showToast(message, type = 'info', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (type === 'success') toast.style.background = 'var(--success)';
  else if (type === 'error') toast.style.background = 'var(--danger)';
  else if (type === 'warning') toast.style.background = 'var(--warning)';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// --- Modal Helpers ---
function openModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.add('active');
}
function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('active');
}
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('active');
});

// ESC 키로 활성 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }
});

// --- Formatters ---
function formatNumber(n) {
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '억';
  if (n >= 10000) return (n / 10000).toFixed(1) + '만';
  return n.toLocaleString('ko-KR');
}
function formatCurrency(n) { return n.toLocaleString('ko-KR') + '원'; }
function formatDate(d) {
  const date = new Date(d);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}
function formatTime(d) {
  const date = new Date(d);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// --- HTML Escape (XSS 방지) ---
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- Local Storage ---
// 메모리 백업 (localStorage 실패 시)
const MemoryStore = {};

const Store = {
  get(key, fallback = null) {
    try {
      const val = localStorage.getItem('dops_' + key);
      return val ? JSON.parse(val) : fallback;
    } catch (e) {
      // localStorage 실패 → 메모리에서 읽기
      return MemoryStore[key] ?? fallback;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem('dops_' + key, JSON.stringify(val));
    } catch (e) {
      // localStorage 실패 → 메모리에만 저장
      MemoryStore[key] = val;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem('dops_' + key);
    } catch (e) {
      // localStorage 실패는 무시
    }
    delete MemoryStore[key];
  }
};

// ============================================================
// 세션 화이트리스트 게이팅
// ============================================================
const Session = {
  KEY: 'session',
  TTL_MS: 1000 * 60 * 60 * 24 * 7, // 7일
  login({ userId, name, role = 'staff', clinic = '', clinic_id = '', email = '', tier = 'free', is_admin = false }) {
    Store.set(this.KEY, { userId, name, role, clinic, clinic_id, email, tier, is_admin, loggedAt: Date.now() });
  },
  logout() { Store.remove(this.KEY); },
  get() {
    const s = Store.get(this.KEY, null);
    if (!s) return null;
    // loggedAt이 없거나 TTL 초과인 경우만 logout
    if (s.loggedAt && Date.now() - s.loggedAt > this.TTL_MS) {
      console.warn('[Session.get] TTL 초과 → 세션 제거');
      this.logout();
      return null;
    }
    return s;
  },
  isLoggedIn() { return !!this.get(); }
};

// 화이트리스트 (로그인 없이 공개)
const PUBLIC_PAGES = ['index.html', 'manual.html', 'architecture.html', ''];

function gateSessionOrRedirect() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  const isPublic = PUBLIC_PAGES.includes(path);
  if (!isPublic && !Session.isLoggedIn()) {
    window.location.href = 'index.html?redirect=' + encodeURIComponent(path);
  }
}
document.addEventListener('DOMContentLoaded', gateSessionOrRedirect);

// redirect 파라미터로 복귀한 경우, 사이드바 주입 후 로그인 모달 자동 오픈
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('redirect') && !Session.isLoggedIn()) {
    setTimeout(() => {
      openModal('loginModal');
      const badge = document.getElementById('sessionBadge');
      if (badge) {
        badge.insertAdjacentHTML('beforebegin',
          '<span style="padding:4px 10px; background:var(--warning-bg); color:var(--warning-text); border-radius:var(--radius-full); font-size:0.75rem; font-weight:600; margin-right:8px;">🔐 로그인이 필요합니다</span>');
      }
    }, 400);
  }
});

// ============================================================
// 주: 이전 매직링크 로그인(demoLogin) 제거됨 → submitClinicLogin 사용
// ============================================================

// 페이지 로드 시 Supabase Auth 세션 복구 + pending upsert
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 탭 전환
function switchAuthTab(tab) {
  const loginContent = document.getElementById('loginTabContent');
  const signupContent = document.getElementById('signupTabContent');
  const loginTab = document.getElementById('loginTab');
  const signupTab = document.getElementById('signupTab');
  const authBtn = document.getElementById('authBtn');
  const registerBtn = document.getElementById('registerBtn');

  const resetTabs = () => {
    loginContent.style.display = 'none';
    signupContent.style.display = 'none';
    loginTab.style.background = 'transparent';
    loginTab.style.color = 'var(--text-secondary)';
    signupTab.style.background = 'transparent';
    signupTab.style.color = 'var(--text-secondary)';
    authBtn.style.display = 'none';
    registerBtn.style.display = 'none';
  };

  resetTabs();

  if (tab === 'login') {
    loginContent.style.display = 'block';
    loginTab.style.background = 'var(--primary)';
    loginTab.style.color = 'white';
    authBtn.style.display = 'block';
  } else if (tab === 'signup') {
    signupContent.style.display = 'block';
    signupTab.style.background = 'var(--primary)';
    signupTab.style.color = 'white';
    registerBtn.style.display = 'block';
  }
}


// ============================================================
// 병원명 자동완성 및 검색
// ============================================================
let allClinics = [];

async function loadClinicsList() {
  try {
    const res = await fetch('/api/clinics');
    if (!res.ok) return;
    const data = await res.json();
    allClinics = data.clinics || [];
  } catch (e) {
    console.error('[loadClinicsList]', e);
  }
}

function filterClinicsList(searchTerm) {
  if (!searchTerm) return allClinics.slice(0, 10);
  const term = searchTerm.toLowerCase();
  return allClinics.filter(c => c.name.toLowerCase().includes(term)).slice(0, 10);
}

function showClinicDropdown(clinics) {
  const dropdown = document.getElementById('clinicDropdown');
  if (!clinics.length) {
    dropdown.style.display = 'none';
    return;
  }
  dropdown.innerHTML = clinics.map(c => `
    <div style="padding:10px 12px; border-bottom:1px solid var(--gray-100); cursor:pointer; hover:background:var(--gray-50);" onclick="setClinicName('${c.name.replace(/'/g, "\\'")}')">
      <div style="font-weight:500; color:var(--text-primary);">${c.name}</div>
      <div style="font-size:0.75rem; color:var(--text-tertiary);">${c.director_name || ''} · ${c.region || ''}</div>
    </div>
  `).join('');
  dropdown.style.display = 'block';
}

function setClinicName(name) {
  document.getElementById('clinicName').value = name;
  document.getElementById('clinicDropdown').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  loadClinicsList();

  const clinicInput = document.getElementById('clinicName');
  const searchBtn = document.getElementById('clinicSearchBtn');

  if (clinicInput) {
    clinicInput.addEventListener('input', (e) => {
      const clinics = filterClinicsList(e.target.value);
      showClinicDropdown(clinics);
    });

    clinicInput.addEventListener('focus', (e) => {
      if (e.target.value) {
        const clinics = filterClinicsList(e.target.value);
        showClinicDropdown(clinics);
      }
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const clinicInput = document.getElementById('clinicName');
      clinicInput.focus();
      const clinics = filterClinicsList(clinicInput.value || '');
      showClinicDropdown(clinics);
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.form-group') && !e.target.closest('#clinicDropdown')) {
      document.getElementById('clinicDropdown').style.display = 'none';
    }
  });
});

// 로그인: 병원명 + 이메일 + 비밀번호(6자리)
async function submitClinicLogin() {
  console.log('🔐 submitClinicLogin 호출됨');
  const clinic = (document.getElementById('clinicName')?.value || '').trim();
  console.log('병원명:', clinic);
  const email = (document.getElementById('loginEmail')?.value || '').trim();
  console.log('이메일:', email);
  const pwd = [1,2,3,4,5,6].map(i => document.getElementById(`loginPwd${i}`)?.value || '').join('');
  console.log('비밀번호:', pwd ? '입력됨' : '빈값');

  if (!clinic || !email || pwd.length !== 6) {
    console.log('❌ 검증 실패:', {clinic: !!clinic, email: !!email, pwdLen: pwd.length});
    showToast('모든 필드를 입력하세요', 'warning');
    return;
  }

  if (!/^\d{6}$/.test(pwd)) {
    showToast('비밀번호는 숫자 6자리입니다', 'warning');
    return;
  }

  try {
    console.log('📡 /api/login 호출 중...');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicName: clinic, email, password: pwd })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || '로그인 실패', 'error');
      return;
    }

    const user = await res.json();
    Session.login({
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      clinic: user.clinic,
      clinic_id: user.clinic_id,
      tier: user.tier,
      is_admin: user.is_admin
    });

    closeModal('loginModal');

    // redirect 파라미터 확인
    const params = new URLSearchParams(window.location.search);
    const redirectPage = params.get('redirect');
    if (redirectPage) {
      window.location.href = redirectPage;
    } else {
      location.reload();
    }
  } catch (e) {
    console.error('Login error:', e);
    showToast('로그인 중 오류가 발생했습니다', 'error');
  }
}

// 병원 회원가입
async function submitClinicRegister() {
  const clinic = (document.getElementById('signupClinicName')?.value || '').trim();
  const director = (document.getElementById('signupDirector')?.value || '').trim();
  const region = (document.getElementById('signupRegion')?.value || '').trim();
  const pwd = [1,2,3,4,5,6].map(i => document.getElementById(`signupPwd${i}`)?.value || '').join('');

  if (!clinic || !director || !region || pwd.length !== 6) {
    showToast('모든 필드를 입력하세요', 'warning');
    return;
  }

  if (!/^\d{6}$/.test(pwd)) {
    showToast('비밀번호는 숫자 6자리입니다', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/clinic-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicName: clinic,
        directorName: director,
        region,
        password: pwd
      })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || '가입 실패', 'error');
      return;
    }

    showToast('병원 가입이 완료되었습니다. 로그인해주세요.', 'success');
    switchAuthTab('login');
    // 입력 필드 초기화
    ['clinicName', 'loginEmail', 'loginPwd1', 'loginPwd2', 'loginPwd3', 'loginPwd4', 'loginPwd5', 'loginPwd6'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  } catch (e) {
    console.error('Register error:', e);
    showToast('가입 중 오류가 발생했습니다', 'error');
  }
}

function toggleSignupFields(e) {
  if (e) e.preventDefault();
  const fields = document.getElementById('signupFields');
  const link = document.getElementById('toggleSignupLink');
  if (!fields) return;
  const hidden = fields.style.display === 'none';
  fields.style.display = hidden ? 'block' : 'none';
  if (link) link.textContent = hidden ? '가입 정보 숨기기 ▴' : '처음이신가요? 가입 정보 입력 ▾';
}

// 스마트 로그인 — 등록된 이메일이면 즉시, 신규면 매직링크

async function logoutAndRefresh() {
  try {
    if (typeof SupabaseDB !== 'undefined' && SupabaseDB.client?.auth) {
      await SupabaseDB.client.auth.signOut();
    }
  } catch (e) { console.warn('auth.signOut 실패', e); }
  Session.logout();
  showToast('로그아웃되었습니다', 'info');
  setTimeout(() => window.location.href = 'index.html', 500);
}

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
      email: u.email,
      tier: u.tier || 'free',
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
function renderSidebar(activePage) {
  return `
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-logo" style="flex-direction:column; gap:8px; align-items:center;">
        <img src="img/logo.png" alt="Dental Ops AI" style="max-width:200px; width:100%; height:auto; background:#FFFFFF; padding:10px 14px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.15);">
        <div style="font-size:0.6875rem; color:var(--text-on-primary-disabled); letter-spacing:0.08em; text-transform:uppercase; text-align:center;">치과 상담·운영 OS</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section-label">Main</div>
      <a href="index.html" class="nav-item ${activePage === 'index' ? 'active' : ''}">
        <span class="nav-item-icon">🏠</span> 홈
      </a>

      <div class="nav-section-label">8대 엔진</div>
      <a href="consult.html" class="nav-item ${activePage === 'consult' ? 'active' : ''}">
        <span class="nav-item-icon">💬</span> 상담 AI
      </a>
      <a href="review.html" class="nav-item ${activePage === 'review' ? 'active' : ''}">
        <span class="nav-item-icon">📋</span> 상담 리뷰
      </a>
      <a href="consult_review_wide.html" class="nav-item nav-subitem ${activePage === 'review-wide' ? 'active' : ''}">
        <span class="nav-item-icon">📑</span> · Wide
      </a>
      <a href="consult_review_tab.html" class="nav-item nav-subitem ${activePage === 'review-tab' ? 'active' : ''}">
        <span class="nav-item-icon">📋</span> · Tab
      </a>
      <a href="conversion.html" class="nav-item ${activePage === 'conversion' ? 'active' : ''}">
        <span class="nav-item-icon">🎯</span> 전환 전략
      </a>
      <a href="automation.html" class="nav-item ${activePage === 'automation' ? 'active' : ''}">
        <span class="nav-item-icon">⚙️</span> 자동화
      </a>
      <a href="patients.html" class="nav-item ${activePage === 'patients' ? 'active' : ''}">
        <span class="nav-item-icon">👥</span> 환자 관리
      </a>
      <a href="dashboard.html" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}">
        <span class="nav-item-icon">📊</span> KPI 대시보드
      </a>
      <a href="training.html" class="nav-item ${activePage === 'training' ? 'active' : ''}">
        <span class="nav-item-icon">🎓</span> 교육/훈련
      </a>
      <a href="insight.html" class="nav-item ${activePage === 'insight' ? 'active' : ''}">
        <span class="nav-item-icon">🧠</span> 인사이트 리포트
      </a>

      <div class="nav-section-label">관리</div>
      <a href="clinic-dashboard.html" class="nav-item ${activePage === 'clinic-dashboard' ? 'active' : ''}">
        <span class="nav-item-icon">🏥</span> 병원 관리
      </a>
      <a href="admin.html" class="nav-item ${activePage === 'admin' ? 'active' : ''}">
        <span class="nav-item-icon">👔</span> 관리자 (CEO)
      </a>

      <div class="nav-section-label">Docs</div>
      <a href="manual.html" class="nav-item ${activePage === 'manual' ? 'active' : ''}">
        <span class="nav-item-icon">📖</span> 매뉴얼
      </a>
      <a href="architecture.html" class="nav-item ${activePage === 'architecture' ? 'active' : ''}">
        <span class="nav-item-icon">🗺️</span> 아키텍처
      </a>
    </nav>
    <div class="sidebar-footer">
      <button class="sidebar-api-btn" onclick="openModal('supabaseModal')" id="sidebarSupabaseBtn">
        <span class="sidebar-api-icon" id="sidebarDbIcon">🗄️</span>
        <span class="sidebar-api-text">
          <span id="sidebarDbLabel">Supabase DB 연결</span>
          <span class="sidebar-api-status" id="sidebarDbStatus"></span>
        </span>
      </button>
      <div style="font-size:0.7rem; color:rgba(255,255,255,0.25); margin-top:10px;">Dental Ops AI v1.0</div>
    </div>
  </aside>
  <!-- Supabase 모달 -->
  <div class="modal-overlay" id="supabaseModal">
    <div class="modal" style="max-width:520px;">
      <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:1.25rem;">🗄️</span> Supabase DB 연결
        </h3>
        <button class="btn btn-sm btn-secondary" onclick="closeModal('supabaseModal')" style="font-size:1rem; padding:4px 10px;">✕</button>
      </div>
      <div class="modal-body">
        <div style="padding:16px; background:var(--primary-bg); border-radius:var(--radius-md); margin-bottom:20px;">
          <p style="font-size:0.8125rem; color:var(--primary); font-weight:600; margin-bottom:6px;">환자/상담/KPI 데이터 영구 저장</p>
          <p style="font-size:0.8125rem; color:var(--text-tertiary);">환자 정보, 상담 로그, 자동화 실행 이력, KPI가 Supabase에 저장됩니다.</p>
        </div>
        <div class="form-group">
          <label class="form-label">Project URL</label>
          <input type="text" class="form-input" id="supabaseUrlInput" placeholder="https://xxxx.supabase.co">
        </div>
        <div class="form-group">
          <label class="form-label">Anon Key</label>
          <input type="password" class="form-input" id="supabaseKeyInput" placeholder="eyJhbGciOi...">
        </div>
        <div id="supabaseStatus" style="margin-top:8px;"></div>
        <div style="margin-top:16px; padding:12px 16px; background:var(--gray-50); border-radius:var(--radius-sm); border:1px solid var(--gray-200);">
          <p style="font-size:0.75rem; font-weight:600; color:var(--text-secondary); margin-bottom:6px;">설정 방법</p>
          <ol style="font-size:0.75rem; color:var(--text-tertiary); padding-left:16px; line-height:1.8;">
            <li><a href="https://supabase.com/dashboard" target="_blank" rel="noopener" style="color:var(--primary); font-weight:600;">Supabase Dashboard</a> → 프로젝트 생성</li>
            <li>Settings > API에서 URL과 anon key 복사</li>
            <li>SQL Editor에서 <code>sql/schema.sql</code> 실행</li>
          </ol>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="removeSupabaseConfig()">연결 해제</button>
        <div style="flex:1;"></div>
        <button class="btn btn-secondary" onclick="closeModal('supabaseModal')">취소</button>
        <button class="btn btn-primary" onclick="saveSupabaseConfig()">🗄️ 연결 테스트 + 저장</button>
      </div>
    </div>
  </div>
  <!-- 로그인 모달 -->
  <div class="modal-overlay" id="loginModal">
    <div class="modal" style="max-width:480px;">
      <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--gray-200); padding-bottom:12px;">
        <div style="display:flex; gap:0; border-radius:8px; background:var(--gray-100); padding:2px;">
          <button class="btn btn-sm" id="loginTab" onclick="switchAuthTab('login')" style="background:var(--primary); color:white; border:none; border-radius:6px 0 0 0;">🔐 로그인</button>
          <button class="btn btn-sm" id="signupTab" onclick="switchAuthTab('signup')" style="background:transparent; color:var(--text-secondary); border:none; border-radius:0 6px 6px 0;">🏥 병원 가입</button>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="closeModal('loginModal')" style="font-size:1rem; padding:4px 10px;">✕</button>
      </div>
      <div class="modal-body">
        <!-- 로그인 탭 -->
        <div id="loginTabContent">
          <div class="form-group">
            <label class="form-label">병원명 <span style="color:var(--danger);">*</span></label>
            <div style="position:relative;">
              <input type="text" class="form-input" id="clinicName" placeholder="예: 디지털스마일치과" autocomplete="off" style="width:100%;">
              <button type="button" id="clinicSearchBtn" style="position:absolute; right:12px; top:12px; background:none; border:none; cursor:pointer; font-size:1.25rem; padding:0; color:var(--text-secondary);" title="병원 목록">🔍</button>
            </div>
            <div id="clinicDropdown" style="position:absolute; top:100%; left:0; right:0; background:var(--surface); border:1px solid var(--gray-200); border-radius:var(--radius-md); max-height:200px; overflow-y:auto; display:none; z-index:1000; box-shadow:var(--shadow-md); margin-top:4px;"></div>
          </div>
          <div class="form-group">
            <label class="form-label">이메일 <span style="color:var(--danger);">*</span></label>
            <input type="email" class="form-input" id="loginEmail" placeholder="you@example.com" autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
              <span>비밀번호 (숫자 6자리) <span style="color:var(--danger);">*</span></span>
              <small style="color:var(--text-tertiary);">병원 공유 비밀번호</small>
            </label>
            <div style="display:grid; grid-template-columns:repeat(6,1fr); gap:8px;">
              <input type="password" class="form-input" id="loginPwd1" placeholder="1" maxlength="1" pattern="\\d" style="text-align:center; font-size:1.5rem; font-weight:700;">
              <input type="password" class="form-input" id="loginPwd2" placeholder="2" maxlength="1" pattern="\\d" style="text-align:center; font-size:1.5rem; font-weight:700;">
              <input type="password" class="form-input" id="loginPwd3" placeholder="3" maxlength="1" pattern="\\d" style="text-align:center; font-size:1.5rem; font-weight:700;">
              <input type="password" class="form-input" id="loginPwd4" placeholder="4" maxlength="1" pattern="\\d" style="text-align:center; font-size:1.5rem; font-weight:700;">
              <input type="password" class="form-input" id="loginPwd5" placeholder="5" maxlength="1" pattern="\\d" style="text-align:center; font-size:1.5rem; font-weight:700;">
              <input type="password" class="form-input" id="loginPwd6" placeholder="6" maxlength="1" pattern="\\d" style="text-align:center; font-size:1.5rem; font-weight:700;">
            </div>
          </div>
        </div>

        <!-- 병원 회원가입 탭 -->
        <div id="signupTabContent" style="display:none;">
          <div class="form-group">
            <label class="form-label">병원명 <span style="color:var(--danger);">*</span></label>
            <input type="text" class="form-input" id="signupClinicName" placeholder="예: 디지털스마일 치과" autocomplete="organization">
          </div>
          <div class="form-group">
            <label class="form-label">대표원장 이름 <span style="color:var(--danger);">*</span></label>
            <input type="text" class="form-input" id="signupDirector" placeholder="홍길동" autocomplete="name">
          </div>
          <div class="form-group">
            <label class="form-label">지역명 <span style="color:var(--danger);">*</span></label>
            <input type="text" class="form-input" id="signupRegion" placeholder="예: 서울 강남">
          </div>
          <div class="form-group">
            <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
              <span>비밀번호 (숫자 6자리) <span style="color:var(--danger);">*</span></span>
              <small style="color:var(--text-tertiary);">직원들과 공유하는 비밀번호</small>
            </label>
            <div style="display:grid; grid-template-columns:repeat(6,1fr); gap:8px;">
              <input type="password" class="form-input" id="signupPwd1" placeholder="1" maxlength="1" pattern="\\d" style="text-align:center; font-size:1.5rem; font-weight:700;">
              <input type="password" class="form-input" id="signupPwd2" placeholder="2" maxlength="1" pattern="\\d" style="text-align:center; font-size:1.5rem; font-weight:700;">
              <input type="password" class="form-input" id="signupPwd3" placeholder="3" maxlength="1" pattern="\\d" style="text-align:center; font-size:1.5rem; font-weight:700;">
              <input type="password" class="form-input" id="signupPwd4" placeholder="4" maxlength="1" pattern="\\d" style="text-align:center; font-size:1.5rem; font-weight:700;">
              <input type="password" class="form-input" id="signupPwd5" placeholder="5" maxlength="1" pattern="\\d" style="text-align:center; font-size:1.5rem; font-weight:700;">
              <input type="password" class="form-input" id="signupPwd6" placeholder="6" maxlength="1" pattern="\\d" style="text-align:center; font-size:1.5rem; font-weight:700;">
            </div>
          </div>
        </div>

      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('loginModal')">취소</button>
        <button class="btn btn-primary" id="authBtn" onclick="submitClinicLogin()" style="display:none;">🔐 로그인</button>
        <button class="btn btn-primary" id="registerBtn" onclick="submitClinicRegister()" style="display:none;">💾 병원 가입하기</button>
      </div>
    </div>
  </div>`;
}

// --- Premium Footer ---
function renderFooter() {
  return `
  <footer class="premium-footer">
    <div class="footer-inner">
      <div class="footer-top">
        <div class="footer-brand">
          <img src="img/logo.png" alt="Dental Ops AI" style="max-width:180px; background:#FFFFFF; padding:8px 12px; border-radius:8px; margin-bottom:14px; display:inline-block;">
          <p>치과 상담·진단·운영을 자동화하는 AI 운영 플랫폼. 상담 전환율과 환자 경험을 동시에 끌어올립니다.</p>
        </div>
        <div class="footer-section">
          <h4>8대 엔진</h4>
          <a href="consult.html" class="footer-link">상담 AI</a>
          <a href="conversion.html" class="footer-link">전환 전략</a>
          <a href="automation.html" class="footer-link">자동화</a>
          <a href="patients.html" class="footer-link">환자 관리</a>
        </div>
        <div class="footer-section">
          <h4>Analytics</h4>
          <a href="dashboard.html" class="footer-link">KPI 대시보드</a>
          <a href="training.html" class="footer-link">교육/훈련</a>
          <a href="insight.html" class="footer-link">인사이트 리포트</a>
          <a href="admin.html" class="footer-link">관리자 (CEO)</a>
        </div>
        <div class="footer-section">
          <h4>Docs</h4>
          <a href="manual.html" class="footer-link">매뉴얼</a>
          <a href="architecture.html" class="footer-link">아키텍처</a>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="footer-copy">&copy; ${new Date().getFullYear()} Dental Ops AI. Powered by AX Dental Solutions.</div>
        <div class="footer-badges">
          <span class="footer-badge">8-Engine</span>
          <a href="admin-dashboard.html" class="footer-badge" style="background:rgba(0,102,255,0.15); border-color:rgba(0,102,255,0.4); color:#60A5FA; text-decoration:none; cursor:pointer;">🛠 관리자 대시보드</a>
        </div>
      </div>
    </div>
  </footer>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const content = document.querySelector('.content');
  if (content) content.insertAdjacentHTML('afterend', renderFooter());
});

// --- Supabase Config Helpers ---
function saveSupabaseConfig() {
  const url = (document.getElementById('supabaseUrlInput')?.value || '').trim();
  const key = (document.getElementById('supabaseKeyInput')?.value || '').trim();
  if (!url || !key) { showToast('URL과 Key를 모두 입력하세요', 'warning'); return; }

  if (typeof SupabaseDB !== 'undefined') {
    SupabaseDB.setConfig(url, key);
    SupabaseDB.getPatientCount()
      .then(count => {
        document.getElementById('supabaseStatus').innerHTML =
          '<span style="color:var(--success); font-weight:600;">✓ 연결 성공! (환자 ' + count + '명)</span>';
        showToast('Supabase 연결 성공!', 'success');
        updateSidebarDbState();
        setTimeout(() => closeModal('supabaseModal'), 1000);
      })
      .catch(err => {
        document.getElementById('supabaseStatus').innerHTML =
          '<span style="color:var(--danger); font-weight:600;">❌ 연결 실패: ' + err.message + '</span>';
      });
  } else {
    Store.set('supabase_url', url);
    Store.set('supabase_key', key);
    showToast('설정 저장됨 (supabase.js 미로드)', 'warning');
  }
}

function removeSupabaseConfig() {
  Store.remove('supabase_url');
  Store.remove('supabase_key');
  if (typeof SupabaseDB !== 'undefined') SupabaseDB.client = null;
  updateSidebarDbState();
  showToast('Supabase 연결이 해제되었습니다', 'info');
}

// --- Gemini API ---
// SaaS 방식: 본사 서버(/api/gemini)가 GEMINI_API_KEY를 보관하고 모든 치과가 공동 사용
// 브라우저는 키를 알 필요 없음. 프록시에만 prompt를 전송.
const GeminiAPI = {
  // 호환성용: 항상 true (서버가 키를 보유한다고 가정)
  getKey() { return 'server-managed'; },

  async chat(prompt, imageBase64 = null, model = null, engine = null) {
    const body = { prompt, imageBase64 };
    if (model) body.model = model;
    if (engine) body.engine = engine;

    // 로그인 세션에서 이메일 첨부 (간편 로그인 사용자)
    try {
      const s = typeof Session !== 'undefined' ? Session.get() : null;
      if (s?.email) body.user_email = s.email;
    } catch {}

    const headers = { 'Content-Type': 'application/json' };

    // Supabase Auth 세션 있으면 Bearer 토큰도 전달
    try {
      if (typeof SupabaseDB !== 'undefined' && SupabaseDB.client?.auth) {
        const { data } = await SupabaseDB.client.auth.getSession();
        if (data?.session?.access_token) {
          headers.Authorization = 'Bearer ' + data.session.access_token;
        }
      }
    } catch {}

    const res = await fetch('/api/gemini', {
      method: 'POST', headers, body: JSON.stringify(body)
    });
    if (!res.ok) {
      let msg = 'Gemini API 오류';
      try { const err = await res.json(); msg = err.error || msg; } catch {}
      throw new Error(msg);
    }
    const data = await res.json();
    // usage 정보를 전역 저장 (UI에서 배지 표시용, 선택)
    if (data.usage && typeof window !== 'undefined') {
      window.__lastGeminiUsage = data.usage;
    }
    return data.text || '';
  },

  async json(prompt, model = null, engine = null) {
    const text = await this.chat(prompt + '\n\n반드시 유효한 JSON만 출력하라. 설명이나 마크다운 코드 블록 없이.', null, model, engine);
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    try { return JSON.parse(cleaned); }
    catch { const m = cleaned.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error('JSON 파싱 실패'); }
  },

  // 서버 키 등록 여부 진단용 (선택)
  async checkServerStatus() {
    try {
      const res = await fetch('/api/gemini', { method: 'GET' });
      if (!res.ok) return { ok: false };
      return await res.json();
    } catch {
      return { ok: false };
    }
  }
};

// --- Gemini 키는 서버(/api/gemini)에서 관리되므로 브라우저 UI 불필요 ---

function updateSidebarDbState() {
  const btn = document.getElementById('sidebarSupabaseBtn');
  const icon = document.getElementById('sidebarDbIcon');
  const label = document.getElementById('sidebarDbLabel');
  const status = document.getElementById('sidebarDbStatus');
  if (!btn) return;
  const cfg = Store.get('supabase_url', '');
  if (cfg) {
    btn.classList.add('connected');
    icon.innerHTML = '✅';
    label.textContent = 'Supabase DB';
    status.textContent = '연결됨';
    status.className = 'sidebar-api-status on';
  } else {
    btn.classList.remove('connected');
    icon.innerHTML = '🗄️';
    label.textContent = 'Supabase DB 연결';
    status.textContent = 'DB를 연결하세요';
    status.className = 'sidebar-api-status off';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateSidebarDbState();
  renderConnectionBanner();
  // Supabase Auth 세션 복원 + onAuthStateChange 구독
  // SupabaseDB.init()이 DOMContentLoaded에서 실행되므로 약간의 딜레이
  // initAuthBridge 제거됨 - 이전 매직링크 방식
});

// --- 연결 상태 배너 (엔진 페이지 한정) ---
function renderConnectionBanner() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  if (PUBLIC_PAGES.includes(path)) return;
  if (Store.get('banner_dismissed', false)) return;

  const hasSupabase = !!Store.get('supabase_url', '');
  if (hasSupabase) return;

  const content = document.querySelector('.content');
  if (!content) return;

  const banner = document.createElement('div');
  banner.className = 'connection-banner';
  banner.style.cssText = 'background:var(--warning-bg); border:1px solid var(--warning-border); color:#78350F; padding:12px 16px; border-radius:var(--radius-md); margin-bottom:20px; display:flex; align-items:center; gap:12px; font-size:0.875rem;';

  const msg = '🗄️ Supabase DB가 연결되지 않았습니다. 데이터는 이 브라우저에만 저장됩니다.';

  const msgEl = document.createElement('span');
  msgEl.style.flex = '1';
  msgEl.textContent = msg;
  banner.appendChild(msgEl);

  const dismissBtn = document.createElement('button');
  dismissBtn.textContent = '✕';
  dismissBtn.setAttribute('aria-label', '배너 닫기');
  dismissBtn.style.cssText = 'background:none; border:none; font-size:1rem; cursor:pointer; color:#78350F; padding:4px 8px;';
  dismissBtn.onclick = () => { Store.set('banner_dismissed', true); banner.remove(); };
  banner.appendChild(dismissBtn);

  content.insertBefore(banner, content.firstChild);
}

// ============================================================
// 샘플 데이터 (Supabase 미연결 시 데모용)
// ============================================================
const SampleData = {
  patients: [
    { id: 'P001', name: '김민수', age: 34, phone: '010-1234-5678', gender: '남', status: '상담중', lastVisit: '2026-04-15', treatment: '임플란트', estimate: 3500000, conversionProb: 65 },
    { id: 'P002', name: '이지은', age: 28, phone: '010-2345-6789', gender: '여', status: '계약완료', lastVisit: '2026-04-14', treatment: '라미네이트', estimate: 4200000, conversionProb: 95 },
    { id: 'P003', name: '박서준', age: 41, phone: '010-3456-7890', gender: '남', status: '치료중', lastVisit: '2026-04-13', treatment: '임플란트', estimate: 5800000, conversionProb: 88 },
    { id: 'P004', name: '최유나', age: 25, phone: '010-4567-8901', gender: '여', status: '상담대기', lastVisit: '2026-04-16', treatment: '교정', estimate: 6500000, conversionProb: 45 },
    { id: 'P005', name: '정현우', age: 37, phone: '010-5678-9012', gender: '남', status: '계약완료', lastVisit: '2026-04-12', treatment: '보철', estimate: 2800000, conversionProb: 92 },
    { id: 'P006', name: '한소희', age: 30, phone: '010-6789-0123', gender: '여', status: '치료완료', lastVisit: '2026-04-10', treatment: '치아미백', estimate: 900000, conversionProb: 100 },
    { id: 'P007', name: '오민혁', age: 45, phone: '010-7890-1234', gender: '남', status: '상담중', lastVisit: '2026-04-16', treatment: '임플란트', estimate: 4500000, conversionProb: 38 },
    { id: 'P008', name: '윤서아', age: 33, phone: '010-8901-2345', gender: '여', status: '상담대기', lastVisit: '2026-04-16', treatment: '라미네이트', estimate: 3800000, conversionProb: 67 },
  ],
  dailyRevenue: [
    { date: '04/10', revenue: 1520, patients: 8, consult: 12, contracts: 5 },
    { date: '04/11', revenue: 2340, patients: 12, consult: 18, contracts: 9 },
    { date: '04/12', revenue: 1890, patients: 10, consult: 14, contracts: 6 },
    { date: '04/13', revenue: 3100, patients: 15, consult: 22, contracts: 12 },
    { date: '04/14', revenue: 2760, patients: 14, consult: 20, contracts: 10 },
    { date: '04/15', revenue: 2950, patients: 13, consult: 19, contracts: 11 },
    { date: '04/16', revenue: 3420, patients: 16, consult: 24, contracts: 14 },
  ],
  treatmentMix: [
    { name: '임플란트', value: 38, color: 'var(--primary)' },
    { name: '라미네이트', value: 22, color: 'var(--accent)' },
    { name: '교정', value: 18, color: 'var(--warning)' },
    { name: '보철', value: 14, color: '#8B5CF6' },
    { name: '치아미백', value: 8, color: 'var(--danger)' },
  ],
  kpi: {
    conversionRate: 68,      // 상담 → 치료 전환율 (%)
    conversionRateDelta: +12, // 전주 대비
    avgConsultMin: 14,        // 평균 상담 시간 (분)
    avgConsultMinDelta: -6,
    revisitRate: 76,          // 재방문율 (%)
    revisitRateDelta: +8,
    aiUsageRate: 84,          // AI 활용률 (%)
    aiUsageRateDelta: +15,
    monthlyRevenue: 186000000,
    monthlyRevenueDelta: +22,
  }
};
