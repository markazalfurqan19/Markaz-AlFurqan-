import { CenterSetting, SCHEMA_LIMITS } from '../types';
import { Language, TRANSLATIONS } from '../i18n';

const LOGO_PATH = '/assets/aistudio/loog_6003b99d.jpg';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses a user-selected image file so it fits comfortably within Firestore's
 * 250,000-character limit on settings/center.bankInfoImage.
 */
export async function compressBankImageFile(
  file: File,
  invalidFileMsg: string,
  tooLargeMsg: string
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error(invalidFileMsg);
  }

  const rawUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawUrl);
  if (!img) {
    throw new Error(invalidFileMsg);
  }

  const attempts = [
    { maxDim: 960, quality: 0.84 },
    { maxDim: 760, quality: 0.74 },
    { maxDim: 600, quality: 0.65 },
    { maxDim: 480, quality: 0.56 },
  ];

  const maxAllowed = SCHEMA_LIMITS.SETTING_BANK_IMAGE - 2000;

  for (const { maxDim, quality } of attempts) {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const targetW = Math.max(1, Math.round(img.width * scale));
    const targetH = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const compressed = canvas.toDataURL('image/jpeg', quality);
    if (compressed.length <= maxAllowed) {
      return compressed;
    }
  }

  throw new Error(tooLargeMsg);
}

/**
 * Processes an uploaded payment proof file (image or PDF) so it fits safely within
 * Firestore's 250,000-character limit on contributions.proofFileUrl.
 */
export async function compressProofFile(
  file: File,
  invalidFileMsg: string,
  tooLargeMsg: string
): Promise<{ dataUrl: string; fileName: string }> {
  const cleanName = file.name.slice(0, SCHEMA_LIMITS.CONTRIBUTION_PROOF_NAME);

  if (file.type.startsWith('image/')) {
    const dataUrl = await compressBankImageFile(file, invalidFileMsg, tooLargeMsg);
    return { dataUrl, fileName: cleanName };
  }

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const rawUrl = await readFileAsDataUrl(file);
    if (rawUrl.length > SCHEMA_LIMITS.CONTRIBUTION_PROOF_URL - 2000) {
      throw new Error(tooLargeMsg);
    }
    return { dataUrl: rawUrl, fileName: cleanName };
  }

  throw new Error(invalidFileMsg);
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}

/**
 * Generates and downloads a branded Al-Furqaan Bank Information PNG card
 * containing the center header, bank details text, and optional attached bank/QR image.
 */
export async function downloadBankInfoImagePNG(
  center: CenterSetting,
  lang: Language = 'om'
): Promise<void> {
  const t = TRANSLATIONS[lang];
  const centerName = center.centerName || t.centerDefaultName;
  const contactText = [center.phone, center.email].filter(Boolean).join('  ·  ');
  const detailsText = (center.bankAccountDetails || '').trim();

  const [logoImg, bankImg] = await Promise.all([
    loadImage(LOGO_PATH),
    center.bankInfoImage ? loadImage(center.bankInfoImage) : Promise.resolve(null),
  ]);

  const width = 1000;
  const padX = 56;
  const headerHeight = 168;

  // Measure wrapped text lines using a temporary canvas context
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  if (!mCtx) return;

  mCtx.font = '500 23px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  const detailLines = detailsText ? wrapLines(mCtx, detailsText, width - padX * 2 - 48) : [];

  const textBoxHeight = detailLines.length > 0 ? detailLines.length * 34 + 64 : 0;

  let bankImgDrawW = 0;
  let bankImgDrawH = 0;
  if (bankImg) {
    const maxImgW = width - padX * 2 - 32;
    const maxImgH = 620;
    const scale = Math.min(maxImgW / bankImg.width, maxImgH / bankImg.height, 1.5);
    bankImgDrawW = Math.round(bankImg.width * scale);
    bankImgDrawH = Math.round(bankImg.height * scale);
  }

  const imageBoxHeight = bankImg ? bankImgDrawH + 40 : 0;
  const gapBetweenTextAndImg = textBoxHeight > 0 && imageBoxHeight > 0 ? 28 : 0;
  const footerHeight = 76;
  const bodyPaddingY = 42;
  const totalHeight =
    headerHeight +
    bodyPaddingY +
    textBoxHeight +
    gapBetweenTextAndImg +
    imageBoxHeight +
    bodyPaddingY +
    footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.max(420, totalHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header Banner (Minimalist Deep Blue)
  ctx.fillStyle = '#0B1F3A';
  ctx.fillRect(0, 0, width, headerHeight);

  // Circular Logo
  let textStartX = padX;
  if (logoImg) {
    const logoSize = 96;
    const logoX = padX;
    const logoY = (headerHeight - logoSize) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    ctx.restore();

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.65)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.stroke();

    textStartX = logoX + logoSize + 24;
  }

  // Header Text
  ctx.fillStyle = '#D4AF37';
  ctx.font = '700 28px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(centerName, textStartX, 66, width - textStartX - padX);

  ctx.fillStyle = '#E2E8F0';
  ctx.font = '600 17px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(
    lang === 'om'
      ? 'ODEEFFANNOO BAANKII FI TELEBIRR'
      : 'OFFICIAL BANK & TELEBIRR ACCOUNT DETAILS',
    textStartX,
    102
  );

  if (contactText) {
    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 15px "JetBrains Mono", monospace';
    ctx.fillText(contactText, textStartX, 132, width - textStartX - padX);
  }

  let cursorY = headerHeight + bodyPaddingY;

  // Text Account Box
  if (detailLines.length > 0) {
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(padX, cursorY, width - padX * 2, textBoxHeight, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1E3A8A';
    ctx.font = '700 15px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(t.labels.bankDetails.toUpperCase(), padX + 24, cursorY + 32);

    ctx.fillStyle = '#0F172A';
    ctx.font = '600 22px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
    detailLines.forEach((line, idx) => {
      ctx.fillText(line, padX + 24, cursorY + 68 + idx * 34);
    });

    cursorY += textBoxHeight + gapBetweenTextAndImg;
  }

  // Attached Bank / QR Image
  if (bankImg) {
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(padX, cursorY, width - padX * 2, imageBoxHeight, 14);
    ctx.fill();
    ctx.stroke();

    const drawX = Math.round((width - bankImgDrawW) / 2);
    const drawY = cursorY + 20;
    ctx.drawImage(bankImg, drawX, drawY, bankImgDrawW, bankImgDrawH);
  }

  // Footer
  const footerY = canvas.height - footerHeight;
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, footerY);
  ctx.lineTo(width - padX, footerY);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = '600 15px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(`Jazaakumullaahu Khayran — ${centerName}`, padX, footerY + 42);

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `Al-Furqaan-Bank-Info-${new Date().toISOString().slice(0, 10)}.png`;
  link.click();
}
