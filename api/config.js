// Vercel Edge Function — 클라이언트 부트스트랩용 공개 설정 전달
// 서버에 저장된 SUPABASE_URL / SUPABASE_ANON_KEY를 브라우저에 안전하게 공급

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Allow': 'GET' }
    });
  }
  return new Response(JSON.stringify({
    supabase_url: process.env.SUPABASE_URL || '',
    supabase_anon_key: process.env.SUPABASE_ANON_KEY || ''
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
