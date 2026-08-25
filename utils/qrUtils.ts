import QRCode from 'qrcode';

/**
 * Generates a branded QR code data URL with the 'MK POSHAK HOUSE' center badge.
 * Matches the uploaded design with dark green/teal matrix and white center logo.
 */
export async function generateBrandedCatalogQr(
  url: string,
  brandText = 'MK POSHAK HOUSE'
): Promise<string> {
  // If not in browser environment (SSR), fallback to standard QR
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return QRCode.toDataURL(url, {
      margin: 1,
      width: 240,
      color: {
        dark: '#008060',
        light: '#ffffff',
      },
    });
  }

  try {
    // Generate high-resolution base QR code
    const rawQrDataUrl = await QRCode.toDataURL(url, {
      margin: 1,
      width: 320,
      errorCorrectionLevel: 'H', // High error correction allows center logo up to 30% area
      color: {
        dark: '#008060',
        light: '#ffffff',
      },
    });

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 320;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(rawQrDataUrl);
          return;
        }

        // Draw base QR image
        ctx.drawImage(img, 0, 0, size, size);

        // Center badge dimensions (~28% of size)
        const badgeWidth = size * 0.32;
        const badgeHeight = size * 0.22;
        const badgeX = (size - badgeWidth) / 2;
        const badgeY = (size - badgeHeight) / 2;
        const radius = 6;

        // Draw white rounded background with crisp border
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(badgeX + radius, badgeY);
        ctx.lineTo(badgeX + badgeWidth - radius, badgeY);
        ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + radius);
        ctx.lineTo(badgeX + badgeWidth, badgeY + badgeHeight - radius);
        ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX + badgeWidth - radius, badgeY + badgeHeight);
        ctx.lineTo(badgeX + radius, badgeY + badgeHeight);
        ctx.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + badgeHeight - radius);
        ctx.lineTo(badgeX, badgeY + radius);
        ctx.quadraticCurveTo(badgeX, badgeY, badgeX + radius, badgeY);
        ctx.closePath();

        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#008060';
        ctx.stroke();

        // Draw "mk" stylized text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // "mk"
        ctx.font = 'bold 22px "Arial Black", "Trebuchet MS", sans-serif';
        ctx.fillStyle = '#008060';
        ctx.fillText('mk', size / 2, badgeY + (badgeHeight * 0.38));

        // "POSHAK HOUSE"
        ctx.font = 'bold 6.5px "Arial", sans-serif';
        ctx.letterSpacing = '1px';
        ctx.fillStyle = '#334155';
        ctx.fillText('POSHAK HOUSE', size / 2, badgeY + (badgeHeight * 0.76));

        ctx.restore();

        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => {
        resolve(rawQrDataUrl);
      };

      img.src = rawQrDataUrl;
    });
  } catch (error) {
    console.error('Error generating branded QR:', error);
    return QRCode.toDataURL(url, {
      margin: 1,
      width: 240,
      color: {
        dark: '#008060',
        light: '#ffffff',
      },
    });
  }
}
