import { motion } from "framer-motion";
import Logo from "../assets/logodrk.png";

export default function Footer() {
  return (
    <footer className="relative bg-black text-gray-200 py-12 overflow-hidden">
      {/* Water animation background */}
      <div className="absolute inset-0 overflow-hidden">
        <svg
          className="absolute w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="water">
            <feTurbulence
              id="turbulence"
              baseFrequency="0.02 0.05"
              numOctaves="2"
              seed="2"
            >
              <animate
                attributeName="baseFrequency"
                dur="15s"
                values="0.02 0.05;0.04 0.1;0.02 0.05"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="30" />
          </filter>
        </svg>

        {/* Dark water-like layer */}
        <div
          className="absolute inset-0 bg-black opacity-40"
          style={{ filter: "url(#water)" }}
        />
      </div>

      {/* Logo as watermark (more visible) */}
      <div className="absolute inset-0 flex items-center justify-center opacity-25">
        <img
          src={Logo}
          alt="Madina Quran"
          className="w-72 h-72 object-contain"
        />
      </div>

      {/* Footer content */}
      <div className="relative container mx-auto px-6 grid md:grid-cols-3 gap-8 z-10">
        <div>
          <h3 className="text-xl font-semibold text-white">Madina Quran</h3>
          <p className="mt-2 text-gray-300">
            Teaching the Quran worldwide with excellence.
          </p>
        </div>

        <div>
          <h4 className="text-lg font-medium text-white">Quick Links</h4>
          <ul className="mt-3 space-y-2">
            {["Home", "About", "Courses", "FAQ", "Contact"].map((item) => (
              <li key={item}>
                <a
                  href={`#${item.toLowerCase()}`}
                  className="text-gray-300 hover:text-green-400 transition-colors duration-300"
                >
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-lg font-medium text-white">Contact</h4>
          <p className="mt-3 text-gray-300">Email: info@madinaquran.com</p>
          <p className="text-gray-300">Phone: +254 700 123 456</p>
        </div>
      </div>

      {/* Bottom note */}
      <div className="relative mt-10 border-t border-gray-700 pt-6 text-center text-gray-400 text-sm z-10">
        © {new Date().getFullYear()} Madina Quran. All rights reserved.
      </div>
    </footer>
  );
}
