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
const Store = {
  get(key, fallback = null) {
    try {
      const val = localStorage.getItem('dops_' + key);
      return val ? JSON.parse(val) : fallback;
    } catch { return fallback; }
  },
  set(key, val) { localStorage.setItem('dops_' + key, JSON.stringify(val)); },
  remove(key) { localStorage.removeItem('dops_' + key); }
};

// ============================================================
// 세션 화이트리스트 게이팅
// ============================================================
const Session = {
  KEY: 'session',
  TTL_MS: 1000 * 60 * 60 * 24 * 7, // 7일
  login({ userId, name, role = 'staff', clinic = '', email = '' }) {
    Store.set(this.KEY, { userId, name, role, clinic, email, loggedAt: Date.now() });
  },
  logout() { Store.remove(this.KEY); },
  get() {
    const s = Store.get(this.KEY, null);
    if (!s) return null;
    if (Date.now() - s.loggedAt > this.TTL_MS) { this.logout(); return null; }
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
          '<span style="padding:4px 10px; background:#FEF3C7; color:#92400E; border-radius:var(--radius-full); font-size:0.75rem; font-weight:600; margin-right:8px;">🔐 로그인이 필요합니다</span>');
      }
    }, 400);
  }
});

// 데모 로그인 (index.html 모달에서 호출) — Supabase users 테이블과 동기화
async function demoLogin() {
  const name = (document.getElementById('loginName')?.value || '').trim();
  const clinic = (document.getElementById('loginClinic')?.value || '').trim();
  const email = (document.getElementById('loginEmail')?.value || '').trim();
  const role = document.getElementById('loginRole')?.value || 'staff';

  if (!name) { showToast('이름을 입력하세요', 'warning'); return; }
  if (name.length > 20) { showToast('이름은 20자 이내로 입력하세요', 'warning'); return; }
  if (!clinic) { showToast('병원명을 입력하세요', 'warning'); return; }
  if (clinic.length > 40) { showToast('병원명은 40자 이내로 입력하세요', 'warning'); return; }
  if (!email) { showToast('이메일을 입력하세요', 'warning'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('이메일 형식이 올바르지 않습니다', 'warning'); return; }

  // Supabase users 테이블 upsert — 성공 시 실제 DB userId 사용
  let userId = 'u_' + Date.now(); // fallback (Supabase 미연결 시)
  if (typeof SupabaseDB !== 'undefined' && SupabaseDB.isReady()) {
    try {
      const row = await SupabaseDB.upsertUser({ email, name, clinic, role });
      userId = row.id;
      showToast(`${name}님 (${clinic}) · Supabase 동기화 완료`, 'success');
    } catch (e) {
      console.warn('Supabase 사용자 upsert 실패', e);
      showToast(`${name}님 환영합니다 (오프라인 세션)`, 'warning');
    }
  } else {
    showToast(`${name}님 환영합니다 (Supabase 미연결)`, 'warning');
  }

  Session.login({ userId, name, role, clinic, email });
  closeModal('loginModal');
  const urlParams = new URLSearchParams(window.location.search);
  const redirect = urlParams.get('redirect');
  setTimeout(() => {
    if (redirect) {
      // 화이트리스트된 내부 경로만 허용 (open redirect 방지)
      const safePath = /^[a-z0-9_-]+\.html$/i.test(redirect) ? redirect : 'index.html';
      window.location.href = safePath;
    } else updateSessionUI();
  }, 600);
}

// Enter 키로 로그인 제출
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const loginModal = document.getElementById('loginModal');
    if (loginModal && loginModal.classList.contains('active')) {
      e.preventDefault();
      demoLogin();
    }
  }
});

function logoutAndRefresh() {
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
// 사이드바 — 8메뉴 + 홈/매뉴얼/구조도
// ============================================================
function renderSidebar(activePage) {
  return `
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-logo" style="flex-direction:column; gap:8px; align-items:center;">
        <img src="img/logo.png" alt="Dental Ops AI" style="max-width:200px; width:100%; height:auto; background:#FFFFFF; padding:10px 14px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.15);">
        <div style="font-size:0.6875rem; color:rgba(255,255,255,0.4); letter-spacing:0.08em; text-transform:uppercase; text-align:center;">치과 상담·운영 OS</div>
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
      <button class="sidebar-api-btn" onclick="openApiKeyModal()">
        <span class="sidebar-api-icon" id="sidebarApiIcon">🔑</span>
        <span class="sidebar-api-text">
          <span id="sidebarApiLabel">Gemini API 키 설정</span>
          <span class="sidebar-api-status" id="sidebarApiStatus"></span>
        </span>
      </button>
      <button class="sidebar-api-btn" onclick="openModal('supabaseModal')" style="margin-top:6px;" id="sidebarSupabaseBtn">
        <span class="sidebar-api-icon" id="sidebarDbIcon">🗄️</span>
        <span class="sidebar-api-text">
          <span id="sidebarDbLabel">Supabase DB 연결</span>
          <span class="sidebar-api-status" id="sidebarDbStatus"></span>
        </span>
      </button>
      <div style="font-size:0.7rem; color:rgba(255,255,255,0.25); margin-top:10px;">Dental Ops AI v1.0</div>
    </div>
  </aside>
  <!-- Gemini API Key Modal -->
  <div class="modal-overlay" id="geminiApiModal">
    <div class="modal">
      <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:1.25rem;">🔑</span> Gemini API 키 설정
        </h3>
        <button class="btn btn-sm btn-secondary" onclick="closeModal('geminiApiModal')" style="font-size:1rem; padding:4px 10px;">✕</button>
      </div>
      <div class="modal-body">
        <div style="padding:16px; background:var(--primary-bg); border-radius:var(--radius-md); margin-bottom:20px;">
          <p style="font-size:0.8125rem; color:var(--primary); font-weight:600; margin-bottom:6px;">AI 기능 사용에 필요합니다</p>
          <p style="font-size:0.8125rem; color:var(--text-tertiary);">상담 AI, 전환 전략, 교육 평가 등 모든 엔진이 Gemini API를 사용합니다.</p>
        </div>
        <div class="form-group">
          <label class="form-label">API Key</label>
          <div style="position:relative;">
            <input type="password" class="form-input" id="geminiKeyInput" placeholder="AIza..." style="padding-right:44px;">
            <button onclick="toggleKeyVisibility()" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; font-size:1.1rem; color:var(--text-tertiary);" id="toggleKeyBtn">👁</button>
          </div>
        </div>
        <div id="geminiKeyStatus" style="margin-top:8px;"></div>
        <div style="margin-top:16px; padding:12px 16px; background:var(--gray-50); border-radius:var(--radius-sm); border:1px solid var(--gray-200);">
          <p style="font-size:0.75rem; font-weight:600; color:var(--text-secondary); margin-bottom:6px;">API 키 발급 방법</p>
          <ol style="font-size:0.75rem; color:var(--text-tertiary); padding-left:16px; line-height:1.8;">
            <li><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="color:var(--primary); font-weight:600;">Google AI Studio</a> 접속 → "Get API Key"</li>
            <li>"Create API Key" 버튼으로 키 생성</li>
            <li>생성된 키를 위 입력란에 붙여넣기</li>
          </ol>
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:6px; margin-top:10px; padding:8px 16px; background:var(--primary); color:#FFF; font-size:0.75rem; font-weight:600; border-radius:var(--radius-full); text-decoration:none;">🔗 Google AI Studio에서 API 키 발급받기</a>
        </div>
        <p style="font-size:0.6875rem; color:var(--text-disabled); margin-top:12px;">🔒 API 키는 이 브라우저의 로컬 스토리지에만 저장됩니다.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="removeApiKey()">키 삭제</button>
        <div style="flex:1;"></div>
        <button class="btn btn-secondary" onclick="closeModal('geminiApiModal')">취소</button>
        <button class="btn btn-primary" onclick="saveGeminiKey()">🔑 저장</button>
      </div>
    </div>
  </div>
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
    <div class="modal" style="max-width:420px;">
      <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:1.25rem;">🔐</span> 로그인
        </h3>
        <button class="btn btn-sm btn-secondary" onclick="closeModal('loginModal')" style="font-size:1rem; padding:4px 10px;">✕</button>
      </div>
      <div class="modal-body">
        <div style="padding:14px; background:var(--primary-bg); border-radius:var(--radius-md); margin-bottom:20px;">
          <p style="font-size:0.8125rem; color:var(--primary); font-weight:600;">🎯 8대 엔진 접근에 로그인이 필요합니다</p>
        </div>
        <div class="form-group">
          <label class="form-label">이름 <span style="color:var(--danger);">*</span></label>
          <input type="text" class="form-input" id="loginName" placeholder="홍길동" autocomplete="name">
        </div>
        <div class="form-group">
          <label class="form-label">병원명 <span style="color:var(--danger);">*</span></label>
          <input type="text" class="form-input" id="loginClinic" placeholder="예: 스마일치과" autocomplete="organization">
        </div>
        <div class="form-group">
          <label class="form-label">이메일 <span style="color:var(--danger);">*</span></label>
          <input type="email" class="form-input" id="loginEmail" placeholder="you@clinic.co.kr" autocomplete="email">
        </div>
        <div class="form-group">
          <label class="form-label">역할</label>
          <select class="form-input" id="loginRole">
            <option value="상담실장">상담실장</option>
            <option value="원장">원장</option>
            <option value="코디네이터">코디네이터</option>
            <option value="치위생사">치위생사</option>
            <option value="관리자">관리자 (CEO)</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('loginModal')">취소</button>
        <button class="btn btn-primary" onclick="demoLogin()">🚀 로그인</button>
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
          <span class="footer-link" style="cursor:default;">Gemini 2.0 Flash</span>
          <span class="footer-link" style="cursor:default;">Supabase DB</span>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="footer-copy">&copy; ${new Date().getFullYear()} Dental Ops AI. Powered by AX Dental Solutions.</div>
        <div class="footer-badges">
          <span class="footer-badge">Gemini AI</span>
          <span class="footer-badge">Supabase</span>
          <span class="footer-badge">8-Engine</span>
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
const GeminiAPI = {
  apiKey: '',
  setKey(key) { this.apiKey = key; Store.set('gemini_key', key); },
  getKey() {
    if (!this.apiKey) this.apiKey = Store.get('gemini_key', '');
    return this.apiKey;
  },
  async chat(prompt, imageBase64 = null) {
    const key = this.getKey();
    if (!key) throw new Error('Gemini API 키가 설정되지 않았습니다.');
    const parts = [];
    if (imageBase64) {
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64Data } });
    }
    parts.push({ text: prompt });
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Gemini API 오류');
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  },
  async json(prompt) {
    const text = await this.chat(prompt + '\n\n반드시 유효한 JSON만 출력하라. 설명이나 마크다운 코드 블록 없이.');
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    try { return JSON.parse(cleaned); }
    catch { const m = cleaned.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error('JSON 파싱 실패'); }
  }
};

// --- Gemini Key Modal ---
function openApiKeyModal() {
  const key = GeminiAPI.getKey();
  const input = document.getElementById('geminiKeyInput');
  if (input) { input.value = key || ''; input.type = 'password'; }
  const toggleBtn = document.getElementById('toggleKeyBtn');
  if (toggleBtn) toggleBtn.innerHTML = '👁';
  updateGeminiKeyStatus();
  openModal('geminiApiModal');
}

function saveGeminiKey() {
  const input = document.getElementById('geminiKeyInput');
  const key = input ? input.value.trim() : '';
  if (!key) { showToast('API 키를 입력하세요', 'warning'); return; }
  GeminiAPI.setKey(key);
  updateSidebarApiState();
  updateGeminiKeyStatus();
  showToast('Gemini API 키가 저장되었습니다', 'success');
  closeModal('geminiApiModal');
}

function removeApiKey() {
  GeminiAPI.apiKey = '';
  Store.remove('gemini_key');
  const input = document.getElementById('geminiKeyInput');
  if (input) input.value = '';
  updateSidebarApiState();
  updateGeminiKeyStatus();
  showToast('API 키가 삭제되었습니다', 'info');
}

function toggleKeyVisibility() {
  const input = document.getElementById('geminiKeyInput');
  const btn = document.getElementById('toggleKeyBtn');
  if (!input) return;
  if (input.type === 'password') { input.type = 'text'; btn.innerHTML = '🙈'; }
  else { input.type = 'password'; btn.innerHTML = '👁'; }
}

function updateGeminiKeyStatus() {
  const el = document.getElementById('geminiKeyStatus');
  if (!el) return;
  const key = GeminiAPI.getKey();
  if (key) {
    const masked = key.substring(0, 6) + '••••••' + key.substring(key.length - 4);
    el.innerHTML = `<div style="display:flex; align-items:center; gap:8px; font-size:0.8125rem;">
      <span style="color:var(--success); font-weight:600;">✓ 연결됨</span>
      <span style="color:var(--text-tertiary); font-family:monospace; font-size:0.75rem;">${masked}</span>
    </div>`;
  } else {
    el.innerHTML = '<span style="font-size:0.8125rem; color:var(--text-tertiary);">API 키가 설정되지 않았습니다</span>';
  }
}

function updateSidebarApiState() {
  const key = GeminiAPI.getKey();
  const btn = document.querySelector('.sidebar-api-btn');
  const icon = document.getElementById('sidebarApiIcon');
  const label = document.getElementById('sidebarApiLabel');
  const status = document.getElementById('sidebarApiStatus');
  if (!btn) return;
  if (key) {
    btn.classList.add('connected');
    icon.innerHTML = '✅';
    label.textContent = 'Gemini API';
    status.textContent = '연결됨 — ' + key.substring(0, 6) + '••••';
    status.className = 'sidebar-api-status on';
  } else {
    btn.classList.remove('connected');
    icon.innerHTML = '🔑';
    label.textContent = 'Gemini API 키 설정';
    status.textContent = '키를 설정하세요';
    status.className = 'sidebar-api-status off';
  }
}

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
  updateSidebarApiState();
  updateSidebarDbState();
  renderConnectionBanner();
});

// --- 연결 상태 배너 (엔진 페이지 한정) ---
function renderConnectionBanner() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  if (PUBLIC_PAGES.includes(path)) return;
  if (Store.get('banner_dismissed', false)) return;

  const hasGemini = !!GeminiAPI.getKey();
  const hasSupabase = !!Store.get('supabase_url', '');
  if (hasGemini && hasSupabase) return;

  const content = document.querySelector('.content');
  if (!content) return;

  const banner = document.createElement('div');
  banner.className = 'connection-banner';
  banner.style.cssText = 'background:#FEF3C7; border:1px solid #FCD34D; color:#78350F; padding:12px 16px; border-radius:var(--radius-md); margin-bottom:20px; display:flex; align-items:center; gap:12px; font-size:0.875rem;';

  const msg = !hasGemini && !hasSupabase
    ? '🔧 데모 모드 — Gemini API 키와 Supabase DB가 미연결 상태입니다. 사이드바 하단에서 설정하면 실제 AI·데이터가 연결됩니다.'
    : !hasGemini
    ? '🔑 Gemini API 키가 설정되지 않았습니다. AI 엔진은 데모 응답만 반환합니다.'
    : '🗄️ Supabase DB가 연결되지 않았습니다. 데이터는 이 브라우저에만 저장됩니다.';

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
    { name: '임플란트', value: 38, color: '#0066FF' },
    { name: '라미네이트', value: 22, color: '#00D4AA' },
    { name: '교정', value: 18, color: '#F59E0B' },
    { name: '보철', value: 14, color: '#8B5CF6' },
    { name: '치아미백', value: 8, color: '#EF4444' },
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
