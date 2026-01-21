import { motion } from "framer-motion";
import QuranImage from './quran.jpg';

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.3,
    },
  },
};

const textVariants = {
  hidden: { opacity: 0, x: -100 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: "easeOut" } },
};

const imageVariants = {
  hidden: { opacity: 0, x: 100 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: "easeOut" } },
};

const paragraphVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
};

export default function About() {
  return (
    <section
      id="about"
      className="relative py-20 bg-gradient-to-b from-black via-green-900 to-green-700 text-gray-100"
    >
      <motion.div
        className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        {/* Text Content */}
        <motion.div variants={textVariants} className="space-y-6">
          <motion.h2
            variants={paragraphVariants}
            className="text-3xl md:text-4xl font-bold text-green-400"
          >
            Learn the Qur’an with Teachers from Madina University
          </motion.h2>
          <motion.p variants={paragraphVariants} className="text-lg leading-relaxed">
            We offer{" "}
            <span className="font-semibold text-green-500">live Quran classes</span>{" "}
            worldwide, guided by qualified teachers from Madina University. Our
            programs include{" "}
            <span className="font-semibold text-green-500">
              Hifdh sessions, Tafsir, and Quran recitation
            </span>
            . Classes are available in both{" "}
            <span className="font-semibold text-green-500">video and audio formats</span>
            , ensuring accessibility for everyone.
          </motion.p>
          <motion.p variants={paragraphVariants} className="text-lg leading-relaxed">
            All sessions are{" "}
            <span className="font-semibold text-green-500">recorded</span> to maintain
            quality and allow you to revisit lessons anytime. Whether you’re a student eager
            to enroll or a donor who wishes to sponsor students, your contribution helps
            spread the light of the Qur’an across the globe.
          </motion.p>
          <motion.div
            variants={paragraphVariants}
            className="flex flex-col sm:flex-row gap-4 pt-6"
          >
            <a
              href="#enroll"
              className="px-6 py-3 bg-green-600 text-white rounded-2xl shadow hover:bg-black transition transform hover:scale-105"
            >
              Enroll in Quran Classes
            </a>
            <a
              href="#donate"
              className="px-6 py-3 bg-black text-green-400 rounded-2xl shadow hover:bg-black transition transform hover:scale-105"
            >
              Sponsor a Student
            </a>
          </motion.div>
        </motion.div>

        {/* Image / Visual */}
        <motion.div
          variants={imageVariants}
          className="flex justify-center"
        >
          <img
            src={QuranImage}
            alt="Quran class online"
            className="rounded-2xl shadow-lg max-w-full h-auto"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
