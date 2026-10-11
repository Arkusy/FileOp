// Browser-native Matroska (MKV / WebM) Subtitle Extractor & Demuxer
// Decodes EBML element headers and extracts SRT, ASS/SSA, and WebVTT subtitle tracks completely client-side.

export interface SubtitleCue {
  startMs: number;
  endMs: number;
  text: string;
  layer?: number;
  style?: string;
  actor?: string;
  raw?: string;
}

export interface MkvSubtitleTrack {
  trackNumber: number;
  trackUid?: number;
  trackType: number; // 0x11 = 17 for subtitle
  codecId: string; // e.g. 'S_TEXT/UTF8', 'S_TEXT/ASS', 'S_TEXT/SSA', 'S_TEXT/WEBVTT'
  language: string;
  name: string;
  hasCustomName?: boolean;
  codecPrivate?: string;
  cues: SubtitleCue[];
}

export interface MkvExtractionResult {
  tracks: MkvSubtitleTrack[];
  durationMs: number;
  title?: string;
}

/**
 * Generate a clean, descriptive subtitle filename for export/download.
 * Uses the embedded track name (e.g. "above", "below"), language, and MKV base filename.
 * If multiple tracks share the same name, appends +1, +2, etc. (e.g. "above", "above1", "above2").
 */
export function getSubtitleFileName(
  baseFileName: string,
  track: MkvSubtitleTrack,
  trackIndex: number,
  allTracks: MkvSubtitleTrack[],
  format: 'srt' | 'vtt' | 'ass'
): string {
  const base = baseFileName.replace(/\.[^.]+$/, '');

  const getCleanLabel = (t: MkvSubtitleTrack, idx: number): string => {
    const rawName = (t.name || '').trim();
    const isGeneric =
      !rawName ||
      (!t.hasCustomName && (/^subtitle\s*track\s*\d+$/i.test(rawName) || /^track\s*#?\d+$/i.test(rawName)));

    if (!isGeneric && rawName) {
      // Remove invalid filename characters: / \ : * ? " < > |
      const clean = rawName.replace(/[\/\\:*?"<>|]/g, '_').trim();
      if (clean) return clean;
    }

    if (t.language && t.language !== 'und') {
      return t.language.toLowerCase().trim();
    }

    return `track${t.trackNumber || idx + 1}`;
  };

  const nameCounts = new Map<string, number>();
  let targetLabel = '';

  for (let i = 0; i < allTracks.length; i++) {
    const t = allTracks[i];
    const label = getCleanLabel(t, i);
    const key = label.toLowerCase();
    const count = nameCounts.get(key) || 0;
    nameCounts.set(key, count + 1);

    if (i === trackIndex) {
      if (count === 0) {
        targetLabel = label;
      } else {
        targetLabel = `${label}${count}`;
      }
      break;
    }
  }

  if (!targetLabel) {
    targetLabel = getCleanLabel(track, trackIndex);
  }

  return `${base}.${targetLabel}.${format}`;
}

// Convert milliseconds to SRT timestamp: 00:01:23,456
export function formatSrtTimestamp(ms: number): string {
  if (ms < 0) ms = 0;
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
}

// Convert milliseconds to VTT timestamp: 00:01:23.456
export function formatVttTimestamp(ms: number): string {
  if (ms < 0) ms = 0;
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
}

// Convert milliseconds to ASS timestamp: 0:01:23.45
export function formatAssTimestamp(ms: number): string {
  if (ms < 0) ms = 0;
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centis = Math.floor((ms % 1000) / 10);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${hours}:${pad(minutes)}:${pad(seconds)}.${pad(centis, 2)}`;
}

// Detect embedded subtitle track's native format ('ass' | 'srt' | 'vtt')
export function getTrackNativeFormat(track: MkvSubtitleTrack): 'ass' | 'srt' | 'vtt' {
  const codec = (track?.codecId || '').toUpperCase();
  if (codec.includes('ASS') || codec.includes('SSA')) return 'ass';
  if (codec.includes('VTT') || codec.includes('WEBVTT')) return 'vtt';
  return 'srt';
}

// Clean ASS dialogue styling tags for clean plain text export (e.g. {\\b1}Hello{\\b0} -> Hello)
export function stripAssTags(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, '') // remove {...} override tags
    .replace(/\\N/g, '\n') // replace \N with newlines
    .replace(/\\n/g, ' ')
    .replace(/\\h/g, ' ')
    .trim();
}

// Build complete .SRT string from cues
export function buildSrtString(cues: SubtitleCue[]): string {
  const sorted = [...cues].sort((a, b) => a.startMs - b.startMs);
  const blocks: string[] = [];

  sorted.forEach((cue, idx) => {
    // Strip ASS tags if present
    const cleanText = cue.text.includes('{') ? stripAssTags(cue.text) : cue.text.replace(/\\N/g, '\n');
    if (!cleanText.trim()) return;

    const start = formatSrtTimestamp(cue.startMs);
    const end = formatSrtTimestamp(cue.endMs > cue.startMs ? cue.endMs : cue.startMs + 3000);

    blocks.push(`${idx + 1}\n${start} --> ${end}\n${cleanText.trim()}`);
  });

  return blocks.join('\n\n') + '\n';
}

// Build complete WebVTT string from cues
export function buildVttString(cues: SubtitleCue[], trackName?: string): string {
  const sorted = [...cues].sort((a, b) => a.startMs - b.startMs);
  const lines: string[] = ['WEBVTT'];
  if (trackName) {
    lines.push(`NOTE Title: ${trackName}`);
  }
  lines.push('');

  sorted.forEach((cue, idx) => {
    const cleanText = cue.text.includes('{') ? stripAssTags(cue.text) : cue.text.replace(/\\N/g, '\n');
    if (!cleanText.trim()) return;

    const start = formatVttTimestamp(cue.startMs);
    const end = formatVttTimestamp(cue.endMs > cue.startMs ? cue.endMs : cue.startMs + 3000);

    lines.push(`${idx + 1}`);
    lines.push(`${start} --> ${end}`);
    lines.push(cleanText.trim());
    lines.push('');
  });

  return lines.join('\n');
}

// Build complete ASS script string from cues and header
export function buildAssString(cues: SubtitleCue[], codecPrivate?: string, trackName?: string): string {
  const sorted = [...cues].sort((a, b) => a.startMs - b.startMs);
  let header = codecPrivate || '';

  if (!header.includes('[Script Info]')) {
    header = `[Script Info]\nTitle: ${trackName || 'Extracted Subtitles'}\nScriptType: v4.00+\nWrapStyle: 0\nScaledBorderAndShadow: yes\nYCbCr Matrix: None\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1\n\n`;
  }

  // Ensure [Events] header exists
  let eventsHeader = '';
  if (!header.includes('[Events]')) {
    eventsHeader = `[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  }

  const events: string[] = [];
  sorted.forEach((cue) => {
    const start = formatAssTimestamp(cue.startMs);
    const end = formatAssTimestamp(cue.endMs > cue.startMs ? cue.endMs : cue.startMs + 3000);
    const layer = cue.layer ?? 0;
    const style = cue.style || 'Default';
    const actor = cue.actor || '';
    const text = cue.text.replace(/\r?\n/g, '\\N');

    events.push(`Dialogue: ${layer},${start},${end},${style},${actor},0,0,0,,${text}`);
  });

  return `${header.trim()}\n\n${eventsHeader}${events.join('\n')}\n`;
}

// Convert ASS comma-delimited dialogue payload to SubtitleCue
// Matroska ASS Block format: ReadOrder (number), Layer (number), Style, Name, MarginL, MarginR, MarginV, Effect, Text
function parseAssBlockPayload(payload: string, startMs: number, endMs: number): SubtitleCue {
  // Matroska stores ASS event as: ReadOrder,Layer,Style,Name,MarginL,MarginR,MarginV,Effect,Text
  // Note: first 8 commas separate metadata, remainder is the text
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let commasFound = 0;

  for (let i = 0; i < payload.length; i++) {
    const ch = payload[i];
    if (commasFound < 8 && ch === ',') {
      parts.push(current);
      current = '';
      commasFound++;
    } else {
      current += ch;
    }
  }
  parts.push(current);

  if (parts.length >= 9) {
    const layer = parseInt(parts[1], 10) || 0;
    const style = parts[2] || 'Default';
    const actor = parts[3] || '';
    const text = parts[8];
    return {
      startMs,
      endMs,
      layer,
      style,
      actor,
      text,
      raw: payload,
    };
  }

  return {
    startMs,
    endMs,
    text: payload,
  };
}

/**
 * Stream/Chunked MKV Subtitle Parser
 * Reads Matroska file headers, tracks, and clusters to extract all embedded subtitle streams.
 */
export async function extractSubtitlesFromMkv(
  file: File,
  onProgress?: (percent: number) => void
): Promise<MkvExtractionResult> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const totalLength = bytes.length;

  let offset = 0;
  const tracks: Map<number, MkvSubtitleTrack> = new Map();
  let timestampScale = 1000000; // default 1ms per tick
  let currentClusterTimestamp = 0;
  let durationMs = 0;

  const textDecoder = new TextDecoder('utf-8');

  // Read variable size integer (VINT) with EBML class marker
  function readVint(pos: number): { value: number; length: number } | null {
    if (pos >= totalLength) return null;
    const b0 = bytes[pos];
    let mask = 0x80;
    let len = 1;

    while (len <= 8 && (b0 & mask) === 0) {
      mask >>= 1;
      len++;
    }

    if (len > 8) return null; // Invalid VINT
    if (pos + len > totalLength) return null;

    let val = b0 & (mask - 1);
    for (let i = 1; i < len; i++) {
      val = val * 256 + bytes[pos + i];
    }

    return { value: val, length: len };
  }

  // Read Raw Element ID (keeping the leading marker bits)
  function readElementId(pos: number): { id: number; length: number } | null {
    if (pos >= totalLength) return null;
    const b0 = bytes[pos];
    let mask = 0x80;
    let len = 1;

    while (len <= 4 && (b0 & mask) === 0) {
      mask >>= 1;
      len++;
    }

    if (len > 4) {
      // Elements can be up to 4 bytes in standard Matroska
      return { id: b0, length: 1 };
    }
    if (pos + len > totalLength) return null;

    let id = 0;
    for (let i = 0; i < len; i++) {
      id = (id << 8) | bytes[pos + i];
    }
    return { id: id >>> 0, length: len };
  }

  // Read unsigned integer of n bytes
  function readUint(pos: number, len: number): number {
    let res = 0;
    for (let i = 0; i < len; i++) {
      res = res * 256 + bytes[pos + i];
    }
    return res;
  }

  // Parse TrackEntry element (0xAE)
  function parseTrackEntry(entryPos: number, entrySize: number) {
    let p = entryPos;
    const end = entryPos + entrySize;

    let trackNum = 0;
    let trackUid = 0;
    let trackType = 0;
    let codecId = '';
    let lang = 'und';
    let name = '';
    let codecPrivate = '';

    while (p < end) {
      const el = readElementId(p);
      if (!el) break;
      p += el.length;
      const sizeVint = readVint(p);
      if (!sizeVint) break;
      p += sizeVint.length;
      const dataSize = sizeVint.value;

      if (el.id === 0xd7) {
        // TrackNumber
        trackNum = readUint(p, dataSize);
      } else if (el.id === 0x73c5) {
        // TrackUID
        trackUid = readUint(p, dataSize);
      } else if (el.id === 0x83) {
        // TrackType (0x11 = 17 subtitle)
        trackType = readUint(p, dataSize);
      } else if (el.id === 0x86) {
        // CodecID
        codecId = textDecoder.decode(bytes.subarray(p, p + dataSize)).replace(/\0/g, '').trim();
      } else if (el.id === 0x22b59c || el.id === 0x22b59d) {
        // Language or LanguageBCP47
        const l = textDecoder.decode(bytes.subarray(p, p + dataSize)).replace(/\0/g, '').trim();
        if (l && (!lang || lang === 'und')) {
          lang = l;
        }
      } else if (el.id === 0x536e) {
        // Name (Track Title in MKV)
        name = textDecoder.decode(bytes.subarray(p, p + dataSize)).replace(/\0/g, '').trim();
      } else if (el.id === 0x63a2) {
        // CodecPrivate
        codecPrivate = textDecoder.decode(bytes.subarray(p, p + dataSize));
      }

      p += dataSize;
    }

    // Only keep subtitle tracks (TrackType 0x11 = 17) or known subtitle CodecIDs
    const isSubtitleCodec =
      codecId.startsWith('S_TEXT') ||
      codecId.startsWith('S_VOBSUB') ||
      codecId.startsWith('S_HDMV') ||
      codecId.includes('SUBTITLE');

    if (trackType === 0x11 || isSubtitleCodec) {
      const explicitName = name || '';
      tracks.set(trackNum, {
        trackNumber: trackNum,
        trackUid,
        trackType: trackType || 0x11,
        codecId,
        language: lang || 'und',
        name: explicitName || (lang && lang !== 'und' ? `${lang.toUpperCase()} Subtitle` : `Subtitle Track ${trackNum}`),
        hasCustomName: Boolean(explicitName),
        codecPrivate,
        cues: [],
      });
    }
  }

  // Parse Matroska Tags (0x1254C367) if present
  function parseTags(tagsPos: number, tagsSize: number) {
    let p = tagsPos;
    const end = tagsPos + tagsSize;
    while (p < end) {
      const el = readElementId(p);
      if (!el) break;
      p += el.length;
      const sizeVint = readVint(p);
      if (!sizeVint) break;
      p += sizeVint.length;
      const dataSize = sizeVint.value;

      if (el.id === 0x7373) {
        // Tag
        let tp = p;
        const tagEnd = p + dataSize;
        let targetUid = 0;
        let tagName = '';
        let tagString = '';

        while (tp < tagEnd) {
          const tel = readElementId(tp);
          if (!tel) break;
          tp += tel.length;
          const tsize = readVint(tp);
          if (!tsize) break;
          tp += tsize.length;
          const subSize = tsize.value;

          if (tel.id === 0x63c0) {
            // Targets
            let tgtP = tp;
            const tgtEnd = tp + subSize;
            while (tgtP < tgtEnd) {
              const tgEl = readElementId(tgtP);
              if (!tgEl) break;
              tgtP += tgEl.length;
              const tgSz = readVint(tgtP);
              if (!tgSz) break;
              tgtP += tgSz.length;
              if (tgEl.id === 0x63c5) {
                targetUid = readUint(tgtP, tgSz.value);
              }
              tgtP += tgSz.value;
            }
          } else if (tel.id === 0x67c8) {
            // SimpleTag
            let stP = tp;
            const stEnd = tp + subSize;
            while (stP < stEnd) {
              const stEl = readElementId(stP);
              if (!stEl) break;
              stP += stEl.length;
              const stSz = readVint(stP);
              if (!stSz) break;
              stP += stSz.length;
              if (stEl.id === 0x45a3) {
                tagName = textDecoder.decode(bytes.subarray(stP, stP + stSz.value)).replace(/\0/g, '').trim();
              } else if (stEl.id === 0x4487) {
                tagString = textDecoder.decode(bytes.subarray(stP, stP + stSz.value)).replace(/\0/g, '').trim();
              }
              stP += stSz.value;
            }
          }
          tp += subSize;
        }

        if (tagString && (tagName.toUpperCase() === 'TITLE' || tagName.toUpperCase() === 'NAME')) {
          for (const trk of tracks.values()) {
            if (!trk.hasCustomName && (targetUid === 0 || trk.trackUid === targetUid || trk.trackNumber === targetUid)) {
              trk.name = tagString;
              trk.hasCustomName = true;
              break;
            }
          }
        }
      }
      p += dataSize;
    }
  }

  // Parse Block / SimpleBlock for subtitles
  function parseBlockData(blockPos: number, blockSize: number, blockDurationMs: number = 0) {
    let p = blockPos;
    // Track Number (VINT)
    const trackVint = readVint(p);
    if (!trackVint) return;
    p += trackVint.length;
    const trackNum = trackVint.value;

    const track = tracks.get(trackNum);
    if (!track) {
      // Not a subtitle track, skip
      return;
    }

    if (p + 3 > blockPos + blockSize) return;

    // Relative timestamp (signed 16-bit integer, big endian)
    const relTime = view.getInt16(p, false);
    p += 2;

    // Flags (lacing, etc.)
    const flags = bytes[p];
    p += 1;
    const lacing = (flags >> 1) & 0x03;

    // Subtitle start timestamp in ms
    const timeScaleFactor = timestampScale / 1000000;
    const startMs = Math.round((currentClusterTimestamp + relTime) * timeScaleFactor);
    let endMs = startMs + Math.round(blockDurationMs * timeScaleFactor);
    if (endMs <= startMs) {
      endMs = startMs + 3000; // fallback duration if not given in BlockGroup
    }

    // If lacing is present, subtitles typically don't lace or use no lacing (00b)
    // Extract payload text
    const payloadBytes = bytes.subarray(p, blockPos + blockSize);
    const rawPayload = textDecoder.decode(payloadBytes).trim();

    if (!rawPayload) return;

    if (track.codecId === 'S_TEXT/ASS' || track.codecId === 'S_TEXT/SSA') {
      const cue = parseAssBlockPayload(rawPayload, startMs, endMs);
      track.cues.push(cue);
    } else {
      // Plain UTF-8 SRT or WebVTT
      track.cues.push({
        startMs,
        endMs,
        text: rawPayload,
      });
    }
  }

  // Parse BlockGroup (0xA0)
  function parseBlockGroup(bgPos: number, bgSize: number) {
    let p = bgPos;
    const end = bgPos + bgSize;
    let blockPos = 0;
    let blockSize = 0;
    let blockDuration = 0;

    while (p < end) {
      const el = readElementId(p);
      if (!el) break;
      p += el.length;
      const sizeVint = readVint(p);
      if (!sizeVint) break;
      p += sizeVint.length;
      const dataSize = sizeVint.value;

      if (el.id === 0xa1) {
        // Block
        blockPos = p;
        blockSize = dataSize;
      } else if (el.id === 0x9b) {
        // BlockDuration
        blockDuration = readUint(p, dataSize);
      }

      p += dataSize;
    }

    if (blockPos > 0) {
      parseBlockData(blockPos, blockSize, blockDuration);
    }
  }

  // Parse Cluster (0x1F43B675)
  function parseCluster(clusterPos: number, clusterSize: number) {
    let p = clusterPos;
    const end = clusterPos + clusterSize;

    while (p < end && p < totalLength) {
      const el = readElementId(p);
      if (!el) break;
      p += el.length;
      const sizeVint = readVint(p);
      if (!sizeVint) break;
      p += sizeVint.length;
      const dataSize = sizeVint.value;

      if (el.id === 0xe7) {
        // Cluster Timestamp
        currentClusterTimestamp = readUint(p, dataSize);
      } else if (el.id === 0xa3) {
        // SimpleBlock
        parseBlockData(p, dataSize, 0);
      } else if (el.id === 0xa0) {
        // BlockGroup
        parseBlockGroup(p, dataSize);
      }

      p += dataSize;
    }
  }

  // Main EBML traversal loop
  let lastReportTime = 0;
  while (offset < totalLength) {
    const el = readElementId(offset);
    if (!el) break;
    offset += el.length;

    const sizeVint = readVint(offset);
    if (!sizeVint) break;
    offset += sizeVint.length;
    const dataSize = sizeVint.value;

    const now = Date.now();
    if (onProgress && now - lastReportTime > 200) {
      onProgress(Math.min(99, Math.round((offset / totalLength) * 100)));
      lastReportTime = now;
    }

    // Top Level EBML Elements:
    if (el.id === 0x18538067) {
      // Segment: contains everything, step inside
      continue;
    } else if (el.id === 0x1549a966) {
      // Segment Info: get TimestampScale and Duration
      let p = offset;
      const end = offset + dataSize;
      while (p < end) {
        const subEl = readElementId(p);
        if (!subEl) break;
        p += subEl.length;
        const subSize = readVint(p);
        if (!subSize) break;
        p += subSize.length;

        if (subEl.id === 0x2ad7b1) {
          // TimestampScale
          timestampScale = readUint(p, subSize.value);
        } else if (subEl.id === 0x4489) {
          // Duration (Float 32 or Float 64)
          if (subSize.value === 4) {
            durationMs = view.getFloat32(p, false);
          } else if (subSize.value === 8) {
            durationMs = view.getFloat64(p, false);
          }
        }
        p += subSize.value;
      }
      offset += dataSize;
    } else if (el.id === 0x1654ae6b) {
      // Tracks element: discover all tracks
      let p = offset;
      const end = offset + dataSize;
      while (p < end) {
        const subEl = readElementId(p);
        if (!subEl) break;
        p += subEl.length;
        const subSize = readVint(p);
        if (!subSize) break;
        p += subSize.length;

        if (subEl.id === 0xae) {
          // TrackEntry
          parseTrackEntry(p, subSize.value);
        }
        p += subSize.value;
      }
      offset += dataSize;
    } else if (el.id === 0x1f43b675) {
      // Cluster: media blocks
      parseCluster(offset, dataSize);
      offset += dataSize;
    } else if (el.id === 0x1254c367) {
      // Tags element: capture track title/name metadata if needed
      parseTags(offset, dataSize);
      offset += dataSize;
    } else {
      // Other top-level containers (SeekHead, Cues, Chapters, Attachments)
      offset += dataSize;
    }
  }

  if (onProgress) onProgress(100);

  const trackList = Array.from(tracks.values());
  return {
    tracks: trackList,
    durationMs: Math.round(durationMs * (timestampScale / 1000000)),
  };
}
