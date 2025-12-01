// In your parent component
import React, { useState } from 'react';
import VideoCall from './components/VideoCall';

const ClassroomPage = () => {
  const [isInVideoCall, setIsInVideoCall] = useState(false);
  
  const user = {
    id: 'user-123',
    name: 'Teacher Name'
  };

  const handleStartVideoCall = () => {
    setIsInVideoCall(true);
  };

  const handleLeaveVideoCall = () => {
    setIsInVideoCall(false);
  };

  if (isInVideoCall) {
    return (
      <VideoCall
        meetingId="classroom-123" // Any string ID works
        user={user}
        isTeacher={true}
        onLeave={handleLeaveVideoCall}
        onSessionEnded={handleLeaveVideoCall}
      />
    );
  }

  return (
    <div className="classroom-page">
      <h1>Classroom</h1>
      <button onClick={handleStartVideoCall} className="start-call-button">
        Start Video Call
      </button>
    </div>
  );
};

export default ClassroomPage;
