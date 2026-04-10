import { NextRequest, NextResponse } from 'next/server';
import { supabase, toCamelCaseDeep } from '@/lib/supabase';

// GET /api/audit - List audit logs with pagination and filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const arguidoId = searchParams.get('arguido_id');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (arguidoId) {
      query = query.eq('arguido_id', parseInt(arguidoId));
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Audit logs fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: toCamelCaseDeep(data || []),
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}

// POST /api/audit - Create new audit log entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const record = {
      arguido_id: body.arguidoId,
      user_id: body.userId || null,
      username: body.username || 'sistema',
      action: body.action,           // criacao, atualizacao, remocao, status_change
      field_changed: body.fieldChanged || null,
      old_value: body.oldValue || null,
      new_value: body.newValue || null,
    };

    const { data, error } = await supabase
      .from('audit_logs')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('Audit log insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(toCamelCaseDeep(data), { status: 201 });
  } catch (error) {
    console.error('Audit log create error:', error);
    return NextResponse.json({ error: 'Failed to create audit log' }, { status: 500 });
  }
}
