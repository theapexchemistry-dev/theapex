import React from"react";
import LiveClasses from"../LiveClasses";

export const AdminVideoCall: React.FC = () => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Live Classes &amp; Video Meetings
        </h2>
        <p className="text-sm text-slate-500">
          Start live classes via In-App WebRTC with automatic student registration name setup.
        </p>
      </div>

      <LiveClasses role="admin" />
    </div>
  );
};

export default AdminVideoCall;
