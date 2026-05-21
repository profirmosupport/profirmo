'use client';

import { Star, Quote, Play, Video, Mic, MessageSquareQuote } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

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

const MEDIA_REVIEWS = [
  {
    img: 8,
    name: 'Priyanka Rao',
    outcomeKey: 'testimonials.media1Outcome',
    typeKey: 'testimonials.media1Type',
    icon: Video,
  },
  {
    img: 24,
    name: 'Imran Sheikh',
    outcomeKey: 'testimonials.media2Outcome',
    typeKey: 'testimonials.media2Type',
    icon: Mic,
  },
  {
    img: 53,
    name: 'Lakshmi Menon',
    outcomeKey: 'testimonials.media3Outcome',
    typeKey: 'testimonials.media3Type',
    icon: Video,
  },
];

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

      {/* Video / audio reviews */}
      <div className="mx-auto mt-14 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-3">
          {MEDIA_REVIEWS.map(({ img, name, outcomeKey, typeKey, icon: Icon }) => (
            <div
              key={name}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-glow-cyan"
            >
              <div className="relative h-44 overflow-hidden bg-gradient-to-br from-amber-500 to-amber-600">
                <img
                  src={`https://i.pravatar.cc/400?img=${img}`}
                  alt={t('testimonials.reviewAlt', { name })}
                  loading="lazy"
                  className="h-full w-full object-cover opacity-90 transition group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent" />
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 backdrop-blur">
                  <Icon className="h-3.5 w-3.5 text-amber-600" />
                  {t(typeKey)}
                </span>
                <button
                  type="button"
                  aria-label={t('testimonials.playReview', { name })}
                  className="absolute inset-0 grid place-items-center"
                >
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-amber-600 to-amber-500 text-white shadow-glow transition group-hover:scale-110">
                    <Play className="h-6 w-6 translate-x-0.5 fill-white" />
                  </span>
                </button>
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold text-slate-900">{name}</p>
                <p className="mt-1 text-xs text-slate-600">{t(outcomeKey)}</p>
              </div>
            </div>
          ))}
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
