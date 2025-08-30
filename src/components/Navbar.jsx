import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "../assets/logo.png"; // Adjust path accordingly

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const hamburgerRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (
        isOpen &&
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        hamburgerRef.current &&
        !hamburgerRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isOpen]);

  const lineSpring = { type: "spring", stiffness: 260, damping: 20 };

  const navLinksLeft = [
    { href: "#home", label: "Home" },
    { href: "#about", label: "About" },
    { href: "#courses", label: "Courses" },
  ];
  const navLinksRight = [
    { href: "#pricing", label: "Pricing" },
     { href: "#cta", label: "Enroll" },
  ];

  const navbarFloatVariants = {
    float: {
      y: [0, -6, 0],
      transition: {
        yoyo: Infinity,
        duration: 4,
        ease: "easeInOut",
      },
    },
  };

  return (
    <motion.nav
      variants={navbarFloatVariants}
      animate="float"
      className="fixed inset-x-0 top-0 z-50 bg-white border border-transparent rounded-md shadow-xl"
      style={{ height: 88 }}
    >
      <div
        className="max-w-7xl mx-auto h-full flex items-center px-6 md:px-12"
        style={{ minHeight: 88 }}
      >
        {/* LEFT nav (hidden on mobile) */}
        <div className="hidden md:flex flex-1 items-center space-x-8">
          {navLinksLeft.map(({ href, label }) => (
            <a
  key={href}
  href={href}
  onClick={() => setIsOpen(false)}
  className="text-black hover:text-green-600 transition"
>
  {label}
</a>
          ))}
        </div>

        {/* CENTER logo container */}
        <div className="flex-shrink-0 w-28 md:w-32 mx-auto">
          <motion.div
            whileHover={{ scale: 1.15, boxShadow: "0 12px 40px rgba(16,185,129,0.5)" }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 25 }}
            className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-white border-4 border-green-600 flex items-center justify-center shadow-lg mx-auto"
          >
            <img
              src={logo}
              alt="Deen Khaalis Logo"
              draggable={false}
              className="w-full h-full object-contain"
            />
          </motion.div>
        </div>

        {/* RIGHT nav + hamburger */}
        <div className="flex flex-1 items-center justify-end space-x-6 min-w-0">
          {/* DESKTOP right links */}
          <div className="hidden md:flex items-center space-x-8 flex-shrink-0">
            {navLinksRight.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="text-base font-medium text-gray-800 hover:text-green-600 transition"
              >
                {label}
              </a>
            ))}
            <button className="px-5 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition">
              Register
            </button>
          </div>

          {/* MOBILE hamburger */}
          <button
            ref={hamburgerRef}
            aria-label={isOpen ? "Close menu" : "Open menu"}
            onClick={() => setIsOpen((v) => !v)}
            className="md:hidden p-2 flex flex-col justify-center items-center gap-1 bg-transparent border-0 focus:outline-none h-10 relative z-50"
            style={{ marginBottom: 6 }}
          >
            <motion.span
              className="block w-7 h-0.5 bg-gray-900 rounded origin-center"
              animate={isOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
              transition={lineSpring}
            />
            <motion.span
              className="block w-7 h-0.5 bg-gray-900 rounded origin-center"
              animate={isOpen ? { opacity: 0 } : { opacity: 1 }}
              transition={lineSpring}
            />
            <motion.span
              className="block w-7 h-0.5 bg-gray-900 rounded origin-center"
              animate={isOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
              transition={lineSpring}
            />
          </button>
        </div>
      </div>

      {/* Mobile fullscreen menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            key="mobileMenu"
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            className="fixed inset-0 z-40 bg-white flex flex-col items-center justify-center gap-10 text-2xl font-semibold text-gray-900 px-12"
          >
            {[...navLinksLeft, ...navLinksRight].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className="hover:text-green-600"
              >
                {label}
              </a>
            ))}
            <button
              onClick={() => setIsOpen(false)}
              className="mt-6 px-10 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700"
            >
              Register
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
