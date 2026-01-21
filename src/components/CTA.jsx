import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export default function CTA() {
  return (
    <section className="relative overflow-hidden py-20 px-6 text-center bg-gradient-to-br from-green-50 via-white to-green-100" id="cta">
      {/* 🌌 Animated gradient blobs */}
      <motion.div
        className="absolute -top-32 -left-32 w-96 h-96 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"
        animate={{ x: [0, 50, -50, 0], y: [0, -50, 50, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40"
        animate={{ x: [0, -60, 60, 0], y: [0, 60, -60, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* 🌙 Floating Crescent Moon SVG */}
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="green"
        className="absolute top-10 left-10 w-10 h-10 opacity-50"
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <path d="M21 12.79A9 9 0 0111.21 3a7 7 0 100 14 9 9 0 009.79-4.21z" />
      </motion.svg>

      {/* ✨ Content */}
      <div className="relative z-10 max-w-2xl mx-auto">
        <motion.h2
          className="text-4xl md:text-5xl font-bold text-gray-900 mb-6"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          Embark on Your Quran Journey Today
        </motion.h2>
        <motion.p
          className="text-lg text-gray-700 mb-8"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          Learn Quran online with qualified teachers from Madina University. 
          Join thousands of students worldwide in live interactive classes.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          <Link
            to="/enroll"
            className="px-8 py-4 bg-green-600 text-white font-semibold rounded-2xl shadow-lg hover:bg-green-700 transition"
          >
            Enroll Now
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
