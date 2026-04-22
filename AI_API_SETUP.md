# 🤖 AI API 설정 가이드

치과 AI SaaS에서 **Gemini, Claude, Geo-AIO** 중 사용 가능한 AI를 자동으로 선택하여 사용합니다.

---

## 📋 지원되는 AI 모델

| 모델 | 공급사 | API 키 이름 | 우선순위 |
|------|--------|-----------|--------|
| **Gemini 2.0 Flash** | Google | `GEMINI_API_KEY` | 1 (최우선) |
| **Claude 3.5 Sonnet** | Anthropic | `CLAUDE_API_KEY` | 2 |
| **GPT-4o & 기타** | Geo-AIO | `GEO_AIO_API_KEY` | 3 |

---

## 🔑 API 키 발급 방법

### 1️⃣ Gemini API (Google)
```bash
# 1. Google AI Studio 접속
https://aistudio.google.com/app/apikey

# 2. "API 키 만들기" 클릭
# 3. 키 복사

# 4. .env.local에 추가
GEMINI_API_KEY="your-gemini-api-key-here"
```

### 2️⃣ Claude API (Anthropic)
```bash
# 1. Anthropic Console 접속
https://console.anthropic.com/

# 2. "API Keys" 메뉴
# 3. "Create Key" 클릭
# 4. 키 복사

# 5. .env.local에 추가
CLAUDE_API_KEY="sk-ant-xxxxxxxxxxxx"
```

### 3️⃣ Geo-AIO API
```bash
# 1. Geo-AIO 접속
https://www.geo-aio.com/generate

# 2. 회원가입/로그인
# 3. 대시보드 → API 키 관리
# 4. 키 생성 및 복사

# 5. .env.local에 추가
GEO_AIO_API_KEY="your-geo-aio-api-key-here"
```

---

## 📝 설정 파일 (.env.local)

```env
# ==================== AI API 키 ====================
# Gemini (Google)
GEMINI_API_KEY="your-gemini-api-key"

# Claude (Anthropic)
CLAUDE_API_KEY="your-claude-api-key"

# Geo-AIO (API 통합 플랫폼)
GEO_AIO_API_KEY="your-geo-aio-api-key"

# ==================== Supabase ====================
NEXT_PUBLIC_SUPABASE_URL="https://grgppaammbccuddwthfo.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-key"
```

---

## 🚀 사용 방법

### Backend (Node.js)

```javascript
const { callAI } = require('./api/ai-selector');

// 자동으로 사용 가능한 AI 선택
const result = await callAI('치아 우식증 진단 보고서를 작성해주세요', {
  temperature: 0.5,
  maxTokens: 2048
});

console.log(result);
// {
//   model: 'gemini' | 'claude' | 'geo-aio',
//   text: '생성된 텍스트...',
//   usage: { promptTokens: 100, outputTokens: 200 }
// }
```

### Frontend (HTML/JavaScript)

```html
<script src="js/ai-client.js"></script>

<script>
// 상담 내용 분석
async function analyzConsultation() {
  try {
    const result = await AIClient.generate(
      '환자가 치아 통증을 호소했습니다. 원인을 분석해주세요.'
    );
    console.log(result.text);
  } catch (e) {
    console.error('AI 호출 실패:', e.message);
  }
}

// 진단 보고서 생성
async function createDiagnosisReport() {
  const patient = { name: '김환자', age: 35, symptom: '앞니 깨짐' };
  const report = await AIClient.generateDiagnosisReport(
    patient,
    '앞니 우식증으로 발견, 신경치료 필요'
  );
  console.log(report);
}

// 교육 자료 생성
async function createEducationMaterial() {
  const material = await AIClient.generateEducationalMaterial(
    '올바른 양치질 방법',
    'basic'
  );
  console.log(material);
}

// AI 상태 확인
async function checkAIStatus() {
  const status = await AIClient.checkAvailableModels();
  console.log('사용 중인 AI:', status.selectedModel);
  console.log('사용 가능한 AI:', status.availableModels);
}
</script>
```

### API 엔드포인트

```bash
# AI 생성 (자동 선택)
POST /api/ai-generate
{
  "prompt": "생성할 텍스트 프롬프트",
  "options": {
    "temperature": 0.5,
    "maxTokens": 2048
  }
}

# AI 상태 확인
GET /api/ai-status
```

---

## 🔄 AI 선택 우선순위

시스템은 다음 순서대로 API를 확인하고 **첫 번째 사용 가능한 API 사용**:

```
1️⃣ Gemini (Google)
   ↓ (API 키 없으면)
2️⃣ Claude (Anthropic)
   ↓ (API 키 없으면)
3️⃣ Geo-AIO
   ↓ (API 키 없으면)
❌ 에러: 사용 가능한 AI 없음
```

---

## 💡 사용 팁

### 1️⃣ 비용 최적화
- **Gemini**: 무료 할당량 유지 (월 60 요청)
- **Claude**: 저렴한 토큰 가격
- **Geo-AIO**: 여러 모델 통합 → 최적의 가격

### 2️⃣ 성능 최적화
- Gemini: 속도 빠름 (✅ 권장)
- Claude: 정확도 높음
- Geo-AIO: 다양한 모델 선택 가능

### 3️⃣ 장애 대응
API 하나가 다운되어도 자동으로 다음 API 사용:

```javascript
// Gemini 장애 → Claude로 자동 전환 → Geo-AIO로 전환
const result = await callAI(prompt);  // 자동 선택!
```

---

## 🔧 고급 사용

### 특정 AI 모델 강제 선택

```javascript
const { callGemini, callClaude, callGeoAIO } = require('./api/ai-selector');

// Gemini 강제 사용
const result = await callGemini(prompt, { model: 'gemini-2.0-flash' });

// Claude 강제 사용
const result = await callClaude(prompt, { model: 'claude-3-5-sonnet-20241022' });

// Geo-AIO 강제 사용 (여러 모델 지원)
const result = await callGeoAIO(prompt, { model: 'gpt-4o' });
```

### 사용 통계 확인

```javascript
// 어떤 AI가 사용되었는지 로그로 확인
const result = await callAI(prompt);
console.log(`사용된 AI: ${result.model}`);
console.log(`토큰 사용량:`, result.usage);
```

---

## ⚠️ 주의사항

1. **API 키 보안**
   - `.env.local`은 `.gitignore`에 포함됨
   - 절대 GitHub에 커밋하지 않기

2. **비용 제한**
   - Gemini: 월 할당량 확인
   - Claude: 토큰 가격 주의
   - Geo-AIO: 과금 설정 확인

3. **요청 한도**
   - 동시 요청 줄이기
   - Rate limiting 고려

---

## 🆘 문제 해결

### "사용 가능한 AI API 없음" 에러

```javascript
// .env.local 확인
console.log(process.env.GEMINI_API_KEY);  // null이면 설정 필요
console.log(process.env.CLAUDE_API_KEY);  // null이면 설정 필요
console.log(process.env.GEO_AIO_API_KEY); // null이면 설정 필요
```

### AI 응답이 느린 경우

```javascript
// 1. 프롬프트 단축
const shortPrompt = prompt.substring(0, 500);

// 2. maxTokens 감소
const result = await callAI(prompt, { maxTokens: 512 });

// 3. temperature 감소 (더 빠르고 일관적)
const result = await callAI(prompt, { temperature: 0.3 });
```

---

## 📞 지원

API 키 발급 문제:
- Gemini: https://ai.google.dev/
- Claude: https://www.anthropic.com/
- Geo-AIO: https://www.geo-aio.com/

---

**✅ 설정 완료! 이제 AI를 사용하세요!** 🚀
