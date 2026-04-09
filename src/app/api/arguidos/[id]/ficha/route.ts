import { NextRequest, NextResponse } from 'next/server';
import { supabase, toCamelCaseDeep } from '@/lib/supabase';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const execFileAsync = promisify(execFile);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch arguido from Supabase
    const { data: arguido, error } = await supabase
      .from('arguidos')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !arguido) {
      return NextResponse.json({ error: 'Arguido nao encontrado' }, { status: 404 });
    }

    // Convert to snake_case for Python script (the raw DB data is already snake_case)
    const jsonData = JSON.stringify(arguido);

    // Generate temp PDF path
    const tmpDir = '/tmp';
    const uniqueId = crypto.randomUUID();
    const pdfPath = path.join(tmpDir, `ficha_${uniqueId}.pdf`);
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate_ficha.py');

    // Check script exists
    if (!fs.existsSync(scriptPath)) {
      console.error('PDF generation script not found:', scriptPath);
      return NextResponse.json({ error: 'Script de geracao PDF nao encontrado' }, { status: 500 });
    }

    // Run Python script
    const { stdout, stderr } = await execFileAsync('python3', [
      scriptPath,
      pdfPath,
      jsonData,
    ], {
      maxBuffer: 1024 * 1024, // 1MB buffer
      timeout: 30000, // 30s timeout
    });

    if (stderr) {
      console.error('PDF generation stderr:', stderr);
    }

    // Check PDF was created
    if (!fs.existsSync(pdfPath)) {
      console.error('PDF file not generated. stdout:', stdout, 'stderr:', stderr);
      return NextResponse.json(
        { error: 'Falha ao gerar PDF', details: stderr || stdout },
        { status: 500 }
      );
    }

    // Add Z.ai metadata
    try {
      const metadataScript = path.join(process.cwd(), 'scripts', 'add_zai_metadata.py');
      await execFileAsync('python3', [
        metadataScript, pdfPath,
        '-t', `Ficha_Arguido_${arguido.numero_id || id}`,
      ]);
    } catch (metaErr) {
      console.warn('Metadata script failed (non-critical):', metaErr);
    }

    // Read PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);

    // Clean up temp file
    try {
      fs.unlinkSync(pdfPath);
    } catch {
      // Ignore cleanup errors
    }

    // Build filename
    const safeName = (arguido.nome_arguido || 'arguido')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
    const filename = `Ficha_${arguido.numero_id || id}_${safeName}.pdf`;

    // Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Falha ao gerar ficha PDF' },
      { status: 500 }
    );
  }
}
