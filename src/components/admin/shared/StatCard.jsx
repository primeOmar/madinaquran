
export default function StatCard({ title, value, icon: Icon, color = "blue" }) {
  const colorClasses = {
    blue: "bg-blue-900/30 text-blue-300",
    green: "bg-green-900/30 text-green-300",
    yellow: "bg-yellow-900/30 text-yellow-300",
    red: "bg-red-900/30 text-red-300",
    purple: "bg-purple-900/30 text-purple-300"
  };

  return (
    <div className="bg-blue-700/30 rounded-xl p-4 border border-blue-600/30">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-blue-300 text-sm">{title}</p>
          <h3 className="text-2xl font-bold mt-1">{value}</h3>
        </div>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}