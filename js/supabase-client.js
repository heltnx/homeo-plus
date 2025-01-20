const SUPABASE_URL = "https://cudkbdtnaynbapdbhvgm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1ZGtiZHRuYXluYmFwZGJodmdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY1MjExNjAsImV4cCI6MjA1MjA5NzE2MH0.KHuKs25jmBAaJGzkgyrgqlOXLCqwQrXuDAw8BtHgfVc";

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: true
});