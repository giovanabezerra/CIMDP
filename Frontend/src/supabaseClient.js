
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mjvcapqwqieihttiwugm.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zDMh4jnJhDlehpg6HiRpUQ_FiN57uM4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

