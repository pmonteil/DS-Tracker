import { NextResponse } from 'next/server';
import { getBranches } from '@/lib/figma';

export async function GET() {
  try {
    const token = process.env.FIGMA_ACCESS_TOKEN?.trim();
    if (!token) {
      return NextResponse.json(
        {
          error: 'Configuration Figma manquante',
          hint:
            'Ajoutez FIGMA_ACCESS_TOKEN dans .env.local. Créez un token sur figma.com → Settings → Personal access tokens (scope « file_read »).',
        },
        { status: 503 }
      );
    }

    const fileKey = process.env.FIGMA_FILE_KEY!;
    if (!fileKey) {
      return NextResponse.json(
        { error: 'FIGMA_FILE_KEY manquant dans .env.local' },
        { status: 503 }
      );
    }

    const branches = await getBranches(fileKey);
    return NextResponse.json({ branches });
  } catch (error) {
    console.error('Error fetching branches:', error);
    const message =
      error instanceof Error ? error.message : 'Erreur inconnue';
    return NextResponse.json(
      {
        error: 'Impossible de récupérer les branches Figma',
        details: message,
      },
      { status: 500 }
    );
  }
}
