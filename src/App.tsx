/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { Plus, Trash2, RotateCcw, FileDown, Table as TableIcon, Info, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Add type declaration for jspdf-autotable plugin if needed, 
// but jspdf-autotable extends jsPDF instance at runtime.

type Grade = {
  label: string;
  point: number;
};

const DEFAULT_GRADE_SCALE: Grade[] = [
  { label: 'A+', point: 4.00 },
  { label: 'A', point: 3.75 },
  { label: 'B+', point: 3.50 },
  { label: 'B', point: 3.25 },
  { label: 'C+', point: 3.00 },
  { label: 'C', point: 2.75 },
  { label: 'D+', point: 2.50 },
  { label: 'D', point: 2.25 },
  { label: 'F', point: 0.00 },
];

type Course = {
  id: string;
  name: string;
  credit: number;
  grade: string;
  isRetake: boolean;
  prevGrade: string;
};

export default function App() {
  const [prevCredits, setPrevCredits] = useState<number>(0);
  const [prevCGPA, setPrevCGPA] = useState<number>(0);
  const [gradeScale, setGradeScale] = useState<Grade[]>(DEFAULT_GRADE_SCALE);
  const [courses, setCourses] = useState<Course[]>([
    { id: '1', name: '', credit: 3, grade: 'A+', isRetake: false, prevGrade: 'F' }
  ]);
  const [showScaleSettings, setShowScaleSettings] = useState(false);

  const getPoint = (label: string) => gradeScale.find(g => g.label === label)?.point || 0;

  const results = useMemo(() => {
    // In AIUB/Standard systems:
    // CGPA = Total Grade Points Earned / Total Credits Attempted
    // Note: Attempted credits here refers to the sum of credits of all unique courses taken.
    
    // We treat 'prevCredits' as the total credits that contribute to the current CGPA (the denominator).
    const prevTotalPoints = prevCredits * prevCGPA;
    
    let currentSemesterPoints = 0;
    let currentSemesterCredits = 0;
    
    let pointsAdjustment = 0;
    let creditsAdjustment = 0;

    courses.forEach(course => {
      const gradePoint = getPoint(course.grade);
      currentSemesterPoints += course.credit * gradePoint;
      currentSemesterCredits += course.credit;

      if (course.isRetake) {
        const prevGradePoint = getPoint(course.prevGrade);
        // Replace old points with new points
        // Adjustment = (New Credit * New GP) - (New Credit * Old GP)
        // We assume the course credit remains the same for the same course
        pointsAdjustment += (course.credit * gradePoint) - (course.credit * prevGradePoint);
        // Credits adjustment is 0 because the course was already in the denominator (prevCredits)
      } else {
        // New course
        pointsAdjustment += course.credit * gradePoint;
        creditsAdjustment += course.credit;
      }
    });

    const semesterGPA = currentSemesterCredits > 0 ? currentSemesterPoints / currentSemesterCredits : 0;
    
    const finalTotalPoints = prevTotalPoints + pointsAdjustment;
    const finalTotalCredits = prevCredits + creditsAdjustment;
    
    const updatedCGPA = finalTotalCredits > 0 ? finalTotalPoints / finalTotalCredits : 0;

    // Completed credits (Passed ones)
    // This is for the UI summary
    let semesterPassedCredits = 0;
    courses.forEach(c => {
      if (getPoint(c.grade) > 0) semesterPassedCredits += c.credit;
    });

    return {
      semesterGPA,
      updatedCGPA,
      completedCredits: finalTotalCredits, // Total unique credits attempted/passed
      totalPoints: finalTotalPoints,
      isProbation: updatedCGPA < 2.50 && finalTotalCredits > 0
    };
  }, [prevCredits, prevCGPA, courses, gradeScale]);

  const addCourse = () => {
    setCourses([...courses, { id: crypto.randomUUID(), name: '', credit: 3, grade: 'A+', isRetake: false, prevGrade: 'F' }]);
  };

  const removeCourse = (id: string) => {
    if (courses.length > 1) {
      setCourses(courses.filter(c => c.id !== id));
    }
  };

  const updateCourse = (id: string, updates: Partial<Course>) => {
    setCourses(courses.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const reset = () => {
    setPrevCredits(0);
    setPrevCGPA(0);
    setCourses([{ id: '1', name: '', credit: 3, grade: 'A+', isRetake: false, prevGrade: 'F' }]);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('AIUB CGPA Result', 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Previous Credits: ${prevCredits}`, 14, 30);
    doc.text(`Previous CGPA: ${prevCGPA.toFixed(2)}`, 14, 35);
    doc.text(`Semester GPA: ${results.semesterGPA.toFixed(2)}`, 14, 40);
    doc.text(`Updated CGPA: ${results.updatedCGPA.toFixed(2)}`, 14, 45);
    doc.text(`Status: ${results.isProbation ? 'Probation' : 'Safe'}`, 14, 50);

    const tableData = courses.map(c => [
      c.name || 'Untitled',
      c.credit.toString(),
      c.grade,
      getPoint(c.grade).toFixed(2),
      c.isRetake ? `Retake (Prev: ${c.prevGrade})` : 'No'
    ]);

    autoTable(doc, {
      head: [['Course', 'Credit', 'Grade', 'Point', 'Retake']],
      body: tableData,
      startY: 60,
    });

    doc.save('AIUB_CGPA_Result.pdf');
  };

  const exportExcel = () => {
    const data = courses.map(c => ({
      'Course Name': c.name || 'Untitled',
      'Credit': c.credit,
      'Grade': c.grade,
      'Grade Point': getPoint(c.grade),
      'Is Retake': c.isRetake ? 'Yes' : 'No',
      'Previous Grade': c.isRetake ? c.prevGrade : 'N/A'
    }));

    const summary = [
      { 'Metric': 'Previous Credits', 'Value': prevCredits },
      { 'Metric': 'Previous CGPA', 'Value': prevCGPA },
      { 'Metric': 'Semester GPA', 'Value': results.semesterGPA.toFixed(2) },
      { 'Metric': 'Updated CGPA', 'Value': results.updatedCGPA.toFixed(2) },
      { 'Metric': 'Status', 'Value': results.isProbation ? 'Probation' : 'Safe' }
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(data);
    const ws2 = XLSX.utils.json_to_sheet(summary);
    
    XLSX.utils.book_append_sheet(wb, ws1, "Courses");
    XLSX.utils.book_append_sheet(wb, ws2, "Summary");
    
    XLSX.writeFile(wb, 'AIUB_CGPA_Result.xlsx');
  };

  const updateGradeScale = (index: number, point: number) => {
    const newScale = [...gradeScale];
    newScale[index].point = point;
    setGradeScale(newScale);
  };

  return (
    <div className="w-full min-h-screen bg-[#f4f7fa] flex flex-col font-sans text-slate-800">
      {/* Header */}
      <header className="bg-[#002147] text-white px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center shrink-0 border-b-4 border-[#4CAF50] gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">AIUB CGPA CALCULATOR</h1>
          <p className="text-xs text-blue-200 uppercase tracking-widest font-medium">Academic Performance Management System</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={reset}
            className="flex-1 md:flex-none bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-2 rounded border border-white/20 transition-all flex items-center justify-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> RESET
          </button>
          <button 
            onClick={exportPDF}
            className="flex-1 md:flex-none bg-[#4CAF50] hover:bg-[#43a047] text-white text-xs font-semibold px-3 py-2 rounded transition-all flex items-center justify-center gap-1 shadow-sm"
          >
            <FileDown className="w-3.5 h-3.5" /> PDF
          </button>
          <button 
            onClick={exportExcel}
            className="flex-1 md:flex-none bg-white text-[#002147] hover:bg-slate-100 text-xs font-semibold px-3 py-2 rounded transition-all flex items-center justify-center gap-1 shadow-sm"
          >
            <TableIcon className="w-3.5 h-3.5" /> EXCEL
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 max-w-7xl mx-auto w-full">
        {/* Left Column: Previous Record & Settings */}
        <div className="md:col-span-3 flex flex-col gap-6 order-2 md:order-1">
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-xs font-bold text-[#002147] mb-4 uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#4CAF50] rounded-full"></span> Previous Record
            </h2>
            <div className="space-y-4">
              <div className="group">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Completed Credits</label>
                <input 
                  type="number" 
                  value={prevCredits || ''} 
                  onChange={(e) => setPrevCredits(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#002147] outline-none transition-all"
                />
              </div>
              <div className="group">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Previous CGPA</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={prevCGPA || ''} 
                  onChange={(e) => setPrevCGPA(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-[#002147] outline-none transition-all"
                />
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-[10px] text-blue-600 font-bold mb-1 uppercase tracking-tight">Total Earned Points</p>
                <p className="text-lg font-mono font-bold text-[#002147]">{(prevCredits * prevCGPA).toFixed(2)}</p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-bold text-[#002147] uppercase flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#4CAF50] rounded-full"></span> Grade Scale
              </h2>
              <button 
                onClick={() => setShowScaleSettings(!showScaleSettings)}
                className="text-[10px] font-bold text-[#4CAF50] hover:underline"
              >
                {showScaleSettings ? 'DONE' : 'EDIT'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
              {gradeScale.map((grade, idx) => (
                <div key={grade.label} className="flex justify-between items-center border-b border-slate-100 pb-1">
                  <span className="font-medium text-slate-600">{grade.label}</span>
                  {showScaleSettings ? (
                    <input 
                      type="number" 
                      step="0.01"
                      value={grade.point}
                      onChange={(e) => updateGradeScale(idx, Number(e.target.value))}
                      className="w-12 bg-slate-100 rounded text-right px-1 font-bold outline-none"
                    />
                  ) : (
                    <span className={`font-bold ${grade.point === 0 ? 'text-red-500' : 'text-slate-800'}`}>
                      {grade.point.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Center Column: Course Input */}
        <div className="md:col-span-6 flex flex-col gap-4 order-1 md:order-2">
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xs font-bold text-[#002147] uppercase">Current Semester Courses</h2>
              <button 
                onClick={addCourse}
                className="text-[10px] bg-[#002147] text-white px-3 py-1.5 rounded-full font-bold flex items-center gap-1 hover:bg-[#003366] transition-colors shadow-sm"
              >
                <Plus className="w-3 h-3" /> ADD COURSE
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              <div className="hidden md:grid grid-cols-12 gap-3 text-[10px] text-slate-400 font-bold uppercase mb-1 px-2">
                <div className="col-span-5">Course Name</div>
                <div className="col-span-2 text-center">Credit</div>
                <div className="col-span-3 text-center">Grade</div>
                <div className="col-span-1 text-center">Retake</div>
                <div className="col-span-1"></div>
              </div>

              <AnimatePresence initial={false}>
                {courses.map((course) => (
                  <motion.div 
                    key={course.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex flex-col gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/30 hover:bg-slate-50 transition-colors"
                  >
                    <div className="grid grid-cols-12 gap-2 md:gap-3 items-center">
                      <div className="col-span-12 md:col-span-5">
                        <input 
                          value={course.name} 
                          onChange={(e) => updateCourse(course.id, { name: e.target.value })}
                          placeholder="e.g. Data Structures"
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-[#002147] outline-none"
                        />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <input 
                          type="number" 
                          value={course.credit} 
                          onChange={(e) => updateCourse(course.id, { credit: Number(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-sm text-center outline-none"
                        />
                      </div>
                      <div className="col-span-5 md:col-span-3">
                        <select 
                          value={course.grade} 
                          onChange={(e) => updateCourse(course.id, { grade: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-sm font-bold outline-none"
                        >
                          {gradeScale.map(g => (
                            <option key={g.label} value={g.label}>{g.label} ({g.point.toFixed(2)})</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2 md:col-span-1 flex justify-center">
                        <input 
                          type="checkbox" 
                          checked={course.isRetake} 
                          onChange={(e) => updateCourse(course.id, { isRetake: e.target.checked })}
                          className="w-4 h-4 accent-[#002147]"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button 
                          onClick={() => removeCourse(course.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {course.isRetake && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="bg-blue-50/50 p-2 rounded border border-blue-100 flex flex-wrap gap-4 items-center"
                      >
                        <span className="text-[9px] font-black uppercase bg-blue-100 px-2 py-0.5 rounded text-blue-800">Retake Data</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-blue-700 font-medium whitespace-nowrap">Previous Grade:</span>
                          <select 
                            value={course.prevGrade}
                            onChange={(e) => updateCourse(course.id, { prevGrade: e.target.value })}
                            className="bg-white border border-blue-200 rounded px-1.5 py-0.5 text-[10px] font-bold outline-none"
                          >
                            {gradeScale.map(g => (
                              <option key={g.label} value={g.label}>{g.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-blue-700 font-medium">Point:</span>
                          <span className="text-[10px] font-bold">{getPoint(course.prevGrade).toFixed(2)}</span>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="p-4 bg-yellow-50 border-t border-yellow-100 flex items-start gap-3">
              <Info className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-yellow-800 leading-relaxed">
                <span className="font-bold">Important:</span> If you retake a course, the old grade point will be replaced by the new grade point for CGPA calculation. Failed courses count in attempted credits but not in completed credits.
              </p>
            </div>
          </section>
        </div>

        {/* Right Column: Results */}
        <div className="md:col-span-3 flex flex-col gap-6 order-3 md:order-3">
          <section className="bg-white rounded-xl shadow-lg border-t-4 border-[#002147] p-6 text-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-5">
              <Plus className="w-20 h-20 rotate-45" />
            </div>
            
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Calculated CGPA</h2>
            <p className="text-5xl font-black text-[#002147] mb-3">{results.updatedCGPA.toFixed(2)}</p>
            
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${
              results.isProbation 
                ? 'bg-red-50 text-red-600 ring-1 ring-red-200' 
                : 'bg-[#4CAF50]/10 text-[#2E7D32] ring-1 ring-[#4CAF50]/30'
            }`}>
              {results.isProbation ? (
                <><AlertCircle className="w-3 h-3" /> Still at risk / probation</>
              ) : (
                <><CheckCircle2 className="w-3 h-3" /> Safe / Out of probation</>
              )}
            </div>
          </section>

          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
            <h2 className="text-xs font-bold text-[#002147] uppercase border-b border-slate-50 pb-2">Metrics Summary</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Semester GPA</p>
                <p className="text-lg font-bold text-slate-800">{results.semesterGPA.toFixed(2)}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Total Points</p>
                <p className="text-lg font-bold text-slate-800">{results.totalPoints.toFixed(2)}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 col-span-2">
                <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Total Unique Credits (Denominator)</p>
                <p className="text-lg font-bold text-slate-800">{results.completedCredits}</p>
              </div>
            </div>
            
            <div className="pt-2">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1.5 font-bold">
                <span className="uppercase">Academic Health</span>
                <span className="text-[#002147]">{Math.min(100, Math.max(0, (results.updatedCGPA / 4) * 100)).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden p-0.5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(results.updatedCGPA / 4) * 100}%` }}
                  className={`h-full rounded-full transition-all duration-1000 ${
                    results.isProbation ? 'bg-red-500' : 'bg-[#4CAF50]'
                  }`}
                />
              </div>
            </div>
          </section>

          <div className="mt-auto hidden md:block">
            <div className="p-4 bg-[#002147] rounded-xl text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <ChevronRight className="w-8 h-8" />
              </div>
              <p className="text-[10px] opacity-70 mb-1 uppercase font-bold tracking-wider">Session Info</p>
              <p className="text-sm font-medium">Academic Year 2023-2024</p>
              <p className="text-[10px] opacity-50 mt-1">Calculated locally for student use.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer / Mobile Hint */}
      <footer className="p-4 text-center text-slate-400 text-[10px] md:hidden">
        Swipe up for detailed results
      </footer>
    </div>
  );
}
