/**
 * AI 생성 API - 자동 AI 선택으로 텍스트 생성
 * POST /api/ai-generate
 */

const { callAI } = require('./ai-selector');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 지원됩니다' });
  }

  try {
    const { prompt, options = {} } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt는 필수 입력값입니다' });
    }

    console.log('[ai-generate] 요청:', {
      promptLength: prompt.length,
      options
    });

    // 자동으로 사용 가능한 AI 선택 및 호출
    const result = await callAI(prompt, options);

    console.log('[ai-generate] ✅ 완료:', {
      model: result.model,
      textLength: result.text.length,
      usage: result.usage
    });

    return res.status(200).json({
      success: true,
      model: result.model,
      text: result.text,
      usage: result.usage
    });

  } catch (e) {
    console.error('[ai-generate] ❌ 에러:', e.message);
    return res.status(500).json({
      error: e.message,
      hint: 'API 키를 .env.local에 설정했는지 확인해주세요'
    });
  }
};
