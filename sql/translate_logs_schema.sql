-- translate_logs 테이블 생성
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS translate_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID        REFERENCES clinics(id) ON DELETE SET NULL,
  patient_lang TEXT       NOT NULL,
  staff_lang  TEXT        NOT NULL,
  messages    JSONB       NOT NULL DEFAULT '[]',
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 병원별 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_translate_logs_clinic_id ON translate_logs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_translate_logs_created_at ON translate_logs(created_at DESC);

-- RLS 비활성화 (service role key로 접근)
ALTER TABLE translate_logs DISABLE ROW LEVEL SECURITY;
