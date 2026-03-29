import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SplashScreen = () => {
  const navigate = useNavigate();
  const [showVideo, setShowVideo] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowVideo(false);
      navigate('/login');
    }, 2000); // 2 seconds

    return () => clearTimeout(timer);
  }, [navigate]);

  if (!showVideo) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#000',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999
    }}>
      {/* Video element */}
      <video 
        autoPlay 
        muted 
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'cover' 
        }}
      >
        {/* Using your specific video file */}
        <source src="/naajvidreal.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default SplashScreen;
