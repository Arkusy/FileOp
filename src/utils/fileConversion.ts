import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { CropArea, ConvertedOutput, SupportedTargetFormat } from '../types/converter';

// Global declarations for CDN libraries
declare global {
  interface Window {
    pdfjsLib?: {
      getDocument: (src: { data: Uint8Array }) => {
        promise: Promise<{
          numPages: number;
          getPage: (pageNumber: number) => Promise<{
            getViewport: (options: { scale: number }) => { width: number; height: number };
            render: (params: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
              promise: Promise<void>;
            };
            getTextContent: () => Promise<{
              items: Array<{ str: string; transform: number[] }>;
            }>;
          }>;
        }>;
      };
      GlobalWorkerOptions: {
        workerSrc: string;
      };
    };
    mammoth?: {
      extractRawText: (params: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
      convertToHtml: (params: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
    };
  }
}

// Initialize PDF.js worker
if (typeof window !== 'undefined' && window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  srt: 'text/plain',
  vtt: 'text/vtt',
  ass: 'text/plain',
  subtitles: 'text/plain',
  auto: 'application/octet-stream',
};

export const TARGET_FORMATS_BY_SOURCE: Record<string, SupportedTargetFormat[]> = {
  png: ['auto', 'png', 'jpg', 'webp', 'pdf', 'svg'],
  jpg: ['auto', 'jpg', 'png', 'webp', 'pdf', 'svg'],
  jpeg: ['auto', 'jpg', 'png', 'webp', 'pdf', 'svg'],
  webp: ['auto', 'webp', 'png', 'jpg', 'pdf', 'svg'],
  svg: ['auto', 'png', 'jpg', 'webp', 'pdf'],
  gif: ['auto', 'gif', 'mp4', 'webm', 'png', 'jpg', 'webp'],
  bmp: ['auto', 'png', 'jpg', 'webp', 'pdf'],
  mp4: ['auto', 'mp4', 'webm', 'mkv', 'gif', 'mp3', 'wav', 'subtitles', 'srt', 'vtt'],
  webm: ['auto', 'webm', 'mp4', 'mkv', 'gif', 'mp3', 'wav', 'subtitles', 'srt', 'vtt'],
  mov: ['auto', 'mp4', 'webm', 'mkv', 'gif', 'mp3', 'wav'],
  mkv: ['auto', 'mkv', 'mp4', 'webm', 'subtitles', 'srt', 'vtt', 'ass', 'gif', 'mp3', 'wav'],
  avi: ['auto', 'mp4', 'webm', 'mkv', 'gif', 'mp3', 'wav'],
  pdf: ['auto', 'png', 'jpg', 'webp', 'txt'],
  docx: ['auto', 'pdf', 'txt'],
  txt: ['auto', 'pdf'],
  any: ['auto', 'mkv', 'mp4', 'webm', 'png', 'jpg', 'webp', 'subtitles', 'srt', 'vtt', 'pdf', 'svg', 'gif'],
};

export function getBaseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function loadImage(src: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (typeof src !== 'string') URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      if (typeof src !== 'string') URL.revokeObjectURL(url);
      reject(new Error('Failed to load image file'));
    };
    img.src = url;
  });
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas conversion resulted in empty image'));
      },
      type,
      quality
    );
  });
}

export interface ConversionOptions {
  maxKb?: number;
  maxDimension?: number;
  quality?: number;
  backgroundColor?: string;
}

export async function convertImageFile(
  file: File,
  targetFormat: SupportedTargetFormat,
  options: ConversionOptions = {},
  crop?: CropArea | null
): Promise<ConvertedOutput[]> {
  const baseName = getBaseName(file.name);
  const srcExt = file.name.split('.').pop()?.toLowerCase() || 'png';
  const resolvedFormat: SupportedTargetFormat =
    targetFormat === 'auto'
      ? (srcExt === 'jpeg' ? 'jpg' : (srcExt as SupportedTargetFormat))
      : targetFormat;

  const img = await loadImage(file);

  const naturalW = img.naturalWidth || 500;
  const naturalH = img.naturalHeight || 500;

  // Calculate crop rectangle
  const sx = crop ? crop.x : 0;
  const sy = crop ? crop.y : 0;
  const sw = crop ? crop.w : naturalW;
  const sw_clamped = Math.max(1, sw);
  const sh = crop ? crop.h : naturalH;
  const sh_clamped = Math.max(1, sh);

  // Scale down if maxDimension is provided
  let scale = 1;
  if (options.maxDimension && Math.max(sw_clamped, sh_clamped) > options.maxDimension) {
    scale = options.maxDimension / Math.max(sw_clamped, sh_clamped);
  }

  const finalW = Math.max(1, Math.round(sw_clamped * scale));
  const finalH = Math.max(1, Math.round(sh_clamped * scale));

  // Render to canvas
  const canvas = document.createElement('canvas');
  canvas.width = finalW;
  canvas.height = finalH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize canvas 2D context');

  // Fill white for JPG or PDF
  if (resolvedFormat === 'jpg' || resolvedFormat === 'pdf') {
    ctx.fillStyle = options.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, finalW, finalH);
  }

  ctx.drawImage(img, sx, sy, sw_clamped, sh_clamped, 0, 0, finalW, finalH);

  // Conversion outputs
  if (resolvedFormat === 'pdf') {
    const isLandscape = finalW > finalH;
    const doc = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const ratio = Math.min((pageWidth - 20) / finalW, (pageHeight - 20) / finalH);
    const renderW = finalW * ratio;
    const renderH = finalH * ratio;
    const offsetX = (pageWidth - renderW) / 2;
    const offsetY = (pageHeight - renderH) / 2;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    doc.addImage(dataUrl, 'JPEG', offsetX, offsetY, renderW, renderH);

    const pdfBlob = doc.output('blob');
    const outName = `${baseName}.pdf`;
    return [
      {
        blob: pdfBlob,
        name: outName,
        url: URL.createObjectURL(pdfBlob),
        size: pdfBlob.size,
      },
    ];
  }

  if (resolvedFormat === 'svg') {
    const dataUrl = canvas.toDataURL('image/png');
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${finalW}" height="${finalH}" viewBox="0 0 ${finalW} ${finalH}">
  <image width="${finalW}" height="${finalH}" href="${dataUrl}"/>
</svg>`;
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const outName = `${baseName}.svg`;
    return [
      {
        blob,
        name: outName,
        url: URL.createObjectURL(blob),
        size: blob.size,
      },
    ];
  }

  // Handle PNG, JPG, WEBP
  const mime = MIME_TYPES[resolvedFormat] || 'image/png';
  let blob: Blob;

  // Check if size constraint in KB is provided
  if (options.maxKb && (resolvedFormat === 'jpg' || resolvedFormat === 'webp')) {
    const targetBytes = options.maxKb * 1024;
    let low = 0.1;
    let high = 0.95;
    let bestBlob: Blob | null = null;

    for (let i = 0; i < 7; i++) {
      const q = (low + high) / 2;
      const b = await canvasToBlob(canvas, mime, q);
      if (b.size <= targetBytes) {
        bestBlob = b;
        low = q; // try higher quality
      } else {
        high = q; // reduce quality
      }
    }

    blob = bestBlob || (await canvasToBlob(canvas, mime, 0.4));
  } else if (options.maxKb && resolvedFormat === 'png') {
    // PNG compression: iteratively scale down canvas if exceeding maxKb
    const targetBytes = options.maxKb * 1024;
    let b = await canvasToBlob(canvas, 'image/png');
    let curW = finalW;
    let curH = finalH;
    let attempts = 0;
    while (b.size > targetBytes && attempts < 5 && curW > 64 && curH > 64) {
      const scaleFactor = Math.sqrt(targetBytes / b.size) * 0.95;
      curW = Math.max(32, Math.round(curW * scaleFactor));
      curH = Math.max(32, Math.round(curH * scaleFactor));
      const scaledCanvas = document.createElement('canvas');
      scaledCanvas.width = curW;
      scaledCanvas.height = curH;
      const sCtx = scaledCanvas.getContext('2d');
      if (sCtx) {
        sCtx.drawImage(canvas, 0, 0, curW, curH);
        b = await canvasToBlob(scaledCanvas, 'image/png');
      }
      attempts++;
    }
    blob = b;
  } else {
    const q = options.quality ?? (resolvedFormat === 'png' ? undefined : 0.92);
    blob = await canvasToBlob(canvas, mime, q);
  }

  const outName = `${baseName}.${resolvedFormat}`;
  return [
    {
      blob,
      name: outName,
      url: URL.createObjectURL(blob),
      size: blob.size,
    },
  ];
}

export async function convertSvgCodeOrFile(
  svgContent: string,
  targetFormat: SupportedTargetFormat,
  scaleFactor: number = 1,
  baseName: string = 'vector-graphic',
  customWidth?: number,
  customHeight?: number
): Promise<ConvertedOutput[]> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  const svgEl = doc.documentElement as unknown as SVGSVGElement;

  if (!svgEl || svgEl.nodeName.toLowerCase() !== 'svg') {
    throw new Error('Invalid SVG code structure');
  }

  let w = parseFloat(svgEl.getAttribute('width') || '0');
  let h = parseFloat(svgEl.getAttribute('height') || '0');
  const vb = svgEl.getAttribute('viewBox');

  if (vb) {
    const nums = vb.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
    if (nums.length === 4) {
      if (!w || isNaN(w)) w = nums[2];
      if (!h || isNaN(h)) h = nums[3];
    }
  }

  if (!w || isNaN(w)) w = 300;
  if (!h || isNaN(h)) h = 300;

  // Target dimensions
  const finalW = customWidth || Math.round(w * scaleFactor);
  const finalH = customHeight || Math.round(h * scaleFactor);

  if (!svgEl.getAttribute('viewBox')) {
    svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }
  if (!svgEl.getAttribute('xmlns')) {
    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  svgEl.setAttribute('width', String(finalW));
  svgEl.setAttribute('height', String(finalH));

  const serialized = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });

  if (targetFormat === 'svg') {
    const outName = `${baseName}.svg`;
    return [
      {
        blob: svgBlob,
        name: outName,
        url: URL.createObjectURL(svgBlob),
        size: svgBlob.size,
      },
    ];
  }

  const img = await loadImage(svgBlob);

  const canvas = document.createElement('canvas');
  canvas.width = finalW;
  canvas.height = finalH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas 2D context');

  if (targetFormat === 'jpg' || targetFormat === 'pdf') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, finalW, finalH);
  }

  ctx.drawImage(img, 0, 0, finalW, finalH);

  if (targetFormat === 'pdf') {
    const isLandscape = finalW > finalH;
    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'px',
      format: [finalW, finalH],
      hotfixes: ['px_scaling'],
    });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, finalW, finalH);
    const pdfBlob = pdf.output('blob');
    const outName = `${baseName}-${scaleFactor}x.pdf`;
    return [
      {
        blob: pdfBlob,
        name: outName,
        url: URL.createObjectURL(pdfBlob),
        size: pdfBlob.size,
      },
    ];
  }

  const mime = MIME_TYPES[targetFormat] || 'image/png';
  const blob = await canvasToBlob(canvas, mime, targetFormat === 'png' ? undefined : 0.95);
  const outName = `${baseName}-${scaleFactor}x.${targetFormat}`;

  return [
    {
      blob,
      name: outName,
      url: URL.createObjectURL(blob),
      size: blob.size,
    },
  ];
}

export async function convertPdfFile(
  file: File,
  targetFormat: SupportedTargetFormat
): Promise<ConvertedOutput[]> {
  const baseName = getBaseName(file.name);
  if (!window.pdfjsLib) {
    throw new Error('PDF.js engine is still loading. Please try again in a moment.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const numPages = pdf.numPages;

  if (targetFormat === 'txt') {
    const textPieces: string[] = [];
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ');
      if (pageText.trim()) {
        textPieces.push(`--- Page ${i} ---\n${pageText}`);
      }
    }
    const fullText = textPieces.join('\n\n') || 'No extractable text found in this document.';
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const outName = `${baseName}.txt`;
    return [
      {
        blob,
        name: outName,
        url: URL.createObjectURL(blob),
        size: blob.size,
      },
    ];
  }

  // PDF to images (PNG / JPG)
  const outputs: ConvertedOutput[] = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 }); // 2x retina crispness
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    if (targetFormat === 'jpg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    await page.render({ canvasContext: ctx, viewport }).promise;

    const mime = targetFormat === 'jpg' ? 'image/jpeg' : 'image/png';
    const blob = await canvasToBlob(canvas, mime, 0.92);
    const outName = numPages === 1 ? `${baseName}.${targetFormat}` : `${baseName}-p${i}.${targetFormat}`;

    outputs.push({
      blob,
      name: outName,
      url: URL.createObjectURL(blob),
      size: blob.size,
    });
  }

  return outputs;
}

export async function convertDocxFile(
  file: File,
  targetFormat: SupportedTargetFormat
): Promise<ConvertedOutput[]> {
  const baseName = getBaseName(file.name);
  if (!window.mammoth) {
    throw new Error('Mammoth DOCX engine is loading. Please try again in a moment.');
  }

  const arrayBuffer = await file.arrayBuffer();

  if (targetFormat === 'txt') {
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    const blob = new Blob([result.value || ''], { type: 'text/plain;charset=utf-8' });
    const outName = `${baseName}.txt`;
    return [
      {
        blob,
        name: outName,
        url: URL.createObjectURL(blob),
        size: blob.size,
      },
    ];
  }

  // DOCX -> PDF
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  const rawText = result.value || '';
  const lines = rawText.split('\n');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const margin = 20;
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let cursorY = margin;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  for (const line of lines) {
    const wrappedLines = doc.splitTextToSize(line || ' ', maxWidth);
    for (const wLine of wrappedLines) {
      if (cursorY > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(wLine, margin, cursorY);
      cursorY += 6;
    }
  }

  const pdfBlob = doc.output('blob');
  const outName = `${baseName}.pdf`;

  return [
    {
      blob: pdfBlob,
      name: outName,
      url: URL.createObjectURL(pdfBlob),
      size: pdfBlob.size,
    },
  ];
}

export async function mergeImagesToPdf(
  files: File[],
  options: ConversionOptions = {}
): Promise<ConvertedOutput> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let isFirst = true;

  for (const file of files) {
    const img = await loadImage(file);
    const w = img.naturalWidth || 500;
    const h = img.naturalHeight || 500;
    const isLandscape = w > h;

    if (!isFirst) {
      doc.addPage('a4', isLandscape ? 'l' : 'p');
    } else {
      isFirst = false;
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const ratio = Math.min((pageWidth - 20) / w, (pageHeight - 20) / h);
    const renderW = w * ratio;
    const renderH = h * ratio;
    const offsetX = (pageWidth - renderW) / 2;
    const offsetY = (pageHeight - renderH) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      doc.addImage(dataUrl, 'JPEG', offsetX, offsetY, renderW, renderH);
    }
  }

  const blob = doc.output('blob');
  const outName = `merged-images-${files.length}.pdf`;
  return {
    blob,
    name: outName,
    url: URL.createObjectURL(blob),
    size: blob.size,
  };
}

export async function createZipBundle(
  outputs: ConvertedOutput[],
  zipName = 'converted-files.zip'
): Promise<ConvertedOutput> {
  const zip = new JSZip();

  outputs.forEach((item, index) => {
    // Avoid duplicate names in zip
    const uniqueName = item.name || `file-${index + 1}`;
    zip.file(uniqueName, item.blob);
  });

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return {
    blob: zipBlob,
    name: zipName,
    url: URL.createObjectURL(zipBlob),
    size: zipBlob.size,
  };
}
