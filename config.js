const SUPABASE_URL = "https://wllegyguaxfiubffsoqh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsbGVneWd1YXhmaXViZmZzb3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyODkxNjEsImV4cCI6MjA5NDg2NTE2MX0.98nHxm2oX2SuFvyfJExoaUxWFkkDFgFmviDv2b3rPCw";

window.initSupabase = function() {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase client initialized");
};