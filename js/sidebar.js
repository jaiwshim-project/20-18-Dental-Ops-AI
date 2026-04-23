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
function renderSidebar(activePage) {
  return `
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-logo" style="flex-direction:column; gap:8px; align-items:center;">
        <img src="img/logo.png" alt="Medvo" style="max-width:200px; width:100%; height:auto; background:#FFFFFF; padding:10px 14px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.15);">
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
      <div style="font-size:0.7rem; color:rgba(255,255,255,0.25); margin-top:10px;">Medvo v1.0</div>
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
            <div style="display:flex; gap:8px;">
              <input type="text" class="form-input" id="clinicName" placeholder="예: 디지털스마일치과" autocomplete="off" style="flex:1;">
              <button type="button" id="clinicSearchBtn" class="btn btn-secondary" style="padding:8px 12px; font-size:1.25rem; white-space:nowrap;" title="병원 목록">🔍</button>
            </div>
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
            <label class="form-label">대표원장 이메일 <span style="color:var(--danger);">*</span></label>
            <input type="email" class="form-input" id="signupEmail" placeholder="director@example.com" autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label">휴대폰 번호 <span style="color:var(--danger);">*</span></label>
            <input type="tel" class="form-input" id="signupPhone" placeholder="010-1234-5678" autocomplete="tel">
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

      <!-- 병원 검색 드롭다운 -->
      <div id="clinicDropdown" style="background:var(--surface); border-top:1px solid var(--gray-200); max-height:250px; overflow-y:auto; display:none;"></div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('loginModal')">취소</button>
        <button class="btn btn-primary" id="finalLoginBtn" onclick="submitClinicLogin()" style="display:none;">✓ 확인</button>
        <button class="btn btn-primary" id="clinicConfirmBtn" onclick="confirmClinicAndProceed()" style="display:none;">✓ 확인</button>
        <button class="btn btn-primary" id="authBtn" onclick="submitClinicLogin()" style="display:none;">🔐 로그인</button>
        <button class="btn btn-primary" id="registerBtn" onclick="submitClinicRegister()" style="display:none;">💾 병원 가입하기</button>
      </div>
    </div>
  </div>`;
}

// --- Premium Footer ---
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
// Deployment: 1776871986
