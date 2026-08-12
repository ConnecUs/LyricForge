import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Sparkles, RefreshCw, Copy, ChevronDown, Mic2,
  Hash, Music2, Wand2, Search, BarChart2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAILyricist } from '@/hooks/useAILyricist';

interface AILyricistPanelProps {
  currentRawLyrics: string;
  onInsertLyrics: (lyrics: string) => void;
  bpm: number;
}

const SECTION_TYPES = ['Verse', 'Chorus', 'Bridge', 'Hook', 'Intro', 'Outro'] as const;
const GENRES = ['Hip-Hop', 'R&B', 'Pop', 'Trap', 'Lo-fi', 'Drill', 'Afrobeats', 'Rock'];
const RHYME_SCHEMES = ['AABB', 'ABAB', 'ABBA', 'AAAA', 'Free'] as const;
const MOODS = ['Energetic', 'Melancholic', 'Confident', 'Romantic', 'Dark', 'Uplifting', 'Nostalgic'];

/** Count syllables in a word (simple heuristic) */
function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 0;
  if (word.length <= 3) return 1;
  const vowelGroups = word.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;
  if (word.endsWith('e') && !word.endsWith('le')) count = Math.max(1, count - 1);
  return Math.max(1, count);
}

function countLineSyllables(line: string): number {
  return line.split(/\s+/).reduce((sum, w) => sum + countSyllables(w), 0);
}

/** Simple rhyme scheme detection: check last words */
function detectRhymeHighlights(lines: string[]): Map<string, string> {
  const colorMap = new Map<string, string>();
  const endWords = lines.map(l => {
    const words = l.trim().split(/\s+/);
    return words[words.length - 1]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
  });
  const colors = [
    'hsl(213,95%,65%)',   // blue
    'hsl(300,80%,65%)',   // magenta
    'hsl(145,75%,55%)',   // green
    'hsl(38,95%,55%)',    // amber
    'hsl(0,84%,65%)',     // red
    'hsl(180,85%,55%)',   // teal
  ];
  const groups = new Map<string, number>();
  let colorIdx = 0;

  endWords.forEach((word, i) => {
    if (!word || word.length < 2) return;
    // Check if it rhymes with any previous word (last 2-3 chars match)
    let matched = false;
    for (const [groupWord, groupIdx] of groups.entries()) {
      const overlap = Math.min(3, Math.min(word.length, groupWord.length));
      if (word.slice(-overlap) === groupWord.slice(-overlap)) {
        colorMap.set(`${i}`, colors[groupIdx % colors.length]);
        matched = true;
        break;
      }
    }
    if (!matched) {
      groups.set(word, colorIdx);
      colorMap.set(`${i}`, colors[colorIdx % colors.length]);
      colorIdx++;
    }
  });

  return colorMap;
}

export function AILyricistPanel({ currentRawLyrics, onInsertLyrics, bpm }: AILyricistPanelProps) {
  const { state, generateLyrics, refineLyrics, getRhymes, analyzeLyrics } = useAILyricist();

  const [section, setSection] = useState<typeof SECTION_TYPES[number]>('Verse');
  const [genre, setGenre] = useState('Hip-Hop');
  const [mood, setMood] = useState('Energetic');
  const [rhymeScheme, setRhymeScheme] = useState<typeof RHYME_SCHEMES[number]>('AABB');
  const [theme, setTheme] = useState('');
  const [editableLyrics, setEditableLyrics] = useState('');
  const [rhymeWord, setRhymeWord] = useState('');
  const [refineInstruction, setRefineInstruction] = useState('');
  const [activeTab, setActiveTab] = useState<'write' | 'refine' | 'rhyme' | 'analyze'>('write');

  const isLoading = state.status !== 'idle';
  const lines = editableLyrics.split('\n').filter(Boolean);
  const rhymeHighlights = detectRhymeHighlights(lines);

  const handleGenerate = async () => {
    const result = await generateLyrics({
      genre, section, mood, bpm,
      rhymeScheme,
      theme: theme || `${mood.toLowerCase()} ${genre.toLowerCase()} vibes`,
      existingLyrics: currentRawLyrics,
    });
    setEditableLyrics(result);
  };

  const handleRefine = async () => {
    if (!editableLyrics.trim()) { toast.error('No lyrics to refine'); return; }
    const result = await refineLyrics(editableLyrics, refineInstruction || 'Improve flow and rhyme scheme');
    setEditableLyrics(result);
  };

  const handleRhyme = async () => {
    if (!rhymeWord.trim()) return;
    await getRhymes(rhymeWord);
  };

  const handleAnalyze = async () => {
    if (!editableLyrics.trim()) { toast.error('No lyrics to analyze'); return; }
    await analyzeLyrics(editableLyrics);
  };

  const handleCopyAndInsert = () => {
    if (!editableLyrics.trim()) { toast.error('No lyrics to insert'); return; }
    onInsertLyrics(editableLyrics);
    toast.success('Lyrics sent to editor!', { description: 'Find them in the Lyrics Engine panel.' });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editableLyrics);
    toast.success('Copied to clipboard');
  };

  const TABS = [
    { id: 'write', label: 'WRITE', icon: <Sparkles className="w-3 h-3" /> },
    { id: 'refine', label: 'REFINE', icon: <Wand2 className="w-3 h-3" /> },
    { id: 'rhyme', label: 'RHYME', icon: <Search className="w-3 h-3" /> },
    { id: 'analyze', label: 'ANALYZE', icon: <BarChart2 className="w-3 h-3" /> },
  ] as const;

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-0.5 glass-panel rounded-lg p-0.5">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[9px] font-mono uppercase tracking-wider transition-all ${
              activeTab === tab.id
                ? 'bg-[hsl(var(--hud-magenta)/0.2)] text-[hsl(var(--hud-magenta))] border border-[hsl(var(--hud-magenta)/0.4)]'
                : 'text-[hsl(var(--muted-foreground))] hover:text-white'
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* WRITE TAB */}
      {activeTab === 'write' && (
        <div className="space-y-2.5">
          {/* Section selector */}
          <div>
            <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">Section</label>
            <div className="grid grid-cols-3 gap-1">
              {SECTION_TYPES.map(s => (
                <button key={s} onClick={() => setSection(s)}
                  className={`py-1 rounded text-[10px] font-mono transition-all ${
                    section === s
                      ? 'bg-[hsl(var(--hud-magenta)/0.2)] text-[hsl(var(--hud-magenta))] border border-[hsl(var(--hud-magenta)/0.4)]'
                      : 'neo-button text-[hsl(var(--muted-foreground))] hover:text-white'
                  }`}>{s}</button>
              ))}
            </div>
          </div>

          {/* Genre + Mood row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase block mb-1">Genre</label>
              <select value={genre} onChange={e => setGenre(e.target.value)}
                className="w-full bg-[hsl(var(--input))] border border-[hsl(var(--hud-border)/0.5)] rounded px-1.5 py-1 text-[10px] font-mono text-white focus:outline-none focus:border-[hsl(var(--hud-magenta)/0.6)]">
                {GENRES.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase block mb-1">Mood</label>
              <select value={mood} onChange={e => setMood(e.target.value)}
                className="w-full bg-[hsl(var(--input))] border border-[hsl(var(--hud-border)/0.5)] rounded px-1.5 py-1 text-[10px] font-mono text-white focus:outline-none focus:border-[hsl(var(--hud-magenta)/0.6)]">
                {MOODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Rhyme scheme */}
          <div>
            <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">Rhyme Scheme</label>
            <div className="flex gap-1">
              {RHYME_SCHEMES.map(r => (
                <button key={r} onClick={() => setRhymeScheme(r)}
                  className={`flex-1 py-1 rounded text-[9px] font-mono transition-all ${
                    rhymeScheme === r
                      ? 'bg-[hsl(var(--hud-blue)/0.2)] text-[hsl(var(--hud-blue))] border border-[hsl(var(--hud-blue)/0.4)]'
                      : 'neo-button text-[hsl(var(--muted-foreground))] hover:text-white'
                  }`}>{r}</button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">
              Theme / Topic <span className="opacity-50">(optional)</span>
            </label>
            <input
              type="text"
              value={theme}
              onChange={e => setTheme(e.target.value)}
              placeholder="e.g. Late nights, grind, loyalty..."
              className="w-full bg-[hsl(var(--input))] border border-[hsl(var(--hud-border)/0.5)] rounded px-2 py-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-[hsl(var(--hud-magenta)/0.6)] placeholder-[hsl(var(--muted-foreground))]"
            />
          </div>

          {/* BPM display */}
          <div className="flex items-center gap-2 px-2 py-1.5 glass-panel rounded">
            <Music2 className="w-3 h-3 text-[hsl(var(--hud-blue))]" />
            <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">Song BPM:</span>
            <span className="text-[10px] font-mono text-[hsl(var(--hud-blue))] font-bold">{bpm} BPM</span>
            <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] ml-auto">
              {bpm > 130 ? 'Fast flow' : bpm > 100 ? 'Mid-tempo' : 'Slow delivery'}
            </span>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all bg-[hsl(var(--hud-magenta)/0.15)] border border-[hsl(var(--hud-magenta)/0.5)] text-[hsl(var(--hud-magenta))] hover:bg-[hsl(var(--hud-magenta)/0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: '0 0 14px hsl(var(--hud-magenta)/0.2)' }}
          >
            {isLoading && state.status === 'generating'
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> GENERATING...</>
              : <><Sparkles className="w-3.5 h-3.5" /> GENERATE LYRICS</>
            }
          </button>
        </div>
      )}

      {/* REFINE TAB */}
      {activeTab === 'refine' && (
        <div className="space-y-2">
          <div>
            <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">Refinement Instruction</label>
            <input
              type="text"
              value={refineInstruction}
              onChange={e => setRefineInstruction(e.target.value)}
              placeholder="e.g. Make it more aggressive, improve the rhyme..."
              className="w-full bg-[hsl(var(--input))] border border-[hsl(var(--hud-border)/0.5)] rounded px-2 py-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-[hsl(var(--hud-magenta)/0.6)] placeholder-[hsl(var(--muted-foreground))]"
            />
          </div>
          <button
            onClick={handleRefine}
            disabled={isLoading || !editableLyrics.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold neo-button text-[hsl(var(--hud-amber))] border border-[hsl(var(--hud-amber)/0.4)] hover:border-[hsl(var(--hud-amber)/0.7)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && state.status === 'refining'
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> REFINING...</>
              : <><Wand2 className="w-3.5 h-3.5" /> REFINE LYRICS</>
            }
          </button>
        </div>
      )}

      {/* RHYME TAB */}
      {activeTab === 'rhyme' && (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={rhymeWord}
              onChange={e => setRhymeWord(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRhyme()}
              placeholder="Type a word..."
              className="flex-1 bg-[hsl(var(--input))] border border-[hsl(var(--hud-border)/0.5)] rounded px-2 py-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-[hsl(var(--hud-blue)/0.6)] placeholder-[hsl(var(--muted-foreground))]"
            />
            <button
              onClick={handleRhyme}
              disabled={isLoading}
              className="px-3 rounded neo-button text-[hsl(var(--hud-blue))] border border-[hsl(var(--hud-blue)/0.4)] hover:text-white text-[10px] font-mono disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            </button>
          </div>
          {state.rhymeSuggestions.length > 0 && (
            <div className="glass-panel rounded-lg p-2">
              <p className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] mb-2 uppercase tracking-wider">Rhymes for "{rhymeWord}"</p>
              <div className="flex flex-wrap gap-1">
                {state.rhymeSuggestions.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => { navigator.clipboard.writeText(r); toast.success(`Copied: ${r}`); }}
                    className="px-2 py-0.5 rounded text-[10px] font-mono neo-button text-[hsl(var(--hud-teal))] hover:text-white transition-colors"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ANALYZE TAB */}
      {activeTab === 'analyze' && (
        <div className="space-y-2">
          <button
            onClick={handleAnalyze}
            disabled={isLoading || !editableLyrics.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold neo-button text-[hsl(var(--hud-teal))] border border-[hsl(var(--hud-teal)/0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && state.status === 'analyzing'
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> ANALYZING...</>
              : <><BarChart2 className="w-3.5 h-3.5" /> ANALYZE LYRICS</>
            }
          </button>
          {state.analysis && (
            <div className="glass-panel rounded-lg p-2.5 space-y-1.5">
              {[
                { label: 'Total Syllables', value: state.analysis.syllableCount },
                { label: 'Avg / Line', value: `${state.analysis.avgSyllablesPerLine} syl` },
                { label: 'Rhyme Scheme', value: state.analysis.rhymeScheme },
                { label: 'Flow Type', value: state.analysis.suggestedFlow },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">{label}</span>
                  <span className="text-[10px] font-mono text-white">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live lyrics editor with rhyme highlights + syllable count */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            Lyric Canvas
          </label>
          <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
            {lines.length} lines
          </span>
        </div>

        {/* Line-by-line view with rhyme highlighting + syllable count */}
        {lines.length > 0 ? (
          <div className="glass-panel rounded-lg overflow-hidden">
            {lines.map((line, i) => {
              const syl = countLineSyllables(line);
              const rhymeColor = rhymeHighlights.get(`${i}`);
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2.5 py-1.5 border-b border-[hsl(var(--border)/0.3)] last:border-b-0 hover:bg-[hsl(var(--border)/0.2)] transition-colors group"
                >
                  <span className="text-[8px] font-mono text-[hsl(var(--muted-foreground))] w-4 text-right shrink-0">{i + 1}</span>
                  <span
                    className="flex-1 text-[11px] font-mono text-white leading-tight"
                    style={rhymeColor ? {
                      borderRight: `2px solid ${rhymeColor}`,
                      paddingRight: '4px',
                    } : {}}
                  >
                    {line}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Hash className="w-2.5 h-2.5 text-[hsl(var(--muted-foreground))]" />
                    <span className="text-[8px] font-mono text-[hsl(var(--muted-foreground))]">{syl}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <textarea
            value={editableLyrics}
            onChange={e => setEditableLyrics(e.target.value)}
            placeholder="Generated lyrics appear here. You can also type directly..."
            className="w-full h-36 bg-[hsl(var(--background)/0.7)] border border-[hsl(var(--hud-border)/0.5)] rounded-lg p-2 text-xs font-mono text-white resize-none focus:outline-none focus:border-[hsl(var(--hud-magenta)/0.6)] placeholder-[hsl(var(--muted-foreground))] leading-relaxed"
          />
        )}

        {lines.length > 0 && (
          <textarea
            value={editableLyrics}
            onChange={e => setEditableLyrics(e.target.value)}
            className="w-full h-24 bg-[hsl(var(--background)/0.7)] border border-[hsl(var(--hud-border)/0.4)] rounded-lg p-2 text-xs font-mono text-white resize-none focus:outline-none focus:border-[hsl(var(--hud-magenta)/0.6)] leading-relaxed mt-1"
            placeholder="Edit freely..."
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          onClick={handleCopyAndInsert}
          disabled={!editableLyrics.trim()}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-[hsl(var(--hud-magenta))/0.15] border border-[hsl(var(--hud-magenta)/0.5)] text-[hsl(var(--hud-magenta))] hover:bg-[hsl(var(--hud-magenta)/0.25)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Mic2 className="w-3.5 h-3.5" />
          INSERT TO EDITOR
        </button>
        <button
          onClick={handleCopy}
          disabled={!editableLyrics.trim()}
          className="neo-button px-3 rounded-lg text-[10px] font-mono text-[hsl(var(--muted-foreground))] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
