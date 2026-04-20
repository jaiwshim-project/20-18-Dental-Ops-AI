-- ============================================================
-- Step B — SaaS 운영 필수 스키마
-- 실행 위치: Supabase Dashboard → SQL Editor → New Query
-- URL: https://supabase.com/dashboard/project/grgppaammbccuddwthfo/sql/new
-- ============================================================

-- 1. users 테이블 확장 (요금제 등급 + 관리자 플래그)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'max')),
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 2. api_call_logs 테이블 (과금 추적 + Rate Limit 집계 기준)
CREATE TABLE IF NOT EXISTS api_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email TEXT,
  clinic TEXT,
  endpoint TEXT NOT NULL DEFAULT 'gemini',
  model TEXT,
  prompt_chars INT,
  response_chars INT,
  status_code INT,
  latency_ms INT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 인덱스 (월별 사용량 COUNT 최적화)
CREATE INDEX IF NOT EXISTS idx_api_call_logs_user_id ON api_call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_created_at ON api_call_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_user_month ON api_call_logs(user_id, created_at DESC);

-- 4. RLS 정책 (데모 단계: anon_full, 정식 운영 시 서비스 role만 INSERT로 교체)
ALTER TABLE api_call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_full_api_call_logs" ON api_call_logs;
CREATE POLICY "anon_full_api_call_logs" ON api_call_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. 본사 관리자 계정 지정 (심재우 → admin + max)
UPDATE users
  SET is_admin = true, tier = 'max'
  WHERE email = 'jaiwshim@gmail.com';

-- 6. 결과 확인
SELECT email, name, clinic, role, tier, is_admin, created_at
FROM users
ORDER BY created_at DESC;
