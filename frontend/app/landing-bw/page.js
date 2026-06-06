// Black & white version of the landing page.
//
// Renders the exact same sections as `/` but wraps them in a global
// CSS filter chain that strips chroma. The trade-off vs. duplicating
// every component with a monochrome palette: zero refactor, instant
// visual conversion, and any future tweak to the colour landing
// flows here automatically. If the design lands and you decide to
// promote it permanently we can bake the styles directly into each
// component and drop the filter.

import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
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

export const metadata = {
  title: 'Profirmo — Verified Legal & Tax Directory',
  description:
    'Browse Profirmo’s directory of identity-verified legal and tax professionals. Find the right advocate, CA or consultant for your matter.',
};

export default function LandingBWPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main
        // CSS filter pipeline: grayscale removes the saturation,
        // light contrast boost keeps text crisp. `isolate` creates a
        // new stacking context so any sticky / fixed children inherit
        // the filter (sticky header is OUTSIDE this wrapper so it
        // stays branded).
        className="flex-1 isolate [filter:grayscale(1)_contrast(1.02)]"
      >
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
    </div>
  );
}
