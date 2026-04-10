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
    const { username, password, nome, role } = await request.json();

    if (!username || !password || !nome) {
      return NextResponse.json({ error: 'Username, password, and nome are required' }, { status: 400 });
    }

    const validRoles = ['admin', 'operador', 'magistrado', 'consultor'];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const cleanUsername = username.toLowerCase().trim();

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
      })
      .select('id, username, nome, role, ativo, created_at')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: 'Failed to create user: ' + error.message }, { status: 500 });
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
