import { useEffect, useState } from 'react';
import QRCodeLib from 'qrcode';

export function QRCode({ text, size = 200 }: { text: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    QRCodeLib.toString(text, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setSvg).catch(() => setSvg(null));
  }, [text]);

  if (!svg) {
    return <div style={{ width: size, height: size }} className="bg-[#1a1a1f] rounded-xl" />;
  }

  return (
    <div
      className="rounded-xl bg-white p-3"
      style={{ width: size + 24, height: size + 24 }}
      dangerouslySetInnerHTML={{ __html: svg.replace('<svg', `<svg width="${size}" height="${size}"`) }}
    />
  );
}
