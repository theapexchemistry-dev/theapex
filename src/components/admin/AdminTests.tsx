import React, { useState, useRef, useEffect } from 'react';
import { StorageService } from '../../lib/storage';
import { Test, Batch, Student, TestResult, Question } from '../../types';
import { parseQuestionsFromCSV, downloadSampleCSV, getSampleChemistryCSV } from '../../lib/testUtils';
import { generateAiTestQuestions } from '../../lib/aiQuestionGenerator';
import {
  Award,
  Plus,
  Trophy,
  CheckCircle2,
  Trash2,
  Upload,
  FileSpreadsheet,
  Download,
  Sparkles,
  Clock,
  HelpCircle,
  Eye,
  Calendar,
  Layers,
  Radio,
  BookOpen,
  ChevronRight,
  AlertCircle,
  Check,
  Zap,
  Play,
  RotateCcw,
  Users,
  Loader2,
  Edit3,
  Flame,
  ShieldAlert
} from 'lucide-react';

export const AdminTests: React.FC = () => {
  const [batches] = useState<Batch[]>(() => StorageService.getBatches());
  const [students] = useState<Student[]>(() => StorageService.getStudents());
  const [tests, setTests] = useState<Test[]>(() => StorageService.getTests());

  // Active Creation Mode: 'ai_builder' | 'csv' | 'manual' | 'offline'
  const [creationMode, setCreationMode] = useState<'ai_builder' | 'csv' | 'manual' | 'offline'>('ai_builder');

  // Batch & Filter State
  const [selectedBatchId, setSelectedBatchId] = useState<string>(batches[0]?.id || '');
  const [filterBatchId, setFilterBatchId] = useState<string>('ALL');

  // Test Details Form State
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [className, setClassName] = useState('Class 11');
  const [durationMinutes, setDurationMinutes] = useState<number>(20);
  const [customDuration, setCustomDuration] = useState<string>('');
  const [totalMarks, setTotalMarks] = useState<number>(40);
  const [customMarks, setCustomMarks] = useState<string>('');
  const [marksPerQ, setMarksPerQ] = useState<number>(4);
  const [negMarksPerQ, setNegMarksPerQ] = useState<number>(1);
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);

  // Start & Expiry Time
  const [scheduledStartTime, setScheduledStartTime] = useState<string>(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.toISOString().slice(0, 16);
  });

  const [expiryDateTime, setExpiryDateTime] = useState<string>(() => {
    const now = new Date();
    now.setHours(now.getHours() + 24); // default 24h window
    return now.toISOString().slice(0, 16);
  });

  // AI Question Generator State
  const [aiTopic, setAiTopic] = useState<string>('');
  const [aiClassName, setAiClassName] = useState<string>('Class 11 / 12 & JEE/NEET');
  const [aiNumQuestions, setAiNumQuestions] = useState<number>(10);
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard' | 'jee_neet'>('medium');
  const [aiCustomInstructions, setAiCustomInstructions] = useState<string>('');
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  // CSV State
  const [csvText, setCsvText] = useState<string>('');
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Question Builder State
  const [manualQuestions, setManualQuestions] = useState<Question[]>([]);
  const [currentManualQ, setCurrentManualQ] = useState<{
    question: string;
    options: [string, string, string, string];
    correctOption: number;
    explanation: string;
  }>({
    question: '',
    options: ['', '', '', ''],
    correctOption: 0,
    explanation: ''
  });

  // Offline Mode Student Marks Map { studentId: score }
  const [studentMarksMap, setStudentMarksMap] = useState<Record<string, number>>({});

  // Active Viewing Modal
  const [previewTest, setPreviewTest] = useState<Test | null>(null);
  const [viewLeaderboardTest, setViewLeaderboardTest] = useState<Test | null>(null);
  const [editingExpiryTest, setEditingExpiryTest] = useState<Test | null>(null);
  const [newExpiryInput, setNewExpiryInput] = useState<string>('');

  // Delete Confirmation Modal State
  const [testToDelete, setTestToDelete] = useState<Test | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const refreshTests = () => {
    setTests(StorageService.getTests());
  };

  const selectedBatch = batches.find(b => b.id === selectedBatchId);
  const batchStudents = students.filter(s => s.batchId === selectedBatchId);

  // Synchronize topic state
  useEffect(() => {
    if (topic && !aiTopic) {
      setAiTopic(topic);
    }
  }, [topic]);

  // Set quick expiry presets
  const handleSetExpiryPreset = (hours: number | null) => {
    if (hours === null) {
      setExpiryDateTime('');
      return;
    }
    const base = scheduledStartTime ? new Date(scheduledStartTime) : new Date();
    base.setHours(base.getHours() + hours);
    setExpiryDateTime(base.toISOString().slice(0, 16));
  };

  // AI Question Generation Handler
  const handleGenerateAIQuestions = async () => {
    const targetTopic = (aiTopic.trim() || topic.trim());
    if (!targetTopic) {
      alert('Please specify an Exam Topic (e.g. Chemical Kinetics, Coordination Chemistry, Thermodynamics).');
      return;
    }

    setIsGeneratingAI(true);
    setAiError(null);
    setAiSuccessMessage(null);

    try {
      const generated = await generateAiTestQuestions({
        topic: targetTopic,
        className: aiClassName || className,
        numQuestions: aiNumQuestions,
        difficulty: aiDifficulty,
        customInstructions: aiCustomInstructions,
        marksPerQ,
        negativeMarksPerQ: negMarksPerQ
      });

      if (!generated || generated.length === 0) {
        throw new Error('AI did not return any questions. Please retry.');
      }

      // Add to manual questions
      setManualQuestions(prev => [...prev, ...generated]);
      setTotalMarks((manualQuestions.length + generated.length) * marksPerQ);

      if (!topic.trim()) {
        setTopic(targetTopic);
      }
      if (!title.trim()) {
        setTitle(`${targetTopic} - MCQ Exam`);
      }

      setAiSuccessMessage(`✨ Successfully generated ${generated.length} AI Chemistry questions with 4 options and faculty explanations!`);
    } catch (err: any) {
      console.error('AI generation failed:', err);
      setAiError(err.message || 'Failed to generate questions. Please try again.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Generate directly into CSV
  const handleGenerateAICsv = async () => {
    const targetTopic = (aiTopic.trim() || topic.trim());
    if (!targetTopic) {
      alert('Please enter an exam topic first.');
      return;
    }

    setIsGeneratingAI(true);
    setAiError(null);
    setAiSuccessMessage(null);

    try {
      const generated = await generateAiTestQuestions({
        topic: targetTopic,
        className: aiClassName || className,
        numQuestions: aiNumQuestions,
        difficulty: aiDifficulty,
        customInstructions: aiCustomInstructions,
        marksPerQ,
        negativeMarksPerQ: negMarksPerQ
      });

      if (!generated || generated.length === 0) {
        throw new Error('AI was unable to generate questions. Please try again.');
      }

      setParsedQuestions(generated);
      setTotalMarks(generated.length * marksPerQ);

      // Build CSV text
      const lines = [
        'Question,Option A,Option B,Option C,Option D,Correct Option,Explanation'
      ];
      generated.forEach(q => {
        const correctLetter = ['A', 'B', 'C', 'D'][q.correctOption] || 'A';
        const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
        lines.push(
          `${escape(q.question)},${escape(q.options[0])},${escape(q.options[1])},${escape(q.options[2])},${escape(q.options[3])},${correctLetter},${escape(q.explanation || '')}`
        );
      });
      setCsvText(lines.join('\n'));
      setCsvFileName(`${targetTopic.replace(/[^a-zA-Z0-9]/g, '_')}_AI_Paper.csv`);

      if (!topic.trim()) setTopic(targetTopic);
      if (!title.trim()) setTitle(`${targetTopic} - Chemistry Test`);

      setAiSuccessMessage(`✨ Generated ${generated.length} questions into CSV!`);
    } catch (err: any) {
      setAiError(err.message || 'AI generation failed');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      setCsvText(content);
      const { questions, errors } = parseQuestionsFromCSV(content);
      setParsedQuestions(questions);
      setCsvErrors(errors);

      if (questions.length > 0) {
        setTotalMarks(questions.length * marksPerQ);
        if (!title.trim() && topic.trim()) {
          setTitle(`${topic} - Live MCQ Test`);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleCsvTextChange = (text: string) => {
    setCsvText(text);
    if (!text.trim()) {
      setParsedQuestions([]);
      setCsvErrors([]);
      return;
    }
    const { questions, errors } = parseQuestionsFromCSV(text);
    setParsedQuestions(questions);
    setCsvErrors(errors);
    if (questions.length > 0) {
      setTotalMarks(questions.length * marksPerQ);
    }
  };

  const handleAddManualQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentManualQ.question.trim()) return;
    if (currentManualQ.options.some(opt => !opt.trim())) return;

    const newQ: Question = {
      id: 'mq-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      question: currentManualQ.question.trim(),
      options: [...currentManualQ.options] as [string, string, string, string],
      correctOption: currentManualQ.correctOption,
      explanation: currentManualQ.explanation.trim() || undefined
    };

    setManualQuestions(prev => [...prev, newQ]);
    setTotalMarks((manualQuestions.length + 1) * marksPerQ);
    setCurrentManualQ({
      question: '',
      options: ['', '', '', ''],
      correctOption: 0,
      explanation: ''
    });
  };

  const handleRemoveQuestion = (idx: number) => {
    if (creationMode === 'csv') {
      const updated = parsedQuestions.filter((_, i) => i !== idx);
      setParsedQuestions(updated);
      setTotalMarks(updated.length * marksPerQ);
    } else {
      const updated = manualQuestions.filter((_, i) => i !== idx);
      setManualQuestions(updated);
      setTotalMarks(updated.length * marksPerQ);
    }
  };

  const handleScoreChange = (studentId: string, value: number) => {
    setStudentMarksMap(prev => ({
      ...prev,
      [studentId]: value
    }));
  };

  const handleCreateTestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedBatchId) {
      alert('Please provide a Test Title and select a Target Batch.');
      return;
    }

    const finalDuration = customDuration ? Number(customDuration) : durationMinutes;
    const finalTotalMarks = customMarks ? Number(customMarks) : totalMarks;

    let finalQuestions: Question[] = [];
    let initialResults: TestResult[] = [];

    if (creationMode === 'offline') {
      initialResults = batchStudents.map(s => ({
        studentId: s.id,
        studentName: s.name,
        marksObtained: Number(studentMarksMap[s.id] ?? 0)
      }));
    } else if (creationMode === 'csv') {
      finalQuestions = parsedQuestions;
      if (finalQuestions.length === 0) {
        alert('Please upload a CSV or generate questions for the test paper.');
        return;
      }
    } else {
      // ai_builder or manual
      finalQuestions = manualQuestions;
      if (finalQuestions.length === 0) {
        alert('Please use the AI Question Generator or add questions manually before publishing.');
        return;
      }
    }

    StorageService.addTest(
      {
        title: title.trim(),
        topic: topic.trim() || aiTopic.trim() || 'General Chemistry',
        className: className || selectedBatch?.className || 'Class 11',
        batchId: selectedBatchId,
        batchTitle: selectedBatch ? selectedBatch.title : undefined,
        totalMarks: finalTotalMarks,
        durationMinutes: finalDuration,
        marksPerQuestion: marksPerQ,
        negativeMarksPerQuestion: negMarksPerQ,
        date: testDate,
        scheduledStartTime,
        expiryDateTime: expiryDateTime || undefined,
        testType: creationMode === 'offline' ? 'offline_marks' : 'live',
        status: creationMode === 'offline' ? 'completed' : 'live',
        questions: finalQuestions,
        submissions: {},
        results: initialResults
      },
      initialResults
    );

    refreshTests();

    // Reset Form
    setTitle('');
    setTopic('');
    setAiTopic('');
    setParsedQuestions([]);
    setManualQuestions([]);
    setCsvText('');
    setCsvFileName('');
    setStudentMarksMap({});
    setAiSuccessMessage(null);
    setAiError(null);
    alert('🎯 Test successfully hosted & published with AI questions and live ranking!');
  };

  const handleDeleteTest = (t: Test) => {
    setTestToDelete(t);
  };

  const handleConfirmDelete = async () => {
    if (!testToDelete) return;
    setIsDeleting(true);
    try {
      await StorageService.deleteTest(testToDelete.id);
      refreshTests();
      setTestToDelete(null);
    } catch (err) {
      console.error('Failed to permanently delete test:', err);
      alert('Failed to delete test. Please check your network and try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleTestStatus = (t: Test) => {
    const nextStatus = t.status === 'live' ? 'completed' : 'live';
    StorageService.updateTest(t.id, { status: nextStatus });
    refreshTests();
  };

  const handleSaveUpdatedExpiry = () => {
    if (!editingExpiryTest) return;
    StorageService.updateTest(editingExpiryTest.id, {
      expiryDateTime: newExpiryInput || undefined
    });
    setEditingExpiryTest(null);
    refreshTests();
  };

  const isTestExpired = (t: Test) => {
    if (!t.expiryDateTime) return false;
    return new Date() > new Date(t.expiryDateTime);
  };

  const activeQuestions = creationMode === 'csv' ? parsedQuestions : manualQuestions;
  const filteredTests = tests.filter(t => filterBatchId === 'ALL' || t.batchId === filterBatchId);

  const durationPresets = [10, 15, 20, 30, 45, 60, 90, 120, 180];
  const marksPresets = [10, 20, 30, 40, 50, 60, 75, 100, 120, 180, 300];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> AI-Powered Chemistry Examination Engine
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Live Tests & Automatic Ranking
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Generate complete MCQ papers via AI with 4 options & solutions, schedule start & expiry times, auto-submit on tab switch, and compute class ranks instantly.
          </p>
        </div>

        <button
          type="button"
          onClick={downloadSampleCSV}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-2xl shadow-md transition-all self-start md:self-auto"
        >
          <Download className="w-4 h-4 text-amber-400" />
          <span>Download Sample CSV Template</span>
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left: Test Creator Panel */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          {/* Creation Mode Tabs */}
          <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-100 gap-2">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" /> Host New Test
            </h3>

            <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setCreationMode('ai_builder')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  creationMode === 'ai_builder'
                    ? 'bg-white text-indigo-600 shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> AI Question Builder
              </button>

              <button
                type="button"
                onClick={() => setCreationMode('manual')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  creationMode === 'manual'
                    ? 'bg-white text-indigo-600 shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> Manual MCQs
              </button>

              <button
                type="button"
                onClick={() => setCreationMode('csv')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  creationMode === 'csv'
                    ? 'bg-white text-indigo-600 shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> CSV Upload
              </button>

              <button
                type="button"
                onClick={() => setCreationMode('offline')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  creationMode === 'offline'
                    ? 'bg-white text-indigo-600 shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Award className="w-3.5 h-3.5" /> Offline Marks
              </button>
            </div>
          </div>

          <form onSubmit={handleCreateTestSubmit} className="space-y-5">
            {/* Row 1: Batch & Class */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Batch *</label>
                <select
                  required
                  value={selectedBatchId}
                  onChange={e => {
                    setSelectedBatchId(e.target.value);
                    const b = batches.find(item => item.id === e.target.value);
                    if (b) setClassName(b.className);
                  }}
                  className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-slate-800"
                >
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.title} ({b.className})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Class / Standard *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class 11, Class 12, JEE Main"
                  value={className}
                  onChange={e => setClassName(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
            </div>

            {/* Row 2: Topic & Title */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Exam Topic / Chapter *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chemical Kinetics, Thermodynamics"
                  value={topic}
                  onChange={e => {
                    setTopic(e.target.value);
                    setAiTopic(e.target.value);
                    if (!title) setTitle(`${e.target.value} Test 1`);
                  }}
                  className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Test Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. JEE Main Mock - Chemical Kinetics"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none font-semibold"
                />
              </div>
            </div>

            {/* Row 3: Duration & Marks Selection */}
            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
              {/* Duration Presets */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" /> Exam Duration:
                  </label>
                  <span className="text-xs font-mono font-black text-indigo-600">
                    {customDuration ? `${customDuration} mins` : `${durationMinutes} mins`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {durationPresets.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDurationMinutes(d);
                        setCustomDuration('');
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        !customDuration && durationMinutes === d
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {d}m
                    </button>
                  ))}
                  <input
                    type="number"
                    placeholder="Custom"
                    value={customDuration}
                    onChange={e => setCustomDuration(e.target.value)}
                    className="w-20 text-xs px-2 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>

              {/* Total Marks Presets & Marking Scheme */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-indigo-100">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black text-indigo-950">Total Marks:</label>
                    <span className="text-xs font-mono font-black text-indigo-600">
                      {customMarks ? customMarks : totalMarks} Marks
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {marksPresets.slice(0, 6).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setTotalMarks(m);
                          setCustomMarks('');
                        }}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all ${
                          !customMarks && totalMarks === m
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {m}M
                      </button>
                    ))}
                    <input
                      type="number"
                      placeholder="Custom"
                      value={customMarks}
                      onChange={e => setCustomMarks(e.target.value)}
                      className="w-16 text-xs px-2 py-1 bg-white border border-slate-200 rounded-xl outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-indigo-950 mb-1.5">Marking Scheme (Per Question):</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-1 bg-white px-2 py-1.5 rounded-xl border border-slate-200 text-xs">
                      <span className="text-emerald-600 font-bold">Correct:</span>
                      <input
                        type="number"
                        value={marksPerQ}
                        onChange={e => setMarksPerQ(Number(e.target.value))}
                        className="w-10 font-bold text-center outline-none"
                      />
                    </div>
                    <div className="flex-1 flex items-center gap-1 bg-white px-2 py-1.5 rounded-xl border border-slate-200 text-xs">
                      <span className="text-red-600 font-bold">Negative:</span>
                      <input
                        type="number"
                        value={negMarksPerQ}
                        onChange={e => setNegMarksPerQ(Number(e.target.value))}
                        className="w-10 font-bold text-center outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 4: Scheduled Start Time & Expiry Date/Time */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Exam Schedule & Expiry Window
                </span>
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  Auto-Closes After Expiry
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    🟢 Scheduled Start Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledStartTime}
                    onChange={e => setScheduledStartTime(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>🔴 Expiry Date & Time (Deadline)</span>
                    <span className="text-[10px] text-slate-400 font-normal">Students cannot start after this</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={expiryDateTime}
                    onChange={e => setExpiryDateTime(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* Quick Expiry Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-400">Quick Expiry:</span>
                {[
                  { label: '+2 Hours', hours: 2 },
                  { label: '+6 Hours', hours: 6 },
                  { label: '+24 Hours (1 Day)', hours: 24 },
                  { label: '+48 Hours (2 Days)', hours: 48 },
                  { label: '+7 Days (1 Week)', hours: 168 }
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleSetExpiryPreset(p.hours)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold rounded-lg transition-all"
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleSetExpiryPreset(null)}
                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg"
                >
                  Clear Expiry
                </button>
              </div>
            </div>

            {/* AI QUESTION BUILDER SECTION */}
            {(creationMode === 'ai_builder' || creationMode === 'manual') && (
              <div className="space-y-4 pt-2">
                {/* AI Generator Card */}
                <div className="p-5 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-3xl border border-indigo-700/40 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300 font-bold">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white">✨ AI Chemistry Question Generator</h4>
                        <p className="text-[11px] text-indigo-200">
                          Auto-generates questions with 4 distinct options, correct answer keys, and detailed faculty solutions.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-indigo-200 mb-1">
                        Topic / Chapter for AI *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Chemical Bonding, Electrochemistry, Aldehydes & Ketones"
                        value={aiTopic}
                        onChange={e => setAiTopic(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-slate-800/80 border border-indigo-500/30 text-white rounded-xl outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-400 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-indigo-200 mb-1">
                        Number of Questions
                      </label>
                      <select
                        value={aiNumQuestions}
                        onChange={e => setAiNumQuestions(Number(e.target.value))}
                        className="w-full text-xs px-3 py-2 bg-slate-800/80 border border-indigo-500/30 text-white rounded-xl outline-none font-bold"
                      >
                        <option value={5}>5 Questions</option>
                        <option value={10}>10 Questions</option>
                        <option value={15}>15 Questions</option>
                        <option value={20}>20 Questions</option>
                        <option value={25}>25 Questions</option>
                        <option value={30}>30 Questions</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-200 mb-1">
                        Target Level / Exam Standard
                      </label>
                      <select
                        value={aiDifficulty}
                        onChange={e => setAiDifficulty(e.target.value as any)}
                        className="w-full text-xs px-3 py-2 bg-slate-800/80 border border-indigo-500/30 text-white rounded-xl outline-none font-semibold"
                      >
                        <option value="easy">Class 11/12 Foundation / Board Level</option>
                        <option value="medium">Standard / Mixed Conceptual Level</option>
                        <option value="jee_neet">JEE Main & NEET Level (MCQs + Numericals)</option>
                        <option value="hard">JEE Advanced / Olympiad Level (Multi-Concept)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-indigo-200 mb-1">
                        Custom Focus / Sub-topics (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Include 3 numericals on rate law and Arrhenius eq"
                        value={aiCustomInstructions}
                        onChange={e => setAiCustomInstructions(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-slate-800/80 border border-indigo-500/30 text-white rounded-xl outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {aiError && (
                    <div className="p-3 bg-red-950/80 border border-red-500/40 text-red-200 text-xs rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{aiError}</span>
                    </div>
                  )}

                  {aiSuccessMessage && (
                    <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs rounded-xl flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{aiSuccessMessage}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isGeneratingAI}
                    onClick={handleGenerateAIQuestions}
                    className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isGeneratingAI ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Generating Chemistry Questions with AI...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-slate-950" />
                        <span>Generate {aiNumQuestions} Questions with AI</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Manual Add Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">
                      Or Add / Customise Question #{manualQuestions.length + 1}
                    </span>
                    {manualQuestions.length > 0 && (
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                        {manualQuestions.length} Questions in Test
                      </span>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="Enter question text (e.g. Which molecule has sp3d2 hybridization?)"
                    value={currentManualQ.question}
                    onChange={e => setCurrentManualQ({ ...currentManualQ, question: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    {['A', 'B', 'C', 'D'].map((letter, i) => (
                      <div key={letter} className="flex items-center gap-1.5">
                        <span className="w-5 text-center text-xs font-bold text-slate-600">{letter}:</span>
                        <input
                          type="text"
                          placeholder={`Option ${letter}`}
                          value={currentManualQ.options[i]}
                          onChange={e => {
                            const opts = [...currentManualQ.options] as [string, string, string, string];
                            opts[i] = e.target.value;
                            setCurrentManualQ({ ...currentManualQ, options: opts });
                          }}
                          className="flex-1 text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Correct Option *</label>
                      <select
                        value={currentManualQ.correctOption}
                        onChange={e => setCurrentManualQ({ ...currentManualQ, correctOption: Number(e.target.value) })}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl outline-none font-bold text-emerald-700"
                      >
                        <option value={0}>Option A</option>
                        <option value={1}>Option B</option>
                        <option value={2}>Option C</option>
                        <option value={3}>Option D</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Explanation / Solution (Optional)</label>
                      <input
                        type="text"
                        placeholder="Step-by-step reasoning or formula..."
                        value={currentManualQ.explanation}
                        onChange={e => setCurrentManualQ({ ...currentManualQ, explanation: e.target.value })}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddManualQuestion}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Add Manual Question to Paper
                  </button>
                </div>

                {/* Question List Preview */}
                {manualQuestions.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">
                        Generated & Added Questions ({manualQuestions.length}):
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setManualQuestions([]);
                          setTotalMarks(0);
                        }}
                        className="text-[11px] text-red-600 hover:underline font-bold"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {manualQuestions.map((q, idx) => (
                        <div key={q.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2 relative group">
                          <div className="flex justify-between items-start gap-2">
                            <p className="font-bold text-slate-900">
                              Q{idx + 1}. {q.question}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestion(idx)}
                              className="text-slate-400 hover:text-red-600 p-1"
                              title="Delete Question"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-1 text-[11px]">
                            {q.options.map((opt, optIdx) => (
                              <div
                                key={optIdx}
                                className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 ${
                                  q.correctOption === optIdx
                                    ? 'bg-emerald-100/90 border-emerald-300 text-emerald-950 font-bold'
                                    : 'bg-white border-slate-200 text-slate-600'
                                }`}
                              >
                                <span className="font-bold text-[10px]">
                                  {['A', 'B', 'C', 'D'][optIdx]}:
                                </span>
                                <span className="truncate">{opt}</span>
                                {q.correctOption === optIdx && (
                                  <span className="text-[10px] text-emerald-700 ml-auto font-black">✓ Correct</span>
                                )}
                              </div>
                            ))}
                          </div>

                          {q.explanation && (
                            <p className="text-[10px] text-slate-500 bg-white p-2 rounded-xl border border-slate-100">
                              <strong className="text-slate-700">Explanation:</strong> {q.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CSV Upload Mode */}
            {creationMode === 'csv' && (
              <div className="space-y-4 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Upload Question Paper CSV
                  </span>

                  <button
                    type="button"
                    disabled={isGeneratingAI}
                    onClick={handleGenerateAICsv}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    {isGeneratingAI ? 'Generating AI CSV...' : '✨ Generate AI Questions into CSV'}
                  </button>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/70 hover:bg-indigo-50/30 p-6 rounded-2xl text-center cursor-pointer transition-all space-y-2"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    {csvFileName ? `Selected: ${csvFileName}` : 'Click to Browse or Drag & Drop Question Paper CSV'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Format: Question, Option A, Option B, Option C, Option D, Correct Option (A/B/C/D), Explanation
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Or Paste CSV Data Below:
                  </label>
                  <textarea
                    rows={4}
                    value={csvText}
                    onChange={e => handleCsvTextChange(e.target.value)}
                    placeholder="Question,Option A,Option B,Option C,Option D,Correct Option,Explanation..."
                    className="w-full text-xs font-mono p-3 bg-slate-900 text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {csvErrors.length > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" /> CSV Parsing Errors:
                    </p>
                    {csvErrors.map((err, i) => (
                      <p key={i}>• {err}</p>
                    ))}
                  </div>
                )}

                {parsedQuestions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-black text-slate-900">
                      Parsed Questions ({parsedQuestions.length}):
                    </span>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {parsedQuestions.map((q, idx) => (
                        <div key={q.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                          <div>
                            <p className="font-bold text-slate-900">Q{idx + 1}. {q.question}</p>
                            <p className="text-[10px] text-emerald-600 font-bold">
                              Correct: {['A', 'B', 'C', 'D'][q.correctOption]}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(idx)}
                            className="text-slate-400 hover:text-red-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Offline Marks Entry Mode */}
            {creationMode === 'offline' && (
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-slate-800">
                  Enter Marks for Enrolled Batch Students ({batchStudents.length}):
                </label>
                {batchStudents.length === 0 ? (
                  <p className="p-4 bg-slate-50 text-center rounded-xl text-xs text-slate-400">
                    No students enrolled in this batch yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {batchStudents.map(student => (
                      <div key={student.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{student.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{student.id}</p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            max={totalMarks}
                            placeholder="0"
                            value={studentMarksMap[student.id] ?? ''}
                            onChange={e => handleScoreChange(student.id, Number(e.target.value))}
                            className="w-20 text-xs px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-right font-bold focus:ring-2 focus:ring-indigo-600 outline-none"
                          />
                          <span className="text-xs font-semibold text-slate-400">/ {totalMarks}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Anti-Cheating & Proctoring Notice */}
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Anti-Cheating Proctor Active:</strong>
                <span>
                  Students will be automatically submitted if they switch tabs, minimize their browser, or navigate away during the live exam.
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>
                {creationMode === 'offline'
                  ? 'Publish Test & Calculate Class Ranks'
                  : `Host & Publish Exam (${activeQuestions.length} Questions)`}
              </span>
            </button>
          </form>
        </div>

        {/* Right: Published Tests & Realtime Leaderboards */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" /> Published Tests & Batches
            </h3>

            <select
              value={filterBatchId}
              onChange={e => setFilterBatchId(e.target.value)}
              className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl outline-none font-bold"
            >
              <option value="ALL">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            {filteredTests.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400 text-xs space-y-2">
                <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300" />
                <p>No tests published for this batch yet.</p>
              </div>
            ) : (
              filteredTests.map(t => {
                const submissionCount = Object.keys(t.submissions || {}).length || t.results.length;
                const isLive = t.status === 'live';
                const expired = isTestExpired(t);

                return (
                  <div
                    key={t.id}
                    className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden"
                  >
                    {/* Status accent top line */}
                    <div
                      className={`absolute top-0 left-0 right-0 h-1.5 ${
                        expired ? 'bg-red-500' : isLive ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />

                    <div className="flex justify-between items-start pt-1">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          {expired ? (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200">
                              EXPIRED / CLOSED
                            </span>
                          ) : isLive ? (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ● LIVE TEST
                            </span>
                          ) : (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              COMPLETED
                            </span>
                          )}

                          <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            {t.durationMinutes || 20}m • {t.totalMarks} Marks
                          </span>
                          {t.questions && t.questions.length > 0 && (
                            <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                              {t.questions.length} MCQs
                            </span>
                          )}
                        </div>

                        <h4 className="text-base font-black text-slate-900">{t.title}</h4>
                        <p className="text-xs text-slate-500 font-medium">
                          Batch: {t.batchTitle} • {t.topic || 'Chemistry'}
                        </p>

                        {/* Timing & Expiry details */}
                        <div className="mt-2 text-[11px] text-slate-600 flex flex-col gap-0.5 font-medium">
                          {t.scheduledStartTime && (
                            <span className="text-emerald-700">
                              🟢 Starts: {t.scheduledStartTime.replace('T', ' ')}
                            </span>
                          )}
                          {t.expiryDateTime ? (
                            <span className={expired ? 'text-red-600 font-bold' : 'text-amber-700'}>
                              🔴 Expiry: {t.expiryDateTime.replace('T', ' ')} {expired && '(Window Closed)'}
                            </span>
                          ) : (
                            <span className="text-slate-400">No Expiry Limit</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteTest(t)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100 transition-all"
                        title="Delete Test Permanently"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>

                    {/* Actions Row */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
                      {t.questions && t.questions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPreviewTest(t)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center gap-1 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" /> Paper ({t.questions.length})
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setEditingExpiryTest(t);
                          setNewExpiryInput(t.expiryDateTime || '');
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center gap-1"
                        title="Edit Expiry Date & Time"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-600" /> Expiry
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewLeaderboardTest(t)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl flex items-center gap-1 transition-all ml-auto"
                      >
                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        <span>Ranks ({submissionCount})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleTestStatus(t)}
                        className={`px-2.5 py-1.5 rounded-xl font-bold transition-all ${
                          isLive
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                        title={isLive ? 'End Live Exam' : 'Make Test Live Again'}
                      >
                        {isLive ? 'End Live' : 'Re-open'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteTest(t)}
                        className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl flex items-center gap-1 transition-all border border-red-100"
                        title="Permanently Delete Test from Database & Students"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        <span>Delete</span>
                      </button>
                    </div>

                    {/* Quick Standings Preview */}
                    <div className="space-y-1.5 max-h-36 overflow-y-auto text-xs bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                      {t.results.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center py-2">
                          No student submissions yet.
                        </p>
                      ) : (
                        t.results.slice(0, 5).map(r => (
                          <div
                            key={r.studentId}
                            className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-slate-100"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                  r.rank === 1
                                    ? 'bg-amber-400 text-slate-950 font-black'
                                    : r.rank === 2
                                    ? 'bg-slate-300 text-slate-900'
                                    : r.rank === 3
                                    ? 'bg-amber-700 text-white'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                #{r.rank}
                              </span>
                              <span className="font-bold text-slate-800 truncate max-w-[130px]">{r.studentName}</span>
                            </div>

                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {r.marksObtained} / {t.totalMarks}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Edit Expiry Modal */}
      {editingExpiryTest && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900">Update Exam Expiry Deadline</h3>
              </div>
              <button
                onClick={() => setEditingExpiryTest(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              Update closing deadline for <strong>{editingExpiryTest.title}</strong>:
            </p>

            <input
              type="datetime-local"
              value={newExpiryInput}
              onChange={e => setNewExpiryInput(e.target.value)}
              className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none font-bold text-slate-900"
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingExpiryTest(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUpdatedExpiry}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md"
              >
                Save Expiry Time
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Question Paper Modal */}
      {previewTest && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-lg font-black text-slate-900">{previewTest.title}</h3>
                <p className="text-xs text-slate-500">
                  {previewTest.topic} • {previewTest.questions?.length || 0} Questions • {previewTest.durationMinutes} Mins • {previewTest.totalMarks} Marks
                </p>
              </div>
              <button
                onClick={() => setPreviewTest(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {(previewTest.questions || []).map((q, idx) => (
                <div key={q.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 text-xs">
                  <p className="font-bold text-slate-900 text-sm">Q{idx + 1}. {q.question}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {q.options.map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        className={`p-2 rounded-xl border flex items-center gap-2 ${
                          q.correctOption === optIdx
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-lg bg-slate-200 text-slate-800 text-[10px] font-black flex items-center justify-center">
                          {['A', 'B', 'C', 'D'][optIdx]}
                        </span>
                        <span>{opt}</span>
                        {q.correctOption === optIdx && (
                          <span className="ml-auto text-[10px] text-emerald-700 font-bold">✓ Correct</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {q.explanation && (
                    <p className="text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                      <strong>Solution:</strong> {q.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  const target = previewTest;
                  setPreviewTest(null);
                  handleDeleteTest(target);
                }}
                className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-red-200 transition-all"
                title="Delete this test paper permanently"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                <span>Delete Test</span>
              </button>
              <button
                onClick={() => setPreviewTest(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {viewLeaderboardTest && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-black text-slate-900">Batch Leaderboard Standings</h3>
                </div>
                <p className="text-xs text-slate-500">
                  {viewLeaderboardTest.title} ({viewLeaderboardTest.batchTitle}) • Max Marks: {viewLeaderboardTest.totalMarks}
                </p>
              </div>
              <button
                onClick={() => setViewLeaderboardTest(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {viewLeaderboardTest.results.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-xs">No students have taken this test yet.</p>
              ) : (
                viewLeaderboardTest.results.map((r, i) => {
                  const sub = r.submission;
                  const pct = Math.round((r.marksObtained / viewLeaderboardTest.totalMarks) * 100);

                  return (
                    <div
                      key={r.studentId}
                      className="p-3.5 bg-slate-50 hover:bg-indigo-50/50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${
                            r.rank === 1
                              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                              : r.rank === 2
                              ? 'bg-slate-300 text-slate-900'
                              : r.rank === 3
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          #{r.rank}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{r.studentName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {r.studentId} {sub?.submittedAt ? `• ${sub.submittedAt}` : ''}
                            {sub?.autoSubmittedReason && (
                              <span className="text-amber-600 font-bold ml-1">({sub.autoSubmittedReason})</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {sub && (
                          <div className="text-right hidden sm:block">
                            <p className="text-[10px] text-slate-400 font-bold">Accuracy</p>
                            <p className="text-xs font-black text-emerald-600 font-mono">{sub.accuracy}%</p>
                          </div>
                        )}

                        <div className="text-right">
                          <p className="text-sm font-black font-mono text-slate-900">
                            {r.marksObtained} / {viewLeaderboardTest.totalMarks}
                          </p>
                          <p className="text-[10px] text-indigo-600 font-bold font-mono">{pct}%</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  const target = viewLeaderboardTest;
                  setViewLeaderboardTest(null);
                  handleDeleteTest(target);
                }}
                className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-red-200 transition-all"
                title="Delete this test permanently"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                <span>Delete Test</span>
              </button>
              <button
                onClick={() => setViewLeaderboardTest(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Test Confirmation Modal */}
      {testToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-red-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Delete Test Permanently</h3>
                <p className="text-xs text-slate-500">Database & Student Portal Removal</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Exam Title</span>
                <p className="font-black text-slate-900 text-sm">{testToDelete.title}</p>
              </div>
              <div className="flex items-center justify-between text-slate-600 font-medium pt-1">
                <span>Batch: <strong className="text-slate-800">{testToDelete.batchTitle}</strong></span>
                <span>Subject: <strong className="text-slate-800">{testToDelete.topic}</strong></span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1.5 text-[11px]">
                <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 font-bold text-slate-700">
                  {testToDelete.questions?.length || 0} Questions
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 font-bold text-slate-700">
                  {testToDelete.results?.length || 0} Submissions
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 font-bold text-slate-700">
                  {testToDelete.totalMarks} Total Marks
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-red-50/90 border border-red-200 rounded-2xl text-xs text-red-800 space-y-1.5">
              <p className="font-black flex items-center gap-1.5 text-red-950">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                Are you sure you want to delete this test?
              </p>
              <p className="text-[11px] leading-relaxed text-red-700 font-medium">
                This test will be <strong>permanently deleted from the Firestore database</strong> and <strong>instantly removed from all students' test panels</strong>. All student results and leaderboard entries for this test will also be deleted. This cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setTestToDelete(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/25 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting Test...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
