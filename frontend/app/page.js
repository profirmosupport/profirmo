import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import HeroSection from '@/components/home/HeroSection';
import CategorySection from '@/components/home/CategorySection';
import HowItWorksSection from '@/components/home/HowItWorksSection';
import FeaturedProfessionals from '@/components/home/FeaturedProfessionals';
import FeaturedFirms from '@/components/home/FeaturedFirms';
import BenefitsSection from '@/components/home/BenefitsSection';
import CTASection from '@/components/home/CTASection';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <CategorySection />
        <HowItWorksSection />
        <FeaturedProfessionals />
        <FeaturedFirms />
        <BenefitsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
