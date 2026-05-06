const { createClient } = require('@supabase/supabase-js');

const LANG_NAMES = {
  ko:'한국어', en:'English', zh:'中文', ja:'日本語', vi:'Tiếng Việt',
  ru:'Русский', th:'ภาษาไทย', ar:'العربية', es:'Español', fr:'Français',
  de:'Deutsch', pt:'Português', id:'Bahasa Indonesia', mn:'Монгол',
  uz:'Oʻzbekcha', kk:'Қазақша', tl:'Filipino', my:'မြန်မာ', km:'ខ្មែរ', hi:'हिन्दी'
};

const STOP_WORDS = new Set([
  '이','가','을','를','은','는','의','에','에서','과','와','도','으로','로','이다',
  '있다','없다','그','저','것','수','때','등','및','더','좀','제','어떻게','어디',
  '언제','왜','뭐','아','네','예','아니요','안','못','할','하다','해요','해서',
  '있어요','없어요','같아요','싶어요','주세요','해주세요','합니다','입니다','이에요',
  '세요','한','된','가장','많은','있는','하는','되는','그런','이런','저런',
  '치과','병원','선생님','의사','저는','제가','우리','나는','나','저','그게',
]);

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const { clinic_id } = req.query;
  if (!clinic_id) return res.status(400).json({ error: 'clinic_id 필요' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'No env' });

  try {
    const sb = createClient(url, key);

    const sixAgo = new Date();
    sixAgo.setMonth(sixAgo.getMonth() - 6);

    const { data: logs, error } = await sb
      .from('translate_logs')
      .select('patient_lang, messages, started_at, ended_at')
      .eq('clinic_id', clinic_id)
      .gte('started_at', sixAgo.toISOString())
      .order('started_at', { ascending: false });

    if (error) throw new Error(error.message);
    if (!logs || !logs.length) return res.status(200).json({ empty: true });

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = logs.filter(l => new Date(l.started_at) >= thisMonthStart);

    // 평균 상담 시간 (분)
    const durations = logs
      .filter(l => l.ended_at)
      .map(l => (new Date(l.ended_at) - new Date(l.started_at)) / 60000);
    const avgDuration = durations.length
      ? Math.round(durations.reduce((a,b) => a+b, 0) / durations.length * 10) / 10 : 0;

    // 평균 메시지 수
    const msgCounts = logs.map(l => Array.isArray(l.messages) ? l.messages.length : 0);
    const avgMessages = msgCounts.length
      ? Math.round(msgCounts.reduce((a,b) => a+b, 0) / msgCounts.length * 10) / 10 : 0;

    // 짧은 상담 (1분 미만)
    const shortSessions = durations.filter(d => d < 1).length;

    // 언어 분포
    const langCount = {};
    logs.forEach(l => {
      const lang = l.patient_lang || 'unknown';
      langCount[lang] = (langCount[lang] || 0) + 1;
    });
    const languages = Object.entries(langCount)
      .sort((a,b) => b[1]-a[1]).slice(0,8)
      .map(([lang, count]) => ({ lang, name: LANG_NAMES[lang] || lang, count }));

    // 요일별 (0=일, 6=토)
    const byWeekday = Array(7).fill(0);
    logs.forEach(l => { byWeekday[new Date(l.started_at).getDay()]++; });

    // 시간대별 (0-23)
    const byHour = Array(24).fill(0);
    logs.forEach(l => { byHour[new Date(l.started_at).getHours()]++; });

    // 월별 트렌드 (최근 6개월)
    const monthlyMap = {};
    logs.forEach(l => {
      const d = new Date(l.started_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      monthlyMap[key] = (monthlyMap[key] || 0) + 1;
    });
    const monthly = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      monthly.push({ month: key, count: monthlyMap[key] || 0 });
    }

    // 환자 메시지 키워드 추출
    const wordCount = {};
    logs.forEach(l => {
      if (!Array.isArray(l.messages)) return;
      l.messages.forEach(m => {
        if (m.who !== 'patient' || !m.original) return;
        const words = m.original.match(/[가-힣]{2,}|[a-zA-Z]{4,}/g) || [];
        words.forEach(w => {
          if (!STOP_WORDS.has(w) && !STOP_WORDS.has(w.toLowerCase())) {
            wordCount[w] = (wordCount[w] || 0) + 1;
          }
        });
      });
    });
    const keywords = Object.entries(wordCount)
      .sort((a,b) => b[1]-a[1]).slice(0,20)
      .map(([word, count]) => ({ word, count }));

    // 신규 언어 감지 (이번달에 처음 등장한 언어)
    const prevLangs = new Set(
      logs.filter(l => new Date(l.started_at) < thisMonthStart).map(l => l.patient_lang)
    );
    const newLangs = [...new Set(thisMonth.map(l => l.patient_lang))]
      .filter(lang => !prevLangs.has(lang))
      .map(lang => LANG_NAMES[lang] || lang);

    return res.status(200).json({
      summary: {
        total: logs.length,
        this_month: thisMonth.length,
        avg_duration_min: avgDuration,
        avg_messages: avgMessages,
        short_sessions: shortSessions
      },
      languages,
      by_weekday: byWeekday,
      by_hour: byHour,
      monthly,
      keywords,
      new_langs: newLangs
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
