/* ============================================================
   Dental Ops AI — Supabase Client
   ============================================================ */

const SupabaseDB = {
  client: null,
  bucket: 'dental-ops',

  // 기본 설정 (프로젝트 전용 — 운영 시 교체)
  DEFAULT_URL: '',
  DEFAULT_KEY: '',

  init() {
    let url = Store.get('supabase_url', '') || this.DEFAULT_URL;
    let key = Store.get('supabase_key', '') || this.DEFAULT_KEY;
    if (!url || !key) return false;
    if (typeof supabase === 'undefined') return false;
    this.client = supabase.createClient(url, key);
    if (!Store.get('supabase_url', '')) {
      Store.set('supabase_url', url);
      Store.set('supabase_key', key);
    }
    return true;
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
};

document.addEventListener('DOMContentLoaded', () => {
  if (typeof supabase !== 'undefined') SupabaseDB.init();
});
