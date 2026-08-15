const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://hzgohcnktwbavqspkogm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6Z29oY25rdHdiYXZxc3Brb2dtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgzNjczMywiZXhwIjoyMTAxNDEyNzMzfQ.G_8EGkyogRmFZY8MwJyQmZGmaxKs1xFA9lqDc14FZUs',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function resetAdmin() {
  const email = 'admin@mmc.com';
  const password = 'password123';
  
  console.log('Checking for existing user...');
  
  // Since we have service_role, we can use auth.admin methods
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }
  
  let user = usersData.users.find(u => u.email === email);
  
  if (user) {
    console.log(`User ${email} found! Resetting password to: ${password}`);
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: password, email_confirm: true }
    );
    if (updateError) {
      console.error('Error updating password:', updateError);
      return;
    }
  } else {
    console.log(`User ${email} not found. Creating it with password: ${password}`);
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    });
    
    if (createError) {
      console.error('Error creating user:', createError);
      return;
    }
    user = createData.user;
  }
  
  console.log('Ensuring user has admin role in user_roles table...');
  const { error: roleError } = await supabase
    .from('user_roles')
    .upsert({ user_id: user.id, role: 'admin' }, { onConflict: 'user_id' });
    
  if (roleError) {
    console.error('Error setting admin role:', roleError);
    return;
  }
  
  console.log('SUCCESS! You can now login with:');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

resetAdmin();
