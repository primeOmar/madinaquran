import { motion } from "framer-motion";

export default function StatsOverview({ stats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {stats.map((stat, index) => (
        <motion.div 
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="bg-blue-800/40 backdrop-blur-md rounded-xl p-4 border border-blue-700/30"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-300 text-sm">{stat.label}</p>
              <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
              <p className="text-blue-400 text-xs mt-1 flex items-center">
                <span className="text-blue-300">↑ {stat.change}</span>
                <span className="ml-2">from last week</span>
              </p>
            </div>
            <div className="p-2 rounded-lg bg-blue-700/30">
              <stat.icon size={20} className="text-blue-300" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
