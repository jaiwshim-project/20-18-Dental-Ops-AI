/**
 * AI API 자동 선택 및 통합 모듈
 * Gemini, Claude, Geo-AIO 중 사용 가능한 API 자동 선택
 */

const AVAILABLE_MODELS = {
  GEMINI: 'gemini',
  CLAUDE: 'claude',
  GEO_AIO: 'geo-aio'
};

// API 키 확인
function getAvailableModels() {
  const available = [];

  if (process.env.GEMINI_API_KEY) {
    available.push(AVAILABLE_MODELS.GEMINI);
    console.log('[ai-selector] ✅ Gemini API 사용 가능');
  } else {
    console.log('[ai-selector] ❌ Gemini API 키 없음');
  }

  if (process.env.CLAUDE_API_KEY) {
    available.push(AVAILABLE_MODELS.CLAUDE);
    console.log('[ai-selector] ✅ Claude API 사용 가능');
  } else {
    console.log('[ai-selector] ❌ Claude API 키 없음');
  }

  if (process.env.GEO_AIO_API_KEY) {
    available.push(AVAILABLE_MODELS.GEO_AIO);
    console.log('[ai-selector] ✅ Geo-AIO API 사용 가능');
  } else {
    console.log('[ai-selector] ❌ Geo-AIO API 키 없음');
  }

  return available;
}

// 우선순위: Gemini → Claude → Geo-AIO
function selectBestModel(availableModels) {
  if (availableModels.includes(AVAILABLE_MODELS.GEMINI)) {
    console.log('[ai-selector] 선택: Gemini (우선순위 1)');
    return AVAILABLE_MODELS.GEMINI;
  }
  if (availableModels.includes(AVAILABLE_MODELS.CLAUDE)) {
    console.log('[ai-selector] 선택: Claude (우선순위 2)');
    return AVAILABLE_MODELS.CLAUDE;
  }
  if (availableModels.includes(AVAILABLE_MODELS.GEO_AIO)) {
    console.log('[ai-selector] 선택: Geo-AIO (우선순위 3)');
    return AVAILABLE_MODELS.GEO_AIO;
  }

  throw new Error('[ai-selector] ❌ 사용 가능한 AI API 없음. API 키를 설정해주세요.');
}

// Gemini API 호출
async function callGemini(prompt, options = {}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API 키 없음');
  }

  const { model = 'gemini-2.0-flash', temperature = 0.7, maxTokens = 2048 } = options;

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + process.env.GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API 에러: ${response.status}`);
    }

    const data = await response.json();
    return {
      model: 'gemini',
      text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0
      }
    };
  } catch (e) {
    console.error('[ai-selector] Gemini 호출 실패:', e.message);
    throw e;
  }
}

// Claude API 호출
async function callClaude(prompt, options = {}) {
  if (!process.env.CLAUDE_API_KEY) {
    throw new Error('Claude API 키 없음');
  }

  const { model = 'claude-haiku-4-5-20251001', temperature = 0.7, maxTokens = 2048 } = options;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Claude API 에러: ${error.error?.message}`);
    }

    const data = await response.json();
    return {
      model: 'claude',
      text: data.content?.[0]?.text || '',
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0
      }
    };
  } catch (e) {
    console.error('[ai-selector] Claude 호출 실패:', e.message);
    throw e;
  }
}

// Geo-AIO API 호출 (통합 API)
async function callGeoAIO(prompt, options = {}) {
  if (!process.env.GEO_AIO_API_KEY) {
    throw new Error('Geo-AIO API 키 없음');
  }

  const { model = 'gpt-4o', temperature = 0.7, maxTokens = 2048 } = options;

  try {
    const response = await fetch('https://www.geo-aio.com/generate', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.GEO_AIO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Geo-AIO API 에러: ${error.error?.message}`);
    }

    const data = await response.json();
    return {
      model: 'geo-aio',
      text: data.choices?.[0]?.message?.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      }
    };
  } catch (e) {
    console.error('[ai-selector] Geo-AIO 호출 실패:', e.message);
    throw e;
  }
}

// 자동 선택 및 호출 (실패 시 다음 모델로 폴백)
async function callAI(prompt, options = {}) {
  const availableModels = getAvailableModels();

  if (availableModels.length === 0) {
    throw new Error('[ai-selector] 사용 가능한 AI API 없음. 환경 변수를 설정해주세요.');
  }

  // 우선순위 순서로 정렬, 각 모델 실패 시 다음 모델로 폴백
  const ordered = [AVAILABLE_MODELS.GEMINI, AVAILABLE_MODELS.CLAUDE, AVAILABLE_MODELS.GEO_AIO]
    .filter(m => availableModels.includes(m));

  let lastError;
  for (const model of ordered) {
    try {
      console.log('[ai-selector] 시도:', model);
      switch (model) {
        case AVAILABLE_MODELS.GEMINI:  return await callGemini(prompt, options);
        case AVAILABLE_MODELS.CLAUDE:  return await callClaude(prompt, options);
        case AVAILABLE_MODELS.GEO_AIO: return await callGeoAIO(prompt, options);
      }
    } catch (e) {
      console.error('[ai-selector] ' + model + ' 실패, 다음 모델 시도:', e.message);
      lastError = e;
    }
  }

  throw lastError || new Error('[ai-selector] 모든 AI API 호출 실패');
}

module.exports = {
  callAI,
  callGemini,
  callClaude,
  callGeoAIO,
  getAvailableModels,
  selectBestModel,
  AVAILABLE_MODELS
};
