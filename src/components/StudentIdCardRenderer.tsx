import React, { useMemo, useState, useEffect } from 'react';
import { School, Student } from '../types';
import { formatPhotoUrl } from '../lib/firebase';
import { generateStandardStudentId } from '../lib/studentIdHelper';
import { Barcode } from './Barcode';
import QRCode from 'qrcode';
import {
  Building2,
  User,
  BookOpen,
  Users,
  GraduationCap,
  MapPin,
  Phone,
  Mail,
  Globe,
  Calendar,
  Droplet,
  CreditCard,
  Award,
  Sparkles,
} from 'lucide-react';

export type IdCardTemplateType = 'template1' | 'template2' | 'template3' | 'template4';

interface StudentIdCardProps {
  student: Student;
  school: School;
  template?: IdCardTemplateType;
  showCuttingGuide?: boolean;
  className?: string;
  isPrintPreview?: boolean;
}

/**
 * Real Scannable High-Contrast QR Code Box
 */
const QrCodeBox: React.FC<{ value: string; size?: number; className?: string }> = ({
  value,
  size = 50,
  className = '',
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(value, {
      margin: 1,
      width: size * 2.5,
      color: {
        dark: '#1e0b36',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url: string) => {
        if (isMounted) setDataUrl(url);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [value, size]);

  return (
    <div
      className={`bg-white p-0.5 rounded-lg border-2 border-fuchsia-600 shadow-sm flex items-center justify-center overflow-hidden shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {dataUrl ? (
        <img src={dataUrl} alt="QR Code" className="w-full h-full object-contain" />
      ) : (
        <div className="w-full h-full bg-slate-100 flex items-center justify-center">
          <span className="text-[6px] font-mono text-purple-900 font-bold">QR</span>
        </div>
      )}
    </div>
  );
};

/**
 * HM Signature Container Box - Guarantees signature is always visible with high contrast
 */
const HmSignatureBlock: React.FC<{
  signatureUrl?: string;
  headmasterName?: string;
  labelColorClass: string;
}> = ({ signatureUrl, headmasterName, labelColorClass }) => {
  const [hasError, setHasError] = useState(false);
  const cleanSign = signatureUrl?.trim();

  return (
    <div className="flex flex-col items-center justify-end text-center shrink-0 min-w-[56px] max-w-[66px]">
      {/* High-contrast signature pad */}
      <div className="h-[20px] w-full flex items-center justify-center bg-white/95 rounded px-1 py-0.5 border border-slate-300/90 shadow-xs mb-0.5 overflow-hidden">
        {cleanSign && !hasError ? (
          <img
            src={cleanSign}
            alt="HM Sign"
            className="h-full w-full object-contain"
            loading="lazy"
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <span className="font-serif italic font-black text-[8.5px] text-slate-800 tracking-tight leading-none truncate select-none">
              {headmasterName ? headmasterName.split(' ')[0] : 'Headmaster'}
            </span>
          </div>
        )}
      </div>

      <span className={`text-[6.5px] font-black leading-none tracking-tight ${labelColorClass}`}>
        HM Signature
      </span>
    </div>
  );
};

/**
 * Auto-Fitting Single-Line School Name Component
 * Implements single-line maximum font size (12.5px - 13px), tight letter spacing (tracking-tighter),
 * and automatic width fitting/scaling so that long school names never wrap or get cut off.
 */
export const AutoFitSchoolHeader: React.FC<{
  name: string;
  align?: 'left' | 'center';
  className?: string;
  colorClass?: string;
  dropShadow?: string;
  borderBottomClass?: string;
  baseFontSize?: number;
}> = ({
  name,
  align = 'left',
  className = '',
  colorClass = 'text-white',
  dropShadow = '',
  borderBottomClass = '',
  baseFontSize = 13,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLHeadingElement>(null);
  const [scale, setScale] = useState<number>(1);

  // Compute baseline font size and tight tracking based on text length
  const textConfig = useMemo(() => {
    const len = name.length;
    if (len <= 14) return { fontSize: baseFontSize, letterSpacing: '-0.015em' };
    if (len <= 19) return { fontSize: Math.min(baseFontSize, 13.5), letterSpacing: '-0.02em' };
    if (len <= 25) return { fontSize: Math.min(baseFontSize - 1, 12.5), letterSpacing: '-0.025em' };
    if (len <= 32) return { fontSize: Math.min(baseFontSize - 2, 11.5), letterSpacing: '-0.03em' };
    if (len <= 40) return { fontSize: 10, letterSpacing: '-0.035em' };
    return { fontSize: 9, letterSpacing: '-0.04em' };
  }, [name, baseFontSize]);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const textWidth = textRef.current.scrollWidth;
        if (containerWidth > 0 && textWidth > containerWidth) {
          const ratio = Math.max(0.55, containerWidth / textWidth);
          setScale(ratio);
        } else {
          setScale(1);
        }
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [name, textConfig]);

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden flex items-center py-0.5 ${
        align === 'center' ? 'justify-center text-center' : 'justify-start text-left'
      } ${borderBottomClass} ${className}`}
      style={{ maxWidth: '100%' }}
    >
      <h1
        ref={textRef}
        className={`${colorClass} font-black uppercase whitespace-nowrap ${dropShadow}`}
        style={{
          fontSize: `${textConfig.fontSize}px`,
          letterSpacing: textConfig.letterSpacing,
          transform: scale < 1 ? `scaleX(${scale})` : undefined,
          transformOrigin: align === 'center' ? 'center center' : 'left center',
          lineHeight: '1.25',
          display: 'inline-block',
          willChange: 'transform',
        }}
      >
        {name}
      </h1>
    </div>
  );
};

/**
 * Auto-fit helper hook for student and school text fields
 */
function useAutoFitStyles(student: Student, school?: School) {
  const fatherNameStyle = useMemo(() => {
    const len = student.fatherName?.length || 0;
    if (len > 28) return 'text-[7.5px] font-black leading-[1.08]';
    if (len > 20) return 'text-[8px] font-black leading-[1.12]';
    return 'text-[9px] font-black leading-tight';
  }, [student.fatherName]);

  const addressStyle = useMemo(() => {
    const len = student.address?.length || 0;
    if (len > 35) return 'text-[7px] font-black leading-[1.08]';
    if (len > 22) return 'text-[7.5px] font-black leading-[1.12]';
    return 'text-[8.5px] font-black leading-tight';
  }, [student.address]);

  const studentNameStyle = useMemo(() => {
    const len = student.name?.length || 0;
    if (len > 24) return 'text-[11px] font-black leading-tight';
    if (len > 18) return 'text-[12px] font-black leading-tight';
    return 'text-[13px] font-black leading-tight';
  }, [student.name]);

  const schoolNameStyle = useMemo(() => {
    const len = school?.name?.length || 0;
    if (len > 34) return 'text-[9.5px] font-black tracking-tighter leading-none';
    if (len > 28) return 'text-[11px] font-black tracking-tighter leading-none';
    if (len > 22) return 'text-[12px] font-black tracking-tighter leading-none';
    if (len > 16) return 'text-[12.5px] font-black tracking-tight leading-none';
    return 'text-[13px] font-black tracking-tight leading-none';
  }, [school?.name]);

  return { fatherNameStyle, addressStyle, studentNameStyle, schoolNameStyle };
}

/**
 * Helper to generate scannable barcode string for 1D Barcode Scanner
 * Returns standardized Student ID: [School Acronym]-[Academic Year]-[Class]-[Roll]
 * (e.g., "NSVN-2026-I-01")
 * Giving wide, high-contrast, thick lines that are easily readable by any barcode scanner gun
 */
export const formatBarcodeScanData = (school: School, student: Student): string => {
  return generateStandardStudentId(school, student);
};

/**
 * =========================================================================
 * TEMPLATE 1: Classic Royal & Sky Blue (ক্লাসিক রয়্যাল ও স্কাই ব্লু)
 * Elegant wave header, circular photo with gold/blue ring, clean info layout
 * =========================================================================
 */
export const StudentIdCardTemplate1: React.FC<StudentIdCardProps> = ({
  student,
  school,
  showCuttingGuide = true,
  className = '',
}) => {
  const studentId = useMemo(() => generateStandardStudentId(school, student), [school, student]);
  const photoUrl = formatPhotoUrl(student.photo);
  const { fatherNameStyle, addressStyle, studentNameStyle, schoolNameStyle } = useAutoFitStyles(student, school);
  const barcodePayload = useMemo(() => formatBarcodeScanData(school, student), [school, student]);

  const formattedRegNo = useMemo(() => {
    if (!school.regNo) {
      if (school.code) return `Code: ${school.code}`;
      if (school.phone) return `Mob: ${school.phone}`;
      return 'STUDENT IDENTITY CARD';
    }
    const cleaned = school.regNo.replace(/^(reg\.?\s*no\.?|reg\.?)\s*[:-]?\s*/i, '').trim();
    return `Reg No: ${cleaned}`;
  }, [school.regNo, school.code, school.phone]);

  return (
    <div
      className={`relative bg-white text-slate-900 overflow-hidden select-none font-sans shadow-sm ${
        showCuttingGuide ? 'border border-dashed border-slate-300' : 'border border-slate-200'
      } ${className}`}
      style={{
        width: '2.1in',
        height: '3.4in',
        minWidth: '2.1in',
        minHeight: '3.4in',
        maxWidth: '2.1in',
        maxHeight: '3.4in',
        boxSizing: 'border-box',
      }}
    >
      {/* Background Graphic SVG Shapes - Template 1 (Royal Navy + Sky Blue + Amber Gold Accent) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        viewBox="0 0 210 340"
        preserveAspectRatio="none"
      >
        {/* Top Gradient Header Wave */}
        <path d="M0,0 L210,0 L210,95 Q105,125 0,95 Z" fill="#0369A1" />
        <path d="M0,0 L210,0 L210,86 Q105,114 0,86 Z" fill="#0C4A6E" />
        <path d="M0,86 Q105,114 210,86 L210,91 Q105,119 0,91 Z" fill="#F59E0B" />

        {/* Bottom Wave Footer */}
        <path d="M0,300 Q105,285 210,300 L210,340 L0,340 Z" fill="#0369A1" />
        <path d="M0,306 Q105,291 210,306 L210,340 L0,340 Z" fill="#0C4A6E" />
        <path d="M0,300 Q105,285 210,300 L210,303 Q105,288 0,303 Z" fill="#F59E0B" />
      </svg>

      {/* Semi-transparent School Logo Watermark */}
      {school.logo && (
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.16] pointer-events-none z-0">
          <img
            src={school.logo}
            alt="watermark"
            className="w-36 h-36 object-contain"
            loading="lazy"
          />
        </div>
      )}

      {/* Main Content Layer */}
      <div className="relative z-10 flex flex-col justify-between h-full p-2 pt-1.5">
        {/* Header: School Logo + Name + Reg No */}
        <div className="w-full text-center">
          <div className="flex items-center gap-1 px-0.5 w-full">
            {school.logo ? (
              <div className="w-7 h-7 rounded-md bg-white p-0.5 border border-amber-400 shadow-sm shrink-0 flex items-center justify-center overflow-hidden">
                <img
                  src={school.logo}
                  alt={school.name}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-md bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-sm font-black">
                <Building2 className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-0 flex-1 text-left flex flex-col justify-center overflow-hidden">
              <AutoFitSchoolHeader
                name={school.name}
                align="left"
                colorClass="text-white"
                dropShadow="drop-shadow-sm"
                baseFontSize={13}
              />
            </div>
          </div>

          {/* Registration Tag */}
          <div className="w-full mt-0.5 px-1 flex items-center justify-center">
            <span className="text-[7.5px] font-black text-amber-300 leading-none tracking-wide truncate bg-black/40 px-2 py-0.5 rounded-full border border-amber-400/40">
              {formattedRegNo}
            </span>
          </div>
        </div>

        {/* Photo Section */}
        <div className="flex flex-col items-center my-auto w-full -mt-0.5">
          <div className="relative w-18 h-18 rounded-full p-[2.5px] bg-gradient-to-tr from-amber-500 via-sky-400 to-sky-600 shadow-md">
            <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center border-2 border-white">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={student.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <User className="w-8 h-8 text-slate-400" />
                </div>
              )}
            </div>
          </div>

          {/* Student Name & Subtitle */}
          <div className="text-center w-full px-1 mt-1">
            <h2 className={`${studentNameStyle} font-black text-slate-950 uppercase tracking-tight leading-tight truncate`}>
              {student.name}
            </h2>
            <div className="text-[7px] font-black text-sky-700 uppercase tracking-widest mt-0.5 bg-sky-50 px-2 py-0.2 rounded-full inline-block border border-sky-200">
              STUDENT IDENTITY CARD
            </div>
          </div>

          {/* Student Details Grid */}
          <div className="w-full mt-1 px-2 space-y-[2px] text-[8.5px] font-black text-slate-950">
            <div className="flex items-center">
              <span className="w-13 text-slate-950 font-black shrink-0">ID No</span>
              <span className="text-slate-950 mr-1.5 font-black shrink-0">:</span>
              <span className="font-mono font-black text-slate-950 text-[9px] truncate">{studentId}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="w-13 text-slate-950 font-black shrink-0">Class</span>
                <span className="text-slate-950 mr-1.5 font-black shrink-0">:</span>
                <span className="font-black text-slate-950 text-[9px]">{student.class}</span>
              </div>
              <div className="flex items-center pr-1">
                <span className="text-slate-950 font-black mr-1">Roll</span>
                <span className="text-slate-950 mr-1 font-black">:</span>
                <span className="font-mono font-black text-sky-800 text-[9px]">#{student.roll}</span>
              </div>
            </div>
            {student.fatherName && (
              <div className="flex items-start">
                <span className="w-13 text-slate-950 font-black shrink-0 pt-0.5">Father</span>
                <span className="text-slate-950 mr-1.5 font-black shrink-0 pt-0.5">:</span>
                <span className={`font-black text-slate-950 flex-1 min-w-0 break-words line-clamp-2 ${fatherNameStyle}`}>
                  {student.fatherName}
                </span>
              </div>
            )}
            {student.phone && (
              <div className="flex items-center">
                <span className="w-13 text-slate-950 font-black shrink-0">Phone</span>
                <span className="text-slate-950 mr-1.5 font-black shrink-0">:</span>
                <span className="font-mono font-black text-slate-950 text-[8.5px]">{student.phone}</span>
              </div>
            )}
            {student.address && (
              <div className="flex items-start">
                <span className="w-13 text-slate-950 font-black shrink-0 pt-0.5">Address</span>
                <span className="text-slate-950 mr-1.5 font-black shrink-0 pt-0.5">:</span>
                <span className={`font-black text-slate-950 flex-1 min-w-0 break-words line-clamp-2 ${addressStyle}`}>
                  {student.address}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer: Barcode + HM Signature + School Address */}
        <div className="w-full mt-auto pt-1">
          <div className="flex items-end justify-between px-1 mb-1 gap-1">
            {/* Barcode */}
            <div className="bg-white px-1.5 py-0.5 rounded shadow-xs border border-slate-300 w-[114px] sm:w-[120px] h-[21px] flex items-center justify-center overflow-hidden">
              <Barcode
                value={barcodePayload}
                height={14}
                width={1.4}
                showText={false}
              />
            </div>

            {/* HM Signature */}
            <HmSignatureBlock
              signatureUrl={school.signature}
              headmasterName={school.headmasterName}
              labelColorClass="text-amber-300 drop-shadow-xs"
            />
          </div>

          {/* School Address Footer */}
          <div className="w-full text-center px-1 pt-0.5">
            <p className="text-[5.5px] font-bold text-sky-100 leading-[1.15] break-words line-clamp-2">
              {school.address ? school.address : school.email ? school.email : 'School Hub Educational System'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * =========================================================================
 * TEMPLATE 2: Modern Yellow & Red Chevron (মডার্ন ইয়েলো ও রেড শেভরন)
 * Yellow header & panels, Red chevron accents, 2026 tag, large school title,
 * auto-fit father name & address, same-line Class & Roll
 * =========================================================================
 */
export const StudentIdCardTemplate2: React.FC<StudentIdCardProps> = ({
  student,
  school,
  showCuttingGuide = true,
  className = '',
}) => {
  const studentId = useMemo(() => generateStandardStudentId(school, student), [school, student]);
  const photoUrl = formatPhotoUrl(student.photo);
  const { fatherNameStyle, addressStyle, studentNameStyle } = useAutoFitStyles(student);
  const barcodePayload = useMemo(() => formatBarcodeScanData(school, student), [school, student]);

  const formattedRegNo = useMemo(() => {
    if (!school.regNo) {
      if (school.code) return `Code: ${school.code}`;
      if (school.phone) return `Mob: ${school.phone}`;
      return 'STUDENT IDENTITY CARD';
    }
    const cleaned = school.regNo.replace(/^(reg\.?\s*no\.?|reg\.?)\s*[:-]?\s*/i, '').trim();
    return `Reg No:-${cleaned}`;
  }, [school.regNo, school.code, school.phone]);

  return (
    <div
      className={`relative bg-[#F0F2F5] text-slate-900 overflow-hidden select-none font-sans shadow-sm ${
        showCuttingGuide ? 'border border-dashed border-slate-300' : 'border border-slate-200'
      } ${className}`}
      style={{
        width: '2.1in',
        height: '3.4in',
        minWidth: '2.1in',
        minHeight: '3.4in',
        maxWidth: '2.1in',
        maxHeight: '3.4in',
        boxSizing: 'border-box',
      }}
    >
      {/* Background Graphic SVG Shapes */}
      {/* Yellow Side Panels & Base (#F59E0B / #EAB308), Red Chevron Accents & Bands (#DC2626 / #EF4444), Light Grey Card Background */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        viewBox="0 0 210 340"
        preserveAspectRatio="none"
      >
        {/* Top Section Graphics */}
        <polygon points="0,0 28,0 28,100 0,90" fill="#EAB308" />
        <polygon points="182,0 210,0 210,90 182,100" fill="#EAB308" />
        <polygon points="0,90 28,100 105,138 182,100 210,90 210,102 105,150 0,102" fill="#DC2626" />
        <polygon points="26,0 184,0 184,98 105,136 26,98" fill="#F59E0B" />

        {/* Bottom Section Graphics */}
        <polygon points="0,285 45,296 0,314" fill="#EAB308" />
        <polygon points="210,285 165,296 210,314" fill="#EAB308" />
        <polygon points="0,296 105,274 210,296 210,304 105,282 0,304" fill="#DC2626" />
        <polygon points="0,304 105,282 210,304 210,340 0,340" fill="#F59E0B" />
      </svg>

      {/* Semi-transparent School Logo Watermark */}
      {school.logo && (
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.16] pointer-events-none z-0">
          <img
            src={school.logo}
            alt="watermark"
            className="w-36 h-36 object-contain"
            loading="lazy"
          />
        </div>
      )}

      {/* Main Foreground Content Layer */}
      <div className="relative z-10 flex flex-col justify-between h-full p-2 pt-1">
        {/* 1. Header inside Yellow Chevron: School Logo + 2026 Tag + Prominent School Name + Registration No */}
        <div className="w-full text-center pt-0">
          <div className="flex items-center gap-1.5 px-0 w-full">
            {/* Logo Column with small red 2026 below it */}
            <div className="flex flex-col items-center shrink-0">
              {school.logo ? (
                <div className="w-9 h-9 rounded-md bg-white p-0.5 border border-red-600 shadow-sm flex items-center justify-center overflow-hidden">
                  <img
                    src={school.logo}
                    alt={school.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-md bg-red-600 text-white flex items-center justify-center shadow-sm">
                  <Building2 className="w-5.5 h-5.5" />
                </div>
              )}
              <span className="text-[7px] font-black text-red-600 leading-none mt-0.5 tracking-tight bg-white/95 px-1.5 py-0.2 rounded-xs border border-red-500/40">
                {school.currentAcademicYear || '2026'}
              </span>
            </div>

            {/* School Name expanded with Auto-Fit Single Line and bold black typography */}
            <div className="min-w-0 flex-1 text-left -mt-1 pr-0.5 overflow-hidden">
              <AutoFitSchoolHeader
                name={school.name}
                align="left"
                colorClass="text-black"
                dropShadow="drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]"
                borderBottomClass="border-b-2 border-red-600 pb-0.5"
                baseFontSize={13}
              />
            </div>
          </div>

          {/* Registration Number Header Tag */}
          <div className="w-full mt-0.5 px-1 flex items-center justify-center">
            <span className="text-[8px] font-black text-white leading-none tracking-wide truncate drop-shadow-sm bg-red-600 px-2.5 py-0.5 rounded-full border border-red-700 shadow-xs">
              {formattedRegNo}
            </span>
          </div>
        </div>

        {/* 2. Photo Section: Circular Frame (60-65% width) with Red Accent Ring */}
        <div className="flex flex-col items-center my-auto w-full -mt-0.5">
          <div className="relative w-20 h-20 rounded-full p-[3px] bg-gradient-to-tr from-red-700 via-red-600 to-rose-500 shadow-lg">
            <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center border-2 border-white">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={student.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-500">
                  <User className="w-10 h-10 text-slate-500" />
                </div>
              )}
            </div>
          </div>

          {/* 3. Student Name (Large Bold Highlight with Auto-fit) & Subtitle Role */}
          <div className="text-center w-full px-1 mt-0.5">
            <h2 className={`${studentNameStyle} font-black text-slate-950 uppercase tracking-tight line-clamp-2 drop-shadow-xs`}>
              {student.name}
            </h2>
            <div className="text-[7px] font-black text-red-600 uppercase tracking-widest mt-0.5 bg-red-50 px-2 py-0.2 rounded-full inline-block border border-red-200">
              STUDENT IDENTITY CARD
            </div>
          </div>

          {/* 4. Student Details Grid - Auto-fit, Larger Font, Bold, Easily Readable in Print */}
          <div className="w-full mt-1 px-2 space-y-[2px] text-[8.5px] font-black text-slate-950">
            <div className="flex items-center">
              <span className="w-13 text-slate-950 font-black shrink-0">ID No</span>
              <span className="text-slate-950 mr-1.5 font-black shrink-0">:</span>
              <span className="font-mono font-black text-slate-950 text-[9px] truncate">{studentId}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="w-13 text-slate-950 font-black shrink-0">Class</span>
                <span className="text-slate-950 mr-1.5 font-black shrink-0">:</span>
                <span className="font-black text-slate-950 text-[9px]">{student.class}</span>
              </div>
              <div className="flex items-center pr-1">
                <span className="text-slate-950 font-black mr-1">Roll</span>
                <span className="text-slate-950 mr-1 font-black">:</span>
                <span className="font-mono font-black text-red-700 text-[9px]">#{student.roll}</span>
              </div>
            </div>
            {student.fatherName && (
              <div className="flex items-start">
                <span className="w-13 text-slate-950 font-black shrink-0 pt-0.5">Father</span>
                <span className="text-slate-950 mr-1.5 font-black shrink-0 pt-0.5">:</span>
                <span className={`font-black text-slate-950 flex-1 min-w-0 break-words line-clamp-2 ${fatherNameStyle}`}>
                  {student.fatherName}
                </span>
              </div>
            )}
            {student.phone && (
              <div className="flex items-center">
                <span className="w-13 text-slate-950 font-black shrink-0">Phone</span>
                <span className="text-slate-950 mr-1.5 font-black shrink-0">:</span>
                <span className="font-mono font-black text-slate-950 text-[8.5px]">{student.phone}</span>
              </div>
            )}
            {student.address && (
              <div className="flex items-start">
                <span className="w-13 text-slate-950 font-black shrink-0 pt-0.5">Address</span>
                <span className="text-slate-950 mr-1.5 font-black shrink-0 pt-0.5">:</span>
                <span className={`font-black text-slate-950 flex-1 min-w-0 break-words line-clamp-2 ${addressStyle}`}>
                  {student.address}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 5. Bottom Section: Barcode + HM Signature + School Address Footer */}
        <div className="w-full mt-auto pt-1">
          <div className="flex items-end justify-between px-1 mb-1 gap-1">
            {/* Barcode */}
            <div className="bg-white px-1.5 py-0.5 rounded shadow-xs border border-slate-300 w-[114px] sm:w-[120px] h-[21px] flex items-center justify-center overflow-hidden">
              <Barcode
                value={barcodePayload}
                height={14}
                width={1.4}
                showText={false}
              />
            </div>

            {/* HM Signature */}
            <HmSignatureBlock
              signatureUrl={school.signature}
              headmasterName={school.headmasterName}
              labelColorClass="text-slate-950"
            />
          </div>

          {/* School Address Footer inside Bottom Yellow Band */}
          <div className="w-full text-center px-1 pt-0.5">
            <p className="text-[5.5px] font-black text-slate-950 leading-[1.15] break-words line-clamp-2">
              {school.address ? school.address : school.email ? school.email : 'School Hub Educational System'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * =========================================================================
 * TEMPLATE 3: Cyan Turquoise & Dark Navy (সায়ান ও ডার্ক নেভি — Ginyard Style)
 * Curved cyan header, circular photo with cyan halo ring overlapping dark navy body,
 * bold crisp white typography, barcode scanner strip, dynamic school data
 * =========================================================================
 */
export const StudentIdCardTemplate3: React.FC<StudentIdCardProps> = ({
  student,
  school,
  showCuttingGuide = true,
  className = '',
}) => {
  const studentId = useMemo(() => generateStandardStudentId(school, student), [school, student]);
  const photoUrl = formatPhotoUrl(student.photo);
  const { fatherNameStyle, addressStyle, studentNameStyle, schoolNameStyle } = useAutoFitStyles(student, school);
  const barcodePayload = useMemo(() => formatBarcodeScanData(school, student), [school, student]);

  const formattedRegNo = useMemo(() => {
    if (!school.regNo) {
      if (school.code) return `Code: ${school.code}`;
      if (school.phone) return `Mob: ${school.phone}`;
      return 'STUDENT IDENTITY CARD';
    }
    const cleaned = school.regNo.replace(/^(reg\.?\s*no\.?|reg\.?)\s*[:-]?\s*/i, '').trim();
    return `Reg No: ${cleaned}`;
  }, [school.regNo, school.code, school.phone]);

  const academicSession = useMemo(() => {
    return school.currentAcademicYear || '2025-2026';
  }, [school.currentAcademicYear]);

  return (
    <div
      className={`relative bg-[#132238] text-white overflow-hidden select-none font-sans shadow-sm ${
        showCuttingGuide ? 'border border-dashed border-slate-400' : 'border border-slate-300'
      } ${className}`}
      style={{
        width: '2.1in',
        height: '3.4in',
        minWidth: '2.1in',
        minHeight: '3.4in',
        maxWidth: '2.1in',
        maxHeight: '3.4in',
        boxSizing: 'border-box',
      }}
    >
      {/* Background Graphic SVG Shapes - Template 3: Exact Ginyard Reference Top Header & Curved Layers */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        viewBox="0 0 210 340"
        preserveAspectRatio="none"
      >
        {/* Upper White Card Background */}
        <rect x="0" y="0" width="210" height="340" fill="#FFFFFF" />

        {/* White Curved Transition Band behind Photo Halo */}
        <path d="M0,98 C55,110 155,110 210,98 L210,108 C155,120 55,120 0,108 Z" fill="#FFFFFF" />

        {/* Deep Navy Blue Body (Bottom Section starting from curve) */}
        <path d="M0,108 C55,120 155,120 210,108 L210,340 L0,340 Z" fill="#132238" />

        {/* Top Cyan Panel with Inset White Margins and Rounded Bottom Corners */}
        <path
          d="M8,0 L202,0 C204,0 204,4 204,8 L204,74 C204,82 196,88 186,88 L24,88 C14,88 6,82 6,74 L6,8 C6,4 6,0 8,0 Z"
          fill="#00C4E2"
        />

        {/* Central Cyan Circular Photo Halo / Tab overlapping down into the Dark Navy Area */}
        <circle cx="105" cy="88" r="42" fill="#00C4E2" />
      </svg>

      {/* Semi-transparent School Logo Watermark */}
      {school.logo && (
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none z-0">
          <img
            src={school.logo}
            alt="watermark"
            className="w-32 h-32 object-contain grayscale invert"
            loading="lazy"
          />
        </div>
      )}

      {/* Main Foreground Content Layer */}
      <div className="relative z-10 flex flex-col justify-between h-full p-2 pt-1">
        {/* 1. Header inside Cyan Area: Circular Logo + School Name & Reg No */}
        <div className="w-full pt-0.5 px-0.5 h-[44px]">
          <div className="flex items-center justify-start gap-1 w-full">
            {school.logo ? (
              <div className="w-7 h-7 rounded-full bg-white p-0.5 shadow-xs shrink-0 flex items-center justify-center overflow-hidden border border-white/90">
                <img
                  src={school.logo}
                  alt={school.name}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-white text-[#00C4E2] flex items-center justify-center shrink-0 shadow-xs font-black border border-white/90">
                <Building2 className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-0 flex-1 text-left flex flex-col justify-center overflow-hidden">
              <AutoFitSchoolHeader
                name={school.name}
                align="left"
                colorClass="text-white"
                dropShadow="drop-shadow-xs"
                baseFontSize={13}
              />
              <p className="text-[7.5px] font-black text-white/95 leading-none mt-0.5 tracking-tight truncate">
                {formattedRegNo}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Photo Section: Perfectly Centered on the Cyan Circular Tab */}
        <div className="flex flex-col items-center w-full mt-0.5">
          <div className="relative w-[68px] h-[68px] rounded-full p-[2.5px] bg-white shadow-md flex items-center justify-center shrink-0">
            <div className="w-full h-full rounded-full bg-slate-100 overflow-hidden flex items-center justify-center">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={student.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <User className="w-8.5 h-8.5 text-slate-400" />
                </div>
              )}
            </div>
          </div>

          {/* 3. Student Name (Bold White Uppercase) & Subtitle */}
          <div className="text-center w-full px-1 mt-2">
            <h2 className={`${studentNameStyle} font-black text-white uppercase tracking-wide leading-tight truncate drop-shadow-sm`}>
              {student.name}
            </h2>
            <div className="text-[6.5px] font-black text-[#00C4E2] uppercase tracking-widest mt-0.5">
              STUDENT IDENTITY CARD
            </div>
          </div>

          {/* 4. Student Details Grid on Dark Navy Background */}
          <div className="w-full mt-2 px-2.5 space-y-[2px] text-[8.5px] font-black text-white">
            <div className="flex items-center">
              <span className="w-13 text-cyan-200 font-black shrink-0">ID No</span>
              <span className="text-cyan-400 mr-1.5 font-black shrink-0">:</span>
              <span className="font-mono font-black text-white text-[9px] truncate">{studentId}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="w-13 text-cyan-200 font-black shrink-0">Class</span>
                <span className="text-cyan-400 mr-1.5 font-black shrink-0">:</span>
                <span className="font-black text-white text-[9px]">{student.class}</span>
              </div>
              <div className="flex items-center pr-1">
                <span className="text-cyan-200 font-black mr-1">Roll</span>
                <span className="text-cyan-400 mr-1 font-black">:</span>
                <span className="font-mono font-black text-[#00E5FF] text-[9px]">#{student.roll}</span>
              </div>
            </div>
            {student.fatherName && (
              <div className="flex items-start">
                <span className="w-13 text-cyan-200 font-black shrink-0 pt-0.5">Father</span>
                <span className="text-cyan-400 mr-1.5 font-black shrink-0 pt-0.5">:</span>
                <span className={`font-black text-white flex-1 min-w-0 break-words line-clamp-2 ${fatherNameStyle}`}>
                  {student.fatherName}
                </span>
              </div>
            )}
            {student.phone && (
              <div className="flex items-center">
                <span className="w-13 text-cyan-200 font-black shrink-0">Phone</span>
                <span className="text-cyan-400 mr-1.5 font-black shrink-0">:</span>
                <span className="font-mono font-black text-white text-[8.5px]">{student.phone}</span>
              </div>
            )}
            {student.address && (
              <div className="flex items-start">
                <span className="w-13 text-cyan-200 font-black shrink-0 pt-0.5">Address</span>
                <span className="text-cyan-400 mr-1.5 font-black shrink-0 pt-0.5">:</span>
                <span className={`font-black text-white flex-1 min-w-0 break-words line-clamp-2 ${addressStyle}`}>
                  {student.address}
                </span>
              </div>
            )}
            {/* Session Field under Address */}
            <div className="flex items-center">
              <span className="w-13 text-cyan-200 font-black shrink-0">Session</span>
              <span className="text-cyan-400 mr-1.5 font-black shrink-0">:</span>
              <span className="font-mono font-black text-[#00E5FF] text-[8.5px]">
                {academicSession}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Bottom Section: Barcode + HM Signature + School Address */}
        <div className="w-full mt-auto pt-1">
          <div className="flex items-end justify-between px-1 mb-1 gap-1">
            {/* Crisp Barcode Box */}
            <div className="bg-white px-1.5 py-0.5 rounded shadow-xs border border-slate-300 w-[114px] sm:w-[120px] h-[21px] flex items-center justify-center overflow-hidden">
              <Barcode
                value={barcodePayload}
                height={14}
                width={1.4}
                showText={false}
              />
            </div>

            {/* HM Signature */}
            <HmSignatureBlock
              signatureUrl={school.signature}
              headmasterName={school.headmasterName}
              labelColorClass="text-cyan-200 drop-shadow-xs"
            />
          </div>

          {/* School Address Footer */}
          <div className="w-full text-center px-1 pt-0.5 border-t border-cyan-500/20">
            <p className="text-[5.5px] font-bold text-cyan-200/90 leading-[1.15] break-words line-clamp-2">
              {school.address ? school.address : school.email ? school.email : 'School Hub Educational System'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * =========================================================================
 * TEMPLATE 4: School Hub Branded Design (স্কুলহাব ব্র্যান্ডেড — Navy/Purple + Magenta Accents)
 * Top lanyard slot cutout, top-left circular logo badge, bold school header + tagline,
 * side core values (শৃঙ্খলা/সততা/সাফল্য & জ্ঞান/দক্ষতা/মানবতা), double-ring circular photo,
 * student role pill badge, icon-prefixed info rows, high-contrast QR code,
 * and white curved footer band with contact icons & Headmaster signature.
 * =========================================================================
 */
export const StudentIdCardTemplate4: React.FC<StudentIdCardProps> = ({
  student,
  school,
  showCuttingGuide = true,
  className = '',
}) => {
  const studentId = useMemo(() => generateStandardStudentId(school, student), [school, student]);
  const photoUrl = formatPhotoUrl(student.photo);
  const { fatherNameStyle, addressStyle, studentNameStyle } = useAutoFitStyles(student, school);
  const barcodePayload = useMemo(() => formatBarcodeScanData(school, student), [school, student]);

  const formattedRegNo = useMemo(() => {
    if (!school.regNo) {
      if (school.code) return `Code: ${school.code}`;
      if (school.phone) return `Mob: ${school.phone}`;
      return 'STUDENT IDENTITY CARD';
    }
    const cleaned = school.regNo.replace(/^(reg\.?\s*no\.?|reg\.?)\s*[:-]?\s*/i, '').trim();
    return `Reg No: ${cleaned}`;
  }, [school.regNo, school.code, school.phone]);

  const roleLabel = useMemo(() => {
    const g = student.gender?.toLowerCase() || '';
    if (g === 'female' || g === 'girl' || g === 'ছাত্রী') return 'ছাত্রী';
    if (g === 'male' || g === 'boy' || g === 'ছাত্র') return 'ছাত্র';
    return 'শিক্ষার্থী';
  }, [student.gender]);

  return (
    <div
      className={`relative bg-[#140733] text-white overflow-hidden select-none font-sans shadow-sm ${
        showCuttingGuide ? 'border border-dashed border-slate-400' : 'border border-slate-300'
      } ${className}`}
      style={{
        width: '2.1in',
        height: '3.4in',
        minWidth: '2.1in',
        minHeight: '3.4in',
        maxWidth: '2.1in',
        maxHeight: '3.4in',
        boxSizing: 'border-box',
      }}
    >
      {/* Background Graphic SVG Vector Layer */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        viewBox="0 0 210 340"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Main Background Gradient */}
          <linearGradient id="tpl4Bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#140733" />
            <stop offset="45%" stopColor="#210948" />
            <stop offset="80%" stopColor="#18073b" />
            <stop offset="100%" stopColor="#100529" />
          </linearGradient>

          {/* Magenta/Pink Accent Gradient */}
          <linearGradient id="tpl4Magenta" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d946ef" />
            <stop offset="100%" stopColor="#c026d3" />
          </linearGradient>
        </defs>

        {/* Base Gradient Canvas */}
        <rect x="0" y="0" width="210" height="340" fill="url(#tpl4Bg)" />

        {/* Top Right Dot Matrix Pattern */}
        <g fill="#c084fc" opacity="0.35">
          <circle cx="172" cy="18" r="1.2" />
          <circle cx="180" cy="18" r="1.2" />
          <circle cx="188" cy="18" r="1.2" />
          <circle cx="196" cy="18" r="1.2" />

          <circle cx="172" cy="26" r="1.2" />
          <circle cx="180" cy="26" r="1.2" />
          <circle cx="188" cy="26" r="1.2" />
          <circle cx="196" cy="26" r="1.2" />

          <circle cx="172" cy="34" r="1.2" />
          <circle cx="180" cy="34" r="1.2" />
          <circle cx="188" cy="34" r="1.2" />
          <circle cx="196" cy="34" r="1.2" />

          <circle cx="180" cy="42" r="1.2" />
          <circle cx="188" cy="42" r="1.2" />
          <circle cx="196" cy="42" r="1.2" />
        </g>

        {/* Top Right Diagonal Accent Rounded Stripes */}
        <rect
          x="170"
          y="-25"
          width="16"
          height="125"
          rx="8"
          transform="rotate(38 170 35)"
          fill="#c026d3"
          opacity="0.85"
        />
        <rect
          x="192"
          y="-5"
          width="14"
          height="100"
          rx="7"
          transform="rotate(38 192 45)"
          fill="#e879f9"
          opacity="0.75"
        />
        <rect
          x="152"
          y="-45"
          width="10"
          height="100"
          rx="5"
          transform="rotate(38 152 5)"
          fill="#7e22ce"
          opacity="0.6"
        />

        {/* Left Side Subtle Diagonal Geometric Slash */}
        <rect
          x="-20"
          y="40"
          width="14"
          height="80"
          rx="7"
          transform="rotate(-38 -20 80)"
          fill="#a21caf"
          opacity="0.4"
        />

        {/* Top Lanyard Cutout Indicator Hole */}
        <rect
          x="88"
          y="2"
          width="34"
          height="5"
          rx="2.5"
          fill="#090317"
          stroke="#e879f9"
          strokeWidth="0.6"
          strokeOpacity="0.4"
        />

        {/* School Logo Watermark in Background behind Student Photo */}
        {school.logo && (
          <image
            href={school.logo}
            x="50"
            y="95"
            width="110"
            height="110"
            opacity="0.06"
            preserveAspectRatio="xMidYMid meet"
          />
        )}

        {/* Bottom Curved White Footer Band */}
        <path
          d="M0,264 C45,256 165,270 210,260 L210,340 L0,340 Z"
          fill="#FFFFFF"
        />
        {/* Thin Magenta Contour Line atop Wave */}
        <path
          d="M0,264 C45,256 165,270 210,260"
          fill="none"
          stroke="#d946ef"
          strokeWidth="2"
        />
      </svg>

      {/* Main Foreground Content Layer */}
      <div className="relative z-10 flex flex-col justify-between h-full p-2 pt-1">
        {/* 1. Header Section: Top-Left Full Original Logo Badge + School Name & Reg No */}
        <div className="w-full pt-0.5 px-0.5">
          <div className="flex items-center gap-1.5 w-full">
            {/* Top-Left Circular Logo Badge (Full Original Logo) */}
            <div className="w-9 h-9 rounded-full bg-white border-2 border-[#581c87] shadow-md p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
              {school.logo ? (
                <img
                  src={school.logo}
                  alt={school.name}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              ) : (
                <Building2 className="w-5 h-5 text-[#581c87] shrink-0" />
              )}
            </div>

            {/* School Name & Registration Number */}
            <div className="min-w-0 flex-1 text-center flex flex-col justify-center overflow-hidden">
              <AutoFitSchoolHeader
                name={school.nameBengali || school.name}
                align="center"
                colorClass="text-white"
                dropShadow="drop-shadow-sm"
                baseFontSize={14.5}
              />

              {/* Registration Number Tag / Affiliation */}
              <p className="text-[7.5px] font-bold text-fuchsia-300/95 leading-none mt-0.5 tracking-tight truncate">
                {formattedRegNo}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Middle Body: Left "শিক্ষাবর্ষ" + Circular Photo (Double Ring) + Right "2026" */}
        <div className="w-full flex items-center justify-between px-1 mt-0.5">
          {/* Left Column: শিক্ষাবর্ষ */}
          <div className="w-11 text-center flex flex-col items-center justify-center shrink-0 space-y-0.5">
            <Calendar className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
            <div className="text-[8px] font-black text-white/95 leading-tight tracking-tight">
              <div>শিক্ষা-</div>
              <div>বর্ষ</div>
            </div>
          </div>

          {/* Center Student Photo with Double Border Ring (White + Magenta/Purple Gradient Halo) */}
          <div className="w-[66px] h-[66px] rounded-full p-[2.5px] bg-gradient-to-tr from-[#6b21a8] via-[#c026d3] to-[#f472b6] shadow-lg flex items-center justify-center shrink-0">
            <div className="w-full h-full rounded-full bg-white p-[2px] overflow-hidden flex items-center justify-center">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={student.name}
                  className="w-full h-full object-cover rounded-full"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full rounded-full bg-slate-100 text-purple-900 flex items-center justify-center font-black">
                  <User className="w-7 h-7 opacity-70" />
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Dynamic Academic Year */}
          <div className="w-11 text-center flex flex-col items-center justify-center shrink-0 space-y-0.5">
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
            <div className="text-[9.5px] font-black text-pink-300 font-mono leading-tight tracking-tight">
              {school.currentAcademicYear || '2026'}
            </div>
          </div>
        </div>

        {/* 3. Student Name & Role Badge (Pill) */}
        <div className="w-full text-center mt-0.5 px-1">
          <h2 className={`${studentNameStyle} font-black text-white uppercase leading-tight drop-shadow-sm tracking-tight truncate`}>
            {student.name}
          </h2>
          <div className="text-center mt-0.5">
            <span className="inline-block px-3 py-0.5 rounded-full bg-[#701a75] border border-fuchsia-400/50 text-white text-[8px] font-black shadow-xs tracking-wider leading-none">
              {roleLabel}
            </span>
          </div>
        </div>

        {/* 4. Student Details Table (Expanded Full Width, Auto-Fit Father Name & Contact Details) */}
        <div className="w-full px-1.5 mt-0.5 space-y-[2px] text-white">
          {/* Class & Roll Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0">
              <div className="w-3.5 h-3.5 rounded-full bg-[#86198f] text-white flex items-center justify-center shrink-0 mr-1 shadow-xs">
                <BookOpen className="w-2 h-2" />
              </div>
              <span className="text-[8px] font-extrabold text-fuchsia-200 w-11 shrink-0">শ্রেণি</span>
              <span className="text-fuchsia-300 font-bold text-[8px] mr-1 shrink-0">:</span>
              <span className="text-[9.5px] font-black text-white uppercase truncate">
                {student.class}
              </span>
            </div>

            <div className="flex items-center pr-1 shrink-0">
              <div className="w-3.5 h-3.5 rounded-full bg-[#86198f] text-white flex items-center justify-center shrink-0 mr-1 shadow-xs">
                <Award className="w-2 h-2" />
              </div>
              <span className="text-[8px] font-extrabold text-fuchsia-200 mr-1 shrink-0">রোল</span>
              <span className="text-fuchsia-300 font-bold text-[8px] mr-1 shrink-0">:</span>
              <span className="text-[10px] font-black text-amber-300 font-mono tracking-tight">
                #{String(student.roll).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Student ID Row */}
          <div className="flex items-center">
            <div className="w-3.5 h-3.5 rounded-full bg-[#86198f] text-white flex items-center justify-center shrink-0 mr-1 shadow-xs">
              <CreditCard className="w-2 h-2" />
            </div>
            <span className="text-[8px] font-extrabold text-fuchsia-200 w-11 shrink-0">আইডি নং</span>
            <span className="text-fuchsia-300 font-bold text-[8px] mr-1 shrink-0">:</span>
            <span className="text-[8.5px] font-black text-pink-200 font-mono tracking-tight truncate">
              {studentId}
            </span>
          </div>

          {/* Father's Name Row with Auto-Fit Multi-line safety */}
          {student.fatherName && (
            <div className="flex items-start">
              <div className="w-3.5 h-3.5 rounded-full bg-[#86198f] text-white flex items-center justify-center shrink-0 mr-1 mt-0.5 shadow-xs">
                <User className="w-2 h-2" />
              </div>
              <span className="text-[8px] font-extrabold text-fuchsia-200 w-11 shrink-0 pt-0.5">পিতা</span>
              <span className="text-fuchsia-300 font-bold text-[8px] mr-1 shrink-0 pt-0.5">:</span>
              <span className={`font-black text-white flex-1 min-w-0 break-words line-clamp-2 ${fatherNameStyle}`}>
                {student.fatherName}
              </span>
            </div>
          )}

          {/* Mobile / Phone Row */}
          <div className="flex items-center">
            <div className="w-3.5 h-3.5 rounded-full bg-[#86198f] text-white flex items-center justify-center shrink-0 mr-1 shadow-xs">
              <Phone className="w-2 h-2" />
            </div>
            <span className="text-[8px] font-extrabold text-fuchsia-200 w-11 shrink-0">মোবাইল</span>
            <span className="text-fuchsia-300 font-bold text-[8px] mr-1 shrink-0">:</span>
            <span className="text-[9px] font-black text-emerald-300 font-mono tracking-tight truncate">
              {student.phone || school.phone || '-'}
            </span>
          </div>

          {/* Address Row (if present) */}
          {student.address && (
            <div className="flex items-start">
              <div className="w-3.5 h-3.5 rounded-full bg-[#86198f] text-white flex items-center justify-center shrink-0 mr-1 mt-0.5 shadow-xs">
                <MapPin className="w-2 h-2" />
              </div>
              <span className="text-[8px] font-extrabold text-fuchsia-200 w-11 shrink-0 pt-0.5">ঠিকানা</span>
              <span className="text-fuchsia-300 font-bold text-[8px] mr-1 shrink-0 pt-0.5">:</span>
              <span className={`font-black text-white/95 flex-1 min-w-0 break-words line-clamp-2 ${addressStyle}`}>
                {student.address}
              </span>
            </div>
          )}
        </div>

        {/* 5. Curved White Footer Band: School Address + Scannable Barcode (Left/Center) + HM Signature (Right) */}
        <div className="w-full mt-auto pt-3 pb-0.5 flex items-end justify-between px-1 gap-1">
          {/* Left / Center: School Address & Scannable Barcode */}
          <div className="flex-1 min-w-0 pr-1 flex flex-col justify-end">
            {/* School Address */}
            <div className="flex items-start gap-1 mb-0.5">
              <MapPin className="w-2.5 h-2.5 text-[#581c87] shrink-0 mt-[0.5px]" />
              <span
                className="font-bold text-slate-900 leading-[1.1] block line-clamp-2"
                style={{
                  fontSize: (school.address?.length || 0) > 36 ? '5px' : (school.address?.length || 0) > 20 ? '5.5px' : '6.5px',
                }}
              >
                {school.address || 'পশ্চিমবঙ্গ, ভারত'}
              </span>
            </div>

            {/* Crisp High-Contrast Scannable Barcode Box */}
            <div className="bg-white px-1.5 py-0.5 rounded shadow-xs border border-slate-300 w-full max-w-[115px] h-[21px] flex items-center justify-center overflow-hidden">
              <Barcode
                value={barcodePayload}
                height={14}
                width={1.4}
                showText={false}
              />
            </div>
          </div>

          {/* Right: HM Signature with Underline & Designation */}
          <div className="shrink-0 flex flex-col items-center justify-end text-center min-w-[52px] pb-0.5">
            {school.signature ? (
              <img
                src={school.signature}
                alt="HM Sign"
                className="h-[16px] max-w-[52px] object-contain mb-0.5"
                loading="lazy"
              />
            ) : (
              <span className="font-serif italic font-black text-[8.5px] text-slate-900 tracking-tight leading-none select-none mb-0.5">
                {school.headmasterName ? school.headmasterName.split(' ')[0] : 'Headmaster'}
              </span>
            )}
            <div className="w-13 border-b border-slate-900/80 mb-0.5"></div>
            <span className="text-[6.5px] font-black text-slate-950 leading-none tracking-tight">
              প্রধান শিক্ষক
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Main Student ID Card Component - Switches between Template 1, Template 2, Template 3 and Template 4
 */
export const StudentIdCard: React.FC<StudentIdCardProps> = ({
  template = 'template1',
  ...props
}) => {
  if (template === 'template4') {
    return <StudentIdCardTemplate4 {...props} />;
  }
  if (template === 'template3') {
    return <StudentIdCardTemplate3 {...props} />;
  }
  if (template === 'template2') {
    return <StudentIdCardTemplate2 {...props} />;
  }
  return <StudentIdCardTemplate1 {...props} />;
};

interface StudentIdCardSheetProps {
  students: Student[];
  school: School;
  template?: IdCardTemplateType;
  showCuttingGuide?: boolean;
  sheetIndex?: number;
  totalSheets?: number;
}

/**
 * 9-Card A4 Sheet Component (3 columns x 3 rows)
 * CR80 Card Size: 2.1in x 3.4in
 * Fits exactly onto standard A4 Portrait (8.27in x 11.69in)
 */
export const StudentIdCardSheet: React.FC<StudentIdCardSheetProps> = ({
  students,
  school,
  template = 'template1',
  showCuttingGuide = true,
  sheetIndex,
  totalSheets,
}) => {
  // Max 9 cards per sheet
  const sheetStudents = students.slice(0, 9);
  const templateTitle =
    template === 'template4'
      ? 'টেমপ্লেট ৪: স্কুলহাব ব্র্যান্ডেড (Navy/Purple + Magenta)'
      : template === 'template3'
      ? 'টেমপ্লেট ৩: সায়ান ও ডার্ক নেভি'
      : template === 'template2'
      ? 'টেমপ্লেট ২: ইয়েলো ও রেড'
      : 'টেমপ্লেট ১: ক্লাসিক ব্লু';

  return (
    <div className="idcard-sheet-container page-break avoid-break-inside bg-white mx-auto my-0 p-0 shadow-lg print:shadow-none print:m-0 print:p-0">
      {/* Optional on-screen sheet badge */}
      {sheetIndex !== undefined && totalSheets !== undefined && (
        <div className="no-print text-center py-1.5 bg-slate-800 text-cyan-300 text-xs font-bold rounded-t-xl border-b border-slate-700">
          A4 প্রিন্ট শিট #{sheetIndex + 1} (মোট {totalSheets} টি শিটের মধ্যে — {sheetStudents.length} টি আইডি কার্ড | {templateTitle})
        </div>
      )}

      <div
        className="idcard-a4-grid p-2 sm:p-4 print:p-0"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 2.1in)',
          gridTemplateRows: 'repeat(3, 3.4in)',
          gap: '3.5mm 3.5mm',
          justifyContent: 'center',
          alignContent: 'center',
          width: '100%',
          maxWidth: '8.27in',
          minHeight: '10.8in',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {sheetStudents.map((st, idx) => (
          <div key={st.studentId || st.roll || idx} className="flex items-center justify-center">
            <StudentIdCard
              student={st}
              school={school}
              template={template}
              showCuttingGuide={showCuttingGuide}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
