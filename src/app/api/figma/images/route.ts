import { NextRequest, NextResponse } from 'next/server';
import { exportImages } from '@/lib/figma';

export async function POST(request: NextRequest) {
  try {
    const { fileKey, nodeIds } = await request.json();
    if (!fileKey || !nodeIds?.length) {
      return NextResponse.json({ error: 'fileKey et nodeIds requis' }, { status: 400 });
    }
    const images = await exportImages(fileKey, nodeIds);
    return NextResponse.json({ images });
  } catch (error) {
    console.error('Error exporting images:', error);
    return NextResponse.json(
      { error: "Impossible d'exporter les images" },
      { status: 500 }
    );
  }
}
