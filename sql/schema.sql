-- ============================================================
-- Dental Ops AI — Supabase Database Schema
-- 치과 상담·진단·운영 AI 플랫폼
-- Supabase SQL Editor에서 실행
-- ============================================================

-- 0. 사용자 (Users) — 로그인 시 email 기준 upsert
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  clinic TEXT,
  role TEXT,
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. 환자 (Patients)
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  age INTEGER,
  gender TEXT CHECK (gender IN ('남', '여')),
  treatment TEXT,
  status TEXT DEFAULT '상담대기' CHECK (status IN ('상담대기', '상담중', '계약완료', '치료중', '치료완료', '이탈')),
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 상담 로그 (8개 엔진 통합)
CREATE TABLE IF NOT EXISTS consult_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  engine TEXT NOT NULL CHECK (engine IN ('consult', 'conversion', 'automation', 'training', 'insight', 'ontology', 'ceo', 'kpi')),
  input TEXT,
  output TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 전환 (Conversions)
CREATE TABLE IF NOT EXISTS conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  treatment_type TEXT,
  estimate INTEGER DEFAULT 0,
  probability INTEGER DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  strategy TEXT,
  status TEXT DEFAULT '상담중' CHECK (status IN ('상담중', '계약완료', '이탈', '치료중', '치료완료', '취소')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 자동화 실행 이력
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB,
  status TEXT DEFAULT 'sent' CHECK (status IN ('scheduled', 'sent', 'delivered', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 교육 평가 결과
CREATE TABLE IF NOT EXISTS training_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  user_name TEXT,
  scenario TEXT,
  score INTEGER DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  feedback TEXT,
  detail JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 인사이트 리포트
CREATE TABLE IF NOT EXISTS insight_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  summary TEXT,
  findings JSONB,
  strategy TEXT,
  author TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. KPI 스냅샷 (일/주/월)
CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT CHECK (period IN ('daily', 'weekly', 'monthly')),
  snapshot_date DATE,
  conversion_rate NUMERIC(5,2),
  avg_consult_min NUMERIC(5,2),
  revisit_rate NUMERIC(5,2),
  ai_usage_rate NUMERIC(5,2),
  revenue BIGINT,
  patient_count INTEGER,
  contract_count INTEGER,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 온톨로지 구조 (Role / Process / Decision)
CREATE TABLE IF NOT EXISTS ontology_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type TEXT CHECK (node_type IN ('role', 'process', 'decision', 'patient_flow')),
  name TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ontology_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id UUID REFERENCES ontology_nodes(id) ON DELETE CASCADE,
  to_id UUID REFERENCES ontology_nodes(id) ON DELETE CASCADE,
  relation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 인덱스
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);
CREATE INDEX IF NOT EXISTS idx_consult_logs_patient ON consult_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_consult_logs_engine ON consult_logs(engine);
CREATE INDEX IF NOT EXISTS idx_consult_logs_created ON consult_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversions_patient ON conversions(patient_id);
CREATE INDEX IF NOT EXISTS idx_automations_patient ON automations(patient_id);
CREATE INDEX IF NOT EXISTS idx_training_user ON training_results(user_id);
CREATE INDEX IF NOT EXISTS idx_kpi_date ON kpi_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================
-- updated_at 자동 갱신 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER conversions_updated_at
  BEFORE UPDATE ON conversions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Storage 버킷 (Supabase Dashboard > Storage에서 생성)
-- 버킷명: dental-ops (Public)
-- ============================================================

-- RLS (필요시 활성화)
-- ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE consult_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;
