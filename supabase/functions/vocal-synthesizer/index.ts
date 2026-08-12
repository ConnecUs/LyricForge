import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// ── Edge-TTS WebSocket protocol constants ─────────────────────────────────────
const EDGE_TTS_WS_URL =
  'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4';

const VOICE_MAP: Record<string, string> = {
  'male-natural':   'en-US-GuyNeural',
  'female-natural': 'en-US-JennyNeural',
  'male-rap':       'en-US-AndrewMultilingualNeural',
  'female-rap':     'en-US-AvaMultilingualNeural',
  'male-sing':      'en-US-RogerNeural',
  'female-sing':    'en-US-NancyNeural',
  'male-dramatic':  'en-US-DavisNeural',
  'female-dramatic':'en-US-SaraNeural',
  'male-whisper':   'en-US-ChristopherNeural',
  'female-whisper': 'en-US-MichelleNeural',
};

/** Map rate/pitch to SSML percentage strings */
function rateToSSML(rate: number): string {
  const pct = Math.round((rate - 1) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}
function pitchToSSML(pitch: number): string {
  const hz = Math.round((pitch - 1) * 50);
  return hz >= 0 ? `+${hz}Hz` : `${hz}Hz`;
}

/** Build SSML document for Edge TTS */
function buildSSML(text: string, voice: string, rate: number, pitch: number): string {
  const lines = text.split('\n').filter(l => l.trim());
  const prosody = lines
    .map(l => `<s>${l}</s><break time="400ms"/>`)
    .join('\n    ');

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="${voice}">
    <prosody rate="${rateToSSML(rate)}" pitch="${pitchToSSML(pitch)}">
      ${prosody}
    </prosody>
  </voice>
</speak>`;
}

/** Synthesize audio via Edge-TTS WebSocket protocol */
async function synthesizeEdgeTTS(ssml: string, voice: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(EDGE_TTS_WS_URL);
    const audioChunks: Uint8Array[] = [];
    let headerSent = false;

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Edge TTS timeout after 30s'));
    }, 30000);

    ws.onopen = () => {
      // Send configuration message
      const configMsg = [
        'X-Timestamp:' + new Date().toUTCString(),
        'Content-Type:application/json; charset=utf-8',
        'Path:speech.config',
        '',
        JSON.stringify({
          context: {
            synthesis: {
              audio: { metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false }, outputFormat: 'audio-24khz-96kbitrate-mono-mp3' },
            },
          },
        }),
      ].join('\r\n');
      ws.send(configMsg);

      // Send SSML synthesis request
      const requestId = crypto.randomUUID().replace(/-/g, '');
      const ssmlMsg = [
        `X-RequestId:${requestId}`,
        'Content-Type:application/ssml+xml',
        `X-Timestamp:${new Date().toUTCString()}`,
        'Path:ssml',
        '',
        ssml,
      ].join('\r\n');
      ws.send(ssmlMsg);
      headerSent = true;
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        // Text message — check for turn end
        if (event.data.includes('Path:turn.end')) {
          clearTimeout(timeout);
          ws.close();

          // Merge all chunks
          const total = audioChunks.reduce((acc, c) => acc + c.length, 0);
          const merged = new Uint8Array(total);
          let offset = 0;
          for (const chunk of audioChunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          resolve(merged);
        }
      } else {
        // Binary message — audio data
        // Edge TTS binary format: 2-byte header length + header text + audio bytes
        const data = event.data as ArrayBuffer;
        const view = new DataView(data);
        const headerLength = view.getUint16(0);
        const audioStart = headerLength + 2;

        if (audioStart < data.byteLength) {
          audioChunks.push(new Uint8Array(data, audioStart));
        }
      }
    };

    ws.onerror = (e) => {
      clearTimeout(timeout);
      reject(new Error(`Edge TTS WebSocket error: ${JSON.stringify(e)}`));
    };

    ws.onclose = (e) => {
      if (!headerSent) {
        clearTimeout(timeout);
        reject(new Error(`WebSocket closed before synthesis: ${e.code} ${e.reason}`));
      }
    };
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

    const body = await req.json();
    const { action, payload } = body;

    // ── Action: generate_ssml — AI-enhanced SSML markup ─────────────────
    if (action === 'generate_ssml') {
      const { text, style, rate, pitch, gender } = payload;
      const voiceKey = `${gender ?? 'male'}-${style ?? 'natural'}`;
      const voiceName = VOICE_MAP[voiceKey] ?? 'en-US-GuyNeural';

      if (!apiKey || !baseUrl) {
        // Return simple SSML without AI enhancement
        const ssml = buildSSML(text, voiceName, rate ?? 1.0, pitch ?? 1.0);
        return new Response(JSON.stringify({ ssml, voice: voiceName }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Use AI to clean/format text for better speech
      const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `You are an expert in speech synthesis. Your job is to reformat lyric text for natural TTS output.
Rules:
- Remove LRC timestamps if any [mm:ss.xx]
- Add commas or pauses where natural breath marks occur  
- Expand abbreviations
- Keep each line separate with a newline
- Style "${style}": ${style === 'rap' ? 'keep punchy, short phrases' : style === 'sing' ? 'elongate vowels with "..." notation' : style === 'whisper' ? 'add softness cues' : 'natural conversational flow'}
- Output ONLY the cleaned text, no explanations`,
            },
            { role: 'user', content: `Format this for "${style}" TTS:\n\n${text}` },
          ],
          temperature: 0.3,
          max_tokens: 600,
        }),
      });

      let formattedText = text;
      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        formattedText = aiData.choices?.[0]?.message?.content ?? text;
      }

      const ssml = buildSSML(formattedText, voiceName, rate ?? 1.0, pitch ?? 1.0);
      return new Response(JSON.stringify({ ssml, voice: voiceName, formattedText }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Action: synthesize — full audio generation via Edge-TTS ─────────
    if (action === 'synthesize') {
      const { text, style, rate, pitch, gender } = payload;
      const voiceKey = `${gender ?? 'male'}-${style ?? 'natural'}`;
      const voiceName = VOICE_MAP[voiceKey] ?? 'en-US-GuyNeural';

      console.log(`[vocal-synth] Synthesizing: voice=${voiceName}, style=${style}, rate=${rate}, pitch=${pitch}`);

      const ssml = buildSSML(text, voiceName, rate ?? 1.0, pitch ?? 1.0);

      const audioBytes = await synthesizeEdgeTTS(ssml, voiceName);

      console.log(`[vocal-synth] Generated ${audioBytes.length} bytes of audio`);

      // Encode to base64 for JSON transport
      let binary = '';
      for (let i = 0; i < audioBytes.length; i++) {
        binary += String.fromCharCode(audioBytes[i]);
      }
      const audioBase64 = btoa(binary);

      return new Response(
        JSON.stringify({
          audioBase64,
          mimeType: 'audio/mpeg',
          voice: voiceName,
          bytes: audioBytes.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[vocal-synth] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
