import React, { useState, useMemo, useEffect } from 'react';
import { Student } from '../types';
import { 
  CheckSquare, 
  XSquare, 
  Users, 
  UserCheck, 
  Layers, 
  Search, 
  Trash2, 
  Check, 
  Filter,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  ListFilter
} from 'lucide-react';

export type PrintSelectionMode = 'ALL' | 'SINGLE' | 'SELECTED' | 'MULTI_CLASS';

export const getStudentKey = (st: Student): string => {
  if (st.studentId) return String(st.studentId);
  return `${(st.class || '').trim().toLowerCase()}__${st.roll}__${(st.name || '').trim().toLowerCase()}`;
};

export const filterPrintStudents = (
  students: Student[],
  mode: PrintSelectionMode,
  selectedClass: string,
  singleRoll: string,
  selectedKeys: string[],
  showInactive: boolean = false
): Student[] => {
  const activeStudents = students.filter(st => {
    if (!st) return false;
    if (!showInactive && st.isActive === false) return false;
    return true;
  });

  if (mode === 'SELECTED' || mode === 'MULTI_CLASS') {
    const keySet = new Set(selectedKeys);
    return activeStudents
      .filter(st => keySet.has(getStudentKey(st)))
      .sort((a, b) => {
        const classComp = (a.class || '').localeCompare(b.class || '');
        if (classComp !== 0) return classComp;
        return Number(a.roll) - Number(b.roll);
      });
  }

  const classStudents = activeStudents.filter(st => 
    selectedClass === 'ALL' || (st.class || '').trim().toLowerCase() === selectedClass.trim().toLowerCase()
  );

  if (mode === 'SINGLE') {
    return classStudents.filter(st => String(st.roll) === String(singleRoll));
  }

  // mode === 'ALL'
  return classStudents.sort((a, b) => {
    const classComp = (a.class || '').localeCompare(b.class || '');
    if (classComp !== 0) return classComp;
    return Number(a.roll) - Number(b.roll);
  });
};

interface StudentPrintSelectorProps {
  mode: PrintSelectionMode;
  onModeChange: (mode: PrintSelectionMode) => void;
  selectedKeys: string[];
  onSelectedKeysChange: (keys: string[]) => void;
  currentClass: string;
  onClassChange?: (cls: string) => void;
  singleRoll?: string;
  onSingleRollChange?: (roll: string) => void;
  availableClasses: string[];
  allStudents: Student[];
  showInactive?: boolean;
  themeColor?: 'cyan' | 'teal' | 'indigo' | 'amber' | 'sky' | 'emerald';
  docTitle?: string;
  compact?: boolean;
}

export const StudentPrintSelector: React.FC<StudentPrintSelectorProps> = ({
  mode,
  onModeChange,
  selectedKeys,
  onSelectedKeysChange,
  currentClass,
  onClassChange,
  singleRoll = '1',
  onSingleRollChange,
  availableClasses,
  allStudents,
  showInactive = false,
  themeColor = 'cyan',
  docTitle = 'প্রিন্ট ডকুমেন্ট',
  compact = false
}) => {
  // Extract clean list of classes
  const classesList = useMemo(() => {
    if (availableClasses && availableClasses.length > 0) {
      return availableClasses;
    }
    const extracted = Array.from(new Set(allStudents.map(s => (s.class || '').trim()).filter(Boolean)));
    return extracted.length > 0 ? extracted : ['Class I', 'Class II', 'Class III', 'Class IV', 'Class V'];
  }, [availableClasses, allStudents]);

  // Active class state for dropdown-based selection
  const [dropdownClass, setDropdownClass] = useState<string>(() => {
    if (currentClass && currentClass !== 'ALL' && classesList.includes(currentClass)) {
      return currentClass;
    }
    return classesList[0] || 'Class I';
  });

  // Sync if currentClass changes externally
  useEffect(() => {
    if (currentClass && currentClass !== 'ALL' && classesList.includes(currentClass)) {
      setDropdownClass(currentClass);
    }
  }, [currentClass, classesList]);

  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active students pool
  const activeStudents = useMemo(() => {
    return allStudents.filter(st => {
      if (!st) return false;
      if (!showInactive && st.isActive === false) return false;
      return true;
    });
  }, [allStudents, showInactive]);

  // Students belonging to the currently chosen dropdown class
  const classSpecificStudents = useMemo(() => {
    return activeStudents
      .filter(st => (st.class || '').trim().toLowerCase() === dropdownClass.trim().toLowerCase())
      .sort((a, b) => Number(a.roll) - Number(b.roll));
  }, [activeStudents, dropdownClass]);

  // Filtered students for grid view within selected class (considering search query)
  const displayStudentsInDropdownClass = useMemo(() => {
    if (!searchQuery.trim()) {
      return classSpecificStudents;
    }
    const q = searchQuery.trim().toLowerCase();
    return classSpecificStudents.filter(st => 
      (st.name || '').toLowerCase().includes(q) || 
      String(st.roll).includes(q) ||
      (st.fatherName || '').toLowerCase().includes(q) ||
      (st.studentId || '').toLowerCase().includes(q)
    );
  }, [classSpecificStudents, searchQuery]);

  // Students for Single mode
  const currentClassStudentsForSingle = useMemo(() => {
    const targetClass = currentClass === 'ALL' ? dropdownClass : currentClass;
    return activeStudents
      .filter(st => (st.class || '').trim().toLowerCase() === targetClass.trim().toLowerCase())
      .sort((a, b) => Number(a.roll) - Number(b.roll));
  }, [activeStudents, currentClass, dropdownClass]);

  // Counts of selected students grouped by class
  const selectedCountByClass = useMemo(() => {
    const counts: Record<string, number> = {};
    const keySet = new Set(selectedKeys);
    activeStudents.forEach(st => {
      if (keySet.has(getStudentKey(st))) {
        counts[st.class] = (counts[st.class] || 0) + 1;
      }
    });
    return counts;
  }, [activeStudents, selectedKeys]);

  // Selected student objects for chips review
  const selectedStudentObjects = useMemo(() => {
    const keySet = new Set(selectedKeys);
    return activeStudents
      .filter(st => keySet.has(getStudentKey(st)))
      .sort((a, b) => {
        const classComp = (a.class || '').localeCompare(b.class || '');
        if (classComp !== 0) return classComp;
        return Number(a.roll) - Number(b.roll);
      });
  }, [activeStudents, selectedKeys]);

  // Handlers for class selection in dropdown
  const handleDropdownClassChange = (newCls: string) => {
    setDropdownClass(newCls);
    onClassChange?.(newCls);
  };

  // Toggle single student
  const toggleStudentSelection = (st: Student) => {
    const key = getStudentKey(st);
    if (selectedKeys.includes(key)) {
      onSelectedKeysChange(selectedKeys.filter(k => k !== key));
    } else {
      onSelectedKeysChange([...selectedKeys, key]);
    }
  };

  // Select all students of currently chosen dropdown class
  const selectAllInDropdownClass = () => {
    const targetClassKeys = classSpecificStudents.map(getStudentKey);
    const merged = new Set([...selectedKeys, ...targetClassKeys]);
    onSelectedKeysChange(Array.from(merged));
  };

  // Unselect all students of currently chosen dropdown class
  const unselectAllInDropdownClass = () => {
    const targetClassKeysSet = new Set(classSpecificStudents.map(getStudentKey));
    onSelectedKeysChange(selectedKeys.filter(k => !targetClassKeysSet.has(k)));
  };

  // Clear all selections across all classes
  const clearAllSelections = () => {
    onSelectedKeysChange([]);
  };

  // Selected count in current dropdown class
  const currentClassSelectedCount = useMemo(() => {
    const keySet = new Set(selectedKeys);
    return classSpecificStudents.filter(st => keySet.has(getStudentKey(st))).length;
  }, [classSpecificStudents, selectedKeys]);

  // Theme styling helpers
  const themeClasses = {
    cyan: {
      border: 'border-cyan-500/40',
      bg: 'bg-cyan-950/70',
      activeTab: 'bg-cyan-500 text-slate-950 font-black shadow-md border-cyan-400',
      inactiveTab: 'bg-slate-900/80 text-cyan-300 border-cyan-800/60 hover:bg-slate-800',
      badge: 'bg-cyan-900/80 text-cyan-300 border-cyan-500/40',
      btnPrimary: 'bg-cyan-600 hover:bg-cyan-500 text-white',
      accentText: 'text-cyan-400',
      itemChecked: 'bg-cyan-950/90 border-cyan-500 text-cyan-200 font-bold shadow-md ring-1 ring-cyan-500/60',
      chip: 'bg-cyan-900/80 border-cyan-700/80 text-cyan-200'
    },
    teal: {
      border: 'border-teal-500/40',
      bg: 'bg-teal-950/70',
      activeTab: 'bg-teal-500 text-slate-950 font-black shadow-md border-teal-400',
      inactiveTab: 'bg-slate-900/80 text-teal-300 border-teal-800/60 hover:bg-slate-800',
      badge: 'bg-teal-900/80 text-teal-300 border-teal-500/40',
      btnPrimary: 'bg-teal-600 hover:bg-teal-500 text-white',
      accentText: 'text-teal-400',
      itemChecked: 'bg-teal-950/90 border-teal-500 text-teal-200 font-bold shadow-md ring-1 ring-teal-500/60',
      chip: 'bg-teal-900/80 border-teal-700/80 text-teal-200'
    },
    indigo: {
      border: 'border-indigo-500/40',
      bg: 'bg-indigo-950/70',
      activeTab: 'bg-indigo-600 text-white font-black shadow-md border-indigo-400',
      inactiveTab: 'bg-slate-900/80 text-indigo-300 border-indigo-800/60 hover:bg-slate-800',
      badge: 'bg-indigo-900/80 text-indigo-300 border-indigo-500/40',
      btnPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
      accentText: 'text-indigo-400',
      itemChecked: 'bg-indigo-950/90 border-indigo-500 text-indigo-200 font-bold shadow-md ring-1 ring-indigo-500/60',
      chip: 'bg-indigo-900/80 border-indigo-700/80 text-indigo-200'
    },
    amber: {
      border: 'border-amber-500/40',
      bg: 'bg-amber-950/60',
      activeTab: 'bg-amber-500 text-slate-950 font-black shadow-md border-amber-400',
      inactiveTab: 'bg-slate-900/80 text-amber-300 border-amber-800/60 hover:bg-slate-800',
      badge: 'bg-amber-900/80 text-amber-300 border-amber-500/40',
      btnPrimary: 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold',
      accentText: 'text-amber-400',
      itemChecked: 'bg-amber-950/90 border-amber-500 text-amber-200 font-bold shadow-md ring-1 ring-amber-500/60',
      chip: 'bg-amber-900/80 border-amber-700/80 text-amber-200'
    },
    sky: {
      border: 'border-sky-500/40',
      bg: 'bg-sky-950/70',
      activeTab: 'bg-sky-500 text-slate-950 font-black shadow-md border-sky-400',
      inactiveTab: 'bg-slate-900/80 text-sky-300 border-sky-800/60 hover:bg-slate-800',
      badge: 'bg-sky-900/80 text-sky-300 border-sky-500/40',
      btnPrimary: 'bg-sky-600 hover:bg-sky-500 text-white',
      accentText: 'text-sky-400',
      itemChecked: 'bg-sky-950/90 border-sky-500 text-sky-200 font-bold shadow-md ring-1 ring-sky-500/60',
      chip: 'bg-sky-900/80 border-sky-700/80 text-sky-200'
    },
    emerald: {
      border: 'border-emerald-500/40',
      bg: 'bg-emerald-950/70',
      activeTab: 'bg-emerald-500 text-slate-950 font-black shadow-md border-emerald-400',
      inactiveTab: 'bg-slate-900/80 text-emerald-300 border-emerald-800/60 hover:bg-slate-800',
      badge: 'bg-emerald-900/80 text-emerald-300 border-emerald-500/40',
      btnPrimary: 'bg-emerald-600 hover:bg-emerald-500 text-white',
      accentText: 'text-emerald-400',
      itemChecked: 'bg-emerald-950/90 border-emerald-500 text-emerald-200 font-bold shadow-md ring-1 ring-emerald-500/60',
      chip: 'bg-emerald-900/80 border-emerald-700/80 text-emerald-200'
    }
  }[themeColor];

  return (
    <div className="w-full space-y-3 no-print">
      {/* Primary Selection Mode Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 shadow-md">
        {/* Left Side: 3 Clean Mode Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-slate-300 flex items-center gap-1.5 mr-1">
            <Filter className={`w-3.5 h-3.5 ${themeClasses.accentText}`} /> প্রিন্ট মোড:
          </span>

          <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800 flex-wrap gap-1">
            {/* Mode 1: All Students */}
            <button
              type="button"
              onClick={() => onModeChange('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                mode === 'ALL' ? themeClasses.activeTab : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> সকল শিক্ষার্থী (Class All)
            </button>

            {/* Mode 2: Single Student */}
            <button
              type="button"
              onClick={() => onModeChange('SINGLE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                mode === 'SINGLE' ? themeClasses.activeTab : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" /> একক শিক্ষার্থী (Single Roll)
            </button>

            {/* Mode 3: Class-wise Dropdown Tick Selection */}
            <button
              type="button"
              onClick={() => {
                onModeChange('SELECTED');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                mode === 'SELECTED' || mode === 'MULTI_CLASS'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md border-amber-400'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" /> টিক মেরে নির্বাচন (Class Dropdown & Multi-Select)
            </button>
          </div>
        </div>

        {/* Right Side: Mode-dependent Quick Status */}
        <div className="flex items-center gap-2">
          {mode === 'SELECTED' || mode === 'MULTI_CLASS' ? (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 font-extrabold text-xs rounded-full border border-amber-500/40 flex items-center gap-1.5 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                মোট {selectedKeys.length} জন নির্বাচিত
              </span>
              {selectedKeys.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllSelections}
                  className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-[11px] font-bold rounded-lg border border-rose-700/50 flex items-center gap-1 cursor-pointer transition-all"
                  title="সব সিলেকশন ক্লিয়ার করুন"
                >
                  <Trash2 className="w-3 h-3" /> ক্লিয়ার
                </button>
              )}
            </div>
          ) : mode === 'SINGLE' ? (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-bold">ক্লাস:</span>
                <select
                  value={currentClass === 'ALL' ? dropdownClass : currentClass}
                  onChange={e => {
                    handleDropdownClassChange(e.target.value);
                  }}
                  className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {classesList.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-bold">রোল:</span>
                <select
                  value={singleRoll}
                  onChange={e => onSingleRollChange?.(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-cyan-500 max-w-[220px] cursor-pointer"
                >
                  {currentClassStudentsForSingle.map(st => (
                    <option key={st.roll} value={String(st.roll)}>
                      Roll #{st.roll}: {st.name}
                    </option>
                  ))}
                  {currentClassStudentsForSingle.length === 0 && (
                    <option value="1">শিক্ষার্থী পাওয়া যায়নি</option>
                  )}
                </select>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold">ক্লাস:</span>
              <select
                value={currentClass}
                onChange={e => {
                  onClassChange?.(e.target.value);
                }}
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="ALL">সকল ক্লাস (ALL Classes)</option>
                {classesList.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span className="text-xs font-bold text-slate-400 ml-1">
                ({activeStudents.filter(st => currentClass === 'ALL' || (st.class || '').trim().toLowerCase() === currentClass.trim().toLowerCase()).length} জন)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CLASS-WISE DROPDOWN TICK SELECTION PANEL (mode === 'SELECTED' or 'MULTI_CLASS') */}
      {(mode === 'SELECTED' || mode === 'MULTI_CLASS') && (
        <div className="w-full bg-slate-950/95 border-2 border-amber-500/50 rounded-2xl p-4 space-y-4 shadow-xl">
          {/* Top Bar: Prominent Class Dropdown + Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-inner">
            {/* Class Dropdown Selector */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-amber-400" />
                <label className="text-xs font-black text-amber-200">
                  ক্লাস সিলেক্ট করুন:
                </label>
              </div>

              <select
                value={dropdownClass}
                onChange={e => handleDropdownClassChange(e.target.value)}
                className="px-4 py-2 bg-slate-950 border-2 border-amber-500/70 rounded-xl text-xs text-amber-300 font-black focus:outline-none focus:border-amber-400 shadow-md cursor-pointer min-w-[190px]"
              >
                {classesList.map(cls => {
                  const classTotal = activeStudents.filter(
                    s => (s.class || '').trim().toLowerCase() === cls.trim().toLowerCase()
                  ).length;
                  const selectedInThisClass = activeStudents.filter(
                    s => (s.class || '').trim().toLowerCase() === cls.trim().toLowerCase() && selectedKeys.includes(getStudentKey(s))
                  ).length;
                  return (
                    <option key={cls} value={cls}>
                      {cls} ({classTotal} জন {selectedInThisClass > 0 ? `• ${selectedInThisClass} জন টিক দেওয়া` : ''})
                    </option>
                  );
                })}
              </select>

              <span className="px-3 py-1 bg-slate-950 border border-slate-700 text-slate-300 font-bold text-xs rounded-xl">
                এই ক্লাসে টিক দেওয়া: <strong className="text-amber-400 font-black">{currentClassSelectedCount}</strong> / {classSpecificStudents.length} জন
              </span>
            </div>

            {/* Quick Actions: Select All in Class / Unselect in Class / Clear */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={selectAllInDropdownClass}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                title={`${dropdownClass} ক্লাসের সকল শিক্ষার্থীকে টিক দিন`}
              >
                <CheckSquare className="w-4 h-4" /> {dropdownClass} সবাইকে টিক দিন
              </button>

              <button
                type="button"
                onClick={unselectAllInDropdownClass}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-800/40 font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                title={`${dropdownClass} ক্লাসের শিক্ষার্থীদের আন-টিক করুন`}
              >
                <XSquare className="w-4 h-4 text-rose-400" /> {dropdownClass} আন-টিক
              </button>

              {selectedKeys.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllSelections}
                  className="px-3 py-2 bg-rose-950/90 hover:bg-rose-900 text-rose-200 border border-rose-700/60 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="সকল ক্লাসের নির্বাচিত তালিকা সম্পূর্ণ খালি করুন"
                >
                  <Trash2 className="w-4 h-4" /> সব ক্লিয়ার ({selectedKeys.length})
                </button>
              )}
            </div>
          </div>

          {/* Selected Students Review Chips Bar (Across all classes) */}
          {selectedStudentObjects.length > 0 && (
            <div className="bg-slate-900/95 border border-amber-500/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
                <span className="flex items-center gap-1.5 text-amber-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  প্রিন্টের জন্য নির্বাচিত শিক্ষার্থী তালিকা ({selectedStudentObjects.length} জন):
                </span>
                <span className="text-[11px] text-slate-400">
                  ক্রস (✕) চিহ্নে ক্লিক করে যেকোনো শিক্ষার্থী বাদ দিন
                </span>
              </div>

              {/* Grouped summary by class */}
              <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-slate-400 pb-1">
                {Object.entries(selectedCountByClass).map(([cls, cnt]) => (
                  <span key={cls} className="px-2 py-0.5 bg-slate-950 rounded-md border border-slate-700 text-slate-300">
                    <strong className="text-amber-400">{cls}:</strong> {cnt} জন
                  </span>
                ))}
              </div>

              {/* Chips List */}
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar p-1 bg-slate-950/70 rounded-lg border border-slate-800/80">
                {selectedStudentObjects.map(st => (
                  <span
                    key={getStudentKey(st)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/90 border border-amber-500/50 text-amber-200 text-xs font-semibold shadow-xs"
                  >
                    <span className="text-cyan-400 font-bold text-[10px]">[{st.class}]</span>
                    <span className="text-amber-300 font-mono font-bold">#{st.roll}</span>
                    <span className="font-bold">{st.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleStudentSelection(st)}
                      className="ml-1 text-amber-400 hover:text-rose-400 cursor-pointer font-black text-sm transition-colors"
                      title="বাদ দিন"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Student Search & Current Class Info Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <ListFilter className="w-4 h-4 text-amber-400" />
              <span>
                বর্তমানে প্রদর্শিত ক্লাস: <strong className="text-amber-300 font-black">{dropdownClass}</strong> ({displayStudentsInDropdownClass.length} জন শিক্ষার্থী)
              </span>
            </div>

            {/* Quick Search within this class */}
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={`${dropdownClass} ক্লাসে নাম বা রোল খুঁজুন...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Student Grid for the Selected Dropdown Class */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-64 overflow-y-auto p-1.5 custom-scrollbar bg-slate-950/60 rounded-xl border border-slate-800/80">
            {displayStudentsInDropdownClass.map(st => {
              const isChecked = selectedKeys.includes(getStudentKey(st));
              return (
                <div
                  key={getStudentKey(st)}
                  onClick={() => toggleStudentSelection(st)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold cursor-pointer border transition-all select-none ${
                    isChecked
                      ? 'bg-amber-950/90 border-amber-500 text-amber-200 font-bold shadow-md ring-2 ring-amber-500/50'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-4 h-4 rounded accent-amber-500 cursor-pointer shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate flex items-center gap-1">
                      <span className="text-amber-400 font-mono font-black shrink-0">#{st.roll}</span>
                      <span className="truncate">{st.name}</span>
                    </div>
                    {st.fatherName && (
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {st.fatherName}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {displayStudentsInDropdownClass.length === 0 && (
              <div className="col-span-full text-center text-slate-400 text-xs py-8 italic">
                {searchQuery ? `"${searchQuery}" এর সাথে মিলে এমন কোনো শিক্ষার্থী পাওয়া যায়নি।` : `${dropdownClass} ক্লাসে কোনো শিক্ষার্থী তালিকাভুক্ত নেই।`}
              </div>
            )}
          </div>

          {/* Help instruction note for user */}
          <div className="text-[11px] text-slate-400 flex items-center justify-between flex-wrap gap-2 pt-1">
            <span>
              💡 <strong>পরামর্শ:</strong> অন্য কোনো ক্লাসের শিক্ষার্থীর প্রিন্ট করতে চাইলে ওপরের ড্রপডাউন থেকে সেই ক্লাস নির্বাচন করুন। পূর্বের ক্লাসে টিক মারা শিক্ষার্থীরা তালিকায় সংরক্ষিত থাকবে।
            </span>
            <span className="text-amber-300 font-bold">
              {docTitle} প্রিন্ট হবে: {selectedKeys.length} জনের
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
