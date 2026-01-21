
export default function OrbitalLoader() {
  return (
    <div className="flex justify-center items-center py-4">
      <div className="orbital-loader">
        <div className="orbit"></div>
        <div className="orbit"></div>
        <div className="orbit"></div>
      </div>
      <style>{`
        .orbital-loader {
          display: inline-block;
          position: relative;
          width: 40px;
          height: 40px;
        }
        
        .orbit {
          position: absolute;
          border: 2px solid #3b82f6;
          border-radius: 50%;
          animation: orbit 1.5s ease-in-out infinite;
        }
        
        .orbit:nth-child(1) {
          width: 100%;
          height: 100%;
          animation-delay: 0s;
        }
        
        .orbit:nth-child(2) {
          width: 70%;
          height: 70%;
          top: 15%;
          left: 15%;
          animation-delay: 0.2s;
        }
        
        .orbit:nth-child(3) {
          width: 40%;
          height: 40%;
          top: 30%;
          left: 30%;
          animation-delay: 0.4s;
        }
        
        @keyframes orbit {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.5); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}