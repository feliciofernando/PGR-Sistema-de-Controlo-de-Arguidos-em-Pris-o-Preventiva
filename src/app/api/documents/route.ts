import { NextRequest, NextResponse } from 'next/server';
import { supabase, toCamelCaseDeep } from '@/lib/supabase';

// GET /api/documents?arguido_id=X — List documents for an arguido
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const arguidoId = searchParams.get('arguido_id');

    if (!arguidoId) {
      return NextResponse.json({ error: 'arguido_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('arguido_id', arguidoId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(toCamelCaseDeep(data || []));
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

// POST /api/documents — Upload document
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const arguidoId = formData.get('arguido_id') as string;
    const file = formData.get('file') as File | null;
    const description = formData.get('description') as string || '';
    const category = formData.get('category') as string || 'outro';

    if (!arguidoId || !file) {
      return NextResponse.json({ error: 'arguido_id and file are required' }, { status: 400 });
    }

    const validCategories = ['mandado', 'certidao', 'relatorio', 'outro'];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'bin';
    const safeFileName = `${arguidoId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(safeFileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file: ' + uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(uploadData.path);

    // Insert document record
    const { data: docRecord, error: dbError } = await supabase
      .from('documents')
      .insert({
        arguido_id: parseInt(arguidoId),
        file_name: file.name,
        file_path: uploadData.path,
        file_size: file.size,
        file_type: file.type,
        category,
        description,
        url: urlData.publicUrl,
      })
      .select()
      .single();

    if (dbError) {
      // Cleanup uploaded file on DB error
      await supabase.storage.from('documents').remove([uploadData.path]);
      console.error('DB insert error:', dbError);
      return NextResponse.json({ error: 'Failed to save document record' }, { status: 500 });
    }

    return NextResponse.json(toCamelCaseDeep(docRecord), { status: 201 });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}

// DELETE /api/documents?id=X — Delete a document
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get('id');

    if (!docId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Get the document record
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .single();

    if (fetchError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete from storage
    await supabase.storage.from('documents').remove([doc.file_path]);

    // Delete from DB
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
