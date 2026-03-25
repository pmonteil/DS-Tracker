import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
    }

    const { email, fullName } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 });
    }

    const serviceClient = await createServiceClient();

    const { data: inviteData, error: inviteError } =
      await serviceClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName || email.split('@')[0], invited_by: user.id },
        redirectTo: `${new URL(request.url).origin}/auth/callback?type=invite`,
      });

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    if (inviteData.user) {
      await serviceClient
        .from('profiles')
        .update({ invited_by: user.id })
        .eq('id', inviteData.user.id);
    }

    return NextResponse.json({ success: true, email });
  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json({ error: "Erreur lors de l'invitation" }, { status: 500 });
  }
}
