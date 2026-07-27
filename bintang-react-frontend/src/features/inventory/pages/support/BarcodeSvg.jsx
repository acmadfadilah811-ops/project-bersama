import { useMemo } from 'react';
import { encode } from './code128';

export default function BarcodeSvg({ value, height = 42, showText = true, className = '' }) {
  const encoded = useMemo(() => encode(value), [value]);
  if (!encoded.text) return <span className={className} style={{ color: '#dc2626', fontSize: 11 }}>Barcode belum diisi</span>;
  const quiet = 10;
  const contentWidth = encoded.modules.reduce((sum, item) => sum + item.width, 0);
  let x = quiet;
  const textHeight = showText ? 15 : 0;
  return (
    <svg className={className} role="img" aria-label={`Barcode ${encoded.text}`} viewBox={`0 0 ${contentWidth + quiet * 2} ${height + textHeight}`} preserveAspectRatio="none" style={{ width: '100%', height: height + textHeight, display: 'block' }}>
      <rect width="100%" height="100%" fill="white" />
      {encoded.modules.map((item, index) => {
        const currentX = x;
        x += item.width;
        return item.bar ? <rect key={index} x={currentX} y="0" width={item.width} height={height} fill="#111827" /> : null;
      })}
      {showText && <text x={(contentWidth + quiet * 2) / 2} y={height + 12} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="10" fill="#111827">{encoded.text}</text>}
    </svg>
  );
}
