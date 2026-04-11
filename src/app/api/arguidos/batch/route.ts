import { NextRequest, NextResponse } from 'next/server';
import { supabase, toCamelCaseDeep } from '@/lib/supabase';

// PUT /api/arguidos/batch — Batch update status/fields
export async function PUT(request: NextRequest) {
  try {
    const { ids, updates } = await request.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs required' }, { status: 400 });
    }
    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Updates required' }, { status: 400 });
    }

    // Convert camelCase to snake_case for Supabase
    const snakeUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      const snake = key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
      snakeUpdates[snake] = value;
    }

    const { data, error } = await supabase
      .from('arguidos')
      .update(snakeUpdates)
      .in('id', ids)
      .select();

    if (error) {
      console.error('Batch update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create audit log for each updated record
    for (const id of ids) {
      await supabase.from('audit_logs').insert({
        arguido_id: id,
        action: 'atualizacao',
        field_changed: Object.keys(updates).join(', '),
        new_value: JSON.stringify(updates),
      });
    }

    return NextResponse.json({ updated: data?.length || 0 });
  } catch (error) {
    console.error('Batch update error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// DELETE /api/arguidos/batch — Batch delete
export async function DELETE(request: NextRequest) {
  try {
    const { ids } = await request.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs required' }, { status: 400 });
    }

    // Log deletions before removing
    const { data: toDelete } = await supabase
      .from('arguidos')
      .select('id, numero_id, nome_arguido')
      .in('id', ids);

    for (const record of (toDelete || [])) {
      await supabase.from('audit_logs').insert({
        arguido_id: record.id,
        action: 'remocao',
        old_value: `${record.numero_id} - ${record.nome_arguido}`,
      });
    }

    const { error } = await supabase
      .from('arguidos')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Batch delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: ids.length });
  } catch (error) {
    console.error('Batch delete error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
