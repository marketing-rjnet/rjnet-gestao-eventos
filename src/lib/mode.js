import { supabaseEnabled } from './supabase';

export const MODE = {
  SUPABASE: 'supabase',
  LOCAL: 'local',
};

export const isSupabaseMode = () => supabaseEnabled;
export const getMode = () => (supabaseEnabled ? MODE.SUPABASE : MODE.LOCAL);
