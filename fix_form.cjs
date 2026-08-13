const fs = require('fs');

let content = fs.readFileSync('src/components/LiveClasses.tsx', 'utf8');

const brokenRegex = /<div className="space-y-1\.5">\s*<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teacher name<\/label>[\s\S]*?<\/button>\s*<\/div>/;

const fix = `<div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teacher name</label>
              <input type="text" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="e.g. Mr. Subhamoy Mondal" className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 :ring-amber-900" />
            </div>

            {/* Audience type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Target Audience</label>
              <select value={scope} onChange={(e) => setScope(e.target.value as "batch" | "class" | "all")} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200">
                <option value="all">All enrolled students</option>
                <option value="class">Specific class grade</option>
                <option value="batch">Specific batch</option>
              </select>
            </div>
            
            {/* Sub-selection based on audience type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {scope === "batch" ? "Select batch" : scope === "class" ? "Select class" : "Duration"}
              </label>
              {scope === "batch" ? (
                batches.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">No batches found. Create one in Batches tab.</p>
                ) : (
                  <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200">
                    {batches.map((b) => (<option key={b.id} value={b.id}>{b.title}{b.className ? \` · \${b.className}\` : ""}</option>))}
                  </select>
                )
              ) : scope === "class" ? (
                classOptions.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">No classes found.</p>
                ) : (
                  <select value={selectedClassName} onChange={(e) => setSelectedClassName(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200">
                    {classOptions.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                )
              ) : (
                <div className="flex items-center gap-2">
                  <input type="number" min={15} max={240} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 60)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
                  <span className="text-xs text-slate-500">minutes</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-5 border-t border-slate-200 pt-5">
            <button
              onClick={handleStartMeeting}
              disabled={starting}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-500 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm shadow-amber-400/20"
            >
              {starting ? (<><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />Launching…</>) : (<><Play className="h-4 w-4 fill-current" /> Start Live Class</>)}
            </button>
          </div>`;

content = content.replace(brokenRegex, fix);

fs.writeFileSync('src/components/LiveClasses.tsx', content);

