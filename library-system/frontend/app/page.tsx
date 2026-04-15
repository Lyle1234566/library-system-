import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import FeaturedBooks from '@/components/FeaturedBooks';
import Features from '@/components/Features';
import CallToAction from '@/components/CallToAction';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen text-white" style={{ background: '#060e24' }}>
      <Navbar variant="dark" />
      <main className="md:[zoom:1.03]">
        <section id="hero"><HeroSection /></section>
        <section id="catalog"><FeaturedBooks /></section>
        <section id="features"><Features /></section>
        <section id="cta"><CallToAction /></section>
      </main>
      <Footer />
    </div>
  );
}
