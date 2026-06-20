// Hindi-language version of /services/gst-consultation.
// Marked with hreflang in the parent metadata; a "Read in English" toggle
// in the hero links back to the English page. Translation is editorial,
// not auto-generated.

import Link from 'next/link';
import { Sparkles, Users, MapPin, HelpCircle } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import LeadGenFloater from '@/components/common/LeadGenFloater';
import { TOP_CITIES } from '@/data/serviceLandings';

const SITE_URL = 'https://profirmo.com';

export const metadata = {
  title: 'भारत में GST परामर्श: 2026 की संपूर्ण मार्गदर्शिका · Pro Firmo',
  description:
    'भारतीय व्यवसायों के लिए GST का पूरा परिचय — पंजीकरण, रिटर्न, ऑडिट, नोटिस, और रिफंड। हर चरण के लिए चेकलिस्ट के साथ सरल हिंदी में।',
  keywords:
    'GST परामर्श, GST पंजीकरण, GSTR-1 GSTR-3B, GST नोटिस जवाब, ITC, इनपुट टैक्स क्रेडिट, GST रिफंड',
  alternates: {
    canonical: '/hi/services/gst-consultation',
    languages: {
      'en-IN': '/services/gst-consultation',
      'hi-IN': '/hi/services/gst-consultation',
      'x-default': '/services/gst-consultation',
    },
  },
  openGraph: {
    title: 'भारत में GST परामर्श · Pro Firmo',
    description: 'GST का पूरा परिचय हिंदी में — पंजीकरण से लेकर नोटिस तक।',
    locale: 'hi_IN',
    url: `${SITE_URL}/hi/services/gst-consultation`,
    type: 'website',
  },
};

const FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  inLanguage: 'hi-IN',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'क्या मुझे GST पंजीकरण कराना ज़रूरी है?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'हाँ — यदि आपका टर्नओवर ₹40 लाख (सामान) या ₹20 लाख (सेवाएँ) से अधिक है। विशेष-श्रेणी राज्यों में थ्रेशोल्ड आधा है। अंतर-राज्यीय आपूर्ति, ई-कॉमर्स बिक्री, या रिवर्स-चार्ज आपूर्ति होने पर टर्नओवर के बावजूद पंजीकरण ज़रूरी है।',
      },
    },
    {
      '@type': 'Question',
      name: 'QRMP योजना क्या है?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Quarterly Return Monthly Payment — ₹5 करोड़ तक के टर्नओवर वाले व्यवसायों के लिए। GST मासिक भरें (चालान या निश्चित राशि), GSTR-1 तिमाही दाख़िल करें। SMEs के लिए फ़ाइलिंग का बोझ कम होता है।',
      },
    },
    {
      '@type': 'Question',
      name: 'क्या मैं ITC तब क्लेम कर सकता हूँ जब मेरे आपूर्तिकर्ता ने GSTR-1 नहीं भरा?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'नहीं — आपके GSTR-2B से ITC का मिलान आवश्यक है। यदि आपूर्तिकर्ता आपका इनवॉइस रिपोर्ट नहीं करता, आप उस क्रेडिट का दावा नहीं कर सकते जब तक वे रिपोर्ट नहीं करते।',
      },
    },
    {
      '@type': 'Question',
      name: 'ITC का दावा करने की अंतिम तिथि क्या है?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'अगले वित्तीय वर्ष के 30 नवंबर तक, या वार्षिक रिटर्न दाख़िल करने की तिथि तक — जो भी पहले हो (§16(4))।',
      },
    },
  ],
};

export default function HindiGstConsultationPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
      />
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
          <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
            <Link
              href="/services/gst-consultation"
              hrefLang="en-IN"
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-200 hover:underline"
            >
              Read in English →
            </Link>
            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
              भारत में GST परामर्श: 2026 की संपूर्ण मार्गदर्शिका
            </h1>
            <p className="mt-4 max-w-3xl text-base text-slate-300 sm:text-lg">
              भारतीय व्यवसाय जिन्हें GST के बारे में जानने की ज़रूरत है — पंजीकरण,
              रिटर्न, ऑडिट, नोटिस, और रिफंड। हर चरण के लिए चेकलिस्ट के साथ।
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/home?intent=GST"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-500/30 hover:bg-amber-400"
              >
                <Sparkles size={16} />
                AI से पहले बात करें
              </Link>
              <Link
                href="/professionals?category=tax"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/10"
              >
                <Users size={16} />
                GST सलाहकार ब्राउज़ करें
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 leading-relaxed">
          <h2 className="text-base font-semibold uppercase tracking-widest text-slate-700">
            परिचय
          </h2>
          <p className="mt-3 text-slate-700">
            GST भारत की सबसे बड़ी अप्रत्यक्ष-कर व्यवस्था है — और सात साल बाद भी यह
            लगातार बदल रही है। हर बजट में संशोधन होते हैं, GST परिषद अपनी बैठकों
            में दर-संरचना और प्रक्रियाएँ बदलती है, और आपके क्षेत्रीय कार्यालय का
            अधिकारी किसी भी करदाता की तुलना में अधिक विवेकाधिकार रखता है।
          </p>

          <h2 className="mt-10 text-base font-semibold uppercase tracking-widest text-slate-700">
            GST पंजीकरण किसे कराना चाहिए
          </h2>
          <p className="mt-3 text-slate-700">
            भारत में GST पंजीकरण टर्नओवर सीमा के ऊपर अनिवार्य है, जो राज्य और
            आपूर्ति के प्रकार पर निर्भर करती है। केंद्रीय सीमाएँ हैं: ₹40 लाख
            (सामान, विशेष-श्रेणी राज्यों में ₹20 लाख) और ₹20 लाख (सेवाएँ,
            विशेष-श्रेणी राज्यों में ₹10 लाख)। अंतर-राज्यीय आपूर्ति, Amazon /
            Flipkart जैसे ई-कॉमर्स प्लेटफ़ॉर्म पर बिक्री, और कुछ रिवर्स-चार्ज
            आपूर्तियाँ टर्नओवर के बावजूद पंजीकरण आवश्यक बनाती हैं।
          </p>

          <h2 className="mt-10 text-base font-semibold uppercase tracking-widest text-slate-700">
            GST रिटर्न — व्यावहारिक कैलेंडर
          </h2>
          <p className="mt-3 text-slate-700">
            हर सामान्य करदाता दो रिटर्न दाख़िल करता है: GSTR-1 (बाहरी आपूर्ति) और
            GSTR-3B (सारांश रिटर्न और भुगतान)। GSTR-1 की देय तिथि: मासिक
            दाख़िलकर्ताओं के लिए अगले महीने की 11वीं, QRMP योजना के लिए तिमाही के
            बाद आने वाले महीने की 13वीं। GSTR-3B: योजना के बावजूद अगले महीने की
            20वीं (कुछ राज्यों के लिए 22 / 24)।
          </p>
          <p className="mt-3 text-slate-700">
            वार्षिक रिटर्न GSTR-9 की देय तिथि: अगले वित्तीय वर्ष की 31 दिसंबर,
            ₹2 करोड़ से अधिक टर्नओवर वालों के लिए। ₹5 करोड़ से अधिक वालों के लिए
            GSTR-9C समाधान आवश्यक है।
          </p>
          <p className="mt-3 text-slate-700">
            देर से दाख़िल करने पर §47 के तहत शुल्क: ₹50 प्रति दिन (₹25 CGST + ₹25
            SGST) सामान्य रिटर्न पर, अधिकतम ₹10,000 तक। निल रिटर्न: ₹20 प्रति
            दिन। §50 के तहत बकाया कर पर ब्याज: 18% प्रति वर्ष। ये जल्दी बढ़ते
            हैं — फ़ाइलिंग को स्वचालित करना या सलाहकार को संलग्न करना पहले देर वाले
            महीने में ही अपना खर्च निकाल लेता है।
          </p>

          <h2 className="mt-10 text-base font-semibold uppercase tracking-widest text-slate-700">
            Input Tax Credit (ITC) — असली इंजन
          </h2>
          <p className="mt-3 text-slate-700">
            ITC ही GST का हृदय है। आप ग्राहकों से आउटपुट कर वसूलते हैं, आपूर्तिकर्ताओं
            को इनपुट कर देते हैं, और सरकार को केवल अंतर भेजते हैं। यह तभी काम
            करता है जब आपके आपूर्तिकर्ता वास्तव में आपके GSTR-2B में दिखाई दें —
            क्योंकि §16 संशोधनों के बाद केवल 2B-मिलान वाली ITC ही दावा-योग्य है।
          </p>

          <h2 className="mt-10 text-base font-semibold uppercase tracking-widest text-slate-700">
            GST नोटिस — अनुभाग-वार मार्गदर्शिका
          </h2>
          <ul className="mt-3 space-y-2 text-slate-700">
            <li>
              <strong>§61</strong> — GSTR-3B और GSTR-1 या GSTR-2B के बीच मिलान न
              होना। आमतौर पर 30 दिनों के भीतर Form ASMT-11 में जवाब दें।
            </li>
            <li>
              <strong>§73</strong> — गैर-धोखाधड़ी का SCN: कम-भुगतान, गैर-भुगतान,
              या गलत ITC। 30 दिनों की जवाब-अवधि, जुर्माना कर का 10% या ₹10,000
              (जो अधिक हो)।
            </li>
            <li>
              <strong>§74</strong> — धोखाधड़ी का SCN: जानबूझकर ग़लत बयानी या
              छिपाव। 30 दिनों की जवाब-अवधि, जुर्माना कर का 100% तक।
            </li>
            <li>
              <strong>§65 / §66 / §67</strong> — ऑडिट, विशेष ऑडिट, तलाशी /
              ज़ब्ती। पहले दिन से GST प्रैक्टिशनर लेना समझदारी है।
            </li>
          </ul>

          <h2 className="mt-10 text-base font-semibold uppercase tracking-widest text-slate-700">
            GST रिफंड कब और कैसे
          </h2>
          <p className="mt-3 text-slate-700">
            सामान्य रिफंड श्रेणियाँ: (a) इलेक्ट्रॉनिक कैश लेजर का अतिशेष, (b)
            निर्यात (LUT / बॉन्ड तंत्र), (c) उलटी शुल्क संरचना (अनुपयोगी ITC का
            रिफंड), (d) SEZ को शून्य-दर वाली आपूर्ति। प्रक्रिया: Form RFD-01,
            अधिकारी RFD-02 में पावती जारी करता है, RFD-04 में 90% अनंतिम रिफंड
            (निर्यात के लिए 7 दिनों के भीतर — व्यवहार में ~30 दिन), RFD-06 में
            अंतिम आदेश 60 दिनों के भीतर। 60 दिनों के बाद विलंब पर 6% प्रति वर्ष
            ब्याज।
          </p>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center gap-2">
            <HelpCircle size={18} className="text-amber-600" />
            <h2 className="text-base font-semibold uppercase tracking-widest text-slate-700">
              अक्सर पूछे जाने वाले प्रश्न
            </h2>
          </div>
          <dl className="space-y-4">
            {FAQ_JSONLD.mainEntity.map((item) => (
              <div
                key={item.name}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <dt className="text-sm font-semibold text-slate-900">
                  {item.name}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-700">
                  {item.acceptedAnswer.text}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="bg-slate-100/60 py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="mb-4 flex items-center gap-2">
              <MapPin size={16} className="text-slate-600" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-700">
                शहर के अनुसार GST सलाहकार खोजें
              </h2>
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {TOP_CITIES.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/professionals/city/${c.slug}/gst-consultation`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-300 hover:text-amber-700"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
      <LeadGenFloater source="hi-gst-consultation" />
    </div>
  );
}
