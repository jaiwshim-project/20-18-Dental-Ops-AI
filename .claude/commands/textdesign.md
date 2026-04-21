---
description: "프리미엄 컬러 자동 설계 — 모든 페이지·섹션·카드·테두리·배경색을 프리미엄 컬러 팔레트로 일괄 수정"
user-invocable: true
---

# /textdesign — 프리미엄 컬러 설계 시스템

프로젝트의 **모든 페이지, 섹션, 카드, 테두리, 배경색**을 분석하고,
**프리미엄 컬러 팔레트**를 자동으로 설계·적용하여 시각적 일관성과 고급스러움을 극대화한다.

---

## 개요

```
🎨 프리미엄 컬러 설계 자동화
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1] 프로젝트 스캔
    ├─ HTML 파일 (배경색, 테두리)
    ├─ CSS 파일 (색상 정의)
    └─ 인라인 스타일 (직접 지정)
        ↓
[2] 현황 분석
    ├─ 사용 중인 색상 {N}종
    ├─ 컬러 불일치 {N}건
    └─ 시각적 위계 부재
        ↓
[3] 프리미엄 팔레트 설계
    ├─ Primary / Secondary / Tertiary
    ├─ 배경색 계층 (Surface / Background)
    ├─ 테두리 색상 (Border / Divider)
    └─ Semantic (Success / Warning / Error)
        ↓
[4] 자동 적용
    ├─ CSS 변수 선언 생성/업데이트
    ├─ 하드코딩 색상 → CSS 변수로 치환
    ├─ 배경·테두리·텍스트 색상 통일
    └─ WCAG AA 대비율 검증
        ↓
[5] 결과 검증
    ├─ 시각적 일관성 100%
    ├─ WCAG AA 준수율
    └─ 프리미엄 느낌 극대화
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 프리미엄 컬러 팔레트 (현재 적용 상태)

### 배경색 계층 (5단계)

| 레벨 | 용도 | CSS 변수 | 색상값 |
|------|------|---------|--------|
| **L0 Base** | 페이지 배경 | `--bg-base` | `#FFFFFF` |
| **L1 Surface** | 카드, 패널, 섹션 | `--bg-surface` | `#FAFAFA` |
| **L2 Secondary** | 호버, 선택, 강조 영역 | `--bg-secondary` | `#F3F4F6` |
| **L3 Tertiary** | 테이블 행, 리스트 항목 | `--bg-tertiary` | `#E5E7EB` |
| **L4 Overlay** | 모달 오버레이, 팝업 | `--bg-overlay` | `rgba(0,0,0,0.5)` |

### 테두리 색상 (3단계)

| 레벨 | CSS 변수 | 색상값 | 용례 |
|------|---------|--------|------|
| **Primary** | `--border` | `#D1D5DB` | 기본 테두리, input |
| **Light** | `--border-light` | `#E5E7EB` | 약한 구분, divider |
| **Accent** | `--border-accent` | `--primary` | 활성, 포커스 |

---

## 사용 방법

### 기본 실행 (프로젝트 자동 스캔)

```bash
/textdesign
```

자동으로:
- 모든 HTML 파일 스캔
- CSS 파일 분석
- 배경색 & 테두리 CSS 변수로 치환
- 결과 검증

### 옵션

| 옵션 | 설명 | 예시 |
|------|------|------|
| `--analyze-only` | 분석만 수행 (수정 안 함) | `/textdesign --analyze-only` |
| `--palette=warm` | 따뜻한 톤 팔레트 | `/textdesign --palette=warm` |
| `--palette=cool` | 차분한 톤 팔레트 | `/textdesign --palette=cool` |
| `--dark-mode` | 다크 모드 팔레트도 생성 | `/textdesign --dark-mode` |
| `--wcag=AAA` | AAA 기준 검증 (기본: AA) | `/textdesign --wcag=AAA` |
| `--file=path` | 특정 파일만 수정 | `/textdesign --file=consult.html` |

---

## 팔레트 옵션

### Neutral (기본 - 현재 적용됨)
```
배경: #FFFFFF → #FAFAFA → #F3F4F6 → #E5E7EB
테두리: #D1D5DB
분위기: 깔끔, 모던, 프로페셔널 ✨
```

### Warm (따뜻한 톤)
```
배경: #FEFAF5 → #FAF5F0 → #F5EFEA → #E8DED6
테두리: #D4BFB0
분위기: 따뜻, 자연, 프리미엄
```

### Cool (차분한 톤)
```
배경: #F8FAFC → #F1F5F9 → #E2E8F0 → #CBD5E1
테두리: #A1AAC3
분위기: 차분, 전문적, 고급
```

---

## CSS 변수 위치

- 파일: `css/common.css`
- 섹션: `:root { ... /* 🎨 Premium Background Hierarchy */ }`

모든 배경색과 테두리는 이 변수들로 관리되므로,
색상 변경이 필요하면 `css/common.css`의 한 곳에서만 수정하면 됩니다.

---

## 적용 현황

✅ **현재 적용된 파일** (15개 페이지)
- index.html (홈/렌딩)
- consult.html (상담 AI)
- conversion.html (전환 전략)
- automation.html (자동화)
- patients.html (환자 관리)
- dashboard.html (KPI 대시보드)
- training.html (교육/훈련)
- insight.html (인사이트)
- admin.html (관리자)
- admin-dashboard.html (관리자 대시보드)
- review.html (상담 리뷰)
- consult_review_tab.html (리뷰 탭)
- consult_review_wide.html (리뷰 와이드)
- architecture.html (아키텍처)
- manual.html (사용 매뉴얼)

---

## 주의사항

### ✅ 자동으로 처리
- CSS 변수 선언 생성/업데이트
- 하드코딩 색상 → 변수로 치환
- WCAG 대비율 검증 및 보정
- 배경/테두리/텍스트 색상 통일

### ⚠️ 수동 검토 필요
- 커스텀 브랜드 색상 (유지 필요 시)
- 이미지 배경색 (투명도 고려)
- 특수 효과 (그래디언트, 그림자 등)

---

## 결과

| 항목 | 수정 전 | 수정 후 |
|------|--------|--------|
| **컬러 일관성** | 색상 10+ 종 난립 | CSS 변수 5단계 체계 |
| **배경색 계층** | 3~4종 랜덤 | Surface 1/2/3 명확한 계층 |
| **테두리 색상** | 5+ 종 혼재 | Border / Border-Light 2종 통일 |
| **WCAG 준수** | 미달 있음 | 100% AA 이상 ✅ |
| **유지보수성** | 하드코딩 색상 추적 어려움 | CSS 변수로 중앙 관리 |
| **프리미엄 느낌** | 부족 | ⭐⭐⭐⭐⭐ |
