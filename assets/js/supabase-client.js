// ============================================================
// supabase-client.js - Supabase connection setup
// ============================================================

// Replace these with your actual Supabase project values
// These are PUBLIC keys - safe to expose in frontend
const SUPABASE_URL = 'https://uqzauvennlrcqoqnvthy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Spzme0_9-eQzY5t6Xnbfqg_lHEU1trl';

// Initialize Supabase client using CDN version
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Export for use in other files
window.db = db;
window.SUPABASE_URL = SUPABASE_URL;
