import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createAdmin() {
  const username = 'admin';
  const password = 'admin123';
  const nome = 'Administrador';
  const role = 'admin';
  
  // Generate password hash
  const passwordHash = await bcrypt.hash(password, 10);
  
  console.log('Creating admin user...');
  console.log('Username:', username);
  console.log('Password hash:', passwordHash);
  
  // Check if user exists
  const { data: existing, error: checkError } = await supabase
    .from('system_users')
    .select('id')
    .eq('username', username)
    .single();
  
  if (existing) {
    console.log('User already exists, updating password...');
    const { error: updateError } = await supabase
      .from('system_users')
      .update({ password_hash: passwordHash, ativo: true })
      .eq('username', username);
    
    if (updateError) {
      console.error('Error updating user:', updateError);
    } else {
      console.log('Password updated successfully!');
    }
    return;
  }
  
  // Create new user
  const { data, error } = await supabase
    .from('system_users')
    .insert({
      username,
      password_hash: passwordHash,
      nome,
      role,
      ativo: true,
    })
    .select();
  
  if (error) {
    console.error('Error creating user:', error);
  } else {
    console.log('User created successfully:', data);
  }
}

createAdmin();
