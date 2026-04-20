/* ============================================================
   Dental Ops AI — Supabase Client
   ============================================================ */

const SupabaseDB = {
  client: null,
  bucket: 'dental-ops',

  // 초기화: localStorage 우선, 없으면 /api/config (서버 환경변수)에서 공급.
  // 하드코딩 키 제거됨.
  init() {
    if (typeof supabase === 'undefined') return false;
    const url = Store.get('supabase_url', '');
    const key = Store.get('supabase_key', '');
    if (url && key) {
      this.client = supabase.createClient(url, key);
      return true;
    }
    this.initAsync();
    return false;
  },

  async initAsync() {
    if (typeof supabase === 'undefined') return false;
    try {
      const r = await fetch('/api/config');
      if (!r.ok) return false;
      const c = await r.json();
      if (c.supabase_url && c.supabase_anon_key) {
        Store.set('supabase_url', c.supabase_url);
        Store.set('supabase_key', c.supabase_anon_key);
        this.client = supabase.createClient(c.supabase_url, c.supabase_anon_key);
        if (typeof updateSidebarDbState === 'function') updateSidebarDbState();
        return true;
      }
    } catch (e) { console.warn('/api/config 로드 실패', e); }
    return false;
  },

  isReady() { return !!this.client; },

  setConfig(url, key) {
    Store.set('supabase_url', url);
    Store.set('supabase_key', key);
    this.client = supabase.createClient(url, key);
  },

  getConfig() {
    return { url: Store.get('supabase_url', ''), key: Store.get('supabase_key', '') };
  },

  // ============================================================
  // 사용자 (Users) — email upsert
  // ============================================================
  async upsertUser({ email, name, clinic = '', role = 'staff' }) {
    if (!this.client) throw new Error('Supabase 미연결');
    if (!email) throw new Error('email 필요');
    // 이메일로 찾기
    const { data: existing, error: findErr } = await this.client
      .from('users').select('id').eq('email', email).maybeSingle();
    if (findErr) throw findErr;
    const payload = { email, name, clinic, role, last_login_at: new Date().toISOString() };
    if (existing) {
      const { data, error } = await this.client.from('users')
        .update(payload).eq('id', existing.id).select().single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await this.client.from('users')
      .insert([payload]).select().single();
    if (error) throw error;
    return data;
  },

  async getUserByEmail(email) {
    if (!this.client) throw new Error('Supabase 미연결');
    const { data, error } = await this.client.from('users')
      .select('*').eq('email', email).maybeSingle();
    if (error) throw error;
    return data;
  },

  // ============================================================
  // 회원 관리 (SaaS 본사 전용 — Step B)
  // ============================================================
  async listUsers() {
    if (!this.client) throw new Error('Supabase 미연결');
    const { data, error } = await this.client.from('users')
      .select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async updateUserTier(userId, tier) {
    if (!this.client) throw new Error('Supabase 미연결');
    const { data, error } = await this.client.from('users')
      .update({ tier }).eq('id', userId).select().single();
    if (error) throw error;
    return data;
  },

  async getAllMonthlyUsage() {
    if (!this.client) throw new Error('Supabase 미연결');
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { data, error } = await this.client.from('api_call_logs')
      .select('user_id').gte('created_at', monthStart.toISOString());
    if (error) throw error;
    const counts = {};
    (data || []).forEach(row => {
      if (row.user_id) counts[row.user_id] = (counts[row.user_id] || 0) + 1;
    });
    return counts;
  },

  // ============================================================
  // 환자 (Patients)
  // ============================================================
  async createPatient({ name, phone, age, gender, treatment, memo }) {
    if (!this.client) throw new Error('Supabase 미연결');
    const { data, error } = await this.client
      .from('patients')
      .insert([{ name, phone, age: age || null, gender: gender || null, treatment: treatment || null, memo: memo || null, status: '상담대기' }])
      .select().single();
    if (error) throw error;
    return data;
  },

  async getPatients({ search, status, limit = 100 } = {}) {
    if (!this.client) throw new Error('Supabase 미연결');
    let query = this.client.from('patients').select('*').order('created_at', { ascending: false }).limit(limit);
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getPatient(id) {
    if (!this.client) throw new Error('Supabase 미연결');
    const { data, error } = await this.client
      .from('patients').select('*, consult_logs(*), conversions(*)').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async updatePatient(id, updates) {
    if (!this.client) throw new Error('Supabase 미연결');
    const { data, error } = await this.client.from('patients').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deletePatient(id) {
    if (!this.client) throw new Error('Supabase 미연결');
    const { error } = await this.client.from('patients').delete().eq('id', id);
    if (error) throw error;
  },

  async getPatientCount() {
    if (!this.client) throw new Error('Supabase 미연결');
    const { count, error } = await this.client.from('patients').select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count;
  },

  // ============================================================
  // 상담 로그
  // ============================================================
  async saveConsultLog({ patientId, engine, input, output, metadata }) {
    if (!this.client) throw new Error('Supabase 미연결');
    const { data, error } = await this.client
      .from('consult_logs')
      .insert([{ patient_id: patientId || null, engine: engine || 'consult', input: input || '', output: output || '', metadata: metadata || null }])
      .select().single();
    if (error) throw error;
    return data;
  },

  async getConsultLogs({ patientId, engine, limit = 50 } = {}) {
    if (!this.client) throw new Error('Supabase 미연결');
    let query = this.client.from('consult_logs').select('*').order('created_at', { ascending: false }).limit(limit);
    if (patientId) query = query.eq('patient_id', patientId);
    if (engine) query = query.eq('engine', engine);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // consult_logs 중 session_id가 있는 세션 로그를 세션 객체로 어댑팅
  async getPatientSessions(patientId, limit = 20) {
    if (!this.client) throw new Error('Supabase 미연결');
    let query = this.client.from('consult_logs')
      .select('*')
      .eq('engine', 'consult')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (patientId) query = query.eq('patient_id', patientId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || [])
      // type='session' 세션 요약만 (coach_turn 중간 저장은 제외)
      .filter(row => row.metadata && row.metadata.session_id && (row.metadata.type === 'session' || !row.metadata.type))
      .map(row => ({
        id: row.metadata.session_id,
        row_id: row.id,
        patientId: row.patient_id,
        patientName: row.metadata.patient_name || '-',
        author: row.metadata.author || '-',
        clinic: row.metadata.clinic || '',
        startedAt: row.metadata.started_at,
        endedAt: row.metadata.ended_at,
        durationSec: row.metadata.duration_sec || 0,
        turns: row.metadata.turns || [],
        coachResults: (row.metadata.coach_snapshots || []).map(d => ({ data: d })),
        evaluation: row.metadata.evaluation || null
      }));
  },

  async getRecentSessions(limit = 20) {
    return this.getPatientSessions(null, limit);
  },

  // 환자별 세션 수 집계 — { patient_id: count } 반환
  async getPatientSessionCounts() {
    if (!this.client) throw new Error('Supabase 미연결');
    const { data, error } = await this.client.from('consult_logs')
      .select('patient_id, metadata')
      .eq('engine', 'consult');
    if (error) throw error;
    const counts = {};
    const lastDate = {}; // 최근 상담일 (epoch ms 통일)
    (data || []).forEach(r => {
      if (!r.patient_id) return;
      if (r.metadata?.type === 'session' || (r.metadata?.session_id && !r.metadata?.type)) {
        counts[r.patient_id] = (counts[r.patient_id] || 0) + 1;
        const raw = r.metadata?.ended_at || r.metadata?.started_at || r.created_at;
        if (raw != null) {
          // 숫자(ms) or ISO 문자열 → ms로 통일
          const ts = typeof raw === 'number' ? raw : new Date(raw).getTime();
          if (!isNaN(ts) && (!lastDate[r.patient_id] || ts > lastDate[r.patient_id])) {
            lastDate[r.patient_id] = ts;
          }
        }
      }
    });
    return { counts, lastDate };
  },

  // ============================================================
  // 전환 (Conversions)
  // ============================================================
  async saveConversion({ patientId, treatmentType, estimate, probability, strategy, status }) {
    if (!this.client) throw new Error('Supabase 미연결');
    const { data, error } = await this.client
      .from('conversions')
      .insert([{ patient_id: patientId, treatment_type: treatmentType || '', estimate: estimate || 0, probability: probability || 0, strategy: strategy || '', status: status || '상담중' }])
      .select().single();
    if (error) throw error;
    return data;
  },

  async updateConversion(id, updates) {
    if (!this.client) throw new Error('Supabase 미연결');
    const { data, error } = await this.client.from('conversions').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // ============================================================
  // 자동화 실행 이력
  // ============================================================
  async saveAutomation({ patientId, type, payload, status }) {
    if (!this.client) throw new Error('Supabase 미연결');
    const { data, error } = await this.client
      .from('automations')
      .insert([{ patient_id: patientId || null, type: type || '', payload: payload || null, status: status || 'sent' }])
      .select().single();
    if (error) throw error;
    return data;
  },

  // ============================================================
  // 교육 평가
  // ============================================================
  async saveTrainingResult({ userId, userName, scenario, score, feedback, detail }) {
    if (!this.client) throw new Error('Supabase 미연결');
    const { data, error } = await this.client
      .from('training_results')
      .insert([{ user_id: userId || null, user_name: userName || '', scenario: scenario || '', score: score || 0, feedback: feedback || '', detail: detail || null }])
      .select().single();
    if (error) throw error;
    return data;
  },

  async getTrainingResults({ userId, limit = 50 } = {}) {
    if (!this.client) throw new Error('Supabase 미연결');
    let query = this.client.from('training_results').select('*').order('created_at', { ascending: false }).limit(limit);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // ============================================================
  // 인사이트 리포트
  // ============================================================
  async saveInsightReport({ title, type, summary, findings, strategy, author }) {
    if (!this.client) throw new Error('Supabase 미연결');
    const { data, error } = await this.client
      .from('insight_reports')
      .insert([{ title, type: type || 'general', summary: summary || '', findings: findings || [], strategy: strategy || '', author: author || '' }])
      .select().single();
    if (error) throw error;
    return data;
  },

  async getInsightReports({ limit = 30 } = {}) {
    if (!this.client) throw new Error('Supabase 미연결');
    const { data, error } = await this.client.from('insight_reports').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  },

  // ============================================================
  // KPI 스냅샷
  // ============================================================
  async saveKPI(snapshot) {
    if (!this.client) throw new Error('Supabase 미연결');
    const { data, error } = await this.client.from('kpi_snapshots').insert([snapshot]).select().single();
    if (error) throw error;
    return data;
  },

  async getKPIs({ limit = 30 } = {}) {
    if (!this.client) throw new Error('Supabase 미연결');
    const { data, error } = await this.client.from('kpi_snapshots').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  },

  // 오늘 날짜 기준 일일 스냅샷 — 있으면 업데이트, 없으면 insert
  async upsertDailyKPI(snapshot) {
    if (!this.client) throw new Error('Supabase 미연결');
    const today = new Date().toISOString().split('T')[0];
    const period = snapshot.period || 'daily';
    const { data: existing } = await this.client.from('kpi_snapshots')
      .select('id').eq('period', period).eq('snapshot_date', today).maybeSingle();
    if (existing) {
      const { data, error } = await this.client.from('kpi_snapshots')
        .update({ ...snapshot, snapshot_date: today, period }).eq('id', existing.id).select().single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await this.client.from('kpi_snapshots')
      .insert([{ ...snapshot, snapshot_date: today, period }]).select().single();
    if (error) throw error;
    return data;
  },

  // ============================================================
  // 대시보드 통계
  // ============================================================
  async getDashboardStats() {
    if (!this.client) throw new Error('Supabase 미연결');
    const today = new Date().toISOString().split('T')[0];
    const [patientsRes, todayConsultsRes, convRes] = await Promise.all([
      this.client.from('patients').select('*', { count: 'exact', head: true }),
      this.client.from('consult_logs').select('*', { count: 'exact', head: true }).gte('created_at', today),
      this.client.from('conversions').select('status, estimate'),
    ]);
    const convs = convRes.data || [];
    const totalRevenue = convs.filter(c => c.status === '계약완료' || c.status === '치료완료').reduce((s, c) => s + (c.estimate || 0), 0);
    const contractCount = convs.filter(c => c.status === '계약완료').length;
    return {
      totalPatients: patientsRes.count || 0,
      todayConsults: todayConsultsRes.count || 0,
      totalRevenue,
      contractCount,
      conversionRate: convs.length > 0 ? Math.round(contractCount / convs.length * 100) : 0,
    };
  },

  // 대시보드용 종합 집계 — 7일 매출 추이·치료 믹스·퍼널·KPI 핵심 6개를 한 번에
  async getDashboardAggregates() {
    if (!this.client) throw new Error('Supabase 미연결');
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [patientsRes, consultLogsRes, convRes] = await Promise.all([
      this.client.from('patients').select('id, status, treatment, created_at'),
      this.client.from('consult_logs').select('engine, metadata, created_at').gte('created_at', weekAgo),
      this.client.from('conversions').select('status, estimate, treatment_type, created_at, updated_at').gte('updated_at', monthStart),
    ]);

    const patients = patientsRes.data || [];
    const allLogs = consultLogsRes.data || [];
    // 세션 요약(1 행/세션)만 집계 — coach_turn 중간 저장은 제외
    const logs = allLogs.filter(l => !l.metadata?.type || l.metadata.type === 'session');
    const convs = convRes.data || [];

    // === 환자 상태별 퍼널 ===
    const funnel = { '상담대기': 0, '상담중': 0, '계약완료': 0, '치료중': 0, '치료완료': 0, '이탈': 0 };
    patients.forEach(p => { if (funnel[p.status] != null) funnel[p.status]++; });

    // === 치료 믹스 (환자 기준) ===
    const treatmentMix = {};
    patients.forEach(p => { if (p.treatment) treatmentMix[p.treatment] = (treatmentMix[p.treatment] || 0) + 1; });

    // === 7일 매출 추이 (conversions) ===
    const dailyRevenue = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
      dailyRevenue[key] = { date: key, revenue: 0, patients: 0, consult: 0, contracts: 0 };
    }
    convs.forEach(c => {
      const d = new Date(c.updated_at || c.created_at);
      const key = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
      if (!dailyRevenue[key]) return;
      if (c.status === '계약완료' || c.status === '치료완료') {
        dailyRevenue[key].revenue += (c.estimate || 0);
        dailyRevenue[key].contracts += 1;
      }
    });
    logs.forEach(l => {
      const d = new Date(l.created_at);
      const key = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
      if (dailyRevenue[key]) dailyRevenue[key].consult += 1;
    });

    // === KPI 6종 ===
    const totalConsults = logs.length;
    const contractCount = convs.filter(c => c.status === '계약완료' || c.status === '치료완료').length;
    const conversionRate = convs.length ? Math.round(contractCount / convs.length * 100) : 0;
    const monthlyRevenue = convs.filter(c => c.status === '계약완료' || c.status === '치료완료')
      .reduce((s, c) => s + (c.estimate || 0), 0);
    // 평균 상담 시간 (분) — consult_logs의 metadata.duration_sec 기반
    const durations = logs
      .filter(l => l.engine === 'consult' && l.metadata && typeof l.metadata.duration_sec === 'number')
      .map(l => l.metadata.duration_sec);
    const avgConsultMin = durations.length
      ? Math.round((durations.reduce((s, x) => s + x, 0) / durations.length / 60) * 10) / 10
      : 0;
    // 재방문율 — 환자가 상태가 치료중 또는 치료완료면 재방문 가정
    const revisitCount = patients.filter(p => p.status === '치료중' || p.status === '치료완료').length;
    const revisitRate = patients.length ? Math.round(revisitCount / patients.length * 100) : 0;
    // AI 활용률 — consult_logs 중 coachResults가 있는 세션 비중
    const aiUsedCount = logs.filter(l => l.metadata && (l.metadata.coach_snapshots || l.metadata.evaluation)).length;
    const aiUsageRate = logs.length ? Math.round(aiUsedCount / logs.length * 100) : 0;
    // 오늘 상담
    const todayStr = now.toISOString().split('T')[0];
    const todayConsults = logs.filter(l => (l.created_at || '').startsWith(todayStr)).length;

    return {
      kpi: {
        conversionRate,
        avgConsultMin,
        revisitRate,
        aiUsageRate,
        monthlyRevenue,
        todayConsults,
        totalPatients: patients.length,
        totalConsults,
        contractCount
      },
      funnel,
      treatmentMix: Object.entries(treatmentMix).map(([name, value]) => ({ name, value })),
      dailyRevenue: Object.values(dailyRevenue)
    };
  },
};

document.addEventListener('DOMContentLoaded', () => {
  if (typeof supabase !== 'undefined') SupabaseDB.init();
});
