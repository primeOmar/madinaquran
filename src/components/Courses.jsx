import { motion } from "framer-motion";
import { BookOpen, Headphones, Mic, Users } from "lucide-react";

const courses = [
  {
    title: "Qur’an Recitation",
    description: "Learn proper recitation with Tajweed under the guidance of expert teachers.",
    icon: <Mic className="w-10 h-10 text-green-400" />,
  },
  {
    title: "Hifdh (Memorization)",
    description: "Step-by-step memorization sessions with revision plans to help you retain the Qur’an.",
    icon: <BookOpen className="w-10 h-10 text-green-400" />,
  },
  {
    title: "Tafsir (Explanation)",
    description: "Understand the meaning and context of verses with authentic Tafsir lessons.",
    icon: <Users className="w-10 h-10 text-green-400" />,
  },
  {
    title: "Audio & Video Classes",
    description: "Join flexible classes in audio or video format, accessible worldwide.",
    icon: <Headphones className="w-10 h-10 text-green-400" />,
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7 } },
};

export default function Courses() {
  return (
    <section
      id="courses"
      className="relative py-20 bg-gradient-to-b from-green-700 via-green-900 to-black text-gray-100"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <motion.h2
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
          className="text-3xl md:text-4xl font-bold text-center mb-12 text-green-400"
        >
          Our Qur’an Programs
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {courses.map((course, index) => (
            <motion.div
              key={index}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              className="bg-black/40 border border-green-700 rounded-2xl p-6 shadow-lg hover:shadow-green-700/50 transition transform hover:-translate-y-2"
            >
              <div className="flex justify-center mb-4">{course.icon}</div>
              <h3 className="text-xl font-semibold text-green-400 text-center mb-3">
                {course.title}
              </h3>
              <p className="text-gray-300 text-center">{course.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
