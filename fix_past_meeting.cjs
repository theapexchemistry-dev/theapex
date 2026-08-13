const fs = require('fs');

let content = fs.readFileSync('src/components/LiveClasses.tsx', 'utf8');

const replacement = `
function RecordingPlayerModal({ meeting, onClose }: { meeting: LiveMeeting; onClose: () => void }) {
  // Convert Google Drive view URL to preview URL for iframe embedding
  let embedUrl = meeting.recordingUrl || '';
  if (embedUrl.includes('drive.google.com') && embedUrl.includes('/view')) {
    embedUrl = embedUrl.replace(/\\/view.*$/, '/preview');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-3xl bg-slate-900 p-1 shadow-2xl border border-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex flex-col">
            <h3 className="text-lg font-black text-white">{meeting.title}</h3>
            <p className="text-xs text-slate-400">Recorded on {new Date(meeting.startedAt).toLocaleDateString()} at {new Date(meeting.startedAt).toLocaleTimeString()}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="relative w-full aspect-video bg-black rounded-b-3xl overflow-hidden">
          {embedUrl ? (
            <iframe 
              src={embedUrl}
              className="w-full h-full border-0"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Video className="w-12 h-12 mb-3 opacity-20" />
              <p>No valid recording URL provided.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PastMeetingCard({ meeting, isAdmin = false, onDelete, onUpdate }: { meeting: LiveMeeting; isAdmin?: boolean; onDelete?: () => void; onUpdate?: (m: LiveMeeting) => void; key?: React.Key }) {
  const scopeLabel = meeting.scope === "all" ? "All students" : meeting.scope === "class" ? meeting.className : meeting.batchTitle;
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showPlayer, setShowPlayer] = useState(false);

  const handleSaveRecording = () => {
    if (!urlInput.trim()) return;
    if (onUpdate) {
      onUpdate({ ...meeting, recordingUrl: urlInput.trim() });
    }
    setShowAddUrl(false);
  };

  if (meeting.recordingUrl) {
    return (
      <>
        <div 
          onClick={() => setShowPlayer(true)}
          className="group relative flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md cursor-pointer hover:border-emerald-300 overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 z-10 flex gap-2">
            {isAdmin && onDelete && (
               <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete record" className="inline-flex items-center justify-center rounded-lg bg-white/90 backdrop-blur-sm shadow-sm p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
            )}
          </div>
          
          <div className="relative w-full h-32 bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-emerald-500 to-slate-900 mix-blend-overlay"></div>
            <div className="z-10 flex flex-col items-center justify-center transform group-hover:scale-110 transition-transform duration-300">
               <div className="h-12 w-12 rounded-full bg-emerald-500/90 text-white flex items-center justify-center shadow-lg backdrop-blur-md">
                 <Play className="h-5 w-5 fill-current ml-1" />
               </div>
            </div>
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded-md text-[10px] font-bold text-white backdrop-blur-md">
              RECORDED
            </div>
          </div>
          
          <div className="flex flex-col min-w-0">
            <h4 className="truncate text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{meeting.title}</h4>
            <p className="mt-0.5 text-xs text-slate-500">{meeting.teacherName} · {scopeLabel}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">{new Date(meeting.startedAt).toLocaleString()}</p>
          </div>
        </div>
        {showPlayer && <RecordingPlayerModal meeting={meeting} onClose={() => setShowPlayer(false)} />}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Ended Class</span>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">· {meeting.platform || "live"}</span>
          </div>
          <h4 className="truncate text-sm font-semibold text-slate-800">{meeting.title}</h4>
          <p className="mt-0.5 text-xs text-slate-500">{meeting.teacherName} · {scopeLabel}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{new Date(meeting.startedAt).toLocaleString()} · {formatDuration(meeting.startedAt, meeting.endedAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && onDelete && (<button onClick={onDelete} title="Delete record" className="inline-flex items-center justify-center rounded-lg bg-red-50 p-2 text-red-500 hover:bg-red-100"><Trash2 className="h-3.5 w-3.5" /></button>)}
        </div>
      </div>
      {isAdmin && !showAddUrl && (
        <button onClick={() => setShowAddUrl(true)} className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
          <LinkIcon className="h-3.5 w-3.5" /> Attach Google Drive Recording
        </button>
      )}
      {isAdmin && showAddUrl && (
        <div className="mt-2 flex items-center gap-2">
          <input 
            type="url" 
            placeholder="Paste Google Drive link..." 
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-200"
          />
          <button onClick={handleSaveRecording} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">Save</button>
          <button onClick={() => setShowAddUrl(false)} className="rounded-lg bg-slate-100 px-2 py-1.5 text-slate-500 hover:bg-slate-200"><X className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}
`;

content = content.replace(
/function PastMeetingCard\(\{ meeting, isAdmin = false, onDelete \}: \{ meeting: LiveMeeting; isAdmin\?: boolean; onDelete\?: \(\) => void; key\?: React\.Key \}\) \{[\s\S]*?    <\/div>\n  \);\n\}/,
replacement
);

fs.writeFileSync('src/components/LiveClasses.tsx', content);
