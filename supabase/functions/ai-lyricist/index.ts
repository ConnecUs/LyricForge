import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

    if (!apiKey || !baseUrl) {
      return new Response(JSON.stringify({ error: 'OnSpace AI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action, payload } = body;

    let systemPrompt = '';
    let userPrompt = '';

    if (action === 'generate') {
      const { genre, theme, section, mood, bpm, rhymeScheme, existingLyrics } = payload;
      systemPrompt = `You are an elite lyricist and songwriter. You write emotionally powerful, rhythmically precise lyrics with natural flow and vivid imagery. You understand music theory, prosody, and rhyme schemes. When given a section type (Verse, Chorus, Bridge, Hook), you adapt the energy and density accordingly. Always output ONLY the lyrics — no explanations, no headers, no extra commentary. Each line should be on its own line.`;
      userPrompt = `Write a ${section ?? 'Verse'} for a ${genre ?? 'hip-hop'} song.
Mood: ${mood ?? 'energetic'}
Theme: ${theme ?? 'ambition and success'}
BPM feel: ${bpm ?? 90} BPM (${bpm > 130 ? 'fast, punchy lines' : bpm > 100 ? 'mid-tempo flow' : 'slow, deliberate delivery'})
Rhyme scheme: ${rhymeScheme ?? 'AABB'}
${existingLyrics ? `\nContext from existing lyrics:\n${existingLyrics.slice(0, 400)}` : ''}

Write 8-12 lines. Make it authentic, vivid, and rhythmically satisfying.`;
    } else if (action === 'refine') {
      const { lyrics, instruction } = payload;
      systemPrompt = `You are an expert lyric editor. Your job is to refine and improve the given lyrics while preserving the artist's voice. You fix clunky rhythms, improve rhymes, sharpen imagery, and maintain syllabic flow. Output ONLY the refined lyrics, one line per line, no explanations.`;
      userPrompt = `Refine these lyrics:\n\n${lyrics}\n\nInstruction: ${instruction ?? 'Improve flow and rhyme scheme while keeping the meaning.'}`;
    } else if (action === 'rhyme') {
      const { word, count } = payload;
      systemPrompt = `You are a rhyme dictionary. Return rhymes for the given word — perfect rhymes first, then near-rhymes. Output as a JSON array of strings. No explanations.`;
      userPrompt = `Give ${count ?? 10} rhymes for the word: "${word}". Prioritize words that work in rap/hip-hop lyrics. Return as JSON array.`;
    } else if (action === 'analyze') {
      const { lyrics } = payload;
      systemPrompt = `You are a music theory and lyrics analyst. Analyze the given lyrics and return a JSON object with: syllableCount (number), rhymeScheme (string like "AABB"), avgSyllablesPerLine (number), rhymingWords (array of pairs), suggestedFlow (string). No extra text, just the JSON.`;
      userPrompt = `Analyze these lyrics:\n\n${lyrics}`;
    } else {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[ai-lyricist] Action: ${action}`);

    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: action === 'generate' ? 0.85 : 0.6,
        max_tokens: 800,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[ai-lyricist] AI API error:', errText);
      return new Response(JSON.stringify({ error: `AI error: ${errText}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content ?? '';
    console.log(`[ai-lyricist] Response length: ${content.length} chars`);

    return new Response(JSON.stringify({ content, action }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[ai-lyricist] Unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
