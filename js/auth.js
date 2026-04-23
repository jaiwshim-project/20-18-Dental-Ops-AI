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

  const clinicConfirmBtn = document.getElementById('clinicConfirmBtn');
  const finalLoginBtn = document.getElementById('finalLoginBtn');
  const clinicDropdown = document.getElementById('clinicDropdown');

  const resetTabs = () => {
    loginContent.style.display = 'none';
    signupContent.style.display = 'none';
    loginTab.style.background = 'transparent';
    loginTab.style.color = 'var(--text-secondary)';
    signupTab.style.background = 'transparent';
    signupTab.style.color = 'var(--text-secondary)';
    authBtn.style.display = 'none';
    registerBtn.style.display = 'none';
    clinicConfirmBtn.style.display = 'none';
    finalLoginBtn.style.display = 'none';
    clinicDropdown.style.display = 'none';
  };

  resetTabs();

  if (tab === 'login') {
    loginContent.style.display = 'block';
    loginTab.style.background = 'var(--primary)';
    loginTab.style.color = 'white';
    // 병원명 입력 여부에 따라 확인 또는 로그인 버튼 표시
    const clinicNameInput = document.getElementById('clinicName');
    if (clinicNameInput && clinicNameInput.value.trim()) {
      clinicConfirmBtn.style.display = 'block';
      finalLoginBtn.style.display = 'none';
    } else {
      clinicConfirmBtn.style.display = 'block'; // 항상 확인 버튼 표시
      finalLoginBtn.style.display = 'none';
    }
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
// 주의: let 사용 금지! var 필수 (window 객체 attach)
var allClinics = [];

// 초기화: window에 직접 할당 (let/var 호환성)
window.allClinics = [];

async function loadClinicsList() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/clinics`);
    if (!res.ok) return;
    const data = await res.json();

    // window 객체에 직접 할당 (로컬 변수 대신)
    window.allClinics = data.clinics || [];
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
    <div style="padding:12px 16px; border-bottom:1px solid var(--gray-100); cursor:pointer; transition:background 0.2s;"
         onmouseover="this.style.background='var(--gray-50)'"
         onmouseout="this.style.background='transparent'"
         onclick="setClinicName('${c.name.replace(/'/g, "\\'")}')">
      <div style="font-weight:500; color:var(--text-primary); margin-bottom:4px;">${c.name}</div>
      <div style="font-size:0.75rem; color:var(--text-tertiary);">${c.director_name || ''} ${c.director_name && c.region ? '·' : ''} ${c.region || ''}</div>
    </div>
  `).join('');
  dropdown.style.display = 'block';
}

function setClinicName(name) {
  document.getElementById('clinicName').value = name;
  document.getElementById('clinicDropdown').style.display = 'none';
}

// 병원명 입력 이벤트 리스너 등록 함수
function registerClinicInputListeners() {
  const clinicInput = document.getElementById('clinicName');
  const searchBtn = document.getElementById('clinicSearchBtn');

  console.log('[registerClinicInputListeners] 병원명 입력 이벤트 등록');

  if (clinicInput) {
    clinicInput.addEventListener('input', (e) => {
      console.log('[clinicInput] input 이벤트:', e.target.value);
      const clinics = filterClinicsList(e.target.value);
      showClinicDropdown(clinics);
    });

    clinicInput.addEventListener('focus', (e) => {
      console.log('[clinicInput] focus 이벤트');
      if (e.target.value) {
        const clinics = filterClinicsList(e.target.value);
        showClinicDropdown(clinics);
      }
    });
  } else {
    console.warn('[registerClinicInputListeners] clinicName 요소 없음');
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('[clinicSearchBtn] click 이벤트');
      const clinicInput = document.getElementById('clinicName');
      const clinics = filterClinicsList(clinicInput.value || '');
      showClinicDropdown(clinics);
    });
  }
}

// DOMContentLoaded 또는 즉시 실행 (이미 발생한 경우 대비)
function initClinicInputs() {
  console.log('[initClinicInputs] 실행. readyState:', document.readyState);
  console.log('[initClinicInputs] loadClinicsList 호출 중...');
  loadClinicsList().then(() => {
    console.log('[initClinicInputs] ✅ loadClinicsList 완료, allClinics:', allClinics.length, '개');
  }).catch(err => {
    console.error('[initClinicInputs] ❌ loadClinicsList 에러:', err);
  });
  registerClinicInputListeners();
}

if (document.readyState === 'loading') {
  console.log('[clinic-input-init] DOMContentLoaded 대기');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[clinic-input-init] DOMContentLoaded 발생 → 초기화 시작');
    initClinicInputs();
  });
} else {
  console.log('[clinic-input-init] DOMContentLoaded 이미 발생 → 즉시 실행');
  initClinicInputs();
}

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
    const loginUrl = `${API_BASE_URL}/api/login`;
    console.log('📡 API 호출:', { url: loginUrl, baseUrl: API_BASE_URL });
    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicName: clinic, email, password: pwd })
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('[submitClinicLogin] ❌ API 에러:', {
        status: res.status,
        error: err.error,
        debug: err.debug,
        fullResponse: err
      });
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

    // [진단 로깅] 세션 저장 확인
    const savedSession = Session.get();
    console.log('[submitClinicLogin] ✅ 세션 저장 완료:', {
      saved_clinic_id: savedSession?.clinic_id,
      requested_clinic_id: user.clinic_id,
      match: savedSession?.clinic_id === user.clinic_id,
      localStorage_key: 'dops_' + Session.KEY,
      localStorage_value: localStorage.getItem('dops_' + Session.KEY) ? '있음' : '없음'
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

// 병원명 확인 후 로그인 폼으로 진행
function confirmClinicAndProceed() {
  const clinicName = (document.getElementById('clinicName')?.value || '').trim();

  if (!clinicName) {
    showToast('병원명을 입력하세요', 'warning');
    return;
  }

  // 확인 버튼 숨기고 최종 로그인 버튼 표시
  const clinicConfirmBtn = document.getElementById('clinicConfirmBtn');
  const finalLoginBtn = document.getElementById('finalLoginBtn');
  if (clinicConfirmBtn) clinicConfirmBtn.style.display = 'none';
  if (finalLoginBtn) finalLoginBtn.style.display = 'block';

  // 드롭다운 닫기
  const clinicDropdown = document.getElementById('clinicDropdown');
  if (clinicDropdown) clinicDropdown.style.display = 'none';

  // 이메일 입력 필드로 포커스 이동
  setTimeout(() => {
    const emailInput = document.getElementById('loginEmail');
    if (emailInput) emailInput.focus();
  }, 100);

  console.log('[confirmClinicAndProceed] ✅ 병원명 확인:', clinicName);
}

// 병원 회원가입
async function submitClinicRegister() {
  const clinic = (document.getElementById('signupClinicName')?.value || '').trim();
  const director = (document.getElementById('signupDirector')?.value || '').trim();
  const email = (document.getElementById('signupEmail')?.value || '').trim();
  const phone = (document.getElementById('signupPhone')?.value || '').trim();
  const region = (document.getElementById('signupRegion')?.value || '').trim();
  const pwd = [1,2,3,4,5,6].map(i => document.getElementById(`signupPwd${i}`)?.value || '').join('');

  if (!clinic || !director || !email || !phone || !region || pwd.length !== 6) {
    showToast('모든 필드를 입력하세요', 'warning');
    return;
  }

  if (!/^\d{6}$/.test(pwd)) {
    showToast('비밀번호는 숫자 6자리입니다', 'warning');
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('유효한 이메일 주소를 입력하세요', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/clinic-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicName: clinic,
        directorName: director,
        directorEmail: email,
        directorPhone: phone,
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

