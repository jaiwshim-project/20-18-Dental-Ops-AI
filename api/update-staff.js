import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { staffId, phone, role } = req.body;

  if (!staffId || !role) {
    return res.status(400).json({ error: 'staffId and role are required' });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .update({ phone: phone || null, role })
      .eq('id', staffId)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    res.status(200).json({
      message: 'Staff updated successfully',
      staff: data[0]
    });
  } catch (err) {
    console.error('[update-staff]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
