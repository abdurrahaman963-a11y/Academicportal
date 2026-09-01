import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { School, Student } from '../types';
import { normalizeClassName } from '../mockData';
import { generateStandardStudentId } from '../lib/studentIdHelper';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Download, 
  AlertTriangle,
  Loader2,
  Users,
  Search,
  Check
} from 'lucide-react';

interface StudentCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (importedStudents: Student[], mode: 'replace' | 'merge') => Promise<{ success: number; failed: number }>;
  existingStudents: Student[];
  schoolName: string;
  schoolId: string;
  school?: School;
}

// Convert Bengali numerals (০-৯) to English digits (0-9)
function convertBengaliDigitsToEnglish(str: string | number): string {
  if (str === null || str === undefined) return '';
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let result = String(str).trim();
  bnDigits.forEach((bn, en) => {
    result = result.split(bn).join(String(en));
  });
  return result;
}

interface ColumnMapping {
  classKey?: string;
  rollKey?: string;
  nameKey?: string;
  fatherKey?: string;
  addressKey?: string;
  phoneKey?: string;
  sectionKey?: string;
  genderKey?: string;
  feeKey?: string;
}

export const StudentCsvImportModal: React.FC<StudentCsvImportModalProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
  existingStudents,
  schoolName,
  schoolId,
  school
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedStudents, setParsedStudents] = useState<Student[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [previewSearch, setPreviewSearch] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Header detection logic matching English & Bengali headers
  const detectHeaderMapping = (headers: string[]): ColumnMapping => {
    const mapping: ColumnMapping = {};

    headers.forEach(h => {
      const clean = h.trim().toLowerCase();

      // Father's name / Guardian (check BEFORE student name to avoid false matches)
      if (
        !mapping.fatherKey &&
        (clean.includes('father') || 
         clean.includes('পিতা') || 
         clean.includes('বাবা') || 
         clean.includes('guardian') || 
         clean.includes('অভিভাবক') ||
         clean.includes('baba'))
      ) {
        mapping.fatherKey = h;
        return;
      }

      // Class
      if (
        !mapping.classKey &&
        (clean.includes('class') || 
         clean.includes('grade') || 
         clean.includes('std') || 
         clean.includes('standard') || 
         clean.includes('শ্রেণি') || 
         clean.includes('শ্রেণী') || 
         clean.includes('ক্লাস') || 
         clean.includes('ক্লাশ'))
      ) {
        mapping.classKey = h;
        return;
      }

      // Roll
      if (
        !mapping.rollKey &&
        (clean.includes('roll') || 
         clean.includes('রোল') || 
         clean.includes('ক্রমিক') || 
         clean.includes('serial') || 
         clean === 'sl' || 
         clean === 'sl no' || 
         clean === 'sl. no' || 
         clean === 'sl.')
      ) {
        mapping.rollKey = h;
        return;
      }

      // Student Name (must not be father/mother/guardian/school/teacher)
      if (
        !mapping.nameKey &&
        !clean.includes('father') &&
        !clean.includes('mother') &&
        !clean.includes('school') &&
        !clean.includes('headmaster') &&
        !clean.includes('teacher') &&
        !clean.includes('guardian') &&
        !clean.includes('পিতা') &&
        !clean.includes('মাতা') &&
        !clean.includes('মা') &&
        !clean.includes('বাবা') &&
        (clean.includes('name') || 
         clean.includes('নাম') || 
         clean.includes('ছাত্র') || 
         clean.includes('শিক্ষার্থী') ||
         clean.includes('student'))
      ) {
        mapping.nameKey = h;
        return;
      }

      // Address
      if (
        !mapping.addressKey &&
        (clean.includes('address') || 
         clean.includes('addr') || 
         clean.includes('village') || 
         clean.includes('গ্রাম') || 
         clean.includes('ঠিকানা') || 
         clean.includes('বাসস্থান') || 
         clean.includes('location'))
      ) {
        mapping.addressKey = h;
        return;
      }

      // Phone
      if (
        !mapping.phoneKey &&
        (clean.includes('phone') || 
         clean.includes('mobile') || 
         clean.includes('contact') || 
         clean.includes('cell') || 
         clean.includes('ফোন') || 
         clean.includes('মোবাইল') || 
         clean.includes('যোগাযোগ'))
      ) {
        mapping.phoneKey = h;
        return;
      }

      // Section (optional)
      if (
        !mapping.sectionKey &&
        (clean.includes('section') || 
         clean.includes('sec') || 
         clean.includes('শাখা'))
      ) {
        mapping.sectionKey = h;
        return;
      }

      // Gender (optional)
      if (
        !mapping.genderKey &&
        (clean.includes('gender') || 
         clean.includes('sex') || 
         clean.includes('লিঙ্গ'))
      ) {
        mapping.genderKey = h;
        return;
      }

      // Fee (optional)
      if (
        !mapping.feeKey &&
        (clean.includes('fee') || 
         clean.includes('বেতন') || 
         clean.includes('monthly'))
      ) {
        mapping.feeKey = h;
        return;
      }
    });

    return mapping;
  };

  const handleFileChange = (selectedFile: File) => {
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith('.csv') && selectedFile.type !== 'text/csv') {
      setParseError('অনুগ্রহ করে একটি বৈধ CSV (.csv) ফাইল নির্বাচন করুন।');
      return;
    }

    setFile(selectedFile);
    setParseError(null);
    setWarnings([]);
    setImportResult(null);
    setIsParsing(true);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header: string) => header.trim(),
      complete: (results) => {
        try {
          const rawRows = results.data as Record<string, any>[];
          if (!rawRows || rawRows.length === 0) {
            setParseError('CSV ফাইলটিতে কোনো ডাটা বা তথ্য পাওয়া যায়নি।');
            setIsParsing(false);
            return;
          }

          const headers = results.meta.fields || Object.keys(rawRows[0] || {});
          const mapping = detectHeaderMapping(headers);

          setDetectedColumns({
            'Class / শ্রেণি': mapping.classKey || 'Not Detected (ডিফল্ট Class I হবে)',
            'Roll / রোল': mapping.rollKey || 'Not Detected',
            'Name / নাম': mapping.nameKey || 'Not Detected',
            "Father's Name / পিতার নাম": mapping.fatherKey || 'Not Detected',
            'Address / ঠিকানা': mapping.addressKey || 'Not Detected',
            'Phone / মোবাইল': mapping.phoneKey || 'Not Detected'
          });

          if (!mapping.nameKey && !mapping.rollKey) {
            setParseError('CSV ফাইলের হেডার শনাক্ত করা যায়নি। নিশ্চিত করুন কলামে Class, Roll, Name, Father Name ইত্যাদি রয়েছে।');
            setIsParsing(false);
            return;
          }

          const studentList: Student[] = [];
          const parseWarnings: string[] = [];
          const seenKeyMap = new Set<string>();

          rawRows.forEach((row, idx) => {
            const rowIndex = idx + 2; // 1-based, considering header is row 1

            // Name
            const rawName = mapping.nameKey ? String(row[mapping.nameKey] || '').trim() : '';
            if (!rawName) {
              parseWarnings.push(`সারি ${rowIndex}: শিক্ষার্থীর নাম ফাঁকা থাকায় বাদ দেওয়া হয়েছে।`);
              return;
            }

            // Class
            const rawClass = mapping.classKey ? String(row[mapping.classKey] || '').trim() : 'Class I';
            const normalizedClass = normalizeClassName(rawClass || 'Class I');

            // Roll
            let rollNum = 0;
            if (mapping.rollKey) {
              const cleanRollStr = convertBengaliDigitsToEnglish(row[mapping.rollKey]).replace(/[^\d]/g, '');
              rollNum = parseInt(cleanRollStr, 10);
            }
            if (isNaN(rollNum) || rollNum <= 0) {
              rollNum = idx + 1;
            }

            // Father Name
            const rawFather = mapping.fatherKey ? String(row[mapping.fatherKey] || '').trim() : '';

            // Address
            const rawAddress = mapping.addressKey ? String(row[mapping.addressKey] || '').trim() : '';

            // Phone
            const rawPhone = mapping.phoneKey ? convertBengaliDigitsToEnglish(row[mapping.phoneKey]).replace(/[^\d+ -]/g, '').trim() : '';

            // Section
            const rawSec = mapping.sectionKey ? String(row[mapping.sectionKey] || '').trim().toUpperCase() : '';

            // Gender
            let gender = 'Male';
            if (mapping.genderKey) {
              const rawGender = String(row[mapping.genderKey] || '').trim().toLowerCase();
              if (rawGender.includes('fem') || rawGender.includes('girl') || rawGender.includes('মেয়ে') || rawGender.includes('নারী') || rawGender === 'f') {
                gender = 'Female';
              }
            }

            // Monthly Fee
            let monthlyFee = 350;
            if (mapping.feeKey) {
              const feeVal = parseInt(convertBengaliDigitsToEnglish(row[mapping.feeKey]).replace(/[^\d]/g, ''), 10);
              if (!isNaN(feeVal) && feeVal >= 0) {
                monthlyFee = feeVal;
              }
            }

            // Student ID (generated using standard format: SchoolCode-Year-Class-Roll)
            const studentId = generateStandardStudentId(
              school || { schoolId, name: schoolName },
              { class: normalizedClass, roll: rollNum }
            );

            const classRollKey = `${normalizedClass}_${rollNum}`;
            if (seenKeyMap.has(classRollKey)) {
              parseWarnings.push(`সারি ${rowIndex}: ${normalizedClass} রোল #${rollNum} ডুপ্লিকেট পাওয়া গেছে।`);
            }
            seenKeyMap.add(classRollKey);

            // Create student object - CRITICAL: photo must remain undefined!
            const studentObj: Student = {
              studentId,
              class: normalizedClass,
              section: rawSec || undefined,
              roll: rollNum,
              name: rawName,
              fatherName: rawFather,
              address: rawAddress,
              phone: rawPhone,
              gender,
              monthlyFee,
              status: 'Active',
              isActive: true,
              govtSchoolName: '',
              vehicle: 'No'
              // photo is intentionally NOT defined here to preserve existing photos
            };

            studentList.push(studentObj);
          });

          if (studentList.length === 0) {
            setParseError('কোনো বৈধ শিক্ষার্থীর ডাটা খুঁজে পাওয়া যায়নি।');
          } else {
            setParsedStudents(studentList);
            setWarnings(parseWarnings);
          }
        } catch (err: any) {
          console.error('CSV parse error:', err);
          setParseError('CSV পার্স করতে ত্রুটি হয়েছে: ' + (err?.message || 'Error'));
        } finally {
          setIsParsing(false);
        }
      },
      error: (err) => {
        console.error('Papa parse error:', err);
        setParseError('ফাইল পড়তে ত্রুটি হয়েছে: ' + err.message);
        setIsParsing(false);
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Download Sample Template CSV
  const handleDownloadSampleCsv = () => {
    const sampleHeaders = ['Class', 'Roll', 'Name', "Father's Name", 'Address', 'Phone', 'Gender', 'Section'];
    const sampleRows = [
      ['Class I', '1', 'আব্দুর রহমান', 'মুহাম্মদ আলী', 'কলকাতা, পশ্চিমবঙ্গ', '9876543210', 'Male', 'A'],
      ['Class I', '2', 'ফাতিমা খাতুন', 'আহমেদ হোসেন', 'হাওড়া', '9876543211', 'Female', 'A'],
      ['Class II', '1', 'রাকিবুল ইসলাম', 'রফিকুল ইসলাম', 'বারাসাত', '9876543212', 'Male', ''],
      ['Class III', '1', 'সুমাইয়া পারভীন', 'মোশাররফ হোসেন', 'দমদম', '9876543213', 'Female', '']
    ];

    const csvContent = Papa.unparse({
      fields: sampleHeaders,
      data: sampleRows
    });

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Student_Import_Template_${schoolId || 'school'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Execute Import
  const handleExecuteImport = async () => {
    if (parsedStudents.length === 0) return;
    setIsSaving(true);
    try {
      const result = await onConfirmImport(parsedStudents, importMode);
      setImportResult(result);
    } catch (err: any) {
      console.error('Import error:', err);
      alert('ইম্পোর্ট করতে সমস্যা হয়েছে: ' + (err?.message || 'Error'));
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered preview rows
  const filteredPreview = parsedStudents.filter(st => {
    if (!previewSearch.trim()) return true;
    const q = previewSearch.toLowerCase();
    return (
      st.name.toLowerCase().includes(q) ||
      String(st.roll).includes(q) ||
      st.class.toLowerCase().includes(q) ||
      st.fatherName.toLowerCase().includes(q) ||
      st.phone.includes(q) ||
      st.address.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-cyan-800/80 rounded-2xl max-w-4xl w-full p-5 sm:p-6 space-y-5 shadow-2xl my-auto text-slate-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                Google Sheet / CSV Import <span className="text-cyan-400 font-semibold">(শিক্ষার্থী ইম্পোর্ট)</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                প্রতিষ্ঠান: <strong className="text-cyan-300">{schoolName}</strong> • (School ID: <span className="font-mono text-cyan-400">{schoolId}</span>)
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer disabled:opacity-50 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Upload Dropzone if no file or result */}
        {importResult ? (
          /* Completion Result View */
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-xl">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h4 className="text-lg font-black text-white">ইম্পোর্ট সফলভাবে সম্পন্ন হয়েছে!</h4>
              <p className="text-xs text-slate-300 mt-1">
                মোট <strong className="text-emerald-400 font-bold">{importResult.success}</strong> জন শিক্ষার্থীর তথ্য ডেটাবেসে ও তালিকায় সংরক্ষণ করা হয়েছে।
              </p>
              {importResult.failed > 0 && (
                <p className="text-xs text-rose-400 mt-1 font-semibold">
                  ⚠️ {importResult.failed} টি রেকর্ডে সমস্যা হয়েছিল।
                </p>
              )}
            </div>
            <div className="pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg cursor-pointer transition-all"
              >
                সম্পন্ন ও বন্ধ করুন (Done)
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* File Upload Zone */}
            {!parsedStudents.length ? (
              <div className="space-y-4">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    isDragging 
                      ? 'border-cyan-400 bg-cyan-950/30 scale-[0.99]' 
                      : 'border-slate-700 bg-slate-950/50 hover:border-cyan-500 hover:bg-slate-950'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                    accept=".csv,text/csv"
                    className="hidden"
                  />
                  
                  <div className="w-14 h-14 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    {isParsing ? (
                      <Loader2 className="w-7 h-7 animate-spin text-cyan-400" />
                    ) : (
                      <UploadCloud className="w-7 h-7 text-cyan-400" />
                    )}
                  </div>
                  
                  <h4 className="font-bold text-white text-sm mb-1">
                    Google Sheet থেকে এক্সপোর্ট করা <span className="text-cyan-400">.CSV ফাইল</span> এখানে আপলোড করুন
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    ফাইল ড্র্যাগ করে আনুন অথবা ব্রাউজ করতে এখানে ক্লিক করুন (Class, Roll, Name, Father's Name, Address, Phone কলাম সমন্বিত)
                  </p>
                </div>

                {parseError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{parseError}</span>
                  </div>
                )}

                {/* Helper & Template Download */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/70 border border-slate-800 p-4 rounded-xl text-xs">
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-200">প্রয়োজনীয় কলামসমূহ (বাংলা বা ইংরেজি যেকোনো নামে হতে পারে):</p>
                    <p className="text-[11px] text-slate-400">
                      • Class (শ্রেণি) • Roll (রোল) • Name (নাম) • Father's Name (পিতার নাম) • Address (ঠিকানা) • Phone (ফোন)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadSampleCsv}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-700/50 rounded-xl font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    নমুনা CSV টেমপ্লেট ডাউনলোড
                  </button>
                </div>
              </div>
            ) : (
              /* Step 2: Parsed Preview View */
              <div className="space-y-4">
                
                {/* Status Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-xs">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg font-black">
                      মোট পাওয়া গেছে: {parsedStudents.length} জন
                    </span>
                    {file && (
                      <span className="text-slate-400 truncate max-w-xs font-mono text-[11px]">
                        📄 {file.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-48">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        value={previewSearch}
                        onChange={e => setPreviewSearch(e.target.value)}
                        placeholder="প্রিভিউ খুঁজুন..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setParsedStudents([]);
                        setFile(null);
                        setWarnings([]);
                        setParseError(null);
                      }}
                      className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
                    >
                      অন্য ফাইল দিন
                    </button>
                  </div>
                </div>

                {/* Detected Column mapping badges */}
                <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 text-[11px]">
                  <p className="font-bold text-slate-300 mb-1.5">চিহ্নিত কলাম ম্যাপিং (Detected Headers):</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-400">
                    {Object.entries(detectedColumns).map(([field, colName]) => (
                      <div key={field} className="flex items-center gap-1 truncate">
                        <span className="text-slate-300 font-semibold">{field}:</span>
                        <span className="text-cyan-400 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-900/50 truncate">
                          {colName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Warnings alert if any */}
                {warnings.length > 0 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs space-y-1 max-h-24 overflow-y-auto">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>সতর্কবার্তা ({warnings.length} টি):</span>
                    </div>
                    {warnings.slice(0, 5).map((w, i) => (
                      <p key={i} className="text-[11px] text-amber-200/80 pl-5">• {w}</p>
                    ))}
                    {warnings.length > 5 && (
                      <p className="text-[10px] text-amber-300/60 pl-5">...এবং আরও {warnings.length - 5} টি</p>
                    )}
                  </div>
                )}

                {/* Preview Table */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto shadow-inner">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-800/90 text-slate-300 sticky top-0 font-bold border-b border-slate-700">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">শ্রেণি</th>
                        <th className="p-2.5">রোল</th>
                        <th className="p-2.5">শিক্ষার্থীর নাম</th>
                        <th className="p-2.5">পিতার নাম</th>
                        <th className="p-2.5">ঠিকানা</th>
                        <th className="p-2.5">মোবাইল</th>
                        <th className="p-2.5 text-slate-400">ID Key</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-slate-300 font-medium">
                      {filteredPreview.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-4 text-center text-slate-500">
                            কোনো তথ্য পাওয়া যায়নি
                          </td>
                        </tr>
                      ) : (
                        filteredPreview.map((st, i) => {
                          const isExisting = existingStudents.some(
                            es => normalizeClassName(es.class) === normalizeClassName(st.class) && Number(es.roll) === Number(st.roll)
                          );
                          return (
                            <tr key={i} className="hover:bg-slate-900/60">
                              <td className="p-2.5 text-slate-500 font-mono text-[11px]">{i + 1}</td>
                              <td className="p-2.5 font-bold text-cyan-400">{st.class}</td>
                              <td className="p-2.5 font-mono font-bold text-amber-400">#{st.roll}</td>
                              <td className="p-2.5 font-bold text-white flex items-center gap-1.5">
                                <span>{st.name}</span>
                                {isExisting && (
                                  <span className="px-1.5 py-0.2 text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-bold">
                                    Update
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-slate-300">{st.fatherName || '—'}</td>
                              <td className="p-2.5 text-slate-400 max-w-[150px] truncate">{st.address || '—'}</td>
                              <td className="p-2.5 font-mono text-cyan-300 text-[11px]">{st.phone || '—'}</td>
                              <td className="p-2.5 font-mono text-slate-500 text-[10px]">{st.studentId}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Import Mode Selection */}
                <div className="bg-slate-950/70 border border-cyan-900/60 rounded-xl p-3.5 space-y-2.5">
                  <label className="block text-xs font-black text-cyan-300 uppercase tracking-wide">
                    ইম্পোর্ট মোড নির্বাচন করুন (Select Import Mode):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label 
                      onClick={() => setImportMode('replace')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                        importMode === 'replace' 
                          ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-lg ring-1 ring-cyan-500/50' 
                          : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="importMode" 
                        value="replace" 
                        checked={importMode === 'replace'} 
                        onChange={() => setImportMode('replace')} 
                        className="mt-1 accent-cyan-400"
                      />
                      <div className="space-y-0.5 text-xs">
                        <div className="font-extrabold text-cyan-300 flex items-center gap-1.5">
                          <span>🔄 নতুন তালিকা প্রতিস্থাপন (Replace All)</span>
                          <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[9px] font-bold">রিকমেন্ডেড</span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          পুরোনো সমস্ত ডুপ্লিকেট ও অকার্যকর শিক্ষার্থী মুছে সম্পূর্ণ ফ্রেশ <strong>{parsedStudents.length}</strong> জন শিক্ষার্থী সেট করবে।
                        </p>
                      </div>
                    </label>

                    <label 
                      onClick={() => setImportMode('merge')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                        importMode === 'merge' 
                          ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-lg ring-1 ring-cyan-500/50' 
                          : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="importMode" 
                        value="merge" 
                        checked={importMode === 'merge'} 
                        onChange={() => setImportMode('merge')} 
                        className="mt-1 accent-cyan-400"
                      />
                      <div className="space-y-0.5 text-xs">
                        <div className="font-extrabold text-amber-300 flex items-center gap-1.5">
                          <span>🧩 মার্জ ও আপডেট (Merge & Keep Photos)</span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          বিদ্যমান শিক্ষার্থীদের নাম ও তথ্য আপডেট করবে এবং পূর্বে সংরক্ষিত শিক্ষার্থীর <strong>ছবি অটুট রাখবে</strong>।
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Action Confirmation Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
                  <p className="text-[11px] text-slate-400">
                    {importMode === 'replace' ? (
                      <span className="text-cyan-300">
                        ⚡ <em>সম্পূর্ণ ফ্রেশ {parsedStudents.length} জন শিক্ষার্থীর তালিকা লোড হবে। ড্যাশবোর্ড ও স্টুডেন্ট কাউন্ট ১০০% নিখুঁত হবে।</em>
                      </span>
                    ) : (
                      <span className="text-amber-300">
                        💡 <em>ছবি মুছে যাওয়ার কোনো ঝুঁকি নেই; বিদ্যমান শিক্ষার্থীদের সংরক্ষিত ফটো অটুট থাকবে।</em>
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isSaving}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50 transition-all flex-1 sm:flex-initial"
                    >
                      বাতিল (Cancel)
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteImport}
                      disabled={isSaving || parsedStudents.length === 0}
                      className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all flex-1 sm:flex-initial"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          সেভ করা হচ্ছে...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Confirm Import ({parsedStudents.length} জন {importMode === 'replace' ? 'প্রতিস্থাপন' : 'যুক্ত'})
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};
