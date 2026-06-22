// Public read-only Supabase client — points to the Lovable Cloud project
// (the unique source of truth for articles). Safe for server functions:
// no session persistence, no localStorage access.
import { createClient } from '@supabase/supabase-js';

const URL =
  (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  'https://qqwudmnfavvaukuldulr.supabase.co';

const ANON =
  (typeof process !== 'undefined' && process.env?.SUPABASE_PUBLISHABLE_KEY) ||
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxd3VkbW5mYXZ2YXVrdWxkdWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTg2MjUsImV4cCI6MjA5NjU3NDYyNX0.P-8PAwboYoul28Iqx_UMGH0c9_NPwBTsJPCkRMXKEpY';

export const holiswissPublic = createClient(URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
});
