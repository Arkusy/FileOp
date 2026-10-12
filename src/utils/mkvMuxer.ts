// Browser-native Matroska (MKV) Multiplexer
// Injects subtitle tracks (SRT, ASS, VTT) and sets Matroska DocType into WebM/EBML streams.

import { MkvSubtitleTrack } from './mkvSubtitleExtractor';

// Encode variable size integer (VINT)
function encodeVint(val: number): Uint8Array {
  if (val < 0x7f) {
    return new Uint8Array([0x80 | val]);
  } else if (val < 0x3fff) {
    return new Uint8Array([0x40 | (val >> 8), val & 0xff]);
  } else if (val < 0x1fffff) {
    return new Uint8Array([0x20 | (val >> 16), (val >> 8) & 0xff, val & 0xff]);
  } else if (val < 0x0fffffff) {
    return new Uint8Array([
      0x10 | (val >> 24),
      (val >> 16) & 0xff,
      (val >> 8) & 0xff,
      val & 0xff,
    ]);
  } else {
    const b0 = 0x08 | Math.floor(val / 0x100000000);
    const v32 = val >>> 0;
    return new Uint8Array([
      b0,
      (v32 >> 24) & 0xff,
      (v32 >> 16) & 0xff,
      (v32 >> 8) & 0xff,
      v32 & 0xff,
    ]);
  }
}

// Encode Element ID
function encodeElementId(id: number): Uint8Array {
  if (id <= 0xff) return new Uint8Array([id]);
  if (id <= 0xffff) return new Uint8Array([(id >> 8) & 0xff, id & 0xff]);
  if (id <= 0xffffff) return new Uint8Array([(id >> 16) & 0xff, (id >> 8) & 0xff, id & 0xff]);
  return new Uint8Array([(id >> 24) & 0xff, (id >> 16) & 0xff, (id >> 8) & 0xff, id & 0xff]);
}

// Create an EBML element from ID and payload
function makeElement(id: number, payload: Uint8Array): Uint8Array {
  const idBytes = encodeElementId(id);
  const sizeBytes = encodeVint(payload.length);
  const res = new Uint8Array(idBytes.length + sizeBytes.length + payload.length);
  res.set(idBytes, 0);
  res.set(sizeBytes, idBytes.length);
  res.set(payload, idBytes.length + sizeBytes.length);
  return res;
}

// Helper to concatenate Uint8Arrays
function concatBytes(arrays: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  for (const arr of arrays) totalLen += arr.length;
  const res = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    res.set(arr, offset);
    offset += arr.length;
  }
  return res;
}

function makeStringElement(id: number, str: string): Uint8Array {
  const encoder = new TextEncoder();
  return makeElement(id, encoder.encode(str));
}

function makeUintElement(id: number, val: number): Uint8Array {
  if (val <= 0xff) {
    return makeElement(id, new Uint8Array([val]));
  } else if (val <= 0xffff) {
    return makeElement(id, new Uint8Array([(val >> 8) & 0xff, val & 0xff]));
  } else if (val <= 0xffffff) {
    return makeElement(id, new Uint8Array([(val >> 16) & 0xff, (val >> 8) & 0xff, val & 0xff]));
  } else {
    return makeElement(
      id,
      new Uint8Array([(val >> 24) & 0xff, (val >> 16) & 0xff, (val >> 8) & 0xff, val & 0xff])
    );
  }
}

// Create Subtitle TrackEntry element (0xAE)
function makeSubtitleTrackEntry(trackNumber: number, track: MkvSubtitleTrack): Uint8Array {
  const parts: Uint8Array[] = [
    makeUintElement(0xd7, trackNumber), // TrackNumber
    makeUintElement(0x73c5, track.trackUid || 2000 + trackNumber), // TrackUID
    makeUintElement(0x83, 0x11), // TrackType = 17 (Subtitle)
    makeStringElement(0x86, track.codecId || 'S_TEXT/UTF8'), // CodecID
  ];

  if (track.name) {
    parts.push(makeStringElement(0x536e, track.name)); // TrackName
  }
  if (track.language && track.language !== 'und') {
    parts.push(makeStringElement(0x22b59c, track.language)); // Language
  }
  if (track.codecPrivate) {
    parts.push(makeStringElement(0x63a2, track.codecPrivate)); // CodecPrivate (ASS header/styles)
  }

  return makeElement(0xae, concatBytes(parts));
}

// Create Subtitle BlockGroup element (0xA0)
function makeSubtitleBlockGroup(
  trackNumber: number,
  relativeTimeMs: number,
  durationMs: number,
  payload: string
): Uint8Array {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(payload);

  const trackVint = encodeVint(trackNumber);
  const relTime = Math.max(-32768, Math.min(32767, Math.round(relativeTimeMs)));
  const timeBytes = new Uint8Array([(relTime >> 8) & 0xff, relTime & 0xff]);
  const flagByte = new Uint8Array([0x00]);

  const blockPayload = concatBytes([trackVint, timeBytes, flagByte, textBytes]);
  const blockElement = makeElement(0xa1, blockPayload); // 0xA1 = Block
  const durationElement = makeUintElement(0x9b, Math.max(50, Math.round(durationMs))); // 0x9B = BlockDuration

  return makeElement(0xa0, concatBytes([blockElement, durationElement]));
}

/**
 * Muxes a WebM recording into a Matroska (.mkv) container and embeds subtitle tracks.
 */
export async function muxSubtitlesIntoMkv(
  webmBlob: Blob,
  tracks: MkvSubtitleTrack[] = []
): Promise<Blob> {
  const buffer = await webmBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const totalLength = bytes.length;

  // Read variable size integer
  function readVint(pos: number): { value: number; length: number } | null {
    if (pos >= totalLength) return null;
    const b0 = bytes[pos];
    let mask = 0x80;
    let len = 1;
    while (len <= 8 && (b0 & mask) === 0) {
      mask >>= 1;
      len++;
    }
    if (len > 8 || pos + len > totalLength) return null;
    let val = b0 & (mask - 1);
    for (let i = 1; i < len; i++) {
      val = val * 256 + bytes[pos + i];
    }
    return { value: val, length: len };
  }

  // Read Element ID
  function readElementId(pos: number): { id: number; length: number } | null {
    if (pos >= totalLength) return null;
    const b0 = bytes[pos];
    let mask = 0x80;
    let len = 1;
    while (len <= 4 && (b0 & mask) === 0) {
      mask >>= 1;
      len++;
    }
    if (len > 4) return { id: b0, length: 1 };
    if (pos + len > totalLength) return null;
    let id = 0;
    for (let i = 0; i < len; i++) {
      id = (id << 8) | bytes[pos + i];
    }
    return { id: id >>> 0, length: len };
  }

  function readUint(pos: number, len: number): number {
    let res = 0;
    for (let i = 0; i < len; i++) {
      res = res * 256 + bytes[pos + i];
    }
    return res;
  }

  try {
    // 1. Rewrite DocType from "webm" to "matroska" in EBML header
    const outputChunks: Uint8Array[] = [];
    let offset = 0;

    // Check if EBML Header (0x1A45DFA3) is present
    const firstEl = readElementId(offset);
    if (firstEl && firstEl.id === 0x1a45dfa3) {
      offset += firstEl.length;
      const sizeVint = readVint(offset);
      if (sizeVint) {
        offset += sizeVint.length;
        const headerEnd = offset + sizeVint.value;

        // Build enhanced EBML Header with DocType "matroska"
        const ebmlParts: Uint8Array[] = [
          makeUintElement(0x4286, 1), // EBMLVersion
          makeUintElement(0x42f7, 1), // EBMLReadVersion
          makeUintElement(0x42f2, 4), // EBMLMaxIDLength
          makeUintElement(0x42f3, 8), // EBMLMaxSizeLength
          makeStringElement(0x4282, 'matroska'), // DocType = "matroska"
          makeUintElement(0x4287, 4), // DocTypeVersion = 4
          makeUintElement(0x4285, 2), // DocTypeReadVersion = 2
        ];
        const newHeader = makeElement(0x1a45dfa3, concatBytes(ebmlParts));
        outputChunks.push(newHeader);
        offset = headerEnd;
      }
    }

    if (tracks.length === 0) {
      // No subtitle tracks to inject, just append the rest with DocType "matroska"
      outputChunks.push(bytes.subarray(offset));
      return new Blob(outputChunks as unknown as BlobPart[], { type: 'video/x-matroska' });
    }

    // 2. Locate Segment (0x18538067)
    const segEl = readElementId(offset);
    if (!segEl || segEl.id !== 0x18538067) {
      // Fallback: return as matroska if structure unexpected
      outputChunks.push(bytes.subarray(offset));
      return new Blob(outputChunks as unknown as BlobPart[], { type: 'video/x-matroska' });
    }

    offset += segEl.length;
    const segSizeVint = readVint(offset);
    if (!segSizeVint) {
      outputChunks.push(bytes.subarray(offset));
      return new Blob(outputChunks as unknown as BlobPart[], { type: 'video/x-matroska' });
    }
    offset += segSizeVint.length;

    // Inside Segment: read child elements (Info, Tracks, Clusters)
    const segmentChildren: Uint8Array[] = [];
    const clusterPositions: { pos: number; size: number; timestamp: number }[] = [];
    let maxExistingTrackNum = 2;

    let p = offset;
    while (p < totalLength) {
      const el = readElementId(p);
      if (!el) break;
      const elId = el.id;
      const elPos = p;
      p += el.length;

      const sz = readVint(p);
      if (!sz) break;
      p += sz.length;
      const dataSize = sz.value;
      const dataPos = p;

      if (elId === 0x1654ae6b) {
        // Tracks element: add subtitle tracks to it
        const existingTracksPayload = bytes.subarray(dataPos, dataPos + dataSize);
        // Find maximum existing TrackNumber
        let tp = dataPos;
        const tEnd = dataPos + dataSize;
        while (tp < tEnd) {
          const tEl = readElementId(tp);
          if (!tEl) break;
          tp += tEl.length;
          const tSz = readVint(tp);
          if (!tSz) break;
          tp += tSz.length;
          if (tEl.id === 0xae) {
            // TrackEntry
            let ep = tp;
            const epEnd = tp + tSz.value;
            while (ep < epEnd) {
              const subEl = readElementId(ep);
              if (!subEl) break;
              ep += subEl.length;
              const subSz = readVint(ep);
              if (!subSz) break;
              ep += subSz.length;
              if (subEl.id === 0xd7) {
                const tn = readUint(ep, subSz.value);
                if (tn > maxExistingTrackNum) maxExistingTrackNum = tn;
              }
              ep += subSz.value;
            }
          }
          tp += tSz.value;
        }

        // Create new subtitle TrackEntry elements
        const subTrackEntries: Uint8Array[] = [];
        tracks.forEach((track, idx) => {
          const assignedTrackNum = maxExistingTrackNum + 1 + idx;
          (track as unknown as { assignedMuxTrackNum: number }).assignedMuxTrackNum = assignedTrackNum;
          subTrackEntries.push(makeSubtitleTrackEntry(assignedTrackNum, track));
        });

        const combinedTracksData = concatBytes([existingTracksPayload, ...subTrackEntries]);
        segmentChildren.push(makeElement(0x1654ae6b, combinedTracksData));
      } else if (elId === 0x1f43b675) {
        // Cluster element: read timestamp
        let clusterTimestamp = 0;
        let cp = dataPos;
        const cEnd = dataPos + dataSize;
        while (cp < cEnd) {
          const cEl = readElementId(cp);
          if (!cEl) break;
          cp += cEl.length;
          const cSz = readVint(cp);
          if (!cSz) break;
          cp += cSz.length;
          if (cEl.id === 0xe7) {
            clusterTimestamp = readUint(cp, cSz.value);
            break;
          }
          cp += cSz.value;
        }

        clusterPositions.push({
          pos: elPos,
          size: dataSize + (dataPos - elPos),
          timestamp: clusterTimestamp,
        });

        // Store original cluster bytes for now
        segmentChildren.push(bytes.subarray(elPos, dataPos + dataSize));
      } else if (elId === 0x114d9b74 || elId === 0x1c53bb6b) {
        // SeekHead / Cues hold absolute byte offsets that become invalid once the
        // Tracks element grows and subtitle blocks are injected. Both are optional,
        // so drop them; players rebuild the index on load.
      } else {
        // Other segment elements (Info, Tags, etc.)
        segmentChildren.push(bytes.subarray(elPos, dataPos + dataSize));
      }

      p += dataSize;
    }

    // Now inject subtitle cues into the clusters
    if (clusterPositions.length > 0) {
      // Find where clusters start in segmentChildren
      let clusterIdx = 0;
      for (let i = 0; i < segmentChildren.length; i++) {
        const itemBytes = segmentChildren[i];
        const itemEl = ((itemBytes[0] << 24) | (itemBytes[1] << 16) | (itemBytes[2] << 8) | itemBytes[3]) >>> 0;
        if (itemEl === 0x1f43b675) {
          const currentCluster = clusterPositions[clusterIdx];
          const nextCluster = clusterPositions[clusterIdx + 1];
          const windowStart = currentCluster.timestamp;
          const windowEnd = nextCluster ? nextCluster.timestamp : windowStart + 10000;

          // Find subtitle cues for this cluster
          const clusterSubtitleBlocks: Uint8Array[] = [];
          tracks.forEach((track) => {
            const assignedNum =
              (track as unknown as { assignedMuxTrackNum: number }).assignedMuxTrackNum || 3;
            track.cues.forEach((cue) => {
              if (cue.startMs >= windowStart && cue.startMs < windowEnd) {
                const relTime = cue.startMs - windowStart;
                const dur = Math.max(100, cue.endMs - cue.startMs);
                const block = makeSubtitleBlockGroup(
                  assignedNum,
                  relTime,
                  dur,
                  cue.raw || cue.text
                );
                clusterSubtitleBlocks.push(block);
              }
            });
          });

          if (clusterSubtitleBlocks.length > 0) {
            // Re-wrap cluster with injected subtitle blocks
            // Read cluster element payload
            let cOffset = 4; // after ID 0x1F43B675
            // Read cluster size VINT
            let mask = 0x80;
            let len = 1;
            while (len <= 8 && (itemBytes[cOffset] & mask) === 0) {
              mask >>= 1;
              len++;
            }
            cOffset += len;
            const originalClusterPayload = itemBytes.subarray(cOffset);
            const newClusterPayload = concatBytes([originalClusterPayload, ...clusterSubtitleBlocks]);
            segmentChildren[i] = makeElement(0x1f43b675, newClusterPayload);
          }

          clusterIdx++;
        }
      }
    }

    // Assemble new Segment
    const combinedSegmentPayload = concatBytes(segmentChildren);
    const newSegment = makeElement(0x18538067, combinedSegmentPayload);
    outputChunks.push(newSegment);

    return new Blob(outputChunks as unknown as BlobPart[], { type: 'video/x-matroska' });
  } catch (err) {
    console.warn('MKV subtitle multiplexing fallback:', err);
    // Graceful fallback: return original recording as matroska
    return new Blob([bytes] as unknown as BlobPart[], { type: 'video/x-matroska' });
  }
}
