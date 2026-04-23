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
  if (overlay) {
    overlay.classList.add('active');
    overlay.classList.remove('hidden');
    // clinic-dashboard의 !important를 처리하기 위해 인라인 스타일도 설정
    overlay.style.setProperty('display', 'flex', 'important');
    overlay.style.setProperty('opacity', '1', 'important');
    overlay.style.setProperty('pointer-events', 'all', 'important');
  }
}
function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) {
    overlay.classList.remove('active');
    overlay.classList.add('hidden');
    // clinic-dashboard의 !important를 처리하기 위해 인라인 스타일도 설정
    overlay.style.setProperty('display', 'none', 'important');
    overlay.style.setProperty('opacity', '0', 'important');
    overlay.style.setProperty('pointer-events', 'none', 'important');
  }
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

// 🔄 캐시 버전 - 변경 시 로컬스토리지 마이그레이션 트리거
const CACHE_VERSION = '1.0.3';
const storedVersion = localStorage.getItem('cache_version');
if (storedVersion !== CACHE_VERSION) {
  console.log('[cache] 버전 변경 감지:', storedVersion, '→', CACHE_VERSION);
  // clinic-dashboard 관련 세션만 유지, 나머지는 검증
  const session = localStorage.getItem('dops_session');
  localStorage.clear();
  if (session) localStorage.setItem('dops_session', session);
  localStorage.setItem('cache_version', CACHE_VERSION);
  console.log('[cache] ✅ 캐시 마이그레이션 완료');
}

// 화이트리스트 (로그인 없이 공개)
const PUBLIC_PAGES = ['index.html', 'manual.html', 'architecture.html', 'clinic-dashboard.html', 'admin-dashboard.html', ''];
