"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Save, Send, ArrowLeft, Users, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ScoringPage() {
  const { eventId, participantId } = useParams();
  const router = useRouter();
  const [participant, setParticipant] = useState<any>(null);
  const [schema, setSchema] = useState<any>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const headers = getHeaders();
        const [pInfo, pSchema, pScores] = await Promise.all([
          fetch(`/api/judge/hackathons/${eventId}/participants/${participantId}`, { headers }).then(r => r.json()),
          fetch(`/api/judge/hackathons/${eventId}/scoring-schema`, { headers }).then(r => r.json()),
          fetch(`/api/judge/hackathons/${eventId}/participants/${participantId}/scores`, { headers }).then(r => r.json()),
        ]);

        setParticipant(pInfo);
        setSchema(pSchema);

        const initialScores: Record<string, number> = {};
        const initialComments: Record<string, string> = {};
        const existingScores = pScores?.scores || [];
        existingScores.forEach((s: any) => {
          initialScores[s.criterion_id] = s.score;
          initialComments[s.criterion_id] = s.comment || '';
        });
        setScores(initialScores);
        setComments(initialComments);
      } catch {
        toast.error('Failed to load evaluation data');
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [eventId, participantId]);

  const handleSave = async (isDraft: boolean) => {
    if (!isDraft) {
      const missing = schema?.criteria?.filter((c: any) => scores[c.id] === undefined) || [];
      if (missing.length > 0) {
        toast.error(`Please score all criteria before submitting`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        scores: Object.entries(scores).map(([critId, score]) => ({
          criterion_id: critId,
          score,
          comment: comments[critId] || ''
        })),
        is_draft: isDraft
      };

      const res = await fetch(`/api/judge/hackathons/${eventId}/participants/${participantId}/scores`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Submission failed');
      }

      toast.success(isDraft ? 'Progress saved as draft' : 'Evaluation submitted!');
      if (!isDraft) router.push(`/judge/${eventId}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const scoredCount = schema?.criteria?.filter((c: any) => scores[c.id] !== undefined).length || 0;
  const totalCount = schema?.criteria?.length || 0;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-sm">Loading evaluation...</span>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Back + Actions header */}
      <div className="flex items-start justify-between gap-4">
        <button
          onClick={() => router.push(`/judge/${eventId}`)}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Assignments
        </button>

        <div className="flex items-center gap-3">
          <button
            disabled={saving}
            onClick={() => handleSave(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-amber-500" />}
            Save Draft
          </button>
          <button
            disabled={saving}
            onClick={() => handleSave(false)}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Evaluation
          </button>
        </div>
      </div>

      {/* Participant card */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-lg flex-shrink-0">
            {participant?.first_name?.[0]}{participant?.last_name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-slate-800">
              {participant?.first_name} {participant?.last_name}
            </h1>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-xs text-slate-400 font-mono">{String(participantId).slice(0, 8)}...</span>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Users className="w-3.5 h-3.5" />
                <span>{participant?.team_name || 'Independent'}</span>
              </div>
              {participant?.project_title && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                  {participant.project_title}
                </span>
              )}
            </div>
          </div>
          {totalCount > 0 && (
            <div className="flex-shrink-0 text-right">
              <p className="text-2xl font-bold text-slate-800">{scoredCount}/{totalCount}</p>
              <p className="text-xs text-slate-400">criteria scored</p>
            </div>
          )}
        </div>

        {totalCount > 0 && (
          <div className="mt-4">
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all"
                style={{ width: `${totalCount > 0 ? (scoredCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Scoring criteria */}
      {!schema ? (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-12 text-center">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">No Scoring Schema</p>
          <p className="text-xs text-slate-400 mt-1">
            The administrator has not yet created a scoring schema for this event.
          </p>
        </div>
      ) : !schema?.criteria?.length ? (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-12 text-center">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-400">Empty Schema</p>
          <p className="text-xs text-slate-300 mt-1">No criteria defined yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {schema.criteria.map((crit: any, idx: number) => {
            const currentScore = scores[crit.id] ?? crit.min_score;
            const isScored = scores[crit.id] !== undefined;
            const pct = ((currentScore - crit.min_score) / (crit.max_score - crit.min_score)) * 100;

            return (
              <div key={crit.id} className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                {/* Criterion header */}
                <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{crit.name}</p>
                      {crit.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{crit.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-slate-400">Weight: <span className="font-semibold text-slate-600">{crit.weight}%</span></span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      {crit.min_score}–{crit.max_score}
                    </span>
                    {isScored && (
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    )}
                  </div>
                </div>

                {/* Criterion body */}
                <div className="p-5 space-y-4">
                  {/* Score slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Score</label>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-blue-600">{currentScore}</span>
                        <span className="text-sm text-slate-400">/ {crit.max_score}</span>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min={crit.min_score}
                        max={crit.max_score}
                        step={1}
                        value={currentScore}
                        onChange={(e) => setScores(s => ({ ...s, [crit.id]: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600"
                      />
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-slate-400">{crit.min_score}</span>
                        <span className="text-[10px] text-slate-400">{crit.max_score}</span>
                      </div>
                    </div>
                  </div>

                  {/* Comments */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Feedback <span className="text-slate-300 normal-case font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={comments[crit.id] || ''}
                      onChange={(e) => setComments(c => ({ ...c, [crit.id]: e.target.value }))}
                      placeholder="Add comments or feedback for this criterion..."
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none placeholder:text-slate-300 transition-colors"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom action bar */}
      {schema?.criteria?.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {scoredCount === totalCount
              ? <span className="text-emerald-600 font-medium flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> All criteria scored</span>
              : <span>{totalCount - scoredCount} criteria remaining</span>
            }
          </p>
          <div className="flex items-center gap-3">
            <button
              disabled={saving}
              onClick={() => handleSave(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-amber-500" />}
              Save Draft
            </button>
            <button
              disabled={saving}
              onClick={() => handleSave(false)}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Evaluation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
