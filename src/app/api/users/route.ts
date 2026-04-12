import { NextRequest, NextResponse } from 'next/server';
import { supabase, toCamelCaseDeep } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

// GET /api/users — List all users
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('system_users')
      .select('id, username, nome, role, ativo, created_at, ultimo_login')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(toCamelCaseDeep(data || []));
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST /api/users — Create a new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const { username, password, nome, role, email } = await request.json();

    if (!username || !password || !nome) {
      return NextResponse.json({ error: 'Username, password, and nome are required' }, { status: 400 });
    }

    const validRoles = ['admin', 'operador', 'magistrado', 'consultor'];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const cleanUsername = username.toLowerCase().trim();
    const cleanEmail = email ? email.toLowerCase().trim() : null;

    // Check if username exists
    const { data: existing } = await supabase
      .from('system_users')
      .select('id')
      .eq('username', cleanUsername)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data, error } = await supabase
      .from('system_users')
      .insert({
        username: cleanUsername,
        password_hash: passwordHash,
        nome: nome.trim(),
        role: role || 'operador',
        ativo: true,
        ...(cleanEmail ? { email: cleanEmail } : {}),
      })
      .select('id, username, nome, role, ativo, created_at')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: 'Failed to create user: ' + error.message }, { status: 500 });
    }

    // Sync with Supabase Auth if email provided (for password recovery)
    if (cleanEmail) {
      try {
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        const existingAuthUser = authUsers?.users?.find(u => u.email === cleanEmail);
        if (!existingAuthUser) {
          await supabase.auth.admin.createUser({
            email: cleanEmail,
            password,
            email_confirm: true,
            user_metadata: { username: cleanUsername, nome: nome.trim(), managed_by: 'system_users' },
          });
          console.log(`[Users] Created Supabase Auth user for ${cleanEmail}`);
        }
      } catch (authErr) {
        console.warn('[Users] Could not sync Supabase Auth user (non-critical):', authErr);
      }
    }

    return NextResponse.json(toCamelCaseDeep(data), { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

// PATCH /api/users — Update user role or status
export async function PATCH(request: NextRequest) {
  try {
    const { id, role, ativo } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'User id is required' }, { status: 400 });
    }

    // Prevent admin from self-demotion or self-deactivation
    const currentUserId = request.headers.get('x-user-id');
    const currentUserRole = request.headers.get('x-user-role');
    if (currentUserId && String(id) === currentUserId) {
      if (role && role !== 'admin') {
        return NextResponse.json({ error: 'Não pode alterar o seu próprio cargo. Contacte outro administrador.' }, { status: 403 });
      }
      if (ativo === false) {
        return NextResponse.json({ error: 'Não pode desativar a sua própria conta. Contacte outro administrador.' }, { status: 403 });
      }
    }

    // Prevent demoting the last admin
    if (role && role !== 'admin' && currentUserRole === 'admin') {
      const { data: targetUser } = await supabase
        .from('system_users')
        .select('role')
        .eq('id', id)
        .single();
      if (targetUser?.role === 'admin') {
        const { count } = await supabase
          .from('system_users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'admin')
          .eq('ativo', true);
        if (count && count <= 1) {
          return NextResponse.json({ error: 'Não pode remover o último administrador ativo.' }, { status: 403 });
        }
      }
    }

    const updates: Record<string, unknown> = {};

    if (role) {
      const validRoles = ['admin', 'operador', 'magistrado', 'consultor'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      updates.role = role;
    }

    if (typeof ativo === 'boolean') {
      updates.ativo = ativo;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('system_users')
      .update(updates)
      .eq('id', id)
      .select('id, username, nome, role, ativo, created_at')
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    return NextResponse.json(toCamelCaseDeep(data));
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
