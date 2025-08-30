import { motion } from "framer-motion";
import { FaGlobe } from "react-icons/fa";
import { MdVideoLibrary } from "react-icons/md";
import QuranIcon from "../assets/icons/quran.jpg";
import MosqueIcon from "../assets/icons/mosque.svg";
import SponsorIcon from "../assets/icons/sponsor.svg";

const reasons = [
  {
    title: "Authentic Teachers",
    description:
      "Learn from qualified teachers from Madina University with years of experience in Qur’an education.",
    icon: <img src={MosqueIcon} alt="mosque" className="w-14 h-14" />,
  },
  {
    title: "Worldwide Access",
    description:
      "Join from anywhere in the world with just an internet connection. Accessible to all students.",
    icon: <FaGlobe className="w-14 h-14 text-green-400" />,
  },
  {
    title: "Student Sponsorship",
    description:
      "Donors can sponsor students, making Qur’an learning possible for those who cannot afford fees.",
    icon: <img src={SponsorIcon} alt="sponsor" className="w-14 h-14" />,
  },
  {
    title: "Recorded Classes",
    description:
      "Every class is recorded, so you can revise lessons anytime and never miss an opportunity to learn.",
    icon: <MdVideoLibrary className="w-14 h-14 text-green-400" />,
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 50, scale: 0.9 },
  visible: (index) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, delay: index * 0.2, ease: "easeOut" },
  }),
};

export default function WhyChooseUs() {
  return (
    <section
      id="why"
      className="relative py-20 bg-gradient-to-b from-black via-green-900 to-green-700 text-gray-100"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
          className="text-3xl md:text-4xl font-bold text-center mb-12 text-green-400"
        >
          Why Choose Us?
        </motion.h2>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {reasons.map((reason, index) => (
            <motion.div
              key={index}
              custom={index}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              whileHover={{ scale: 1.05, rotate: [0, 1, -1, 0] }}
              className="bg-black/40 border border-green-700 rounded-2xl p-6 shadow-lg hover:shadow-green-500/50 transition cursor-pointer"
            >
              <motion.div
                className="flex justify-center mb-4"
                whileHover={{ scale: 1.2, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                {reason.icon}
              </motion.div>
              <h3 className="text-xl font-semibold text-green-400 text-center mb-3">
                {reason.title}
              </h3>
              <p className="text-gray-300 text-center">{reason.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
