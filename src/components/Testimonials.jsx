import { motion } from "framer-motion";

export default function Testimonials() {
  const testimonials = [
    {
      name: "Aisha M.",
      role: "Student from UK",
      quote:
        "Alhamdulillah, the teachers are patient and knowledgeable. I improved my Tajweed within weeks!",
      img: "https://i.pravatar.cc/100?img=5",
    },
    {
      name: "Omar K.",
      role: "Parent from Kenya",
      quote:
        "My kids love the classes! They are now excited to memorize Qur’an every day.",
      
    },
    {
      name: "Fatima S.",
      role: "Student from USA",
      quote:
        "The online setup makes it so easy to learn. May Allah reward the teachers for their effort.",
      
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-6 text-center">
        {/* Heading */}
        <motion.h2
          className="text-3xl md:text-4xl font-bold text-gray-900 mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          What Our <span className="text-green-600">Students Say</span>
        </motion.h2>

        {/* Testimonial Cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, idx) => (
            <motion.div
              key={idx}
              className="bg-green-50 rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-shadow duration-300"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: idx * 0.2 }}
              whileHover={{ scale: 1.05 }}
            >
              <p className="text-gray-700 italic mb-4">“{t.quote}”</p>
              <h4 className="text-lg font-semibold text-gray-900">{t.name}</h4>
              <p className="text-sm text-gray-500">{t.role}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
