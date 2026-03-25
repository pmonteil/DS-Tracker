'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Trash2, Eye, X } from 'lucide-react';
import Link from 'next/link';
import { AdminGuard } from '@/components/layout/AdminGuard';
import { AppHeader } from '@/components/layout/AppHeader';
import { Loader } from '@/components/ui/Loader';
import { DiffItemList } from '@/components/versions/DiffItemList';
import { ImageUploadZone } from '@/components/versions/ImageUploadZone';
import { CustomBlockEditor, type CustomBlock } from '@/components/versions/CustomBlockEditor';
import type { Version, DiffItem } from '@/lib/types';

export default function EditVersionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [version, setVersion] = useState<Version | null>(null);
  const [diffItems, setDiffItems] = useState<DiffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [title, setTitle] = useState('');
  const [versionNumber, setVersionNumber] = useState('');
  const [patchnoteMd, setPatchnoteMd] = useState('');
  const [summary, setSummary] = useState('');
  const [variableScreenshots, setVariableScreenshots] = useState<string[]>([]);
  const [customBlocks, setCustomBlocks] = useState<CustomBlock[]>([]);

  const fetchVersion = useCallback(async () => {
    const res = await fetch(`/api/versions/${id}`);
    const data = await res.json();
    if (data.version) {
      setVersion(data.version);
      setTitle(data.version.title);
      setVersionNumber(data.version.version_number);
      setPatchnoteMd(data.version.patchnote_md || '');
      setSummary(data.version.summary || '');
      setVariableScreenshots(data.version.variable_screenshots || []);
      setCustomBlocks(data.version.custom_blocks || []);
    }
    setDiffItems(data.diffItems ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchVersion();
  }, [fetchVersion]);

  const buildPayload = () => ({
    title,
    version_number: versionNumber,
    patchnote_md: patchnoteMd,
    summary: summary || null,
    variable_screenshots: variableScreenshots,
    custom_blocks: customBlocks,
  });

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/versions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload()),
    });
    setSaving(false);
  };

  const handlePublish = async () => {
    setPublishing(true);
    await fetch(`/api/versions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...buildPayload(), status: 'published' }),
    });
    setPublishing(false);
    setShowPreview(false);
    router.push(`/changelog/${versionNumber}`);
  };

  const handleDelete = async () => {
    if (!confirm('Supprimer ce patchnote ? Cette action est irréversible.')) return;
    await fetch(`/api/versions/${id}`, { method: 'DELETE' });
    router.push('/changelog');
  };

  if (loading) {
    return (
      <AdminGuard>
        <div className="min-h-screen">
          <AppHeader />
          <Loader message="Chargement..." />
        </div>
      </AdminGuard>
    );
  }

  if (!version) {
    return (
      <AdminGuard>
        <div className="min-h-screen">
          <AppHeader />
          <div className="max-w-3xl mx-auto px-6 py-8">
            <p className="text-sm text-slate-300">Version introuvable</p>
          </div>
        </div>
      </AdminGuard>
    );
  }

  const visibleCount = diffItems.filter((d) => !d.excluded).length;

  return (
    <AdminGuard>
      <div className="min-h-screen">
        <AppHeader />
        <main className="max-w-3xl mx-auto px-6 py-8">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link
                href="/changelog"
                className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                Changelog
              </Link>
              <span className="text-slate-500">·</span>
              <span className="text-sm text-slate-400 font-mono">{version.branch_name}</span>
            </div>
            <div className="relative">
              {version.status === 'draft' && (
                <>
                  <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-30" />
                  <span className="relative block w-2.5 h-2.5 rounded-full bg-blue-400" />
                </>
              )}
              {version.status === 'published' && (
                <span className="block w-2.5 h-2.5 rounded-full bg-emerald-400" />
              )}
            </div>
          </div>

          {/* Titre + version éditables */}
          <div className="flex items-center gap-3 mb-6">
            <input
              value={versionNumber}
              onChange={(e) => setVersionNumber(e.target.value)}
              className="font-mono text-sm text-slate-300 bg-transparent border-0 border-b border-transparent hover:border-slate-600 focus:border-slate-400 focus:outline-none w-14 transition-colors"
              placeholder="1.0"
            />
            <span className="text-slate-500 text-lg">—</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-semibold text-slate-50 bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-slate-500 focus:outline-none flex-1 transition-colors"
              placeholder="Titre du patchnote..."
            />
          </div>

          {/* Résumé IA */}
          {summary && (
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 mb-8">
              <textarea
                ref={(el) => {
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = el.scrollHeight + 'px';
                  }
                }}
                value={summary}
                onChange={(e) => {
                  setSummary(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                rows={1}
                className="w-full text-sm text-slate-200 leading-relaxed bg-transparent resize-none border-0 p-0 focus:ring-0 focus:outline-none placeholder:text-slate-500"
                style={{ overflow: 'hidden' }}
                placeholder="Résumé de la version…"
              />
            </div>
          )}

          {/* Section Variables */}
          <div className="mb-8">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-2 h-2 rounded-full bg-teal-400" />
              <span className="text-[13px] font-medium text-slate-300">Variables</span>
              <div className="flex-1 h-px bg-white/[0.04]" />
            </div>
            <div className="pl-4">
              <ImageUploadZone
                images={variableScreenshots}
                onChange={setVariableScreenshots}
                label="Captures des changements de variables"
              />
            </div>
          </div>

          {/* Compteur diff items */}
          <div className="mb-4">
            <span className="text-sm font-medium text-slate-300">
              {visibleCount} changement{visibleCount !== 1 ? 's' : ''} détecté{visibleCount !== 1 ? 's' : ''}
            </span>
          </div>

          <DiffItemList
            items={diffItems}
            versionId={version.id}
            onPatchnoteChange={setPatchnoteMd}
            onExclusionChange={fetchVersion}
          />

          {/* Blocs personnalisés */}
          <div className="mt-10">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-2 h-2 rounded-full bg-purple-400" />
              <span className="text-[13px] font-medium text-slate-400">Blocs supplémentaires</span>
              <div className="flex-1 h-px bg-white/[0.04]" />
            </div>
            <div className="pl-4">
              <CustomBlockEditor blocks={customBlocks} onChange={setCustomBlocks} />
            </div>
          </div>

          {/* Barre d'action sticky full-width */}
        </main>
        <div className="sticky bottom-0 bg-slate-950/95 backdrop-blur-xl border-t border-white/[0.05] mt-10">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <button
              onClick={handleDelete}
              type="button"
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              Supprimer
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                type="button"
                disabled={saving}
                className="px-5 py-2.5 bg-white/[0.06] text-slate-300 rounded-lg text-sm border border-white/[0.08] hover:bg-white/[0.1] transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
              <button
                onClick={() => {
                  handleSave();
                  setShowPreview(true);
                }}
                type="button"
                className="flex items-center gap-1.5 px-5 py-2.5 bg-white text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                Aperçu & Publier
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal aperçu */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto">
          <div className="w-full max-w-3xl mx-auto my-8 bg-slate-950 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40">
            <div className="sticky top-0 bg-slate-950/95 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
              <div>
                <h2 className="text-sm font-medium text-slate-200">Aperçu du patchnote</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Vérifiez le rendu avant publication
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="px-6 py-8">
              <h1 className="text-2xl font-semibold text-slate-100 mb-2">
                {versionNumber} — {title}
              </h1>

              {summary && (
                <div className="bg-white/[0.05] border border-white/[0.1] rounded-xl p-5 mb-8 text-sm text-slate-200 leading-relaxed">
                  {summary}
                </div>
              )}

              <div className="mb-4">
                <span className="text-sm font-medium text-slate-500">
                  {diffItems.filter((d) => !d.excluded).length} changement{diffItems.filter((d) => !d.excluded).length !== 1 ? 's' : ''}
                </span>
              </div>

              <DiffItemList
                items={diffItems}
                readOnly
                variableScreenshots={variableScreenshots.length > 0 ? variableScreenshots : undefined}
                customBlocks={customBlocks.some((b) => b.title || b.text || b.images.length > 0) ? customBlocks : undefined}
              />
            </div>

            <div className="sticky bottom-0 bg-slate-950/95 backdrop-blur-xl border-t border-white/[0.06] px-6 py-4 rounded-b-2xl flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="px-5 py-2.5 text-sm text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors cursor-pointer disabled:opacity-50"
              >
                {publishing ? 'Publication...' : 'Confirmer la publication'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminGuard>
  );
}
