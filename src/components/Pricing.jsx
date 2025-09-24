import { motion } from "framer-motion";

export default function Pricing() {
  const plans = [
    {
      title: "Starter",
      price: "$29/mo",
      features: [
        "1-on-1 Qur’an classes",
        "2 sessions per week",
        "Access to recordings",
        "Basic Tajweed lessons",
      ],
      highlight: false,
    },
    {
      title: "Family",
      price: "$59/mo",
      features: [
        "Up to 3 students",
        "5 sessions per week",
        "Dedicated teacher",
        "Tajweed & Hifdh program",
      ],
      highlight: true,
    },
    {
      title: "Sponsor",
      price: "$99/mo",
      features: [
        "Support a student in need",
        "Monthly progress reports",
        "Reward of continuous charity",
        "Special donor updates",
      ],
      highlight: false,
    },
  ];

  return (
    <section className="py-20 bg-gray-50" id="pricing">
      <div className="max-w-6xl mx-auto px-6 text-center">
        {/* Heading */}
        <motion.h2
          className="text-3xl md:text-4xl font-bold text-gray-900 mb-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Affordable <span className="text-green-600">Plans</span> for Everyone
        </motion.h2>
        <p className="text-gray-600 mb-12">
          Choose a plan that fits your learning or contribution goals.
        </p>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, idx) => (
            <motion.div
              key={idx}
              className={`rounded-2xl p-8 shadow-lg transition-all duration-300 ${
                plan.highlight
                  ? "bg-green-600 text-white scale-105"
                  : "bg-white text-gray-900"
              }`}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: idx * 0.2 }}
              whileHover={{ scale: 1.05 }}
            >
              <h3 className="text-2xl font-bold mb-4">{plan.title}</h3>
              <p
                className={`text-3xl font-extrabold mb-6 ${
                  plan.highlight ? "text-white" : "text-green-600"
                }`}
              >
                {plan.price}
              </p>
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center justify-center gap-2">
                    ✅ <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                className={`px-6 py-3 rounded-xl font-semibold shadow-md transition-colors duration-300 ${
                  plan.highlight
                    ? "bg-white text-green-600 hover:bg-gray-100"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                Get Started
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
