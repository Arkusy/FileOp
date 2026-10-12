# FileConvert

A fast, private, 100% in-browser file converter and media processor. All operations run directly on your device using WebCodecs and canvas APIs with zero server uploads.

---

## Supported Features & Formats

### 1. Video Processing & Compression
- **Input Formats:** MP4, WebM, MKV, MOV, AVI, 3GP
- **Output Formats:** Auto (preserves original container), MP4, WebM, MKV, GIF, WAV
- **Hardware-Accelerated Codecs (via WebCodecs & Mediabunny):**
  - H.264 (AVC)
  - H.265 (HEVC)
  - VP9
  - AV1
  - Auto-selection based on browser & container support
- **Video Controls:**
  - Resolution scaling (Original, 1080p, 720p, 480p, 360p) with aspect ratio preservation
  - Compression quality levels (High ~4 Mbps, Balanced ~1.5 Mbps, Max Compression ~700 kbps)
  - Visual timeline trimming (start & end markers)
  - Audio track muting for smaller file sizes
  - Video-to-animated-GIF conversion
  - Video-to-WAV audio track extraction

### 2. MKV Subtitle Extraction & Multiplexing
- **Subtitle Extraction:** Parses embedded MKV subtitle tracks (SRT, WebVTT, ASS) using track names and languages.
- **Subtitle Preservation:** Injects extracted subtitle tracks back into Matroska (.mkv) output during video compression.

### 3. Images & Vector Graphics
- **Formats:** PNG, JPG/JPEG, WebP, SVG, GIF, BMP
- **Features:** Image cropping, quality compression, multi-scale SVG export (1x, 2x, 4x), batch conversion, ZIP download.

### 4. Documents & General Files
- **Formats:** PDF, DOCX, TXT
- **Features:** Client-side preview, text extraction, image-to-PDF merging.

### 5. App & Platform
- **PWA (Progressive Web App):** Installable, works fully offline.
- **100% Client-Side:** No files or media are ever uploaded to any server.

---

## What Is Not Supported (Currently)
- **DRM-Protected Media:** Encrypted or copyright-protected streams cannot be decrypted.
- **Unsupported Legacy Codecs:** Codecs that browsers and WebCodecs do not support natively (e.g., RealMedia, Indeo, proprietary FLV codecs).
- **Extremely Large Files on Low-RAM Devices:** Browser memory limits apply to in-memory buffers for massive multi-gigabyte video files.
- **Advanced Subtitle Styling Editor:** Visual inline styling and timing editor for subtitles (currently extracts and multiplexes existing streams).

---

## Future Goals
- [ ] WebAssembly FFmpeg worker fallback for rare or legacy codecs unsupported by native WebCodecs.
- [ ] In-browser subtitle timeline editor and sync offset adjustment.
- [ ] Client-side audio format conversion (MP3, OGG, AAC encoding).
- [ ] Batch document conversion enhancements (e.g., XLSX to CSV, client-side PDF OCR).
- [ ] Web Share API integration to easily share converted files directly to native apps.

---

## License

This project is licensed under a **Non-Commercial Attribution License** (CC BY-NC 4.0 style).

- **Free to use & modify:** You are free to view, use, modify, and distribute the code for non-commercial purposes.
- **Credit Required:** You must give appropriate credit to the original author.
- **Non-Commercial Only:** You may **not** use this code or derived projects for commercial purposes, monetary gain, or paid services. It must remain free.

See the [LICENSE](LICENSE) file for the full text.
