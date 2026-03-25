import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: version, error } = await supabase
    .from('versions')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !version) {
    return NextResponse.json({ error: 'Version introuvable' }, { status: 404 });
  }

  const { data: diffItems } = await supabase
    .from('diff_items')
    .select('*')
    .eq('version_id', id)
    .order('sort_order', { ascending: true });

  return NextResponse.json({ version, diffItems: diffItems ?? [] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();

  if (body.status === 'published' && !body.published_at) {
    body.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('versions')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ version: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase.from('versions').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
