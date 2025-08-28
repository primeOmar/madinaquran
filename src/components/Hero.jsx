import { motion } from "framer-motion";

export default function Hero() {
  return (
    <>
      {/* Add pulse keyframes */}
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
      `}</style>

      <section className="relative flex flex-col justify-center items-center min-h-screen w-screen pt-20 md:pt-24 lg:pt-28 bg-gradient-to-b from-green-900 via-black to-black overflow-hidden">
        
        {/* Fixed background gradient */}
        <div className="fixed inset-0 -z-10 bg-gradient-to-b from-green-900 via-black to-black" />

        {/* Content container */}
        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 flex flex-col items-center text-center">

          {/* Animated heading with pulse */}
          <motion.h1
            className="mb-6 font-extrabold text-white animate-pulse-text"
            style={{ fontSize: 'clamp(3rem, 10vw, 5rem)', lineHeight: 1.1 }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          >
            <span className="font-light">Madina&nbsp;</span>
            <span className="bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
              Quran School
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="mt-4 max-w-3xl text-base sm:text-lg md:text-xl text-green-100 leading-relaxed font-light"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
          >
            Learn the Quran with guidance, clarity, and excellence. Our expert teachers empower students of all ages to memorize, understand, and recite the Quran with confidence. Join{" "}
            <strong className="text-green-300">Madina Quran School</strong> and begin your spiritual journey today.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="mt-12 flex flex-col sm:flex-row justify-center gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            <motion.button
              className="flex items-center justify-center px-8 py-4 text-lg font-semibold text-white rounded-xl bg-gradient-to-r from-green-600 to-green-700 shadow-lg hover:shadow-2xl transition-all duration-300"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Start Learning
              <svg
                className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </motion.button>

            <motion.button
              className="px-8 py-4 text-lg font-semibold text-green-300 rounded-xl border-2 border-green-500 shadow-lg hover:bg-green-900/40 transition-all duration-300"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              View Courses
            </motion.button>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
       {/* <motion.div
          className="absolute bottom-8 flex flex-col items-center w-full z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <span className="mb-2 text-sm text-green-300">Scroll to explore</span>
          <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <svg
              className="w-6 h-6 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </motion.div>
        </motion.div>*/}

        
      </section>
    </>
  );
}
