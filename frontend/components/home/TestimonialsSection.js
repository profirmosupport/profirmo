'use client';

import {
  Star,
  Quote,
  MessageSquareQuote,
  Heart,
  Lightbulb,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

// Profirmo's Facebook page rendered via the official Page Plugin iframe.
// `adapt_container_width=true` makes the embed grow up to its `width=`
// cap to fill whatever column it lands in — we use 500 so the plugin
// fills the full grid cell on every breakpoint (cells are ~320–500px
// across the home grid). Height matches the sibling video / audio
// cards (~280px) to keep the row visually even.
const FB_PAGE_URL = 'https://www.facebook.com/fbprofirmo';
const FB_PAGE_PLUGIN_URL = `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(
  FB_PAGE_URL
)}&tabs=timeline&width=500&height=280&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true`;

const TESTIMONIALS = [
  {
    img: 5,
    name: 'Riya Malhotra',
    role: 'Small business owner, Pune',
    quoteKey: 'testimonials.quote1',
  },
  {
    img: 12,
    name: 'Karan Bhatia',
    role: 'Startup founder, Bangalore',
    quoteKey: 'testimonials.quote2',
  },
  {
    img: 28,
    name: 'Deepa Krishnan',
    role: 'Homemaker, Chennai',
    quoteKey: 'testimonials.quote3',
  },
  {
    img: 37,
    name: 'Aman Verma',
    role: 'Freelance consultant, Delhi',
    quoteKey: 'testimonials.quote4',
  },
  {
    img: 49,
    name: 'Nisha Pillai',
    role: 'Restaurant owner, Mumbai',
    quoteKey: 'testimonials.quote5',
  },
  {
    img: 62,
    name: 'Sahil Khanna',
    role: 'E-commerce seller, Jaipur',
    quoteKey: 'testimonials.quote6',
  },
];

// Two fun-fact cards sit alongside the Facebook page widget in the 3-up
// row at the top of the testimonials section. Snackable, India-specific
// stats that earn a second look and reinforce platform positioning.
const FUN_FACTS = [
  {
    icon: Lightbulb,
    accent: 'amber',
    tag: 'Fun fact',
    stat: '60%',
    headline: 'of grey divorces in India are filed by women',
    body:
      'Indian family courts now report 30–40% more over-50 divorces than a decade ago — and women lead the filings, a quiet shift driven by financial independence and an empty nest.',
    source: 'Family-Law Series · 2026',
  },
  {
    icon: Sparkles,
    accent: 'teal',
    tag: 'Did you know?',
    stat: '1.4M+',
    headline: 'advocates enrolled in India, only ~4% specialise in tax',
    body:
      'India has one of the largest bars in the world, but tax-and-GST specialists are a tiny slice. Pro Firmo concentrates on this scarce supply so finding the right professional takes minutes, not days.',
    source: 'BCI roll · 2026',
  },
];

const FACT_ACCENT = {
  amber: {
    band: 'from-amber-100 via-amber-50 to-white',
    tile: 'bg-amber-500 text-white',
    pill: 'bg-amber-100 text-amber-800',
    stat: 'text-amber-700',
  },
  teal: {
    band: 'from-teal-100 via-teal-50 to-white',
    tile: 'bg-teal-500 text-white',
    pill: 'bg-teal-100 text-teal-800',
    stat: 'text-teal-700',
  },
};

function Stars() {
  return (
    <span className="flex">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
      ))}
    </span>
  );
}

function TestimonialCard({ item }) {
  const { t } = useLanguage();
  return (
    <div className="group relative flex w-[20rem] flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-glow-cyan sm:w-[24rem]">
      <Quote
        className="absolute right-5 top-5 h-12 w-12 text-amber-100"
        aria-hidden="true"
      />
      <Stars />
      <p className="relative mt-4 text-sm leading-relaxed text-slate-700">
        “{t(item.quoteKey)}”
      </p>
      <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
        <span className="h-11 w-11 overflow-hidden rounded-full bg-gradient-to-br from-amber-500 to-amber-600 ring-2 ring-teal-100">
          <img
            src={`https://i.pravatar.cc/120?img=${item.img}`}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">{item.name}</p>
          <p className="text-xs text-slate-500">{item.role}</p>
        </div>
      </div>
    </div>
  );
}

function MarqueeRow({ items, reverse = false }) {
  // Duplicate the items so the -50% marquee loop is seamless.
  const loop = [...items, ...items];
  return (
    <div className="overflow-hidden">
      <div
        className={`pause-on-hover flex w-max gap-6 px-3 animate-marquee ${
          reverse ? '[animation-direction:reverse]' : ''
        }`}
      >
        {loop.map((item, i) => (
          <TestimonialCard key={`${item.name}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function TestimonialsSection() {
  const { t } = useLanguage();
  const half = Math.ceil(TESTIMONIALS.length / 2);
  const rowOne = TESTIMONIALS.slice(0, half);
  const rowTwo = TESTIMONIALS.slice(half);

  return (
    <section className="overflow-hidden bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-200">
            <MessageSquareQuote className="h-3.5 w-3.5" />
            {t('testimonials.eyebrow')}
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t('testimonials.heading')}
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            {t('testimonials.subtext')}
          </p>
        </div>
      </div>

      {/* Fun-fact cards + Facebook page widget in the 3-up row. */}
      <div className="mx-auto mt-14 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-3">
          <FacebookPageCard />
          {FUN_FACTS.map((f) => {
            const a = FACT_ACCENT[f.accent] || FACT_ACCENT.amber;
            const Icon = f.icon;
            return (
              <div
                key={f.headline}
                className={`group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${a.band} shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-glow-cyan`}
              >
                <div className="flex items-center justify-between px-5 pt-5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest ${a.pill}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {f.tag}
                  </span>
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-xl shadow-sm ${a.tile}`}
                  >
                    <TrendingUp className="h-4 w-4" />
                  </span>
                </div>
                <div className="px-5 pb-5 pt-4">
                  <p
                    className={`text-4xl font-extrabold leading-none tracking-tight sm:text-5xl ${a.stat}`}
                  >
                    {f.stat}
                  </p>
                  <p className="mt-3 text-sm font-semibold leading-snug text-slate-900">
                    {f.headline}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    {f.body}
                  </p>
                </div>
                <div className="mt-auto border-t border-white/60 bg-white/60 px-5 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    {f.source}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto-scrolling testimonial marquees (opposite directions) */}
      <div className="group relative mt-14 space-y-6">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-slate-50 to-transparent sm:w-32"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-slate-50 to-transparent sm:w-32"
          aria-hidden="true"
        />
        <MarqueeRow items={rowOne} />
        <MarqueeRow items={rowTwo} reverse />
      </div>
    </section>
  );
}

// FacebookPageCard — just the Facebook Page Plugin iframe inside a
// card whose chrome matches the sibling video / audio cards. No
// header, no buttons, no custom copy; the embed itself shows the page
// cover, name, follow CTA and recent posts.
function FacebookPageCard() {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-glow-cyan">
      {/* Floating tag — sits over the iframe's top-left corner the same
          way the "Video" / "Audio" pills sit on the sibling cards.
          Slightly elevated z-index + pointer-events-none so the iframe
          stays fully interactive underneath. */}
      <span className="pointer-events-none absolute right-3 top-[20%] z-10 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-glow-sm">
        <Heart className="h-3.5 w-3.5 fill-white" />
        Happy Customers on Facebook
      </span>
      <iframe
        src={FB_PAGE_PLUGIN_URL}
        title="Profirmo on Facebook"
        width="500"
        height="280"
        style={{ border: 'none', overflow: 'hidden', width: '100%', display: 'block' }}
        scrolling="no"
        frameBorder="0"
        allow="encrypted-media"
        loading="lazy"
      />
    </div>
  );
}
