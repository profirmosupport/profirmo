// Pro Firmo translation dictionary.
// Flat dotted keys. `t(key, vars)` looks up translations[lang][key].
// English is the fallback for any missing key.
// Homepage section keys (hero.*, search.*, stats.*, ...) are appended below.

export const translations = {
  en: {
    // --- Header / navigation ---
    'nav.professionals': 'Professionals',
    'nav.firms': 'Firms',
    'nav.eCourts': 'E-Courts India',
    'nav.blog': 'Blog',
    'nav.howItWorks': 'How it works',
    'nav.pricing': 'Pricing',
    'nav.contact': 'Contact',
    'nav.signIn': 'Sign in',
    'nav.getStarted': 'Get started',
    'nav.openMenu': 'Open menu',
    'nav.language': 'Language',

    // --- Footer ---
    'footer.about':
      'Pro Firmo is an AI-powered platform that connects you with verified advocates, lawyers, legal firms and tax consultants. Describe your case, get matched in minutes and consult online with complete confidence.',
    'footer.newsletterTitle': 'Get legal & tax updates',
    'footer.newsletterText': 'Product news and expert tips — no spam.',
    'footer.emailPlaceholder': 'you@email.com',
    'footer.subscribe': 'Subscribe',
    'footer.colCompany': 'Company',
    'footer.colExplore': 'Explore',
    'footer.colProfessionals': 'For professionals',
    'footer.linkAbout': 'About us',
    'footer.linkHowItWorks': 'How it works',
    'footer.linkPricing': 'Pricing',
    'footer.linkContact': 'Contact us',
    'footer.linkProfessionals': 'Find professionals',
    'footer.linkFirms': 'Browse firms',
    'footer.linkSearch': 'Advanced search',
    'footer.linkJoinPro': 'Join as a professional',
    'footer.linkRegisterFirm': 'Register your firm',
    'footer.linkLogin': 'Sign in',
    'footer.linkTerms': 'Terms & Conditions',
    'footer.linkPrivacy': 'Privacy Policy',
    'footer.cityTitle': 'Find legal & tax experts across India',
    'footer.cityIntro':
      'Connect with verified lawyers and tax consultants in major Indian cities.',
    'footer.lawyersIn': 'Lawyers in {city}',
    'footer.taxIn': 'Tax consultants in {city}',
    'footer.rights': 'All rights reserved.',
    'footer.disclaimer':
      'Pro Firmo is a technology platform and does not itself provide legal or tax advice.',

    // --- Not found / 404 page ---
    'notFound.code': '404',
    'notFound.title': 'We couldn’t find that page',
    'notFound.desc':
      'The page you’re looking for has moved, expired or never existed. Try searching for a professional, or jump back to one of the popular sections below.',
    'notFound.searchPlaceholder': 'Search lawyers, tax consultants, cities…',
    'notFound.searchCta': 'Search',
    'notFound.backHome': 'Back to home',
    'notFound.findPros': 'Find professionals',
    'notFound.browseFirms': 'Browse firms',
    'notFound.popular': 'Popular destinations',

    // --- Cities ---
    'city.Mumbai': 'Mumbai',
    'city.Delhi': 'Delhi',
    'city.Bangalore': 'Bangalore',
    'city.Pune': 'Pune',
    'city.Hyderabad': 'Hyderabad',
    'city.Chennai': 'Chennai',
    'city.Kolkata': 'Kolkata',
    'city.Ahmedabad': 'Ahmedabad',
    'city.Jaipur': 'Jaipur',
    'city.Lucknow': 'Lucknow',
    'city.Gautam Budh Nagar': 'Gautam Budh Nagar',

    // --- Hero section ---
    'hero.eyebrow': 'AI-powered consultation matching',
    'hero.headingLead': 'Explain your case to AI. Get matched with',
    'hero.headingHighlight': 'the right expert.',
    'hero.subtext':
      'AI-powered legal and tax consultation, matched with the right professional in minutes. Describe your issue in plain language — our AI guides you to a verified lawyer, advocate or tax expert.',
    'hero.inputPlaceholder': 'Describe your legal or tax issue…',
    'hero.inputAria': 'Describe your legal or tax issue',
    'hero.matchButton': 'Match me with AI',
    'hero.browseLink': 'or browse all consultants',
    'hero.trustHeadline': 'Trusted by 10,000+ clients',
    'hero.trustAvatarAlt': 'Pro Firmo client',
    'hero.framedAlt': 'Verified legal and tax consultants at work',
    'hero.framedCaption': 'Verified experts, near you',
    'hero.assistantName': 'Pro Firmo Assistant',
    'hero.assistantOnline': 'Online now',
    'hero.chatUser': 'I need help with a property dispute with my builder.',
    'hero.chatBotLead': "Got it — that's a civil property matter. I found",
    'hero.chatBotMatch': '3 verified property lawyers',
    'hero.chatBotTail': 'near you.',
    'hero.verifiedNote': 'All matches are verified, vetted professionals.',

    // --- Search section ---
    'search.eyebrow': 'Search professionals',
    'search.headingLead': 'Find the right',
    'search.headingHighlight': 'legal or tax expert',
    'search.subtext':
      'Search verified professionals by keyword, profession and city — and book a consultation in minutes.',
    'search.keywordPlaceholder': 'Keyword, name or specialization',
    'search.keywordAria': 'Search keyword',
    'search.professionAria': 'Profession',
    'search.allProfessions': 'All professions',
    'search.cityAria': 'City',
    'search.allCities': 'All cities',
    'search.button': 'Search',
    'search.popular': 'Popular:',

    // --- Stats section ---
    'stats.panelTitle': 'Platform analytics',
    'stats.panelStatus': 'Live · updated continuously',
    'stats.growthBadge': 'Growth trending up',
    'stats.verifiedConsultants': 'Verified consultants',
    'stats.verifiedTrend': '+18% this month',
    'stats.aiMatches': 'AI matches made',
    'stats.aiMatchesTrend': '+24% this month',
    'stats.avgRating': 'Average client rating',
    'stats.avgRatingTrend': '+0.2 vs last quarter',
    'stats.avgMatchTime': 'Average match time',
    'stats.avgMatchTimeTrend': '32% faster',

    // --- Category section ---
    'category.eyebrow': 'Areas of expertise',
    'category.heading': 'Browse by area of expertise',
    'category.subtext':
      'Whatever your legal or tax need, our AI connects you with a specialist who has handled cases like yours.',
    'category.tagLegal': 'Legal',
    'category.tagTax': 'Tax',

    // --- Smart matching section ---
    'smartMatching.eyebrow': 'How matching works',
    'smartMatching.headingLead': 'Smart matching,',
    'smartMatching.headingHighlight': 'powered by AI',
    'smartMatching.subtext':
      'Three steps from a confusing problem to the right professional.',
    'smartMatching.step1Title': 'Describe your case',
    'smartMatching.step1Desc':
      'Tell the AI what happened in plain language — no legal jargon, no forms. Just your situation in your own words.',
    'smartMatching.step2Title': 'AI analyzes & understands',
    'smartMatching.step2Desc':
      'Our AI identifies the area of law or tax, gauges the urgency, and figures out which documents you will need.',
    'smartMatching.step3Title': 'Get matched instantly',
    'smartMatching.step3Desc':
      'Receive a ranked shortlist of verified experts best suited to your case — with ratings, rates and availability.',

    // --- AI assistant section ---
    'aiAssistant.eyebrow': 'Your AI assistant',
    'aiAssistant.headingLead': 'Meet your AI',
    'aiAssistant.headingHighlight': 'legal & tax assistant',
    'aiAssistant.subtext':
      'More than a chatbot — a guide that understands your case and connects you to the right verified professional.',
    'aiAssistant.assistantName': 'Pro Firmo Assistant',
    'aiAssistant.assistantStatus': 'Analyzing your case',
    'aiAssistant.analyzing': 'AI is analyzing your case…',
    'aiAssistant.chipVerified': 'Verified match',
    'aiAssistant.chipExperts': '3 experts found',
    'aiAssistant.chatUser':
      'I missed my GST filing deadline last quarter and now there is a penalty. What should I do?',
    'aiAssistant.chatBot1':
      'Understood — this is a GST late-filing matter. You can still file with a late fee. Here is what you will need:',
    'aiAssistant.checklist1': 'GSTR-3B for the late period',
    'aiAssistant.checklist2': 'GST registration certificate',
    'aiAssistant.checklist3': 'Bank statement of filing month',
    'aiAssistant.chatBot2Lead': 'I matched you with',
    'aiAssistant.chatBot2Match': '3 verified GST consultants',
    'aiAssistant.feature1Title': 'Understands plain-language cases',
    'aiAssistant.feature1Desc':
      'Speak naturally. The AI interprets your situation without you knowing any legal terms.',
    'aiAssistant.feature2Title': 'Suggests the documents you will need',
    'aiAssistant.feature2Desc':
      'Get a tailored checklist so you walk into your consultation fully prepared.',
    'aiAssistant.feature3Title': 'Explains your options in simple terms',
    'aiAssistant.feature3Desc':
      'Understand the likely paths, timelines and costs before you commit.',
    'aiAssistant.feature4Title': 'Matches you only with verified experts',
    'aiAssistant.feature4Desc':
      'Every recommended professional is identity-verified and credential-checked.',
    'aiAssistant.cta': 'Start with the AI assistant',

    // --- How it works section ---
    'howItWorks.eyebrow': 'Simple process',
    'howItWorks.heading': 'How Pro Firmo works',
    'howItWorks.subtext':
      'From a confusing problem to a resolved matter — in four clear steps.',
    'howItWorks.step1Title': 'Explain your case to AI',
    'howItWorks.step1Desc':
      'Describe your legal or tax issue in plain words. No forms, no jargon.',
    'howItWorks.step2Title': 'Review your AI-matched consultants',
    'howItWorks.step2Desc':
      'See a ranked shortlist of verified experts picked specifically for your case.',
    'howItWorks.step3Title': 'Book a consultation that suits you',
    'howItWorks.step3Desc':
      'Choose an instant call or schedule a time — transparent per-minute pricing.',
    'howItWorks.step4Title': 'Talk online & resolve your matter',
    'howItWorks.step4Desc':
      'Connect over a secure call, share documents and get clear, actionable advice.',
    'howItWorks.consultantAlt': 'Verified Pro Firmo consultant ready to help',
    'howItWorks.consultantName': 'Anjali Desai',
    'howItWorks.consultantRole': 'Senior Legal Consultant',
    'howItWorks.consultantCaption':
      'Real consultants guide you at every step.',
    'howItWorks.consultantBadge': 'Verified expert',
    'howItWorks.teamLabel': 'Live consultants online now',

    // --- Featured professionals section ---
    'featuredProfessionals.eyebrow': 'Verified marketplace',
    'featuredProfessionals.heading': 'Top verified consultants',
    'featuredProfessionals.subtext':
      'Hand-picked experts our clients rate the highest — all identity-verified.',
    'featuredProfessionals.viewAll': 'View all',
    'featuredProfessionals.viewProfile': 'View profile',
    'featuredProfessionals.book': 'Book',

    // --- Featured firms section ---
    'featuredFirms.eyebrow': 'Established practices',
    'featuredFirms.heading': 'Trusted legal & tax firms',
    'featuredFirms.subtext':
      'Full-service firms with vetted teams of specialists, ready to take on complex matters.',
    'featuredFirms.professionals': 'professionals',
    'featuredFirms.viewFirm': 'View firm',

    // --- Dashboard preview section ---
    'dashboardPreview.eyebrow': 'Client dashboard',
    'dashboardPreview.headingLead': 'Everything you need in one',
    'dashboardPreview.headingHighlight': 'intelligent dashboard',
    'dashboardPreview.subtext':
      'Track cases, manage bookings and review AI-summarised consultations — all in a single, polished workspace.',
    'dashboardPreview.navOverview': 'Overview',
    'dashboardPreview.navCases': 'My cases',
    'dashboardPreview.navBookings': 'Bookings',
    'dashboardPreview.navMessages': 'Messages',
    'dashboardPreview.navSettings': 'Settings',
    'dashboardPreview.welcome': 'Welcome back, Aanya',
    'dashboardPreview.welcomeSub': 'Here is your case overview',
    'dashboardPreview.live': 'Live',
    'dashboardPreview.tileActiveCases': 'Active cases',
    'dashboardPreview.tileUpcoming': 'Upcoming',
    'dashboardPreview.tileSpent': 'Spent',
    'dashboardPreview.tileConsultants': 'Consultants',
    'dashboardPreview.activityTitle': 'Consultation activity',
    'dashboardPreview.recentCases': 'Recent cases',
    'dashboardPreview.case1': 'Property dispute review',
    'dashboardPreview.case1Tag': 'In progress',
    'dashboardPreview.case2': 'GST late-filing consult',
    'dashboardPreview.case2Tag': 'Completed',
    'dashboardPreview.case3': 'Rental agreement draft',
    'dashboardPreview.case3Tag': 'Scheduled',
    'dashboardPreview.cardResolved': 'Case resolved',
    'dashboardPreview.cardResolvedTime': '2 minutes ago',
    'dashboardPreview.cardMatchScore': 'Match score 98%',
    'dashboardPreview.cardConfidence': 'AI confidence',
    'dashboardPreview.perk1': 'Real-time case tracking',
    'dashboardPreview.perk2': 'AI-summarised consultations',
    'dashboardPreview.perk3': 'Secure document vault',

    // --- Testimonials section ---
    'testimonials.eyebrow': 'Social proof',
    'testimonials.heading': 'Customer success stories',
    'testimonials.subtext':
      'Real outcomes from people who let AI find them the right expert.',
    'testimonials.quote1':
      'I described my GST notice in plain English and within minutes the AI matched me with a consultant who fixed everything. No jargon, no stress.',
    'testimonials.quote2':
      'Pro Firmo paired me with a corporate lawyer who understood early-stage companies. The match quality genuinely felt hand-picked.',
    'testimonials.quote3':
      'I was nervous about a property dispute. The AI explained my options simply and connected me to a verified property lawyer the same day.',
    'testimonials.quote4':
      'Filing my income tax used to be a nightmare. The AI built a document checklist and found me an affordable tax expert in 10 minutes.',
    'testimonials.quote5':
      'The matched advocate handled my labour dispute end to end. Transparent per-minute pricing meant zero surprises on cost.',
    'testimonials.quote6':
      'Company registration felt overwhelming until Pro Firmo matched me with the right consultant. Done within a week.',
    'testimonials.media1Outcome': 'Resolved a divorce settlement in record time.',
    'testimonials.media1Type': 'Video review',
    'testimonials.media2Outcome': 'Saved on penalties after a GST consultation.',
    'testimonials.media2Type': 'Audio review',
    'testimonials.media3Outcome': 'Found a trusted lawyer for a property matter.',
    'testimonials.media3Type': 'Video review',
    'testimonials.playReview': 'Play {name} review',
    'testimonials.reviewAlt': '{name} review',

    // --- CTA section ---
    'cta.eyebrow': 'Start in minutes',
    'cta.headingLead': 'Ready to get matched with the',
    'cta.headingHighlight': 'right expert?',
    'cta.subtext':
      'Explain your case to AI and get a verified legal or tax professional matched to you in minutes — fast, transparent and trustworthy.',
    'cta.getStarted': 'Get started free',
    'cta.joinPro': 'Join as a professional',
    'cta.note': 'No credit card required · Verified professionals only',
    'cta.bgAlt': 'Legal and tax professionals collaborating in a modern office',
    'cta.consultantAlt': 'Verified Pro Firmo consultant',
    'cta.consultantsBadge': 'Verified consultants online',
    'cta.consultantName': 'Rahul Mehta',
    'cta.consultantRole': 'Tax & Compliance Expert',
  },

  hi: {
    // --- Header / navigation ---
    'nav.professionals': 'प्रोफेशनल',
    'nav.firms': 'फर्म',
    'nav.eCourts': 'ई-कोर्ट्स इंडिया',
    'nav.blog': 'ब्लॉग',
    'nav.howItWorks': 'यह कैसे काम करता है',
    'nav.pricing': 'मूल्य निर्धारण',
    'nav.contact': 'संपर्क',
    'nav.signIn': 'साइन इन',
    'nav.getStarted': 'शुरू करें',
    'nav.openMenu': 'मेन्यू खोलें',
    'nav.language': 'भाषा',

    // --- Footer ---
    'footer.about':
      'Pro Firmo एक एआई-आधारित प्लेटफ़ॉर्म है जो आपको सत्यापित अधिवक्ताओं, वकीलों, कानूनी फर्मों और कर सलाहकारों से जोड़ता है। अपना मामला बताइए, मिनटों में सही विशेषज्ञ से मिलान पाइए और पूरे भरोसे के साथ ऑनलाइन परामर्श कीजिए।',
    'footer.newsletterTitle': 'कानूनी और कर अपडेट पाएं',
    'footer.newsletterText': 'उत्पाद समाचार और विशेषज्ञ सुझाव — कोई स्पैम नहीं।',
    'footer.emailPlaceholder': 'you@email.com',
    'footer.subscribe': 'सदस्यता लें',
    'footer.colCompany': 'कंपनी',
    'footer.colExplore': 'खोजें',
    'footer.colProfessionals': 'प्रोफेशनल्स के लिए',
    'footer.linkAbout': 'हमारे बारे में',
    'footer.linkHowItWorks': 'यह कैसे काम करता है',
    'footer.linkPricing': 'मूल्य निर्धारण',
    'footer.linkContact': 'संपर्क करें',
    'footer.linkProfessionals': 'प्रोफेशनल खोजें',
    'footer.linkFirms': 'फर्म ब्राउज़ करें',
    'footer.linkSearch': 'उन्नत खोज',
    'footer.linkJoinPro': 'प्रोफेशनल के रूप में जुड़ें',
    'footer.linkRegisterFirm': 'अपनी फर्म पंजीकृत करें',
    'footer.linkLogin': 'साइन इन करें',
    'footer.linkTerms': 'नियम एवं शर्तें',
    'footer.linkPrivacy': 'गोपनीयता नीति',
    'footer.cityTitle': 'भारत भर में कानूनी और कर विशेषज्ञ खोजें',
    'footer.cityIntro':
      'भारत के प्रमुख शहरों में सत्यापित वकीलों और कर सलाहकारों से जुड़ें।',
    'footer.lawyersIn': '{city} में वकील',
    'footer.taxIn': '{city} में कर सलाहकार',
    'footer.rights': 'सर्वाधिकार सुरक्षित।',
    'footer.disclaimer':
      'Pro Firmo एक प्रौद्योगिकी मंच है और स्वयं कानूनी या कर सलाह प्रदान नहीं करता।',

    // --- Not found / 404 page ---
    'notFound.code': '404',
    'notFound.title': 'हमें वह पेज नहीं मिला',
    'notFound.desc':
      'जिस पेज को आप ढूंढ रहे हैं वह हटा दिया गया है, समाप्त हो गया है या कभी मौजूद नहीं था। किसी प्रोफेशनल को खोजें या नीचे दिए लोकप्रिय सेक्शन्स पर जाएं।',
    'notFound.searchPlaceholder': 'वकील, कर सलाहकार, शहर खोजें…',
    'notFound.searchCta': 'खोजें',
    'notFound.backHome': 'होम पर वापस',
    'notFound.findPros': 'प्रोफेशनल खोजें',
    'notFound.browseFirms': 'फर्म ब्राउज़ करें',
    'notFound.popular': 'लोकप्रिय गंतव्य',

    // --- Cities ---
    'city.Mumbai': 'मुंबई',
    'city.Delhi': 'दिल्ली',
    'city.Bangalore': 'बेंगलुरु',
    'city.Pune': 'पुणे',
    'city.Hyderabad': 'हैदराबाद',
    'city.Chennai': 'चेन्नई',
    'city.Kolkata': 'कोलकाता',
    'city.Ahmedabad': 'अहमदाबाद',
    'city.Jaipur': 'जयपुर',
    'city.Lucknow': 'लखनऊ',
    'city.Gautam Budh Nagar': 'गौतम बुद्ध नगर',

    // --- Hero section ---
    'hero.eyebrow': 'एआई-आधारित परामर्श मिलान',
    'hero.headingLead': 'अपना मामला एआई को बताइए और मिलान पाइए',
    'hero.headingHighlight': 'सही विशेषज्ञ से।',
    'hero.subtext':
      'एआई-आधारित कानूनी और कर परामर्श, जो मिनटों में आपको सही प्रोफेशनल से जोड़ता है। अपनी समस्या सरल भाषा में बताइए — हमारी एआई आपको सत्यापित वकील, अधिवक्ता या कर विशेषज्ञ तक पहुँचाती है।',
    'hero.inputPlaceholder': 'अपनी कानूनी या कर समस्या बताइए…',
    'hero.inputAria': 'अपनी कानूनी या कर समस्या बताइए',
    'hero.matchButton': 'एआई से मिलान कराएं',
    'hero.browseLink': 'या सभी सलाहकार देखें',
    'hero.trustHeadline': '10,000+ ग्राहकों का भरोसा',
    'hero.trustAvatarAlt': 'Pro Firmo ग्राहक',
    'hero.framedAlt': 'काम करते हुए सत्यापित कानूनी और कर सलाहकार',
    'hero.framedCaption': 'सत्यापित विशेषज्ञ, आपके पास',
    'hero.assistantName': 'Pro Firmo असिस्टेंट',
    'hero.assistantOnline': 'अभी ऑनलाइन',
    'hero.chatUser': 'मुझे अपने बिल्डर के साथ संपत्ति विवाद में मदद चाहिए।',
    'hero.chatBotLead': 'समझ गया — यह एक दीवानी संपत्ति मामला है। मुझे मिले',
    'hero.chatBotMatch': '3 सत्यापित संपत्ति वकील',
    'hero.chatBotTail': 'आपके पास।',
    'hero.verifiedNote': 'सभी मिलान सत्यापित और जाँचे-परखे प्रोफेशनल हैं।',

    // --- Search section ---
    'search.eyebrow': 'प्रोफेशनल खोजें',
    'search.headingLead': 'सही चुनें',
    'search.headingHighlight': 'कानूनी या कर विशेषज्ञ',
    'search.subtext':
      'कीवर्ड, पेशे और शहर के अनुसार सत्यापित प्रोफेशनल खोजें — और मिनटों में परामर्श बुक करें।',
    'search.keywordPlaceholder': 'कीवर्ड, नाम या विशेषज्ञता',
    'search.keywordAria': 'खोज कीवर्ड',
    'search.professionAria': 'पेशा',
    'search.allProfessions': 'सभी पेशे',
    'search.cityAria': 'शहर',
    'search.allCities': 'सभी शहर',
    'search.button': 'खोजें',
    'search.popular': 'लोकप्रिय:',

    // --- Stats section ---
    'stats.panelTitle': 'प्लेटफ़ॉर्म विश्लेषण',
    'stats.panelStatus': 'लाइव · निरंतर अपडेट होता हुआ',
    'stats.growthBadge': 'वृद्धि ऊपर की ओर',
    'stats.verifiedConsultants': 'सत्यापित सलाहकार',
    'stats.verifiedTrend': 'इस माह +18%',
    'stats.aiMatches': 'किए गए एआई मिलान',
    'stats.aiMatchesTrend': 'इस माह +24%',
    'stats.avgRating': 'औसत ग्राहक रेटिंग',
    'stats.avgRatingTrend': 'पिछली तिमाही से +0.2',
    'stats.avgMatchTime': 'औसत मिलान समय',
    'stats.avgMatchTimeTrend': '32% तेज़',

    // --- Category section ---
    'category.eyebrow': 'विशेषज्ञता के क्षेत्र',
    'category.heading': 'विशेषज्ञता के क्षेत्र के अनुसार ब्राउज़ करें',
    'category.subtext':
      'आपकी कानूनी या कर ज़रूरत जो भी हो, हमारी एआई आपको ऐसे विशेषज्ञ से जोड़ती है जिसने आपके जैसे मामले संभाले हैं।',
    'category.tagLegal': 'कानूनी',
    'category.tagTax': 'कर',

    // --- Smart matching section ---
    'smartMatching.eyebrow': 'मिलान कैसे काम करता है',
    'smartMatching.headingLead': 'स्मार्ट मिलान,',
    'smartMatching.headingHighlight': 'एआई द्वारा संचालित',
    'smartMatching.subtext':
      'एक उलझी समस्या से सही प्रोफेशनल तक — तीन चरणों में।',
    'smartMatching.step1Title': 'अपना मामला बताइए',
    'smartMatching.step1Desc':
      'एआई को सरल भाषा में बताइए कि क्या हुआ — कोई कानूनी शब्दजाल नहीं, कोई फ़ॉर्म नहीं। बस अपनी स्थिति अपने शब्दों में।',
    'smartMatching.step2Title': 'एआई विश्लेषण व समझ',
    'smartMatching.step2Desc':
      'हमारी एआई कानून या कर का क्षेत्र पहचानती है, तात्कालिकता आँकती है और बताती है कि आपको कौन-से दस्तावेज़ चाहिए होंगे।',
    'smartMatching.step3Title': 'तुरंत मिलान पाइए',
    'smartMatching.step3Desc':
      'अपने मामले के लिए सबसे उपयुक्त सत्यापित विशेषज्ञों की रैंक की हुई सूची पाइए — रेटिंग, दरों और उपलब्धता के साथ।',

    // --- AI assistant section ---
    'aiAssistant.eyebrow': 'आपका एआई असिस्टेंट',
    'aiAssistant.headingLead': 'मिलिए अपने एआई',
    'aiAssistant.headingHighlight': 'कानूनी व कर असिस्टेंट से',
    'aiAssistant.subtext':
      'सिर्फ़ एक चैटबॉट से कहीं अधिक — एक मार्गदर्शक जो आपका मामला समझता है और आपको सही सत्यापित प्रोफेशनल से जोड़ता है।',
    'aiAssistant.assistantName': 'Pro Firmo असिस्टेंट',
    'aiAssistant.assistantStatus': 'आपके मामले का विश्लेषण कर रहा है',
    'aiAssistant.analyzing': 'एआई आपके मामले का विश्लेषण कर रही है…',
    'aiAssistant.chipVerified': 'सत्यापित मिलान',
    'aiAssistant.chipExperts': '3 विशेषज्ञ मिले',
    'aiAssistant.chatUser':
      'मैंने पिछली तिमाही में अपनी जीएसटी फाइलिंग की समय-सीमा चूक गई और अब जुर्माना लगा है। मुझे क्या करना चाहिए?',
    'aiAssistant.chatBot1':
      'समझ गया — यह जीएसटी देर से फाइलिंग का मामला है। आप विलंब शुल्क के साथ अब भी फाइल कर सकते हैं। आपको यह चाहिए होगा:',
    'aiAssistant.checklist1': 'देरी की अवधि के लिए GSTR-3B',
    'aiAssistant.checklist2': 'जीएसटी पंजीकरण प्रमाणपत्र',
    'aiAssistant.checklist3': 'फाइलिंग माह का बैंक विवरण',
    'aiAssistant.chatBot2Lead': 'मैंने आपका मिलान कराया',
    'aiAssistant.chatBot2Match': '3 सत्यापित जीएसटी सलाहकारों से',
    'aiAssistant.feature1Title': 'सरल भाषा में बताए मामले समझता है',
    'aiAssistant.feature1Desc':
      'स्वाभाविक रूप से बात कीजिए। एआई आपकी स्थिति समझ लेती है, भले ही आपको कोई कानूनी शब्द न आता हो।',
    'aiAssistant.feature2Title': 'ज़रूरी दस्तावेज़ों का सुझाव देता है',
    'aiAssistant.feature2Desc':
      'एक अनुकूलित चेकलिस्ट पाइए ताकि आप पूरी तैयारी के साथ अपने परामर्श में पहुँचें।',
    'aiAssistant.feature3Title': 'आपके विकल्प सरल शब्दों में समझाता है',
    'aiAssistant.feature3Desc':
      'प्रतिबद्ध होने से पहले संभावित रास्ते, समय-सीमा और लागत समझिए।',
    'aiAssistant.feature4Title': 'केवल सत्यापित विशेषज्ञों से मिलान करता है',
    'aiAssistant.feature4Desc':
      'हर अनुशंसित प्रोफेशनल पहचान-सत्यापित और प्रमाण-पत्र जाँचा हुआ है।',
    'aiAssistant.cta': 'एआई असिस्टेंट से शुरू करें',

    // --- How it works section ---
    'howItWorks.eyebrow': 'सरल प्रक्रिया',
    'howItWorks.heading': 'Pro Firmo कैसे काम करता है',
    'howItWorks.subtext':
      'एक उलझी समस्या से सुलझे मामले तक — चार स्पष्ट चरणों में।',
    'howItWorks.step1Title': 'अपना मामला एआई को बताइए',
    'howItWorks.step1Desc':
      'अपनी कानूनी या कर समस्या सरल शब्दों में बताइए। कोई फ़ॉर्म नहीं, कोई शब्दजाल नहीं।',
    'howItWorks.step2Title': 'अपने एआई-मिलान सलाहकार देखें',
    'howItWorks.step2Desc':
      'अपने मामले के लिए विशेष रूप से चुने गए सत्यापित विशेषज्ञों की रैंक की हुई सूची देखें।',
    'howItWorks.step3Title': 'अपनी सुविधा का परामर्श बुक करें',
    'howItWorks.step3Desc':
      'तुरंत कॉल चुनें या समय निर्धारित करें — पारदर्शी प्रति-मिनट मूल्य निर्धारण।',
    'howItWorks.step4Title': 'ऑनलाइन बात करें व मामला सुलझाएं',
    'howItWorks.step4Desc':
      'सुरक्षित कॉल पर जुड़ें, दस्तावेज़ साझा करें और स्पष्ट, व्यावहारिक सलाह पाएं।',
    'howItWorks.consultantAlt': 'मदद के लिए तैयार सत्यापित Pro Firmo सलाहकार',
    'howItWorks.consultantName': 'अंजली देसाई',
    'howItWorks.consultantRole': 'वरिष्ठ कानूनी सलाहकार',
    'howItWorks.consultantCaption':
      'असली सलाहकार हर चरण में आपका मार्गदर्शन करते हैं।',
    'howItWorks.consultantBadge': 'सत्यापित विशेषज्ञ',
    'howItWorks.teamLabel': 'अभी ऑनलाइन लाइव सलाहकार',

    // --- Featured professionals section ---
    'featuredProfessionals.eyebrow': 'सत्यापित मार्केटप्लेस',
    'featuredProfessionals.heading': 'शीर्ष सत्यापित सलाहकार',
    'featuredProfessionals.subtext':
      'हमारे ग्राहकों द्वारा सर्वोच्च रेटिंग पाए चुनिंदा विशेषज्ञ — सभी पहचान-सत्यापित।',
    'featuredProfessionals.viewAll': 'सभी देखें',
    'featuredProfessionals.viewProfile': 'प्रोफ़ाइल देखें',
    'featuredProfessionals.book': 'बुक करें',

    // --- Featured firms section ---
    'featuredFirms.eyebrow': 'स्थापित प्रैक्टिस',
    'featuredFirms.heading': 'भरोसेमंद कानूनी व कर फर्म',
    'featuredFirms.subtext':
      'जाँची-परखी विशेषज्ञ टीमों वाली पूर्ण-सेवा फर्म, जटिल मामले संभालने के लिए तैयार।',
    'featuredFirms.professionals': 'प्रोफेशनल',
    'featuredFirms.viewFirm': 'फर्म देखें',

    // --- Dashboard preview section ---
    'dashboardPreview.eyebrow': 'ग्राहक डैशबोर्ड',
    'dashboardPreview.headingLead': 'जो कुछ आपको चाहिए, सब एक',
    'dashboardPreview.headingHighlight': 'बुद्धिमान डैशबोर्ड में',
    'dashboardPreview.subtext':
      'मामले ट्रैक करें, बुकिंग प्रबंधित करें और एआई-सारांशित परामर्श देखें — सब एक ही परिष्कृत वर्कस्पेस में।',
    'dashboardPreview.navOverview': 'अवलोकन',
    'dashboardPreview.navCases': 'मेरे मामले',
    'dashboardPreview.navBookings': 'बुकिंग',
    'dashboardPreview.navMessages': 'संदेश',
    'dashboardPreview.navSettings': 'सेटिंग्स',
    'dashboardPreview.welcome': 'वापसी पर स्वागत है, आन्या',
    'dashboardPreview.welcomeSub': 'यह आपके मामलों का अवलोकन है',
    'dashboardPreview.live': 'लाइव',
    'dashboardPreview.tileActiveCases': 'सक्रिय मामले',
    'dashboardPreview.tileUpcoming': 'आगामी',
    'dashboardPreview.tileSpent': 'खर्च',
    'dashboardPreview.tileConsultants': 'सलाहकार',
    'dashboardPreview.activityTitle': 'परामर्श गतिविधि',
    'dashboardPreview.recentCases': 'हाल के मामले',
    'dashboardPreview.case1': 'संपत्ति विवाद समीक्षा',
    'dashboardPreview.case1Tag': 'प्रगति में',
    'dashboardPreview.case2': 'जीएसटी देर-फाइलिंग परामर्श',
    'dashboardPreview.case2Tag': 'पूर्ण',
    'dashboardPreview.case3': 'किराया अनुबंध मसौदा',
    'dashboardPreview.case3Tag': 'निर्धारित',
    'dashboardPreview.cardResolved': 'मामला सुलझा',
    'dashboardPreview.cardResolvedTime': '2 मिनट पहले',
    'dashboardPreview.cardMatchScore': 'मिलान स्कोर 98%',
    'dashboardPreview.cardConfidence': 'एआई विश्वास',
    'dashboardPreview.perk1': 'रीयल-टाइम मामला ट्रैकिंग',
    'dashboardPreview.perk2': 'एआई-सारांशित परामर्श',
    'dashboardPreview.perk3': 'सुरक्षित दस्तावेज़ वॉल्ट',

    // --- Testimonials section ---
    'testimonials.eyebrow': 'सामाजिक प्रमाण',
    'testimonials.heading': 'ग्राहकों की सफलता की कहानियाँ',
    'testimonials.subtext':
      'उन लोगों के असली परिणाम जिन्होंने एआई से अपने लिए सही विशेषज्ञ खोजा।',
    'testimonials.quote1':
      'मैंने अपना जीएसटी नोटिस सरल भाषा में बताया और मिनटों में एआई ने मुझे एक ऐसे सलाहकार से जोड़ा जिसने सब कुछ ठीक कर दिया। न शब्दजाल, न तनाव।',
    'testimonials.quote2':
      'Pro Firmo ने मुझे एक ऐसे कॉर्पोरेट वकील से जोड़ा जो शुरुआती-चरण की कंपनियों को समझता था। मिलान की गुणवत्ता सचमुच चुनी हुई लगी।',
    'testimonials.quote3':
      'मैं एक संपत्ति विवाद को लेकर घबराई हुई थी। एआई ने मेरे विकल्प सरलता से समझाए और उसी दिन मुझे एक सत्यापित संपत्ति वकील से जोड़ा।',
    'testimonials.quote4':
      'आयकर भरना पहले एक दुःस्वप्न था। एआई ने एक दस्तावेज़ चेकलिस्ट बनाई और 10 मिनट में मुझे एक किफ़ायती कर विशेषज्ञ मिला।',
    'testimonials.quote5':
      'मिलाए गए अधिवक्ता ने मेरा श्रम विवाद शुरू से अंत तक संभाला। पारदर्शी प्रति-मिनट मूल्य निर्धारण का मतलब था लागत में कोई चौंकाने वाली बात नहीं।',
    'testimonials.quote6':
      'कंपनी पंजीकरण भारी लग रहा था जब तक Pro Firmo ने मुझे सही सलाहकार से न मिलाया। एक हफ़्ते में काम हो गया।',
    'testimonials.media1Outcome': 'रिकॉर्ड समय में तलाक समझौता सुलझाया।',
    'testimonials.media1Type': 'वीडियो समीक्षा',
    'testimonials.media2Outcome': 'जीएसटी परामर्श के बाद जुर्माने में बचत की।',
    'testimonials.media2Type': 'ऑडियो समीक्षा',
    'testimonials.media3Outcome': 'संपत्ति मामले के लिए भरोसेमंद वकील मिला।',
    'testimonials.media3Type': 'वीडियो समीक्षा',
    'testimonials.playReview': '{name} की समीक्षा चलाएं',
    'testimonials.reviewAlt': '{name} की समीक्षा',

    // --- CTA section ---
    'cta.eyebrow': 'मिनटों में शुरू करें',
    'cta.headingLead': 'तैयार हैं मिलान पाने के लिए',
    'cta.headingHighlight': 'सही विशेषज्ञ से?',
    'cta.subtext':
      'अपना मामला एआई को बताइए और मिनटों में अपने लिए मिलान किया हुआ सत्यापित कानूनी या कर प्रोफेशनल पाइए — तेज़, पारदर्शी और भरोसेमंद।',
    'cta.getStarted': 'मुफ़्त में शुरू करें',
    'cta.joinPro': 'प्रोफेशनल के रूप में जुड़ें',
    'cta.note': 'क्रेडिट कार्ड की आवश्यकता नहीं · केवल सत्यापित प्रोफेशनल',
    'cta.bgAlt': 'आधुनिक कार्यालय में सहयोग करते कानूनी और कर प्रोफेशनल',
    'cta.consultantAlt': 'सत्यापित Pro Firmo सलाहकार',
    'cta.consultantsBadge': 'सत्यापित सलाहकार ऑनलाइन',
    'cta.consultantName': 'राहुल मेहता',
    'cta.consultantRole': 'कर व अनुपालन विशेषज्ञ',
  },
};
