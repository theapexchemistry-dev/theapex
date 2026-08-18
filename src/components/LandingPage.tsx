import React, { useState } from 'react';
import { Logo } from './Logo';
import {
  FlaskConical,
  Target,
  BookOpen,
  TrendingUp,
  Users,
  Award,
  ArrowRight,
  X,
  CheckCircle2,
  Calendar,
  Clock,
  Sparkles,
  GraduationCap
} from 'lucide-react';
import subhamoyImg from '../assets/images/subhamoysir.jpeg';

interface LandingPageProps {
  onLoginClick: () => void;
  onExploreCourses?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLoginClick,
  onExploreCourses
}) => {
  const [showCoursesModal, setShowCoursesModal] = useState(false);

  const handleExploreCoursesClick = () => {
    setShowCoursesModal(true);
    if (onExploreCourses) {
      onExploreCourses();
    }
  };
  return (
    <div className="bg-[#0B132B] text-white min-h-screen selection:bg-amber-400 selection:text-slate-950 flex flex-col justify-between">
      {/* Main Hero Container matching uploaded image */}
      <section className="relative pt-8 pb-12 overflow-hidden flex-1 flex flex-col justify-center">
        {/* Subtle Background Chemistry Pattern & Yellow Swoosh */}
        <div className="absolute top-0 right-0 w-[55%] h-full bg-amber-400 rounded-l-full opacity-90 hidden lg:block -z-0 translate-x-20 scale-y-110" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.05] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            {/* Left Column Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              {/* Yellow Eyebrow Slogan */}
              <p className="text-amber-400 font-extrabold text-sm sm:text-lg tracking-wide uppercase">
                Your Success, Our Passion
              </p>

              {/* Title & Badge */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black text-white tracking-tighter uppercase leading-none font-sans drop-shadow-md">
                    CHEMISTRY
                  </h1>
                  <div className="flex items-center justify-center lg:justify-start gap-3">
                    <h2 className="text-5xl sm:text-7xl lg:text-8xl font-black text-amber-400 tracking-tighter uppercase leading-none font-sans drop-shadow-md">
                      TUITION
                    </h2>
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-400 text-slate-950 rounded-2xl flex items-center justify-center shadow-lg border-2 border-amber-300 shrink-0">
                      <FlaskConical className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.5]" />
                    </div>
                  </div>
                </div>

                {/* White Pill Badge */}
                <div className="inline-flex items-center gap-3 bg-white text-slate-950 font-black text-xl sm:text-3xl px-6 py-2.5 rounded-full uppercase tracking-tight shadow-2xl border-2 border-amber-400">
                  <span>CLASS 11-12</span>
                  <span className="text-amber-500 font-bold">|</span>
                  <span className="text-amber-600">JEE</span>
                  <span className="text-amber-500 font-bold">|</span>
                  <span className="text-amber-600">NEET</span>
                </div>
              </div>

              {/* Key Bullet Highlights */}
              <div className="text-slate-200 text-sm sm:text-base font-bold space-y-1 max-w-xl mx-auto lg:mx-0 pt-1">
                <p>Concept Clarity • NCERT Based • Regular Tests</p>
                <p>Exam-Oriented • Personalized Mentorship</p>
              </div>

              {/* Call to Action Buttons */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-4">
                <button
                  onClick={onLoginClick}
                  className="px-8 py-3.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-base rounded-xl shadow-2xl shadow-amber-400/30 transition-all hover:scale-105"
                >
                  Get Started
                </button>
                <button
                  onClick={handleExploreCoursesClick}
                  className="px-8 py-3.5 bg-[#0B132B]/80 hover:bg-slate-900 text-white border-2 border-slate-700 hover:border-slate-500 font-bold text-base rounded-xl transition-all hover:scale-105"
                >
                  Explore Courses
                </button>
              </div>
            </div>

            {/* Right Column Faculty Photo */}
            <div className="lg:col-span-5 flex justify-center relative">
              <div className="relative z-10 max-w-sm sm:max-w-md">
                <div className="relative rounded-3xl overflow-hidden border-4 border-amber-400/80 shadow-2xl bg-gradient-to-b from-slate-900/60 to-slate-950">
                  <img
                    src={subhamoyImg}
                    alt="Faculty Mr. Subhamoy Mondal"
                    className="w-full h-auto object-cover object-top aspect-[4/5] max-h-[460px] transform hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-4 text-center">
                    <span className="text-amber-400 font-extrabold text-xs uppercase tracking-widest block">Senior Chemistry Specialist</span>
                    <h3 className="text-xl font-black text-white">Mr. Subhamoy Mondal</h3>
                    <p className="text-xs text-slate-300 font-medium">Apex Chemistry Director</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom 4 Feature Cards matching bottom of poster image */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-12">
            <div className="bg-[#0f1b3d]/90 p-4 rounded-2xl border border-slate-800 flex items-center gap-3.5 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 font-bold">
                <Target className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white leading-tight">Concept Clarity</h4>
                <p className="text-xs text-slate-400 font-medium">from Basics to Advance</p>
              </div>
            </div>

            <div className="bg-[#0f1b3d]/90 p-4 rounded-2xl border border-slate-800 flex items-center gap-3.5 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 font-bold">
                <BookOpen className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white leading-tight">NCERT Based</h4>
                <p className="text-xs text-slate-400 font-medium">Complete Coverage</p>
              </div>
            </div>

            <div className="bg-[#0f1b3d]/90 p-4 rounded-2xl border border-slate-800 flex items-center gap-3.5 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 font-bold">
                <TrendingUp className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white leading-tight">Regular Tests</h4>
                <p className="text-xs text-slate-400 font-medium">and Practice</p>
              </div>
            </div>

            <div className="bg-[#0f1b3d]/90 p-4 rounded-2xl border border-slate-800 flex items-center gap-3.5 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 font-bold">
                <Users className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white leading-tight">Personalized</h4>
                <p className="text-xs text-slate-400 font-medium">Mentorship</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Explore Courses Modal Pop-up */}
      {showCoursesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 text-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 border border-slate-700 relative overflow-hidden my-auto max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-800 mb-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-400/10 border border-amber-400/30 rounded-full text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <Sparkles className="w-3.5 h-3.5" /> Offered Batches & Programs
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">Apex Chemistry Courses</h3>
                <p className="text-xs text-slate-400 font-medium">Under expert guidance of Mr. Subhamoy Mondal</p>
              </div>
              <button
                onClick={() => setShowCoursesModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Courses List */}
            <div className="space-y-4">
              {/* Course 1 */}
              <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700/80 hover:border-amber-400/50 transition-all space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-400 text-slate-950 font-black text-xs px-2.5 py-1 rounded-lg">
                      CLASS 11
                    </span>
                    <h4 className="font-extrabold text-base text-white">Class 11 Chemistry Foundation</h4>
                  </div>
                  <span className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Board + JEE/NEET
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Thorough coverage of Physical, Organic, and Inorganic Chemistry basics with NCERT line-by-line focus.
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-medium pt-1">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-400" /> Mon, Wed, Fri (4:00 PM - 6:00 PM)</span>
                  <span className="flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5 text-amber-400" /> DPPs + Weekly Tests</span>
                </div>
              </div>

              {/* Course 2 */}
              <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700/80 hover:border-amber-400/50 transition-all space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-400 text-slate-950 font-black text-xs px-2.5 py-1 rounded-lg">
                      CLASS 12
                    </span>
                    <h4 className="font-extrabold text-base text-white">Class 12 Boards & Entrance Special</h4>
                  </div>
                  <span className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Board + PYQ Mastery
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Electrochemistry, Coordination Compounds, Organic Reaction Mechanisms, with dedicated CBSE/WBCHSE answer writing skills.
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-medium pt-1">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-400" /> Tue, Thu, Sat (5:00 PM - 7:00 PM)</span>
                  <span className="flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5 text-amber-400" /> Board Answer Drills</span>
                </div>
              </div>

              {/* Course 3 */}
              <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700/80 hover:border-amber-400/50 transition-all space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-400 text-slate-950 font-black text-xs px-2.5 py-1 rounded-lg">
                      JEE / NEET
                    </span>
                    <h4 className="font-extrabold text-base text-white">JEE Main/Advanced & NEET Target Rank Booster</h4>
                  </div>
                  <span className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Intensive Mock Series
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Comprehensive 11th & 12th revision, high-yield numerical problem solving, and time-bound test series.
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-medium pt-1">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-400" /> Sunday Specials (10:00 AM - 1:00 PM)</span>
                  <span className="flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5 text-amber-400" /> 1-on-1 Mentorship</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-slate-400 text-center sm:text-left">
                Already registered? Log in to your student dashboard to view assigned batches & notes.
              </p>
              <button
                onClick={() => {
                  setShowCoursesModal(false);
                  onLoginClick();
                }}
                className="w-full sm:w-auto px-6 py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition-all hover:scale-105 whitespace-nowrap"
              >
                Login to Enrol / Access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
