import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { formatPatchnoteFromDiff } from '@/lib/patchnote-formatter';
import type { DiffItem } from '@/lib/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: versionId, itemId } = await params;
    const body = await request.json();
    const excluded = body.excluded !== undefined ? Boolean(body.excluded) : undefined;
    const description =
      typeof body.description === 'string' ? body.description : undefined;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const patch: Record<string, unknown> = {};
    if (excluded !== undefined) patch.excluded = excluded;
    if (description !== undefined) patch.description = description;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: 'excluded ou description requis' },
        { status: 400 }
      );
    }

    const { error: updateErr } = await supabase
      .from('diff_items')
      .update(patch)
      .eq('id', itemId)
      .eq('version_id', versionId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const { data: allItems } = await supabase
      .from('diff_items')
      .select('*')
      .eq('version_id', versionId)
      .order('sort_order', { ascending: true });

    const patchnoteMd = formatPatchnoteFromDiff((allItems ?? []) as DiffItem[]);

    await supabase.from('versions').update({ patchnote_md: patchnoteMd }).eq('id', versionId);

    return NextResponse.json({ success: true, patchnote_md: patchnoteMd });
  } catch (error) {
    console.error('PATCH diff-item:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
