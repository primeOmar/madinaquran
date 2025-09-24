import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";

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
        repeat: Infinity,
        duration: 4,
        ease: "easeInOut",
      },
    },
  };

  return (
    <>
      <motion.nav
        variants={navbarFloatVariants}
        animate="float"
        className="fixed inset-x-0 top-0 z-50 bg-white border border-transparent rounded-md shadow-xl overflow-visible"
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
          <div className="flex-shrink-0 absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <motion.div
              whileHover={{
                scale: 1.15,
                boxShadow: "0 12px 40px rgba(16,185,129,0.5)",
              }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 320, damping: 25 }}
              className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-white border-4 border-green-600 flex items-center justify-center shadow-lg overflow-hidden"
            >
              <img
                src={logo}
                alt="Deen Khaalis Logo"
                draggable={false}
                className="w-25 h-25 md:w-25 md:h-25 object-contain"
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
              <Link
                to="/register"
                className="px-5 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition"
              >
                Register
              </Link>
            </div>

            {/* MOBILE hamburger/X button */}
            <button
              ref={hamburgerRef}
              aria-label={isOpen ? "Close menu" : "Open menu"}
              onClick={() => setIsOpen((v) => !v)}
              className="md:hidden p-2 flex flex-col justify-center items-center w-10 h-10 bg-transparent border-0 focus:outline-none relative z-50"
            >
              <motion.div
                className="w-7 h-7 relative"
                animate={isOpen ? "open" : "closed"}
              >
                <motion.span
                  className="absolute left-0 top-1 w-7 h-0.5 bg-gray-900 rounded origin-center"
                  variants={{
                    closed: { rotate: 0, y: -6 },
                    open: { rotate: 45, y: 0 }
                  }}
                  transition={{ duration: 0.2 }}
                />
                <motion.span
                  className="absolute left-0 top-3 w-7 h-0.5 bg-gray-900 rounded origin-center"
                  variants={{
                    closed: { opacity: 1 },
                    open: { opacity: 0 }
                  }}
                  transition={{ duration: 0.1 }}
                />
                <motion.span
                  className="absolute left-0 top-5 w-7 h-0.5 bg-gray-900 rounded origin-center"
                  variants={{
                    closed: { rotate: 0, y: 6 },
                    open: { rotate: -45, y: 0 }
                  }}
                  transition={{ duration: 0.2 }}
                />
              </motion.div>
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile fullscreen menu - Placed outside the nav to avoid z-index conflicts */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            key="mobileMenu"
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{ zIndex: 60 }}
            className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-8 text-2xl font-semibold text-gray-900 px-6"
          >
            {/* Close button for mobile menu */}
           <button
  onClick={() => setIsOpen(false)}
  className="absolute top-6 right-6 p-2 flex items-center justify-center text-white hover:text-green-600 transition-colors"
  aria-label="Close menu"
>
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M18 6L6 18" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      className="transition-all duration-200"
    />
    <path 
      d="M6 6L18 18" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      className="transition-all duration-200"
    />
  </svg>
</button>

            {[...navLinksLeft, ...navLinksRight].map(({ href, label }) => (
              <motion.a
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className="hover:text-green-600 transition-colors py-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {label}
              </motion.a>
            ))}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Link
                to="/register"
                onClick={() => setIsOpen(false)}
                className="mt-4 px-10 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors block text-center"
              >
                Register
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}