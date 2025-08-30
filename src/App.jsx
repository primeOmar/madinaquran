import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import About from "./components/About";
import DiagonalSeparotor from "./components/DiagonalSeparator";
import Courses from "./components/Courses";
import WhyChooseUs from "./components/WhyChooseUs";
import Testimonials from "./components/Testimonials";
import Pricing from "./components/Pricing";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

function App() {
  return (
    <>
      <Navbar />
      <Hero />
      <DiagonalSeparotor />
      <About />
      <Courses />
      <WhyChooseUs />
      <Testimonials />
      <Pricing />
      <CTA />
      <Footer />
    </>
  );
}

export default App;
