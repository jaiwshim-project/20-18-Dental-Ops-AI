# Medvo SEO 등록 가이드

## 📋 개요
Medvo 플랫폼을 네이버(Naver)와 구글(Google) 검색 엔진에 등록하여 검색 가시성을 극대화합니다.

**현재 배포 URL**: 
- `https://medvo.vercel.app/` (Vercel 기본 도메인)
- `https://medvo.vercel.app/dashboard.html` (KPI 대시보드)

---

## 1️⃣ Google Search Console 등록

### 단계 1: Search Console 접속
1. https://search.google.com/search-console 방문
2. 구글 계정으로 로그인

### 단계 2: 속성 추가
1. **+ 속성 만들기** 클릭
2. **URL 접두사** 선택: `https://medvo.vercel.app/`
3. **계속** 클릭

### 단계 3: 소유권 확인 (3가지 방법)
#### 방법 1️⃣: HTML 파일 업로드 (추천)
1. 제공된 HTML 파일 다운로드
2. 프로젝트의 `public/` 디렉토리에 업로드
3. **확인** 클릭

```bash
# 배포 후 확인 (Vercel에 자동으로 배포됨)
curl https://medvo.vercel.app/google<verification-code>.html
```

#### 방법 2️⃣: DNS 레코드 (도메인 구매 후)
1. DNS 제공자(GoDaddy, AWS Route 53 등) 접속
2. TXT 레코드 추가: `google-site-verification=...`
3. DNS 전파 대기 (최대 48시간)

#### 방법 3️⃣: Google Analytics 연결
- 기존 GA 계정이 있으면 자동 확인 가능

### 단계 4: Sitemap 제출
1. Search Console > **Sitemap** 섹션
2. **새 Sitemap 추가** 클릭
3. `https://medvo.vercel.app/sitemap.xml` 입력
4. **제출** 클릭

### 단계 5: 색인 요청
1. **URL 검사** 도구 사용
2. 각 주요 페이지 URL 입력
3. **인덱싱 요청** 클릭

**주요 페이지:**
- `https://medvo.vercel.app/`
- `https://medvo.vercel.app/dashboard.html`
- `https://medvo.vercel.app/consult.html`
- `https://medvo.vercel.app/manual.html`

---

## 2️⃣ Naver Search Advisor 등록

### 단계 1: Naver Search Advisor 접속
1. https://searchadvisor.naver.com 방문
2. 네이버 계정으로 로그인 (아이디 필요)

### 단계 2: 웹마스터 도구 > 사이트 추가
1. **사이트 추가** 클릭
2. URL 입력: `https://medvo.vercel.app/`
3. **추가** 클릭

### 단계 3: 소유권 확인
1. **HTML 파일 업로드** 또는 **HTML 태그 추가** 선택
2. HTML 파일을 `public/` 디렉토리에 업로드하거나
3. `index.html`의 `<head>`에 meta 태그 추가

```html
<!-- Naver 메타 태그 (이미 추가됨) -->
<meta name="naver-site-verification" content="[verification-code]" />
```

### 단계 4: RSS/Sitemap 제출
1. **요청** 탭 > **사이트맵 제출**
2. `https://medvo.vercel.app/sitemap.xml` 입력
3. **제출** 클릭

### 단계 5: 로봇 수집 요청
1. **요청** 탭 > **URL 수집 요청**
2. 주요 페이지 URL 입력:
   ```
   https://medvo.vercel.app/
   https://medvo.vercel.app/dashboard.html
   https://medvo.vercel.app/consult.html
   https://medvo.vercel.app/manual.html
   ```

---

## 3️⃣ 배포 체크리스트

### 배포 전 ✅
- [ ] `public/robots.txt` 생성됨
- [ ] `public/sitemap.xml` 생성됨
- [ ] `index.html` 메타 태그 추가됨
- [ ] 모든 주요 페이지에 SEO 메타 태그 추가됨
- [ ] OpenGraph(og:) 태그 추가됨
- [ ] Canonical URL 설정됨

### 배포 후 ✅
```bash
# 파일 접근성 확인
curl -i https://medvo.vercel.app/robots.txt
curl -i https://medvo.vercel.app/sitemap.xml
curl -i https://medvo.vercel.app/index.html
```

---

## 4️⃣ SEO 최적화 체크리스트

### 메타 태그 ✅
- [x] Title 태그 (60자 이내)
- [x] Meta Description (160자 이내)
- [x] Meta Keywords
- [x] Canonical URL
- [x] OpenGraph 태그 (og:title, og:description, og:image, og:url)
- [x] Twitter Card 태그

### 페이지별 최적화 ✅
| 페이지 | URL | 상태 |
|--------|-----|------|
| 홈페이지 | `/` | ✅ |
| KPI 대시보드 | `/dashboard.html` | ✅ |
| 상담AI코치 | `/consult.html` | ✅ |
| 사용 매뉴얼 | `/manual.html` | ✅ |
| 브랜드 스토리 | `/brand-story.html` | ✅ |
| 병원 관리 | `/clinic-dashboard.html` | ✅ (noindex) |
| 교육 훈련 | `/training.html` | ✅ |

### 구조화된 데이터 (Schema.org)
```html
<!-- 향후 추가 예정 -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Medvo",
  "description": "의료 상담을 AI로 구조화하여 매출로 연결시키는 전환 엔진",
  "url": "https://medvo.vercel.app/",
  "category": "Healthcare"
}
</script>
```

---

## 5️⃣ 모니터링 및 유지보수

### Google Search Console
- **성능**: 검색 쿼리, 클릭, 노출, CTR 모니터링
- **색인 상태**: 색인된 페이지 수 확인
- **오류**: 크롤 오류, 모바일 사용성 이슈 확인

### Naver Search Advisor
- **로봇 수집 현황**: 수집된 페이지 수, 크롤 통계
- **색인 상태**: 네이버 검색 색인 현황
- **검색어 분석**: 검색 트래픽 모니터링

### 정기 작업 (월 1회)
- [ ] 새 페이지 추가 시 Sitemap 업데이트
- [ ] 페이지 수정 시 `<lastmod>` 업데이트
- [ ] Search Console 메시지 확인
- [ ] 크롤 오류 해결

---

## 6️⃣ 도메인 구매 후 추가 작업

현재는 `medvo.vercel.app`을 사용하지만, 향후 도메인 구매 시:

### 1. 도메인 구매
- GoDaddy, AWS Route 53, 메인도메인 등에서 구매
- 예: `medvo.kr`, `medvo.io` 등

### 2. DNS 설정
```
# Vercel DNS Records
Type: A | Value: 76.76.19.165
Type: CNAME | Value: cname.vercel-dns.com
```

### 3. Vercel 도메인 연결
1. Vercel 대시보드 > Project Settings > Domains
2. 도메인 추가
3. DNS 레코드 설정 (자동 또는 수동)

### 4. Search Console 재등록
- 새 도메인으로 속성 추가
- URL 변경 도구로 마이그레이션
- 301 리다이렉트 설정

```javascript
// vercel.json (301 리다이렉트 설정)
{
  "redirects": [
    {
      "source": "/",
      "destination": "https://medvo.kr/",
      "permanent": true
    }
  ]
}
```

---

## 📞 문제 해결

### Q: Sitemap이 제출되지 않음
**A**: 다음을 확인하세요:
- [ ] `https://medvo.vercel.app/sitemap.xml` 직접 접속 가능?
- [ ] XML 형식이 올바른가?
- [ ] 최대 50,000개 URL 초과?

### Q: 페이지가 색인되지 않음
**A**: Search Console의 **URL 검사** 도구에서:
- [ ] 크롤링 차단 확인
- [ ] Robots.txt 확인
- [ ] Meta robots 태그 확인 (`noindex` 확인)

### Q: 한글이 깨짐
**A**: 메타 태그의 charset 확인:
```html
<meta charset="UTF-8">
```

---

## 📈 예상 효과

**1개월 후:**
- Google: 50~100개 페이지 색인
- Naver: 30~50개 페이지 색인

**3개월 후:**
- 검색 트래픽 증가 (월 500~1,000 세션)
- 주요 키워드 순위 진입

**6개월 후:**
- 브랜드 인지도 증가
- 자연 검색 트래픽 안정화

---

**최종 업데이트**: 2026-05-15
**담당자**: Medvo Tech Team
