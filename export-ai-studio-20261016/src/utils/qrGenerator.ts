import QRCode from 'qrcode';
import { QRDesignConfig } from '../types';
import {
  ILLUSION_LOGO_BLACK_DATA_URL,
  ILLUSION_LOGO_WHITE_DATA_URL,
} from '../assets/illusionLogo';

export interface RenderQROptions {
  url: string;
  size?: number;
  design: QRDesignConfig;
  clientName?: string;
  projectName?: string;
}

export async function renderQRToCanvas(
  canvas: HTMLCanvasElement,
  options: RenderQROptions
): Promise<void> {
  const {
    url,
    size = 400,
    design,
    clientName,
    projectName,
  } = options;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Frame dimensions - Clean luxury sticker layout
  const hasFrame = design.includeFrame;
  const padding = hasFrame ? 24 : 16;
  const topHeaderHeight = hasFrame ? 50 : 0;

  const totalWidth = size + padding * 2;
  const totalHeight = size + padding * 2 + topHeaderHeight;

  canvas.width = totalWidth;
  canvas.height = totalHeight;

  // Canvas Background - Always pure white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Outer frame border if requested - Always solid black luxury border
  if (hasFrame) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    const r = 16;
    ctx.beginPath();
    ctx.roundRect(4, 4, totalWidth - 8, totalHeight - 8, r);
    ctx.stroke();

    // Top banner background - Luxury solid black
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.roundRect(8, 8, totalWidth - 16, 42, [12, 12, 4, 4]);
    ctx.fill();

    // Render Illusion white logo and banner text 'USER MANUAL' centered in a perfect line
    const bannerText = (design.frameText?.trim() || 'USER MANUAL').toUpperCase();
    const bannerY = 29;

    try {
      const bannerLogo = await loadImage(ILLUSION_LOGO_WHITE_DATA_URL);
      const bLogoH = 14;
      const bLogoW = (bLogoH / 96) * 392; // ~57.17px

      ctx.font = 'bold 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.letterSpacing = '0.10em';
      const textWidth = ctx.measureText(bannerText).width;
      const gap = 10;
      const separatorW = 1;
      const totalContentW = bLogoW + gap + separatorW + gap + textWidth;
      const startX = Math.round((totalWidth - totalContentW) / 2);

      // Draw white logo aligned in the center of the banner
      const logoY = Math.round(bannerY - bLogoH / 2);
      ctx.drawImage(bannerLogo, startX, logoY, bLogoW, bLogoH);

      // Subtle vertical separator centered in line with logo and text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      const sepHeight = 12;
      ctx.fillRect(startX + bLogoW + gap, Math.round(bannerY - sepHeight / 2), separatorW, sepHeight);

      // Banner text (USER MANUAL) in exact horizontal line with the Illusion logo
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(bannerText, startX + bLogoW + gap + separatorW + gap, bannerY - 0.5);
    } catch {
      // Fallback text if image load fails
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.letterSpacing = '0.10em';
      ctx.fillText(bannerText, totalWidth / 2, bannerY);
    }
  }

  // Generate QR Matrix
  const qr = QRCode.create(url, {
    errorCorrectionLevel: design.errorCorrectionLevel || 'H',
  });

  const modules = qr.modules;
  const moduleCount = modules.size;
  const qrX = padding;
  const qrY = topHeaderHeight + padding;
  const cellSize = size / moduleCount;

  // Draw QR white background box
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(qrX, qrY, size, size);

  // Draw QR Modules - ALWAYS Crisp Black (#000000)
  const fg = '#000000';
  ctx.fillStyle = fg;

  const isPositionPattern = (row: number, col: number): boolean => {
    // Top-left
    if (row < 7 && col < 7) return true;
    // Top-right
    if (row < 7 && col >= moduleCount - 7) return true;
    // Bottom-left
    if (row >= moduleCount - 7 && col < 7) return true;
    return false;
  };

  // Draw modules
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (modules.get(row, col)) {
        const x = qrX + col * cellSize;
        const y = qrY + row * cellSize;

        if (isPositionPattern(row, col)) {
          // Corner eye patterns
          if (design.cornerSquareStyle === 'rounded' || design.cornerSquareStyle === 'extra-rounded') {
            ctx.beginPath();
            ctx.roundRect(x, y, cellSize, cellSize, cellSize * 0.25);
            ctx.fill();
          } else {
            ctx.fillRect(x, y, cellSize, cellSize);
          }
        } else {
          // Data modules
          if (design.dotStyle === 'dots') {
            ctx.beginPath();
            ctx.arc(x + cellSize / 2, y + cellSize / 2, (cellSize / 2) * 0.85, 0, Math.PI * 2);
            ctx.fill();
          } else if (design.dotStyle === 'rounded') {
            ctx.beginPath();
            ctx.roundRect(x, y, cellSize * 0.95, cellSize * 0.95, cellSize * 0.35);
            ctx.fill();
          } else {
            ctx.fillRect(x, y, cellSize + 0.1, cellSize + 0.1);
          }
        }
      }
    }
  }

  // Draw Center Logo if explicitly provided by user
  if (design.logoUrl && design.logoUrl.trim().length > 0) {
    try {
      const logoImg = await loadImage(design.logoUrl);
      const logoRatio = (design.logoSize || 22) / 100;
      const logoWidth = size * logoRatio;
      const logoHeight = (logoWidth / logoImg.width) * logoImg.height;
      const centerX = qrX + size / 2;
      const centerY = qrY + size / 2;
      const logoX = centerX - logoWidth / 2;
      const logoY = centerY - logoHeight / 2;
      const margin = design.logoMargin || 6;

      // Draw pure white background card with black border for the logo
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(
        logoX - margin,
        logoY - margin,
        logoWidth + margin * 2,
        logoHeight + margin * 2,
        8
      );
      ctx.fill();

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
    } catch (err) {
      console.warn('Could not load center QR logo:', err);
    }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

export async function exportCanvasAsImage(
  canvas: HTMLCanvasElement,
  filename: string,
  type: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<void> {
  const dataUrl = canvas.toDataURL(type, 1.0);
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

