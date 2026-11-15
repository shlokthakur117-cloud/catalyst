import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const accounts = [
  { label: "Elder A", email: "elder.a.gate@careledger.org", role: "elder" },
  { label: "Elder B", email: "elder.b.gate@careledger.org", role: "elder" },
  { label: "Caregiver A", email: "caregiver.a.gate@careledger.org", role: "caregiver" },
  { label: "Caregiver B", email: "caregiver.b.gate@careledger.org", role: "caregiver" },
];

async function testLogins() {
  console.log("Testing signInWithPassword for all 4 accounts on:", supabaseUrl);
  for (const acc of accounts) {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await client.auth.signInWithPassword({
      email: acc.email,
      password: "PasswordGate123!#",
    });

    if (error || !data.session?.access_token) {
      console.error(`FAILED login for ${acc.label} (${acc.email}):`, error?.message);
    } else {
      console.log(`SUCCESS: ${acc.label} authenticated. User ID: ${data.user.id}, JWT length: ${data.session.access_token.length}`);
    }
  }
}

testLogins().catch(console.error);
