import { useState } from "react";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";

export default function QuranLandingPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      {/* Navbar */}
      <nav className="flex justify-between items-center p-4 bg-green-900 text-white fixed w-full z-50 shadow-lg">
        <h1 className="text-2xl font-bold">DEEN KHAALIS</h1>
        <div className="hidden md:flex gap-6">
          <a href="#services" className="hover:text-green-300">Services</a>
          <a href="#payment" className="hover:text-green-300">Payment</a>
          <a href="#blog" className="hover:text-green-300">Blog</a>
          <a href="#about" className="hover:text-green-300">About</a>
        </div>
        <div className="hidden md:flex gap-4">
          <button className="bg-white text-green-900 px-4 py-2 rounded-lg hover:bg-green-200">Login</button>
          <button className="bg-green-600 px-4 py-2 rounded-lg hover:bg-green-500">Register</button>
        </div>
        <button onClick={() => setOpen(!open)} className="md:hidden">
          {open ? <X size={28} /> : <Menu size={28} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {open && (
        <div className="bg-green-900 text-white flex flex-col gap-4 p-6 md:hidden">
          <a href="#services">Services</a>
          <a href="#payment">Payment</a>
          <a href="#blog">Blog</a>
          <a href="#about">About</a>
          <button className="bg-white text-green-900 px-4 py-2 rounded-lg">Login</button>
          <button className="bg-green-600 px-4 py-2 rounded-lg">Register</button>
        </div>
      )}

      {/* Hero Section */}
      <section className="flex flex-col md:flex-row items-center justify-center text-center md:text-left pt-32 px-6 md:px-20 bg-gradient-to-r from-green-900 via-black to-green-900 text-white min-h-[90vh]">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="max-w-2xl"
        >
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Learn Quran Online with <span className="text-green-400">Certified Teachers</span>
          </h2>
          <p className="text-lg md:text-xl mb-6">
            Guided by Madina University graduates – One-on-One Quran Recitation, Tajweed & Hifdh classes for students in Europe, USA, and worldwide.
          </p>
          <div className="flex gap-4 justify-center md:justify-start">
            <button className="bg-green-600 px-6 py-3 rounded-lg hover:bg-green-500">Get Started</button>
            <button className="bg-white text-green-900 px-6 py-3 rounded-lg hover:bg-green-200">Learn More</button>
          </div>
        </motion.div>
        <motion.img
          src="https://i.ibb.co/DfBdwvj/quran.png"
          alt="Quran Study"
          className="mt-10 md:mt-0 md:ml-10 w-80 md:w-[400px]"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2 }}
        />
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 px-6 md:px-20 bg-gray-50">
        <h3 className="text-3xl font-bold text-center mb-12">Our Services</h3>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 text-center shadow-xl border-t-4 border-green-600 rounded-xl bg-white">
            <h4 className="text-xl font-bold mb-2">Quran Teaching</h4>
            <p>Recitation with Tajweed, Tafseer understanding, and guided memorization (Hifdh).</p>
          </div>
          <div className="p-6 text-center shadow-xl border-t-4 border-green-600 rounded-xl bg-white">
            <h4 className="text-xl font-bold mb-2">One-on-One Live Classes</h4>
            <p>Personalized video & audio lessons with expert teachers for every level.</p>
          </div>
          <div className="p-6 text-center shadow-xl border-t-4 border-green-600 rounded-xl bg-white">
            <h4 className="text-xl font-bold mb-2">Global Access</h4>
            <p>Students from Europe, USA, and worldwide are welcome – learn anytime, anywhere.</p>
          </div>
        </div>
      </section>

      {/* Payment Section */}
      <section id="payment" className="py-20 px-6 md:px-20 bg-green-900 text-white">
        <h3 className="text-3xl font-bold text-center mb-12">Payment Methods</h3>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 text-center bg-green-800 rounded-xl shadow-lg">
            <h4 className="text-xl font-bold mb-2">Credit / Debit Cards</h4>
            <p>Pay easily using international Visa or Mastercard.</p>
          </div>
          <div className="p-6 text-center bg-green-800 rounded-xl shadow-lg">
            <h4 className="text-xl font-bold mb-2">PayPal</h4>
            <p>Secure transactions through PayPal – trusted worldwide.</p>
          </div>
          <div className="p-6 text-center bg-green-800 rounded-xl shadow-lg">
            <h4 className="text-xl font-bold mb-2">M-Pesa</h4>
            <p>Convenient for students and parents in Africa.</p>
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <section id="blog" className="py-20 px-6 md:px-20 bg-gray-100">
        <h3 className="text-3xl font-bold text-center mb-12">Islamic Insights</h3>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 shadow-lg bg-white rounded-xl">
            <h4 className="text-xl font-bold mb-2">Hadith of the Day</h4>
            <p>“The best among you are those who learn the Quran and teach it.” – Sahih Bukhari</p>
          </div>
          <div className="p-6 shadow-lg bg-white rounded-xl">
            <h4 className="text-xl font-bold mb-2">Article</h4>
            <p>Discover the importance of Tajweed in preserving the purity of Quran recitation.</p>
          </div>
          <div className="p-6 shadow-lg bg-white rounded-xl">
            <h4 className="text-xl font-bold mb-2">Video</h4>
            <iframe className="w-full h-40 rounded-lg" src="https://www.youtube.com/embed/4S3g9Q0x4V0" title="Quran Video" allowFullScreen></iframe>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white text-center p-6">
        <p>&copy; {new Date().getFullYear()} DEEN KHAALIS Quran Academy. All Rights Reserved.</p>
      </footer>
    </div>
  );
}
