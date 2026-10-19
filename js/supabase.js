
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Supabase dashboard se ye dono values copy karna.
const SUPABASE_URL = "https://vpxrxltowbkadgqdlzbo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_yyMXSzA7qQMMbVW73jhw2g_acwyfumO";

export const supabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_") &&
  !SUPABASE_PUBLISHABLE_KEY.includes("YOUR_");

export const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;
