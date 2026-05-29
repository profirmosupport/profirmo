const { Op } = require('sequelize');
const {
  Professional,
  Review,
  User,
  Address,
  ProfessionalDetail,
  ProfessionalApproval,
  LawyerDetail,
  TaxConsultantDetail,
  Category,
  SubCategory,
  City,
} = require('../models');
const reviewStats = require('./reviewStats');

/**
 * Cache of resolved sub-category lookup data. Cleared every 60s — the admin
 * panel mutates these tables infrequently, so a short TTL keeps listing
 * responses snappy without going completely stale.
 */
let subCategoryCache = null;
let subCategoryCacheAt = 0;
const SUBCAT_TTL_MS = 60 * 1000;

const loadSubCategoryLookup = async () => {
  const now = Date.now();
  if (subCategoryCache && now - subCategoryCacheAt < SUBCAT_TTL_MS) {
    return subCategoryCache;
  }
  const [subs, cats] = await Promise.all([
    SubCategory.findAll({ raw: true }),
    Category.findAll({ raw: true }),
  ]);
  const catNameById = new Map(cats.map((c) => [c.id, c.name]));
  const byId = new Map();
  for (const s of subs) {
    byId.set(s.id, {
      id: s.id,
      name: s.name,
      categoryId: s.categoryId,
      categoryName: catNameById.get(s.categoryId) || '',
    });
  }
  subCategoryCache = byId;
  subCategoryCacheAt = now;
  return byId;
};

const resolveSubCategories = (ids, lookup) => {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const out = [];
  for (const id of ids) {
    const row = lookup.get(id);
    if (row) out.push(row);
  }
  return out;
};

/**
 * Overwrite `rating` / `reviewsCount` on each item with the exact values
 * aggregated from the `reviews` table, so listings never show stale counts.
 */
const applyReviewStats = async (items) => {
  if (!Array.isArray(items) || items.length === 0) return items;
  const stats = await reviewStats.getProfessionalStats(
    items.map((p) => p.id)
  );
  for (const item of items) {
    const s = stats.get(item.id);
    item.reviewsCount = s ? s.count : 0;
    item.rating = s ? s.average : 0;
  }
  return items;
};

/** Apply exact review stats to a single professional detail object. */
const applyOneReviewStats = async (item) => {
  if (item && item.id) await applyReviewStats([item]);
  return item;
};

// Default pagination settings shared across list endpoints.
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

// Default pagination for the unified listing endpoints (page 1, 12 per page).
const LISTING_DEFAULT_LIMIT = 12;

/**
 * Normalize page/limit into safe values plus the SQL offset.
 * Exported for reuse by other services.
 * @returns {{ page: number, limit: number, offset: number }}
 */
const paginate = (page, limit) => {
  const safePage = Math.max(Number(page) || DEFAULT_PAGE, 1);
  const safeLimit = Math.max(Number(limit) || DEFAULT_LIMIT, 1);
  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  };
};

// --- Normalization helpers -------------------------------------------------

const toArray = (v) => (Array.isArray(v) ? v : []);
const toNum = (v) => {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

// Pick the live value when it is meaningfully present, else the legacy value.
const pickLive = (liveVal, legacyVal) =>
  liveVal !== undefined && liveVal !== null && liveVal !== ''
    ? liveVal
    : legacyVal;

// Derive a display name from a live User row.
const userDisplayName = (user) => {
  if (!user) return '';
  return (
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.name ||
    ''
  );
};

/**
 * Map a legacy `professionals` row into the unified listing shape.
 * When `overlay` ({ user, detail, address }) is supplied — the live account
 * linked to this legacy row — its uploaded photo and edited fields take
 * precedence, so profile changes surface in listings immediately.
 */
const normalizeLegacyProfessional = (p, overlay = null) => {
  const user = overlay && overlay.user;
  const detail = overlay && overlay.detail;
  const address = overlay && overlay.address;
  return {
    id: p.id,
    source: 'legacy',
    name: pickLive(userDisplayName(user), p.name) || '',
    professionalType:
      pickLive(detail && detail.professionalType, p.professionType) || '',
    specialization:
      pickLive(detail && detail.designation, p.specialization) || '',
    designation: (detail && detail.designation) || '',
    organization: (detail && detail.organization) || '',
    city: pickLive(address && address.city, p.city) || '',
    profilePhoto: pickLive(user && user.profilePhoto, p.profileImage) || null,
    yearsOfExperience: toNum(
      pickLive(detail && detail.yearsOfExperience, p.experience)
    ),
    bio: pickLive(detail && detail.bio, p.bio) || '',
    skills: detail ? toArray(detail.skills) : [],
    expertise: detail ? toArray(detail.expertise) : [],
    languages:
      detail && toArray(detail.languages).length
        ? toArray(detail.languages)
        : toArray(p.languages),
    consultationFee: toNum(
      pickLive(detail && detail.consultationFee, p.perMinuteRate)
    ),
    rating: toNum(p.rating),
    reviewsCount: toNum(p.reviewsCount),
    verified: Boolean(p.verified),
    availableNow: Boolean(p.availableNow),
    // Legacy rows can override via the new-model detail; default to true.
    acceptsOnlineBooking:
      detail &&
      (detail.acceptsOnlineBooking === false ||
        detail.acceptsOnlineBooking === 0 ||
        detail.acceptsOnlineBooking === '0')
        ? false
        : true,
  };
};

/**
 * Map a new-model professional (User + Address + ProfessionalDetail) into the
 * unified listing shape. `id` is the ProfessionalDetail.id.
 */
const normalizeProfileProfessional = ({ user, address, detail }) => {
  const name =
    (user && user.fullName) ||
    [user && user.firstName, user && user.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    (user && user.name) ||
    '';
  return {
    // Prefer the legacy id when this user was backfilled from a legacy
    // professional row — keeps existing /professionals/prof-N URLs working
    // even though the data is sourced from users + professional_details.
    id: (user && user.linkedId) || detail.id,
    source: 'profile',
    name,
    professionalType: detail.professionalType || '',
    specialization: detail.designation || '',
    designation: detail.designation || '',
    organization: detail.organization || '',
    city: (address && address.city) || (user && user.city) || '',
    profilePhoto: (user && user.profilePhoto) || null,
    yearsOfExperience: toNum(detail.yearsOfExperience),
    bio: detail.bio || '',
    skills: toArray(detail.skills),
    expertise: toArray(detail.expertise),
    subCategoryIds: toArray(detail.subCategoryIds),
    practiceCities: toArray(detail.practiceCities),
    courtsPracticing: toArray(detail.courtsPracticing),
    primaryCategoryId: detail.primaryCategoryId || null,
    consultancyType: detail.consultancyType || null,
    chamberAddress: detail.chamberAddress || '',
    licenseNumber: detail.licenseNumber || '',
    barRegistrationNumber: detail.barRegistrationNumber || '',
    taxRegistrationNumber: detail.taxRegistrationNumber || '',
    enrollmentNumber: detail.enrollmentNumber || '',
    // Normalize verificationStatus — listing rows are APPROVED so we
    // surface a "verified" label by default; explicit detail.verificationStatus
    // wins when set so the future "pending"/"under_review" flows display
    // correctly elsewhere.
    verificationStatus:
      detail.verificationStatus &&
      String(detail.verificationStatus).toLowerCase() !== 'pending'
        ? String(detail.verificationStatus).toLowerCase()
        : 'verified',
    completionPercent: toNum(detail.completionPercent),
    // Documents (URLs)
    advocateLicenseDoc: detail.advocateLicenseDoc || '',
    barCouncilCertDoc: detail.barCouncilCertDoc || '',
    lawDegreeDoc: detail.lawDegreeDoc || '',
    taxRegistrationCertDoc: detail.taxRegistrationCertDoc || '',
    qualificationCertDoc: detail.qualificationCertDoc || '',
    professionalLicenseDoc: detail.professionalLicenseDoc || '',
    governmentIdDoc: detail.governmentIdDoc || '',
    languages: toArray(detail.languages),
    consultationFee: toNum(detail.consultationFee),
    rating: toNum(detail.rating),
    reviewsCount: toNum(detail.reviewsCount),
    // Listing only surfaces APPROVED professionals, so every result is
    // implicitly verified. `verificationStatus` is exposed separately for
    // the verification badge on cards/detail pages.
    verified: true,
    // MariaDB stores booleans as TINYINT(1); 0/'0'/false all mean "off",
    // null/undefined means "not set" (treated as available for legacy rows).
    availableNow:
      detail.availableNow === false ||
      detail.availableNow === 0 ||
      detail.availableNow === '0'
        ? false
        : true,
    // NULL acceptsOnlineBooking → bookable. Explicit false hides the CTA.
    acceptsOnlineBooking:
      detail.acceptsOnlineBooking === false ||
      detail.acceptsOnlineBooking === 0 ||
      detail.acceptsOnlineBooking === '0'
        ? false
        : true,
  };
};

/**
 * Load every new-model professional that has an APPROVED ProfessionalApproval
 * and a ProfessionalDetail, normalized into the unified listing shape.
 * @returns {Promise<Array>}
 */
const loadProfileProfessionals = async () => {
  const approvals = await ProfessionalApproval.findAll({
    where: { status: 'APPROVED' },
    raw: true,
  });
  if (approvals.length === 0) return [];

  const userIds = [...new Set(approvals.map((a) => a.userId).filter(Boolean))];

  const [details, users, addresses, subCategoryLookup] = await Promise.all([
    ProfessionalDetail.findAll({
      where: { userId: { [Op.in]: userIds } },
      raw: true,
    }),
    User.findAll({ where: { id: { [Op.in]: userIds } }, raw: true }),
    Address.findAll({
      where: { userId: { [Op.in]: userIds } },
      raw: true,
    }),
    loadSubCategoryLookup(),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const addressByUserId = new Map(addresses.map((a) => [a.userId, a]));

  const items = [];
  for (const detail of details) {
    const user = userById.get(detail.userId);
    // Suspended accounts disappear from the listing entirely — same effect
    // as deleting them, but reversible by toggling status back to 'active'.
    if (!user || String(user.status).toLowerCase() === 'suspended') continue;
    const item = normalizeProfileProfessional({
      user,
      address: addressByUserId.get(detail.userId) || null,
      detail,
    });
    item.subCategories = resolveSubCategories(
      item.subCategoryIds,
      subCategoryLookup
    );
    items.push(item);
  }
  return items;
};

/**
 * Load the live account linked to each legacy professional row. A `User`
 * whose `linkedId` equals a legacy professional id is the same person, so
 * its uploaded photo and edited details override the static seed row.
 * @param {string[]} legacyIds
 * @returns {Promise<Map<string,{user,detail,address}>>}
 */
const loadLegacyOverlays = async (legacyIds = []) => {
  const map = new Map();
  if (legacyIds.length === 0) return map;

  const users = await User.findAll({
    where: { linkedId: { [Op.in]: legacyIds } },
    raw: true,
  });
  if (users.length === 0) return map;

  const userIds = users.map((u) => u.id);
  const [details, addresses] = await Promise.all([
    ProfessionalDetail.findAll({
      where: { userId: { [Op.in]: userIds } },
      raw: true,
    }),
    Address.findAll({ where: { userId: { [Op.in]: userIds } }, raw: true }),
  ]);
  const detailByUserId = new Map(details.map((d) => [d.userId, d]));
  const addressByUserId = new Map(addresses.map((a) => [a.userId, a]));

  for (const user of users) {
    map.set(user.linkedId, {
      user,
      detail: detailByUserId.get(user.id) || null,
      address: addressByUserId.get(user.id) || null,
    });
  }
  return map;
};

// Read a numeric query param, returning undefined when absent/invalid.
const numParam = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};

/**
 * Apply the in-memory listing filters to a normalized professional array.
 */
const filterProfessionals = (items, filters = {}) => {
  let rows = items;

  const search = filters.search ? String(filters.search).toLowerCase() : '';
  if (search) {
    rows = rows.filter((p) =>
      [p.name, p.specialization, p.bio]
        .map((s) => String(s || '').toLowerCase())
        .some((s) => s.includes(search))
    );
  }

  const type = filters.professionalType || filters.category;
  if (type) {
    const q = String(type).toLowerCase();
    rows = rows.filter(
      (p) => String(p.professionalType || '').toLowerCase() === q
    );
  }

  // Admin-managed taxonomy filter: a professional matches when any of their
  // selected sub-category ids equals the requested id.
  if (filters.subCategoryId) {
    const wanted = String(filters.subCategoryId);
    rows = rows.filter((p) =>
      toArray(p.subCategoryIds).some((id) => String(id) === wanted)
    );
  }
  // Filter by parent category id — match any sub-category whose id is in
  // the supplied set. The set is built by the controller from the public
  // /api/app-settings/categories response.
  if (filters.subCategoryIdsAny) {
    const wantedSet = new Set(
      (Array.isArray(filters.subCategoryIdsAny)
        ? filters.subCategoryIdsAny
        : String(filters.subCategoryIdsAny).split(',')
      ).map((s) => String(s).trim()).filter(Boolean)
    );
    if (wantedSet.size > 0) {
      rows = rows.filter((p) =>
        toArray(p.subCategoryIds).some((id) => wantedSet.has(String(id)))
      );
    }
  }

  if (filters.specialization) {
    const q = String(filters.specialization).toLowerCase();
    rows = rows.filter(
      (p) => String(p.specialization || '').toLowerCase() === q
    );
  }

  if (filters.expertise) {
    const q = String(filters.expertise).toLowerCase();
    rows = rows.filter((p) =>
      toArray(p.expertise).some((e) => String(e).toLowerCase() === q)
    );
  }

  if (filters.practiceArea) {
    const q = String(filters.practiceArea).toLowerCase();
    rows = rows.filter(
      (p) =>
        toArray(p.expertise).some((e) => String(e).toLowerCase() === q) ||
        toArray(p.skills).some((s) => String(s).toLowerCase() === q)
    );
  }

  const city = filters.city || filters.location;
  if (city) {
    const raw = String(city).trim();
    const q = raw.toLowerCase();
    // The filter value can be a city id (new dropdowns) or a city name
    // (legacy URLs like ?city=Mumbai). Look up the name when an id is
    // given so we can compare against the address-city name too.
    let cityName = '';
    if (filters._cityNameById && filters._cityNameById[raw]) {
      cityName = String(filters._cityNameById[raw]).toLowerCase();
    }
    rows = rows.filter((p) => {
      const baseCity = String(p.city || '').toLowerCase();
      if (baseCity === q || (cityName && baseCity === cityName)) return true;
      const practice = toArray(p.practiceCities).map((c) =>
        String(c).toLowerCase()
      );
      if (practice.includes(q)) return true;
      if (cityName && practice.includes(cityName)) return true;
      return false;
    });
  }

  const minExp = numParam(filters.minExperience);
  if (minExp !== undefined) {
    rows = rows.filter((p) => p.yearsOfExperience >= minExp);
  }
  const maxExp = numParam(filters.maxExperience);
  if (maxExp !== undefined) {
    rows = rows.filter((p) => p.yearsOfExperience <= maxExp);
  }
  // `experience` as a range "min-max" or single minimum value.
  if (filters.experience !== undefined && filters.experience !== '') {
    const parts = String(filters.experience).split('-');
    const lo = numParam(parts[0]);
    const hi = numParam(parts[1]);
    if (lo !== undefined) {
      rows = rows.filter((p) => p.yearsOfExperience >= lo);
    }
    if (hi !== undefined) {
      rows = rows.filter((p) => p.yearsOfExperience <= hi);
    }
  }

  const minFee = numParam(filters.minFee);
  if (minFee !== undefined) {
    rows = rows.filter((p) => p.consultationFee >= minFee);
  }
  const maxFee = numParam(filters.maxFee);
  if (maxFee !== undefined) {
    rows = rows.filter((p) => p.consultationFee <= maxFee);
  }

  const minRating = numParam(filters.minRating);
  if (minRating !== undefined) {
    rows = rows.filter((p) => p.rating >= minRating);
  }

  if (filters.availableNow !== undefined && filters.availableNow !== '') {
    const want =
      filters.availableNow === true || filters.availableNow === 'true';
    rows = rows.filter((p) => Boolean(p.availableNow) === want);
  }

  if (filters.language) {
    const q = String(filters.language).toLowerCase();
    rows = rows.filter((p) =>
      toArray(p.languages).some((l) => String(l).toLowerCase() === q)
    );
  }

  return rows;
};

/**
 * Sort a normalized professional array in place by the `sort` query value.
 */
const sortProfessionals = (rows, sort) => {
  switch (sort) {
    case 'rating':
      return rows.sort((a, b) => b.rating - a.rating);
    case 'experience':
      return rows.sort(
        (a, b) => b.yearsOfExperience - a.yearsOfExperience
      );
    case 'fee':
    case 'price':
      return rows.sort((a, b) => a.consultationFee - b.consultationFee);
    default:
      return rows;
  }
};

/**
 * Unified professional listing. Merges every legacy `professionals` row with
 * every APPROVED new-model professional, normalizes them to one shape, then
 * applies filters / sort / pagination in memory.
 * Supported filters: search, professionalType / category, expertise,
 * practiceArea, city / location, minExperience / maxExperience / experience,
 * minFee / maxFee, minRating, availableNow, language; sort: rating |
 * experience | fee.
 * @returns {Promise<{ items, page, limit, total }>}
 */
const list = async ({ filters = {}, page, limit } = {}) => {
  const safePage = Math.max(Number(page) || DEFAULT_PAGE, 1);
  const safeLimit = Math.max(
    Number(limit) || LISTING_DEFAULT_LIMIT,
    1
  );

  // Single source of truth: users + professional_details + APPROVED approvals.
  // Legacy professional rows were backfilled into this model in migrate.js.
  const all = await loadProfileProfessionals();
  await applyReviewStats(all);

  // City filter can carry an id (from the new dropdowns) or a name (legacy
  // URLs). Load a lookup once so the filter can resolve ids to names and
  // match both flavours.
  const cityFilter = filters.city || filters.location;
  if (cityFilter && /^city-/.test(String(cityFilter))) {
    try {
      const row = await City.findByPk(cityFilter, {
        attributes: ['id', 'name'],
        raw: true,
      });
      if (row) {
        filters = { ...filters, _cityNameById: { [row.id]: row.name } };
      }
    } catch {
      /* swallow — filter falls back to direct id/name matching */
    }
  }

  const filtered = filterProfessionals(all, filters);
  sortProfessionals(filtered, filters.sort);

  const total = filtered.length;
  const offset = (safePage - 1) * safeLimit;
  return {
    items: filtered.slice(offset, offset + safeLimit),
    page: safePage,
    limit: safeLimit,
    total,
  };
};

/**
 * Distinct filter values drawn from the live merged professional list, so the
 * listing-page filter dropdowns always reflect what is actually in the DB.
 * @returns {Promise<{professionalTypes,cities,specializations,languages}>}
 */
const filterOptions = async () => {
  const { items } = await list({ filters: {}, page: 1, limit: 100000 });
  const types = new Set();
  const cities = new Set();
  const specializations = new Set();
  const languages = new Set();
  for (const p of items) {
    if (p.professionalType) types.add(p.professionalType);
    if (p.city) cities.add(p.city);
    if (p.specialization) specializations.add(p.specialization);
    for (const l of toArray(p.languages)) {
      if (l) languages.add(String(l));
    }
  }
  const sortArr = (s) => [...s].sort((a, b) => a.localeCompare(b));
  return {
    professionalTypes: sortArr(types),
    cities: sortArr(cities),
    specializations: sortArr(specializations),
    languages: sortArr(languages),
  };
};

/**
 * Resolve a professional by id from either source and return the full
 * normalized detail object. Tries the new-model ProfessionalDetail first,
 * then falls back to the legacy `professionals` table. Returns null if not
 * found in either source.
 */
const getById = async (id) => {
  // Resolve by user.linkedId first (preserves /professionals/prof-N URLs),
  // then by ProfessionalDetail.id.
  let user = await User.findOne({ where: { linkedId: id }, raw: true });
  let detail = null;
  if (user) {
    detail = await ProfessionalDetail.findOne({
      where: { userId: user.id },
      raw: true,
    });
  } else {
    detail = await ProfessionalDetail.findByPk(id, { raw: true });
    if (detail) {
      user = await User.findByPk(detail.userId, { raw: true });
    }
  }
  if (detail) {
    // Suspended accounts are not accessible by direct link either. Return
    // null so the controller responds with 404; the frontend redirects to /.
    if (user && String(user.status).toLowerCase() === 'suspended') {
      return null;
    }
    const address = await Address.findOne({
      where: { userId: detail.userId },
      raw: true,
    });
    const base = normalizeProfileProfessional({
      user: user || {},
      address,
      detail,
    });
    const [lawyer, tax, subCategoryLookup] = await Promise.all([
      LawyerDetail.findOne({
        where: { professionalId: detail.id },
        raw: true,
      }),
      TaxConsultantDetail.findOne({
        where: { professionalId: detail.id },
        raw: true,
      }),
      loadSubCategoryLookup(),
    ]);
    base.subCategories = resolveSubCategories(
      base.subCategoryIds,
      subCategoryLookup
    );
    return applyOneReviewStats({
      ...base,
      about: detail.about || '',
      education: toArray(detail.education),
      certifications: toArray(detail.certifications),
      achievements: toArray(detail.achievements),
      website: detail.website || '',
      linkedin: detail.linkedin || '',
      availability: toArray(detail.availability),
      address: {
        country: (address && address.country) || '',
        state: (address && address.state) || '',
        city: (address && address.city) || '',
      },
      lawyer: lawyer || null,
      tax: tax || null,
    });
  }

  return null;
};

/**
 * Free-text search across name, professionType, specialization and city.
 */
const search = async (query) => {
  const q = String(query || '').trim();
  if (!q) return [];
  return Professional.findAll({
    where: {
      [Op.or]: [
        { name: { [Op.like]: `%${q}%` } },
        { professionType: { [Op.like]: `%${q}%` } },
        { specialization: { [Op.like]: `%${q}%` } },
        { city: { [Op.like]: `%${q}%` } },
      ],
    },
    raw: true,
  });
};

/** Toggle a professional's availableNow flag. Returns null if not found. */
const updateAvailability = async (id, availableNow) => {
  const professional = await Professional.findByPk(id);
  if (!professional) return null;
  await professional.update({ availableNow: Boolean(availableNow) });
  return professional.get({ plain: true });
};

/** Update a professional's per-minute rate. Returns null if not found. */
const updateRate = async (id, perMinuteRate) => {
  const rate = Number(perMinuteRate);
  if (Number.isNaN(rate) || rate < 0) {
    throw {
      statusCode: 422,
      message: 'perMinuteRate must be a positive number',
    };
  }
  const professional = await Professional.findByPk(id);
  if (!professional) return null;
  await professional.update({ perMinuteRate: rate });
  return professional.get({ plain: true });
};

/**
 * Published reviews tied to a professional, newest first (empty when none).
 * Filter `kind: 'professional'` so consultation + client reviews — both
 * anchored to specific bookings — never leak into the public profile.
 */
const getReviews = async (id) =>
  Review.findAll({
    where: { professionalId: id, status: 'PUBLISHED', kind: 'professional' },
    order: [['createdAt', 'DESC']],
    raw: true,
  });

/** Get a professional's availability slots. Returns null if not found. */
const getAvailability = async (id) => {
  const professional = await Professional.findByPk(id, { raw: true });
  if (!professional) return null;
  return {
    professionalId: professional.id,
    availableNow: professional.availableNow,
    availabilitySlots: professional.availabilitySlots,
  };
};

module.exports = {
  paginate,
  list,
  filterOptions,
  getById,
  search,
  updateAvailability,
  updateRate,
  getReviews,
  getAvailability,
};
