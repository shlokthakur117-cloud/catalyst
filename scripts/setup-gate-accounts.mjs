import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export const TEST_USERS = [
  {
    email: "elder.a.gate@careledger.org",
    password: "PasswordGate123!#",
    role: "elder",
    fullName: "Elder Alice Gate",
  },
  {
    email: "elder.b.gate@careledger.org",
    password: "PasswordGate123!#",
    role: "elder",
    fullName: "Elder Bob Gate",
  },
  {
    email: "caregiver.a.gate@careledger.org",
    password: "PasswordGate123!#",
    role: "caregiver",
    fullName: "Caregiver Carol Gate",
  },
  {
    email: "caregiver.b.gate@careledger.org",
    password: "PasswordGate123!#",
    role: "caregiver",
    fullName: "Caregiver Dan Gate",
  },
];

async function setup() {
  console.log("Setting up 4 test accounts on", supabaseUrl);
  for (const user of TEST_USERS) {
    const { data, error } = await supabase.auth.signUp({
      email: user.email,
      password: user.password,
      options: {
        data: {
          full_name: user.fullName,
          role: user.role,
        },
      },
    });

    if (error) {
      if (error.message.includes("already registered")) {
        console.log(`User ${user.email} already registered.`);
      } else {
        console.error(`Error registering ${user.email}:`, error.message);
      }
    } else {
      console.log(`Signed up ${user.email} -> user id: ${data.user?.id}`);
    }
  }
}

setup().catch(console.error);
