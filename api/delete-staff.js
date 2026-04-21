const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: '서버 환경 변수 미설정' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { staffId } = req.body;

  if (!staffId) {
    return res.status(400).json({ error: '직원 ID가 필요합니다' });
  }

  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', staffId);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: '직원이 삭제되었습니다'
    });
  } catch (error) {
    console.error('[delete-staff]', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
