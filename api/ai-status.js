/**
 * AI 상태 확인 API
 * GET /api/ai-status
 */

const { getAvailableModels, selectBestModel } = require('./ai-selector');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET 요청만 지원됩니다' });
  }

  try {
    const availableModels = getAvailableModels();
    let selectedModel = null;

    if (availableModels.length > 0) {
      selectedModel = selectBestModel(availableModels);
    }

    const status = {
      status: availableModels.length > 0 ? 'ready' : 'no-api',
      availableModels,
      selectedModel,
      models: {
        gemini: !!process.env.GEMINI_API_KEY,
        claude: !!process.env.CLAUDE_API_KEY,
        geoAIO: !!process.env.GEO_AIO_API_KEY
      },
      priority: ['gemini', 'claude', 'geo-aio']
    };

    console.log('[ai-status]', status);

    return res.status(200).json(status);

  } catch (e) {
    console.error('[ai-status] 에러:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
