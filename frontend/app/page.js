import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import LeadGenFloater from '@/components/common/LeadGenFloater';
import HeroSection from '@/components/home/HeroSection';
import SearchSection from '@/components/home/SearchSection';
import StatsSection from '@/components/home/StatsSection';
import CategorySection from '@/components/home/CategorySection';
import SmartMatchingSection from '@/components/home/SmartMatchingSection';
import AIAssistantSection from '@/components/home/AIAssistantSection';
import HowItWorksSection from '@/components/home/HowItWorksSection';
import FeaturedProfessionals from '@/components/home/FeaturedProfessionals';
import FeaturedFirms from '@/components/home/FeaturedFirms';
import DashboardPreviewSection from '@/components/home/DashboardPreviewSection';
import TestimonialsSection from '@/components/home/TestimonialsSection';
import CTASection from '@/components/home/CTASection';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <SearchSection />
        <StatsSection />
        <CategorySection />
        <SmartMatchingSection />
        <AIAssistantSection />
        <HowItWorksSection />
        <FeaturedProfessionals />
        <FeaturedFirms />
        <DashboardPreviewSection />
        <TestimonialsSection />
        <CTASection />
      </main>
      <Footer />
      <LeadGenFloater source="home" />
    </div>
  );
}
