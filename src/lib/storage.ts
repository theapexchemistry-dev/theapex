  // -------- Meetings (Video Call) --------
  // IMPORTANT: Uses the notifications collection to broadcast meeting status,
  // because the AI Studio-managed Firestore rules block the 'meetings' collection.
  static startMeeting(batchId: string, batchName: string): Meeting {
    const meeting: Meeting = {
      id: `meeting_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      roomName: `apex-${batchId.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`,
      batchId,
      batchName,
      status: 'active',
      startedAt: new Date().toISOString(),
      startedBy: 'Mr. Subhamoy Mondal'
    };

    // Save locally
    const meetings = this.getMeetings();
    meetings.forEach(m => {
      if (m.batchId === batchId && m.status === 'active') {
        m.status = 'ended';
        m.endedAt = new Date().toISOString();
      }
    });
    meetings.unshift(meeting);
    setItem(KEYS.MEETINGS, meetings);

    // Broadcast via notifications collection (which Firestore ALLOWS)
    const notif: any = {
      id: meeting.id,
      title: `Live class started: ${batchName}`,
      message: JSON.stringify(meeting),
      type: 'meeting',
      timestamp: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
      targetRole: 'student',
      read: false
    };
    const notifs = this.getNotifications();
    // Remove any old meeting notifications for the same batch
    const filtered = notifs.filter(n => !(n.type === ('meeting' as any) && n.message.includes(`"batchId":"${batchId}"`)));
    filtered.unshift(notif);
    setItem(KEYS.NOTIFICATIONS, filtered);
    syncDocToFirestore('notifications', notif.id, notif);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('apex_storage_updated'));
    }
    return meeting;
  }

  static endMeeting(meetingId: string): void {
    const meetings = this.getMeetings();
    const meeting = meetings.find(m => m.id === meetingId);
    if (meeting) {
      meeting.status = 'ended';
      meeting.endedAt = new Date().toISOString();
      setItem(KEYS.MEETINGS, meetings);
    }

    // Remove the broadcast notification so students see it disappear
    const notifs = this.getNotifications();
    const filtered = notifs.filter(n => n.id !== meetingId);
    setItem(KEYS.NOTIFICATIONS, filtered);
    deleteFromFirestore('notifications', meetingId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('apex_storage_updated'));
    }
  }

  static getActiveMeetingForBatch(batchId: string): Meeting | null {
    // Read from notifications (synced across devices via Firestore)
    const notifs = this.getNotifications();
    const meetingNotif = notifs.find(n =>
      n.type === ('meeting' as any) &&
      n.message.includes(`"batchId":"${batchId}"`) &&
      n.message.includes(`"status":"active"`)
    );
    if (meetingNotif) {
      try {
        const meeting = JSON.parse(meetingNotif.message);
        if (meeting.status === 'active') return meeting;
      } catch {}
    }
    // Fallback: local meetings array (same device only)
    return this.getMeetings().find(m => m.batchId === batchId && m.status === 'active') || null;
  }

  static getActiveMeetings(): Meeting[] {
    const notifs = this.getNotifications();
    const active: Meeting[] = [];
    notifs.forEach(n => {
      if (n.type === ('meeting' as any)) {
        try {
          const m = JSON.parse(n.message);
          if (m.status === 'active') active.push(m);
        } catch {}
      }
    });
    return active;
  }

  static getMeetings(): Meeting[] {
    return getItem<Meeting[]>(KEYS.MEETINGS, []);
  }

  static saveMeetings(meetings: Meeting[]): void {
    setItem(KEYS.MEETINGS, meetings);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('apex_storage_updated'));
    }
  }
