import React from"react";
import LiveClasses from"../LiveClasses";
import { Student } from"../../types";

interface StudentVideoCallProps {
  student: Student;
}

export const StudentVideoCall: React.FC<StudentVideoCallProps> = ({ student }) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Live Classes
        </h2>
        <p className="text-sm text-slate-500">
          Join live lectures with Mr. Subhamoy Mondal via Google Meet with your registered details auto-configured.
        </p>
      </div>

      <LiveClasses role="student" student={student} />
    </div>
  );
};

export default StudentVideoCall;
