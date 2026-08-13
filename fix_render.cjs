const fs = require('fs');
let content = fs.readFileSync('src/components/LiveClasses.tsx', 'utf8');

const prefix = content.substring(0, content.indexOf('  // ===== ADMIN RENDER ====='));
const suffix = content.substring(content.indexOf('// ===== Sub-components ====='));

const newRender = `  // ===== ADMIN RENDER =====
  if (!isStudent) {
    return (
      <div className="space-y-6">
        <SyncStatusBar connected={connected} error={syncError} count={activeMeetings.length} />

        {toastMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm animate-fade-in">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            {toastMessage}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Radio className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Start a Live Class</h3>
                <p className="text-xs text-slate-500">Start in-app live WebRTC video classes</p>
              </div>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Class topic / title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Organic Chemistry — Reaction Mechanisms" className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teacher name</label>
              <input type="text" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="e.g. Mr. Subhamoy Mondal" className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Target Audience</label>
              <select value={scope} onChange={(e) => setScope(e.target.value as "batch" | "class" | "all")} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200">
                <option value="all">All enrolled students</option>
                <option value="class">Specific class grade</option>
                <option value="batch">Specific batch</option>
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {scope === "batch" ? "Select batch" : scope === "class" ? "Select class" : "Duration"}
              </label>
              {scope === "batch" ? (
                batches.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">No batches found.</p>
                ) : (
                  <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200">
                    {batches.map((b) => (<option key={b.id} value={b.id}>{b.title}</option>))}
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
              {starting ? (<><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />Launching…</>) : (<><Play className="h-4 w-4 fill-current" /> Start Live Class (WebRTC)</>)}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Active Live Classes ({activeMeetings.length})</h3>
          </div>
          {activeMeetings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <Video className="mx-auto mb-2 h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-500">No active classes. Launch one above and students will see it instantly.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeMeetings.map((m) => (
                <AdminMeetingCard
                  key={m.id}
                  meeting={m}
                  onEnd={() => handleEndMeeting(m.id)}
                  onDelete={() => handleDeleteMeeting(m.id)}
                  onRejoin={() => setShowWebRTCModal(m)}
                />
              ))}
            </div>
          )}
        </div>

        {pastMeetings.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900">Recent Class History ({pastMeetings.length})</h3>
            </div>
            <div className="space-y-2">
              {pastMeetings.map((m) => (<PastMeetingCard key={m.id} meeting={m} isAdmin onDelete={() => handleDeleteMeeting(m.id)} onUpdate={fbUpdateMeeting} />))}
            </div>
          </div>
        )}

        {showWebRTCModal && (
          <MeetingDialog
            meeting={showWebRTCModal}
            role="admin"
            displayName={teacherName || "Mr. Subhamoy Mondal"}
            meetingActive={true}
            onClose={() => setShowWebRTCModal(null)}
            onEndMeeting={(id) => {
              handleEndMeeting(id);
              setShowWebRTCModal(null);
            }}
          />
        )}
      </div>
    );
  }

  // ===== STUDENT RENDER =====
  return (
    <div className="space-y-6">
      <SyncStatusBar connected={connected} error={syncError} count={visibleActive.length} />
      
      {toastMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm animate-fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          {toastMessage}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
              {studentRegisteredClass} · {studentRegisteredBatch}
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              Welcome, {studentRegisteredName} 👋
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Your registered student identity is auto-configured for all Live Classes.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2 text-xs font-semibold text-emerald-800">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            Auto-Name Configured
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900">Live Now ({visibleActive.length})</h3>
        </div>
        
        {visibleActive.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <Video className="mx-auto mb-2 h-8 w-8 text-slate-400" />
            <p className="text-sm font-semibold text-slate-700">No live classes running right now.</p>
            <p className="text-xs text-slate-500 mt-1">When a teacher starts a class for your batch, it will appear here automatically.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleActive.map((m) => (
              <StudentMeetingCard
                key={m.id}
                meeting={m}
                studentName={studentRegisteredName}
                studentClass={studentRegisteredClass}
                onJoin={() => setShowWebRTCModal(m)}
              />
            ))}
          </div>
        )}
      </div>

      {visiblePast.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Recent Classes ({visiblePast.length})</h3>
          </div>
          <div className="space-y-2">
            {visiblePast.map((m) => (<PastMeetingCard key={m.id} meeting={m} />))}
          </div>
        </div>
      )}

      {showWebRTCModal && (
        <MeetingDialog
          meeting={showWebRTCModal}
          role="student"
          displayName={studentRegisteredName}
          meetingActive={true}
          onClose={() => setShowWebRTCModal(null)}
          onEndMeeting={() => setShowWebRTCModal(null)}
        />
      )}
    </div>
  );
}
`;

fs.writeFileSync('src/components/LiveClasses.tsx', prefix + newRender + suffix);

