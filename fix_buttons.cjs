const fs = require('fs');

let content = fs.readFileSync('src/components/admin/AdminDashboard.tsx', 'utf8');

const oldBlock = `<div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefreshDatabase}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-60 border border-slate-200 shadow-sm"
          >
            <RefreshCw className={\`w-3.5 h-3.5 \${isRefreshing ? 'animate-spin' : ''}\`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={onAddStudent}
            className="px-3.5 py-2 bg-[#0B132B] hover:bg-slate-900 text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add Student
          </button>
          <button
            onClick={onAddBatch}
            className="px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> New Batch
          </button>
          <button
            onClick={onUploadNotes}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Notes
          </button>
        </div>`;

const newBlock = `<div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleRefreshDatabase}
            disabled={isRefreshing}
            className="px-3.5 py-2.5 sm:py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 border border-slate-200 shadow-sm w-full sm:w-auto"
          >
            <RefreshCw className={\`w-3.5 h-3.5 \${isRefreshing ? 'animate-spin' : ''}\`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={onAddStudent}
            className="px-3.5 py-2.5 sm:py-2 bg-[#0B132B] hover:bg-slate-900 text-amber-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm w-full sm:w-auto"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add Student
          </button>
          <button
            onClick={onAddBatch}
            className="px-3.5 py-2.5 sm:py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm w-full sm:w-auto"
          >
            <Plus className="w-3.5 h-3.5" /> New Batch
          </button>
          <button
            onClick={onUploadNotes}
            className="px-3.5 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm w-full sm:w-auto"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Notes
          </button>
        </div>`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync('src/components/admin/AdminDashboard.tsx', content);
  console.log("Replaced successfully!");
} else {
  console.log("Could not find the block to replace.");
}
