import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import FeaturedBooks from '@/components/FeaturedBooks';
import Features from '@/components/Features';
import MeetLibrarian from '@/components/MeetLibrarian';
import CallToAction from '@/components/CallToAction';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen text-white" style={{ background: '#071825' }}>
      <Navbar variant="dark" />
      <main className="md:[zoom:1.06]">
        <section id="hero"><HeroSection /></section>
        <section id="catalog"><FeaturedBooks /></section>
        <section id="features"><Features /></section>
        <section id="librarian"><MeetLibrarian /></section>
        <section id="cta"><CallToAction /></section>
      </main>
      <Footer />
    </div>
  );
}
