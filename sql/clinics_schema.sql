-- ============================================================
-- Clinics Table — 병원 단위 SaaS 관리
-- ============================================================

CREATE TABLE IF NOT EXISTS clinics (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT UNIQUE NOT NULL,
  director_name TEXT NOT NULL,
  region        TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  tier          TEXT DEFAULT 'free' CHECK (tier IN ('free','pro','max')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Users 테이블 확장
ALTER TABLE users ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_clinics_name ON clinics(name);
CREATE INDEX IF NOT EXISTS idx_users_clinic_id ON users(clinic_id);
