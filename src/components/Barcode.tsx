import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeProps {
  value: string;
  className?: string;
  height?: number;
  width?: number;
  showText?: boolean;
  fontSize?: number;
  lineColor?: string;
  background?: string;
}

export const Barcode: React.FC<BarcodeProps> = ({
  value,
  className = '',
  height = 15,
  width = 1.35,
  showText = false,
  fontSize = 8,
  lineColor = '#0F172A',
  background = 'transparent',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    // Filter only ASCII printable characters (32-126) for standard barcode scanners
    let cleanVal = String(value || 'ID').trim();
    cleanVal = cleanVal.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim() || 'STU001';

    try {
      JsBarcode(svgRef.current, cleanVal, {
        format: 'CODE128',
        width: width,
        height: height,
        displayValue: showText,
        fontSize: fontSize,
        font: 'monospace',
        fontOptions: 'bold',
        textMargin: 0,
        margin: 1,
        lineColor: lineColor,
        background: background,
        valid: () => true,
      });
    } catch (e) {
      console.warn('Barcode primary rendering notice:', e);
      try {
        // Fallback to alphanumeric ID format
        const fallback = cleanVal.replace(/[^a-zA-Z0-9]/g, '') || 'STU001';
        JsBarcode(svgRef.current, fallback, {
          format: 'CODE128',
          width: 1.2,
          height: height,
          displayValue: showText,
          margin: 1,
          lineColor: lineColor,
          background: background,
        });
      } catch (err) {
        console.error('Barcode fallback error:', err);
      }
    }
  }, [value, height, width, showText, fontSize, lineColor, background]);

  return (
    <div className={`flex flex-col items-center justify-center select-none overflow-hidden ${className}`}>
      <svg ref={svgRef} className="w-full h-full max-h-7 object-contain" />
    </div>
  );
};

