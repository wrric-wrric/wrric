"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Trash2, ChevronUp, ChevronDown, Lock, Save, AlertTriangle, Loader2, Check, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';

interface Criterion {
  id?: string;
  name: string;
  description: string;
  weight: number;
  min_score: number;
  max_score: number;
  rubric: Record<string, unknown>;
}

const empty = (): Criterion => ({ name: '', description: '', weight: 1, min_score: 0, max_score: 10, rubric: {} });

export default function ScoringSchemaPage() {
  const { eventId } = useParams();
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const fetchSchema = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/scoring-schema`, { headers: getHeaders() });
      const data = await res.json();
      if (data?.criteria) {
        setCriteria(data.criteria.map((c: any) => ({
          id: c.id, name: c.name, description: c.description,
          weight: c.weight, min_score: c.min_score, max_score: c.max_score, rubric: c.rubric || {}
        })));
        setIsLocked(data.is_locked ?? false);
        setVersion(data.version ?? 0);
      } else {
        setCriteria([]);
      }
    } catch { } finally { setLoading(false); }
  }, [eventId]);

  useEffect(() => { fetchSchema(); }, [fetchSchema]);

  const addCriterion = () => setCriteria(prev => [...prev, empty()]);

  const removeCriterion = (i: number) => {
    if (!confirm('Delete this criterion?')) return;
    setCriteria(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateCriterion = (i: number, field: keyof Criterion, value: any) => {
    setCriteria(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  };

  const moveUp = (i: number) => {
    if (i === 0) return;
    setCriteria(prev => { const a = [...prev];[a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; });
  };

  const moveDown = (i: number) => {
    if (i === criteria.length - 1) return;
    setCriteria(prev => { const a = [...prev];[a[i], a[i + 1]] = [a[i + 1], a[i]]; return a; });
  };

  const saveSchema = async () => {
    if (criteria.some(c => !c.name.trim())) {
      toast.error('All criteria must have a name.');
      return;
    }
    const scoreErrors = criteria.filter(c => c.max_score <= c.min_score);
    if (scoreErrors.length > 0) {
      toast.error(`Criterion "${scoreErrors[0].name || 'Untitled'}" has Max Score ≤ Min Score. Please fix before saving.`);
      return;
    }
    const totalWeight = criteria.reduce((s, c) => s + Number(c.weight), 0);
    if (Math.round(totalWeight) !== 100) {
      toast.error(`Weights must sum to 100% (currently ${totalWeight.toFixed(1)}%). Tip: divide 100 equally among criteria.`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/scoring-schema`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ criteria }),
      });
      const data = await res.json();
      if (res.ok) { toast.success('Schema saved successfully!'); fetchSchema(); }
      else toast.error(data.detail || 'Failed to save schema.');
    } catch { toast.error('Network error.'); }
    finally { setSaving(false); }
  };

  const totalWeight = criteria.reduce((s, c) => s + Number(c.weight), 0);
  const hasScoreErrors = criteria.some(c => c.max_score <= c.min_score);
  const isValid = Math.round(totalWeight) === 100 && !hasScoreErrors;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-sm">Loading schema...</span>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            Scoring Schema
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Define criteria and weights for judge evaluation.
            {version > 0 && <span className="ml-2 text-slate-400">Version {version}</span>}
          </p>
        </div>
        {isLocked && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            <Lock className="w-3 h-3" /> Locked
          </span>
        )}
      </div>

      {isLocked && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <Lock className="w-4 h-4 flex-shrink-0" />
          Schema is locked because judging has started. Use &quot;Override Schema Lock&quot; from the event dashboard to unlock.
        </div>
      )}

      {/* Criteria list */}
      <div className="space-y-3">
        {criteria.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm">
            <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-400">No criteria yet</p>
            <p className="text-xs text-slate-300 mt-1">Add your first scoring criterion below</p>
          </div>
        ) : (
          criteria.map((c, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span className="text-xs font-semibold text-slate-700 flex-1">{c.name || 'Untitled Criterion'}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveUp(i)} disabled={isLocked || i === 0} className="p-1 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-30 transition-colors">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => moveDown(i)} disabled={isLocked || i === criteria.length - 1} className="p-1 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-30 transition-colors">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeCriterion(i)} disabled={isLocked} className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 disabled:opacity-30 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                  <input value={c.name} onChange={e => updateCriterion(i, 'name', e.target.value)} disabled={isLocked}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:cursor-not-allowed" placeholder="e.g. Innovation" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                  <textarea value={c.description} onChange={e => updateCriterion(i, 'description', e.target.value)} disabled={isLocked} rows={2}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:cursor-not-allowed resize-none" placeholder="Describe what judges should evaluate..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Weight (%)</label>
                  <input type="number" value={c.weight} onChange={e => updateCriterion(i, 'weight', Number(e.target.value))} disabled={isLocked} min={0} max={100}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Min Score</label>
                    <input type="number" value={c.min_score} onChange={e => updateCriterion(i, 'min_score', Number(e.target.value))} disabled={isLocked}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Max Score</label>
                    <input type="number" value={c.max_score} onChange={e => updateCriterion(i, 'max_score', Number(e.target.value))} disabled={isLocked}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50" />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer controls */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button onClick={addCriterion} disabled={isLocked}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-blue-300 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus className="w-4 h-4" /> Add Criterion
          </button>

          <div className={`flex items-center gap-2 text-sm font-medium ${isValid ? 'text-emerald-600' : 'text-red-600'}`}>
            {isValid ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            Total weight: {totalWeight.toFixed(1)}%{!isValid && ' (must be 100%)'}
            {hasScoreErrors && <span className="ml-2 text-red-600">⚠ Fix score ranges</span>}
          </div>
        </div>

        <button onClick={saveSchema} disabled={isLocked || saving || !isValid || criteria.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Schema'}
        </button>
      </div>
    </div>
  );
}
