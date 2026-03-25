import { NextRequest, NextResponse } from 'next/server';
import { takeSnapshot, exportImages } from '@/lib/figma';
import { generateDiff } from '@/lib/diff';
import { getAIProvider, isAiConfigured } from '@/lib/ai';
import { formatPatchnoteFromDiff } from '@/lib/patchnote-formatter';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

function parseAiResponse(raw: string): {
  summary: string;
  patchnote: string;
  descriptions: Map<string, string>;
} {
  const resumeIdx = raw.indexOf('---RESUME---');
  const descIdx = raw.indexOf('---DESCRIPTIONS---');
  const patchIdx = raw.indexOf('---PATCHNOTE---');

  const descriptions = new Map<string, string>();

  if (resumeIdx === -1 || patchIdx === -1) {
    return { summary: '', patchnote: raw.trim(), descriptions };
  }

  const summaryEnd = descIdx !== -1 ? descIdx : patchIdx;
  const summary = raw
    .substring(resumeIdx + '---RESUME---'.length, summaryEnd)
    .trim();

  if (descIdx !== -1) {
    const descBlock = raw.substring(descIdx + '---DESCRIPTIONS---'.length, patchIdx).trim();
    for (const line of descBlock.split('\n')) {
      const parts = line.split(':::');
      if (parts.length >= 3 && parts[0] === 'ITEM') {
        const name = parts[1].trim();
        const desc = parts.slice(2).join(':::').trim();
        if (name && desc) descriptions.set(name, desc);
      }
    }
  }

  const patchnote = raw.substring(patchIdx + '---PATCHNOTE---'.length).trim();
  return { summary, patchnote, descriptions };
}

export async function POST(request: NextRequest) {
  try {
    const { branchKey, branchName } = await request.json();
    if (!branchKey || !branchName) {
      return NextResponse.json(
        { error: 'branchKey et branchName requis' },
        { status: 400 }
      );
    }

    const mainFileKey = process.env.FIGMA_FILE_KEY!;

    const [branchSnapshot, mainSnapshot] = await Promise.all([
      takeSnapshot(branchKey),
      takeSnapshot(mainFileKey),
    ]);

    const diffItems = generateDiff(branchSnapshot, mainSnapshot);

    if (diffItems.length === 0) {
      return NextResponse.json({
        message: 'Aucun changement détecté',
        diffItems: [],
        patchnote: '',
      });
    }

    const componentDiffs = diffItems.filter(
      (item) =>
        item.category === 'component' &&
        (item.change_type === 'added' || item.change_type === 'modified')
    );

    const screenshotNodeIds = componentDiffs
      .filter((item) => item.item_id)
      .map((item) => item.item_id!);

    let branchImages: Record<string, string> = {};
    let mainImages: Record<string, string> = {};

    if (screenshotNodeIds.length > 0) {
      [branchImages, mainImages] = await Promise.all([
        exportImages(branchKey, screenshotNodeIds),
        exportImages(mainFileKey, screenshotNodeIds).catch(() => ({})),
      ]);
    }

    for (const item of componentDiffs) {
      if (item.item_id) {
        if (branchImages[item.item_id]) {
          item.screenshot_after = branchImages[item.item_id];
        }
        if (mainImages[item.item_id]) {
          item.screenshot_before = mainImages[item.item_id];
        }
      }
    }

    if (isAiConfigured()) {
      const aiProvider = getAIProvider();
      if (aiProvider.analyzeScreenshots) {
        const modifiedWithScreenshots = componentDiffs.filter(
          (item) =>
            item.change_type === 'modified' &&
            item.screenshot_before &&
            item.screenshot_after
        );
        const analysisPromises = modifiedWithScreenshots.slice(0, 8).map(async (item) => {
          try {
            const analysis = await aiProvider.analyzeScreenshots!(
              item.screenshot_before,
              item.screenshot_after,
              item.item_name
            );
            if (analysis) {
              item.description = (item.description ? item.description + ' ' : '') + analysis;
            }
          } catch (e) {
            console.error(`[AI] Screenshot analysis failed for ${item.item_name}:`, e);
          }
        });
        await Promise.all(analysisPromises);
      }
    }

    let patchnoteMd = '';
    let summary = '';

    if (isAiConfigured()) {
      try {
        const aiProvider = getAIProvider();
        const aiRaw = await aiProvider.generatePatchnote(
          JSON.stringify(diffItems, null, 2),
          `Branche "${branchName}" comparée à main.`
        );
        const parsed = parseAiResponse(aiRaw);
        summary = parsed.summary;
        patchnoteMd = parsed.patchnote;

        if (parsed.descriptions.size > 0) {
          for (const item of diffItems) {
            const desc = parsed.descriptions.get(item.item_name);
            if (desc) item.description = desc;
          }
        }
      } catch (aiError) {
        console.error('AI generation failed, fallback formateur:', aiError);
      }
    }
    if (!patchnoteMd.trim()) {
      patchnoteMd = formatPatchnoteFromDiff(diffItems);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: lastVersion } = await supabase
      .from('versions')
      .select('version_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const nextVersion = incrementVersion(lastVersion?.version_number);
    const cleanTitle = cleanBranchName(branchName);

    const { data: version, error: insertError } = await supabase
      .from('versions')
      .insert({
        version_number: nextVersion,
        title: cleanTitle,
        branch_name: branchName,
        branch_key: branchKey,
        status: 'draft',
        patchnote_md: patchnoteMd,
        summary: summary || null,
        diff_json: diffItems,
        created_by: user?.id,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    if (version && diffItems.length > 0) {
      const diffItemsToInsert = diffItems.map((item) => ({
        ...item,
        version_id: version.id,
        excluded: false,
      }));
      const { error: diffInsertError } = await supabase.from('diff_items').insert(diffItemsToInsert);
      if (diffInsertError) {
        console.error('Failed to insert diff_items:', diffInsertError);
      }
    }

    return NextResponse.json({
      version,
      diffItems,
      patchnote: patchnoteMd,
    });
  } catch (error) {
    console.error('Error generating diff:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du diff' },
      { status: 500 }
    );
  }
}

function incrementVersion(current?: string): string {
  if (!current) return '1.0';
  const match = current.match(/v?(\d+)\.(\d+)/);
  if (!match) return '1.0';
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  return `${major}.${minor + 1}`;
}

function cleanBranchName(name: string): string {
  return name.replace(/^\[.*?\]\s*/, '').trim();
}
