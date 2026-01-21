import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";

export default function Hero() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [loadedImagesCount, setLoadedImagesCount] = useState(0);
  const imagesLoadedRef = useRef(false);

  // ✅ Using absolute paths from public folder
  const backgroundImages = [
  `${process.env.PUBLIC_URL || ''}/images/madina1.jpg`,
  `${process.env.PUBLIC_URL || ''}/images/madina2.jpg`,
  `${process.env.PUBLIC_URL || ''}/images/madina3.jpg`,
  `${process.env.PUBLIC_URL || ''}/images/madina4.jpg`,
  `${process.env.PUBLIC_URL || ''}/images/madina5.jpg`,
  `${process.env.PUBLIC_URL || ''}/images/madina6.jpg`
];
  const colorFilters = [
    "bg-gradient-to-b from-green-900/70 via-black/70 to-black/70",
    "bg-gradient-to-b from-green-800/60 via-black/80 to-black/80", 
    "bg-gradient-to-b from-white/10 via-black/80 to-black/90",
    "bg-gradient-to-b from-green-700/50 via-black/70 to-black/70"
  ];

  // ✅ Preload images with proper error handling
  useEffect(() => {
    if (imagesLoadedRef.current) return;
    imagesLoadedRef.current = true;

    let completed = 0;
    const totalImages = backgroundImages.length;

    const loadImage = (src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          completed++;
          setLoadedImagesCount(completed);
          if (completed === totalImages) {
            setImagesLoaded(true);
          }
          resolve();
        };
        img.onerror = () => {
          console.error(`Failed to load image: ${src}`);
          completed++;
          setLoadedImagesCount(completed);
          if (completed === totalImages) {
            setImagesLoaded(true);
          }
          resolve();
        };
        // Use absolute path from public folder
        img.src = src;
      });
    };

    // Load all images in parallel
    Promise.all(backgroundImages.map(src => loadImage(src)));
  }, [backgroundImages]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    
    // Only start carousel after images are loaded
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => 
        (prevIndex + 1) % backgroundImages.length
      );
    }, 5000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", checkMobile);
    };
  }, [backgroundImages.length, imagesLoaded]);

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }
        .animate-pulse-text {
          animation: pulse 2s ease-in-out infinite;
          display: inline-block;
        }
        
        .carousel-image {
          transition: opacity 1.5s ease-in-out;
          object-fit: cover;
        }
        
        /* Prevent horizontal scrolling */
        html, body {
          overflow-x: hidden;
          width: 100%;
        }
        
        /* Ensure hero section doesn't cause scrolling */
        .hero-section {
          height: 100vh;
          overflow: hidden;
        }
        
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100vh;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          transition: opacity 0.5s ease-out;
        }
        
        .loading-progress {
          color: white;
          font-size: 1.2rem;
          text-align: center;
        }
        
        .progress-bar {
          width: 200px;
          height: 4px;
          background: #333;
          border-radius: 2px;
          margin-top: 10px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          background: #10b981;
          transition: width 0.3s ease;
        }

        /* Smooth transitions for carousel */
        .image-transition {
          transition: opacity 1.5s ease-in-out;
        }
      `}</style>

      {/* Loading Overlay */}
      {!imagesLoaded && (
        <div className="loading-overlay">
          <div className="loading-progress">
            <div>Loading images... {Math.round((loadedImagesCount / backgroundImages.length) * 100)}%</div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(loadedImagesCount / backgroundImages.length) * 100}%` }}
              />
            </div>
            <div className="text-sm mt-2">
              {loadedImagesCount} / {backgroundImages.length} loaded
            </div>
          </div>
        </div>
      )}

      <section className="hero-section relative flex flex-col justify-center items-center w-full pt-20 md:pt-24 lg:pt-28">
        
        {/* Background Carousel */}
        <div className="fixed inset-0 -z-20 overflow-hidden">
          {backgroundImages.map((image, index) => (
            <div
              key={index}
              className={`absolute inset-0 image-transition ${
                index === currentImageIndex ? 'opacity-100' : 'opacity-0'
              } ${!imagesLoaded ? 'invisible' : 'visible'}`}
              style={{
                backgroundImage: `url(${image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                width: '100%',
                height: '100vh',
                position: 'fixed',
                top: 0,
                left: 0,
              }}
            />
          ))}
          
          {/* Color overlay */}
          <div 
            className={`absolute inset-0 ${colorFilters[currentImageIndex % colorFilters.length]}`}
            style={{ height: '100vh' }}
          />
          
          {/* Subtle pattern overlay */}
          <div 
            className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+CiAgPHBhdGggZD0iTTAgMGg2MHY2MEgweiIgZmlsbD0ibm9uZSIvPgogIDxwYXRoIGQ9Ik0zMCAzMG0tMjggMGEyOCwyOCAwIDEsMSA1NiwwYTI4LDI4IDAgMSwxIC01NiwwIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wNykiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIvPgo8L3N2Zz4=')] opacity-20"
            style={{ height: '100vh' }}
          />
        </div>

        {/* Content container - Only show after images load */}
        <div className={`relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center text-center transition-opacity duration-500 ${
          imagesLoaded ? 'opacity-100' : 'opacity-0'
        }`}>

          {/* Animated heading with pulse */}
          <motion.h1
            className="mb-4 sm:mb-6 font-extrabold text-white animate-pulse-text px-2"
            style={{ 
              fontSize: isMobile ? '2.5rem' : 'clamp(3rem, 10vw, 5rem)', 
              lineHeight: 1.1 
            }}
            initial={{ opacity: 0, y: 40 }}
            animate={imagesLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          >
            <span className="font-light">Madina&nbsp;</span>
            <span className="bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
              Quran School
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="mt-4 max-w-3xl text-sm sm:text-base md:text-lg text-green-100 leading-relaxed font-light px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={imagesLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
          >
            Learn the Quran with guidance, clarity, and excellence. Our expert teachers empower students of all ages to memorize, understand, and recite the Quran with confidence.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="mt-8 sm:mt-12 flex flex-col sm:flex-row justify-center gap-4 sm:gap-6 px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={imagesLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            <motion.button
              className="flex items-center justify-center px-6 py-3 sm:px-8 sm:py-4 text-base sm:text-lg font-semibold text-white rounded-xl bg-gradient-to-r from-green-600 to-green-700 shadow-lg hover:shadow-2xl transition-all duration-300 group"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Start Learning
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 ml-2 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </motion.button>

            <motion.button
              className="px-6 py-3 sm:px-8 sm:py-4 text-base sm:text-lg font-semibold text-green-300 rounded-xl border-2 border-green-500 shadow-lg hover:bg-green-900/40 transition-all duration-300"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              View Courses
            </motion.button>
          </motion.div>
        </div>

        {/* Carousel indicators - Only show after images load */}
        {imagesLoaded && (
          <div className="absolute bottom-8 flex space-x-2 z-10">
            {backgroundImages.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-500 ${
                  index === currentImageIndex ? 'bg-green-500 scale-125' : 'bg-white/40'
                }`}
                onClick={() => setCurrentImageIndex(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Scroll indicator */}
        {imagesLoaded && (
          <motion.div 
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
          >
            <div className="animate-bounce">
              <svg className="w-6 h-6 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </motion.div>
        )}
      </section>
    </>
  );
}
