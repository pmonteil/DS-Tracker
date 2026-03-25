import { NextRequest, NextResponse } from 'next/server';
import { takeSnapshot } from '@/lib/figma';

export async function POST(request: NextRequest) {
  try {
    const { fileKey } = await request.json();
    if (!fileKey) {
      return NextResponse.json({ error: 'fileKey requis' }, { status: 400 });
    }
    const snapshot = await takeSnapshot(fileKey);
    return NextResponse.json({ snapshot });
  } catch (error) {
    console.error('Error taking snapshot:', error);
    return NextResponse.json(
      { error: 'Impossible de prendre le snapshot Figma' },
      { status: 500 }
    );
  }
}
