# Supabase 환경 설정 가이드

## 🔗 프로젝트 정보
- **Supabase Project**: grgppaammbccuddwthfo
- **Project URL**: https://grgppaammbccuddwthfo.supabase.co
- **Database**: PostgreSQL (Supabase)

## 📋 각 컴퓨터에서의 설정 방법

### 1️⃣ .env.local 파일 생성
```bash
cp .env.example .env.local
```

### 2️⃣ .env.local에 실제 키 입력
```
SUPABASE_ANON_KEY=your_actual_key
SUPABASE_SERVICE_ROLE_KEY=your_actual_key
```

### 3️⃣ Supabase CLI 로그인
```bash
supabase login
# 브라우저에서 인증 후 진행
```

### 4️⃣ Supabase 프로젝트 연결
```bash
supabase link --project-ref grgppaammbccuddwthfo
```

### 5️⃣ 마이그레이션 상태 확인
```bash
supabase migration list
supabase db status
```

## 🔄 자동 배포 프로세스

| 작업 | 처리 방식 |
|------|---------|
| GitHub push | ✅ 자동 (GitHub의 upload 브랜치) |
| SQL 마이그레이션 | ✅ 자동 (Supabase가 감지) |
| 로컬 개발 테스트 | 📌 각 컴퓨터의 .env.local 필수 |

## 🐛 문제 해결

### "Cannot find project ref" 에러
```bash
supabase link --project-ref grgppaammbccuddwthfo
```

### 환경 변수 인식 안 됨
- .env.local이 최상위 디렉토리에 있는지 확인
- 터미널/IDE 재시작 후 테스트

### 마이그레이션이 자동 실행 안 됨
- GitHub의 sql/ 폴더에 파일이 있는지 확인
- Supabase 대시보드 > Migrations 탭에서 수동 실행 가능

## 📱 컴퓨터 간 일관성 유지
✅ Git으로 추적: `sql/`, `supabase.json`
❌ Git 제외: `.env.local`, `.env` (각 컴퓨터별 다름)

