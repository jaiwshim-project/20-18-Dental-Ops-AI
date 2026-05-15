# 🚀 배포 가이드

## 현재 상태
- ✅ GitHub 동기화: 완료
  - origin/main: 0cd091d (최신)
  - medvo/upload: 0cd091d (최신)
- ✅ Supabase 마이그레이션: 완료
  - translate_logs 테이블 생성됨
- ⏳ Vercel 배포: 준비 중

## 배포 브랜치

| 브랜치 | 저장소 | 배포 환경 | 상태 |
|------|-------|---------|------|
| main | 20-18-Dental-Ops-AI | Production | ✅ 준비됨 |
| upload | 20-18-MedVo | Preview/Staging | ✅ 준비됨 |

## 배포 방식

### 1️⃣ 자동 배포 (권장)
Vercel이 GitHub과 연동되어 있으면, push 시 자동 배포됨:
- main → Production 배포
- upload → Preview 배포

### 2️⃣ Vercel 대시보드에서 수동 배포
🔗 https://vercel.com/dashboard

**각 프로젝트에서:**
1. Deployments 탭 확인
2. 최신 커밋 배포 상태 확인
3. 필요시 "Redeploy" 클릭

### 3️⃣ Vercel CLI로 배포
```bash
npm install -g vercel
vercel deploy
```

## 배포 후 확인

### ✓ Production 배포 (20-18-Dental-Ops-AI)
- URL: https://20-18-dental-ops-ai.vercel.app (또는 커스텀 도메인)

### ✓ Staging 배포 (20-18-MedVo upload)
- URL: vercel.com 대시보드에서 확인

## 🔍 배포 체크리스트

- [ ] GitHub 최신 커밋 확인
- [ ] Supabase 마이그레이션 상태 확인
- [ ] Vercel 빌드 로그 확인
- [ ] 환경 변수 설정 확인 (SUPABASE_*, API_KEY 등)
- [ ] 프로덕션 사이트 접속 테스트
- [ ] 데이터베이스 연동 테스트

