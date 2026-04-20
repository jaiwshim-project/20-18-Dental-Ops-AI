// Vercel Serverless Function — Gemini 2.0 Flash 프록시
// 본사 GEMINI_API_KEY를 서버에서만 보관하고 모든 치과 병원이 공동으로 사용
//
// GET  /api/gemini        → 키 등록 여부만 반환 (진단용)
// POST /api/gemini        → { prompt, imageBase64? } 받아 Gemini 호출 후 { text } 반환

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: !!process.env.GEMINI_API_KEY,
      model: 'gemini-2.5-flash'
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: '서버에 GEMINI_API_KEY가 등록되지 않았습니다. 관리자에게 문의하세요.'
    });
  }

  const { prompt, imageBase64 } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt 필드가 필요합니다' });
  }

  try {
    const parts = [];
    if (imageBase64) {
      const b64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      parts.push({ inline_data: { mime_type: 'image/jpeg', data: b64 } });
    }
    parts.push({ text: prompt });

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      }
    );

    if (!r.ok) {
      let errMsg = 'Gemini API 오류';
      try {
        const errBody = await r.json();
        errMsg = errBody.error?.message || errMsg;
      } catch {}
      return res.status(r.status).json({ error: errMsg });
    }

    const data = await r.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Gemini 프록시 실패' });
  }
}
