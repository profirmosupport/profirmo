// App Settings service: CRUD for Category, SubCategory, City.
//
// Public reads (listCategoriesPublic, listCitiesPublic) return only active
// rows and are used by every signup / profile / search dropdown.
// Admin CRUD operations are paginated where it makes sense and validate
// uniqueness against `slug`.

const { Op } = require('sequelize');
const {
  Category,
  SubCategory,
  Country,
  State,
  City,
  CaseStatus,
  CaseType,
  CauseListType,
} = require('../models');

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function httpError(statusCode, message) {
  return { statusCode, message };
}

// --- Categories -----------------------------------------------------------

async function listCategoriesAdmin({ search } = {}) {
  const where = {};
  if (search && String(search).trim()) {
    where.name = { [Op.like]: `%${String(search).trim()}%` };
  }
  const categories = await Category.findAll({
    where,
    order: [
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
    raw: true,
  });
  const subs = await SubCategory.findAll({
    order: [
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
    raw: true,
  });
  const subsByCategory = new Map();
  for (const s of subs) {
    if (!subsByCategory.has(s.categoryId)) subsByCategory.set(s.categoryId, []);
    subsByCategory.get(s.categoryId).push(s);
  }
  return categories.map((c) => ({
    ...c,
    subCategories: subsByCategory.get(c.id) || [],
  }));
}

async function listCategoriesPublic() {
  const categories = await Category.findAll({
    where: { active: true },
    order: [
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
    raw: true,
  });
  const subs = await SubCategory.findAll({
    where: { active: true },
    order: [
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
    raw: true,
  });
  const subsByCategory = new Map();
  for (const s of subs) {
    if (!subsByCategory.has(s.categoryId)) subsByCategory.set(s.categoryId, []);
    subsByCategory.get(s.categoryId).push(s);
  }
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    subCategories: subsByCategory.get(c.id) || [],
  }));
}

async function createCategory({ name, sortOrder, active }) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw httpError(400, 'Category name is required.');
  const slug = slugify(trimmed);
  if (!slug) throw httpError(400, 'Category name produces an empty slug.');
  const dup = await Category.findOne({ where: { slug } });
  if (dup) throw httpError(409, `Category "${trimmed}" already exists.`);
  return Category.create({
    name: trimmed,
    slug,
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    active: active === false ? false : true,
  });
}

async function updateCategory(id, { name, sortOrder, active }) {
  const cat = await Category.findByPk(id);
  if (!cat) throw httpError(404, 'Category not found.');
  const patch = {};
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw httpError(400, 'Category name cannot be empty.');
    patch.name = trimmed;
    const newSlug = slugify(trimmed);
    if (newSlug && newSlug !== cat.slug) {
      const dup = await Category.findOne({
        where: { slug: newSlug, id: { [Op.ne]: id } },
      });
      if (dup) throw httpError(409, `Category "${trimmed}" already exists.`);
      patch.slug = newSlug;
    }
  }
  if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) {
    patch.sortOrder = Number(sortOrder);
  }
  if (active !== undefined) patch.active = Boolean(active);
  await cat.update(patch);
  return cat.toJSON();
}

async function deleteCategory(id) {
  const cat = await Category.findByPk(id);
  if (!cat) throw httpError(404, 'Category not found.');
  // Cascade is configured on the model association, so SubCategory rows
  // belonging to this category are removed automatically.
  await cat.destroy();
  return { id };
}

// --- Sub-categories -------------------------------------------------------

async function createSubCategory({
  categoryId,
  parentSubCategoryId,
  name,
  sortOrder,
  active,
  featured,
}) {
  if (!categoryId) throw httpError(400, 'categoryId is required.');
  const parent = await Category.findByPk(categoryId);
  if (!parent) throw httpError(404, 'Parent category not found.');
  const trimmed = String(name || '').trim();
  if (!trimmed) throw httpError(400, 'Sub-category name is required.');

  // When nesting under another SubCategory, prefix the slug with the
  // parent SubCategory's slug so two siblings with the same name under
  // different parents (e.g. "Child custody" under Hindu Marriage Law
  // and Special Marriage Act) don't collide on the global slug-unique
  // index.
  let parentSubSlug = parent.slug;
  if (parentSubCategoryId) {
    const parentSub = await SubCategory.findByPk(parentSubCategoryId);
    if (!parentSub) {
      throw httpError(404, 'Parent sub-category not found.');
    }
    if (parentSub.categoryId !== categoryId) {
      throw httpError(
        400,
        'Parent sub-category belongs to a different category.'
      );
    }
    parentSubSlug = parentSub.slug;
  }

  let slug = `${parentSubSlug}-${slugify(trimmed)}`;
  let n = 2;
  // Defensive collision-bumper — global slug uniqueness can be
  // tripped by an unrelated category's row.
  while (await SubCategory.findOne({ where: { slug } })) {
    slug = `${parentSubSlug}-${slugify(trimmed)}-${n}`;
    n += 1;
    if (n > 30) {
      throw httpError(
        409,
        `Could not generate unique slug for sub-category "${trimmed}".`
      );
    }
  }
  return SubCategory.create({
    categoryId,
    parentSubCategoryId: parentSubCategoryId || null,
    name: trimmed,
    slug,
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    active: active === false ? false : true,
    featured: featured === true,
  });
}

async function updateSubCategory(
  id,
  { name, sortOrder, active, categoryId, parentSubCategoryId, featured }
) {
  const sub = await SubCategory.findByPk(id);
  if (!sub) throw httpError(404, 'Sub-category not found.');
  const patch = {};
  let parent = null;
  if (categoryId !== undefined && categoryId !== sub.categoryId) {
    parent = await Category.findByPk(categoryId);
    if (!parent) throw httpError(404, 'Parent category not found.');
    patch.categoryId = categoryId;
  }

  // Resolve parent sub-category (for nested rows). `null` is the
  // explicit "promote to tier-1" signal; leaving the field undefined
  // keeps the current parent.
  const effectiveCategoryId = patch.categoryId || sub.categoryId;
  let parentSubSlug = null;
  if (parentSubCategoryId !== undefined) {
    if (parentSubCategoryId === null || parentSubCategoryId === '') {
      patch.parentSubCategoryId = null;
    } else {
      if (parentSubCategoryId === id) {
        throw httpError(400, 'A sub-category cannot be its own parent.');
      }
      const parentSub = await SubCategory.findByPk(parentSubCategoryId);
      if (!parentSub) {
        throw httpError(404, 'Parent sub-category not found.');
      }
      if (parentSub.categoryId !== effectiveCategoryId) {
        throw httpError(
          400,
          'Parent sub-category belongs to a different category.'
        );
      }
      patch.parentSubCategoryId = parentSubCategoryId;
      parentSubSlug = parentSub.slug;
    }
  } else if (sub.parentSubCategoryId) {
    const existingParent = await SubCategory.findByPk(sub.parentSubCategoryId);
    if (existingParent) parentSubSlug = existingParent.slug;
  }

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw httpError(400, 'Sub-category name cannot be empty.');
    patch.name = trimmed;
    const parentForSlug =
      parentSubSlug ||
      (parent ? parent.slug : (await Category.findByPk(sub.categoryId)).slug);
    let newSlug = `${parentForSlug}-${slugify(trimmed)}`;
    if (newSlug !== sub.slug) {
      let n = 2;
      while (
        await SubCategory.findOne({
          where: { slug: newSlug, id: { [Op.ne]: id } },
        })
      ) {
        newSlug = `${parentForSlug}-${slugify(trimmed)}-${n}`;
        n += 1;
        if (n > 30) {
          throw httpError(
            409,
            `Could not generate unique slug for sub-category "${trimmed}".`
          );
        }
      }
      patch.slug = newSlug;
    }
  }
  if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) {
    patch.sortOrder = Number(sortOrder);
  }
  if (active !== undefined) patch.active = Boolean(active);
  if (featured !== undefined) patch.featured = Boolean(featured);
  await sub.update(patch);
  return sub.toJSON();
}

async function deleteSubCategory(id) {
  const sub = await SubCategory.findByPk(id);
  if (!sub) throw httpError(404, 'Sub-category not found.');
  await sub.destroy();
  return { id };
}

// --- Cities ---------------------------------------------------------------

async function listCitiesAdmin({ search } = {}) {
  const where = {};
  if (search && String(search).trim()) {
    where.name = { [Op.like]: `%${String(search).trim()}%` };
  }
  return City.findAll({
    where,
    order: [
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
    raw: true,
  });
}

async function listCitiesPublic() {
  return City.findAll({
    where: { active: true },
    order: [
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
    attributes: ['id', 'name', 'slug'],
    raw: true,
  });
}

async function createCity({ name, sortOrder, active }) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw httpError(400, 'City name is required.');
  const slug = slugify(trimmed);
  if (!slug) throw httpError(400, 'City name produces an empty slug.');
  const dup = await City.findOne({ where: { slug } });
  if (dup) throw httpError(409, `City "${trimmed}" already exists.`);
  return City.create({
    name: trimmed,
    slug,
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    active: active === false ? false : true,
  });
}

async function updateCity(id, { name, sortOrder, active }) {
  const city = await City.findByPk(id);
  if (!city) throw httpError(404, 'City not found.');
  const patch = {};
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw httpError(400, 'City name cannot be empty.');
    patch.name = trimmed;
    const newSlug = slugify(trimmed);
    if (newSlug && newSlug !== city.slug) {
      const dup = await City.findOne({
        where: { slug: newSlug, id: { [Op.ne]: id } },
      });
      if (dup) throw httpError(409, `City "${trimmed}" already exists.`);
      patch.slug = newSlug;
    }
  }
  if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) {
    patch.sortOrder = Number(sortOrder);
  }
  if (active !== undefined) patch.active = Boolean(active);
  await city.update(patch);
  return city.toJSON();
}

async function deleteCity(id) {
  const city = await City.findByPk(id);
  if (!city) throw httpError(404, 'City not found.');
  await city.destroy();
  return { id };
}

// --- Locations hierarchy (Country -> State -> City) ----------------------

// Admin view: full nested tree of Country -> State -> City. Used by the
// /admin/locations page to render the collapsible hierarchy.
async function listLocationsAdmin() {
  const [countries, states, cities] = await Promise.all([
    Country.findAll({
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      raw: true,
    }),
    State.findAll({
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      raw: true,
    }),
    City.findAll({
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      raw: true,
    }),
  ]);
  const statesByCountry = new Map();
  for (const s of states) {
    if (!statesByCountry.has(s.countryId)) statesByCountry.set(s.countryId, []);
    statesByCountry.get(s.countryId).push(s);
  }
  const citiesByState = new Map();
  for (const c of cities) {
    if (!c.stateId) continue;
    if (!citiesByState.has(c.stateId)) citiesByState.set(c.stateId, []);
    citiesByState.get(c.stateId).push(c);
  }
  return countries.map((c) => ({
    ...c,
    states: (statesByCountry.get(c.id) || []).map((s) => ({
      ...s,
      cities: citiesByState.get(s.id) || [],
    })),
  }));
}

// Public view: only active rows. Same nested shape.
async function listLocationsPublic() {
  const [countries, states, cities] = await Promise.all([
    Country.findAll({
      where: { active: true },
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      attributes: ['id', 'name', 'slug', 'code'],
      raw: true,
    }),
    State.findAll({
      where: { active: true },
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      attributes: ['id', 'countryId', 'name', 'slug', 'code'],
      raw: true,
    }),
    City.findAll({
      where: { active: true },
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      attributes: ['id', 'stateId', 'name', 'slug'],
      raw: true,
    }),
  ]);
  const statesByCountry = new Map();
  for (const s of states) {
    if (!statesByCountry.has(s.countryId)) statesByCountry.set(s.countryId, []);
    statesByCountry.get(s.countryId).push(s);
  }
  const citiesByState = new Map();
  for (const c of cities) {
    if (!c.stateId) continue;
    if (!citiesByState.has(c.stateId)) citiesByState.set(c.stateId, []);
    citiesByState.get(c.stateId).push(c);
  }
  return countries.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    code: c.code,
    states: (statesByCountry.get(c.id) || []).map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      code: s.code,
      countryId: s.countryId,
      cities: citiesByState.get(s.id) || [],
    })),
  }));
}

async function createCountry({ name, code, sortOrder, active }) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw httpError(400, 'Country name is required.');
  const slug = slugify(trimmed);
  if (!slug) throw httpError(400, 'Country name produces an empty slug.');
  const dup = await Country.findOne({ where: { slug } });
  if (dup) throw httpError(409, `Country "${trimmed}" already exists.`);
  return Country.create({
    name: trimmed,
    slug,
    code: (code || '').trim().toUpperCase() || null,
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    active: active === false ? false : true,
  });
}

async function updateCountry(id, { name, code, sortOrder, active }) {
  const country = await Country.findByPk(id);
  if (!country) throw httpError(404, 'Country not found.');
  const patch = {};
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw httpError(400, 'Country name cannot be empty.');
    patch.name = trimmed;
    const newSlug = slugify(trimmed);
    if (newSlug && newSlug !== country.slug) {
      const dup = await Country.findOne({
        where: { slug: newSlug, id: { [Op.ne]: id } },
      });
      if (dup) throw httpError(409, `Country "${trimmed}" already exists.`);
      patch.slug = newSlug;
    }
  }
  if (code !== undefined) {
    patch.code = (code || '').trim().toUpperCase() || null;
  }
  if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) {
    patch.sortOrder = Number(sortOrder);
  }
  if (active !== undefined) patch.active = Boolean(active);
  await country.update(patch);
  return country.toJSON();
}

async function deleteCountry(id) {
  const country = await Country.findByPk(id);
  if (!country) throw httpError(404, 'Country not found.');
  await country.destroy();
  return { id };
}

async function createState({ countryId, name, sortOrder, active }) {
  if (!countryId) throw httpError(400, 'countryId is required.');
  const country = await Country.findByPk(countryId);
  if (!country) throw httpError(404, 'Parent country not found.');
  const trimmed = String(name || '').trim();
  if (!trimmed) throw httpError(400, 'State name is required.');
  const slug = `${country.slug}-${slugify(trimmed)}`;
  const dup = await State.findOne({ where: { slug } });
  if (dup) {
    throw httpError(
      409,
      `State "${trimmed}" already exists under ${country.name}.`
    );
  }
  return State.create({
    countryId,
    name: trimmed,
    slug,
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    active: active === false ? false : true,
  });
}

async function updateState(id, { name, sortOrder, active, countryId }) {
  const state = await State.findByPk(id);
  if (!state) throw httpError(404, 'State not found.');
  const patch = {};
  let parent = null;
  if (countryId !== undefined && countryId !== state.countryId) {
    parent = await Country.findByPk(countryId);
    if (!parent) throw httpError(404, 'Parent country not found.');
    patch.countryId = countryId;
  }
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw httpError(400, 'State name cannot be empty.');
    patch.name = trimmed;
    const parentForSlug = parent || (await Country.findByPk(state.countryId));
    const newSlug = `${parentForSlug.slug}-${slugify(trimmed)}`;
    if (newSlug !== state.slug) {
      const dup = await State.findOne({
        where: { slug: newSlug, id: { [Op.ne]: id } },
      });
      if (dup) {
        throw httpError(
          409,
          `State "${trimmed}" already exists under ${parentForSlug.name}.`
        );
      }
      patch.slug = newSlug;
    }
  }
  if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) {
    patch.sortOrder = Number(sortOrder);
  }
  if (active !== undefined) patch.active = Boolean(active);
  await state.update(patch);
  return state.toJSON();
}

async function deleteState(id) {
  const state = await State.findByPk(id);
  if (!state) throw httpError(404, 'State not found.');
  await state.destroy();
  return { id };
}

// Cities under the hierarchy. Replaces the legacy stateless createCity for
// new admin writes; the legacy version (above) still works for back-compat.
async function createCityForState({ stateId, name, sortOrder, active }) {
  if (!stateId) throw httpError(400, 'stateId is required.');
  const state = await State.findByPk(stateId);
  if (!state) throw httpError(404, 'Parent state not found.');
  const trimmed = String(name || '').trim();
  if (!trimmed) throw httpError(400, 'City name is required.');
  // Suffix the slug with the state slug so two cities of the same name in
  // different states don't collide.
  const slug = `${state.slug}-${slugify(trimmed)}`;
  const dup = await City.findOne({ where: { slug } });
  if (dup) {
    throw httpError(
      409,
      `City "${trimmed}" already exists under ${state.name}.`
    );
  }
  return City.create({
    name: trimmed,
    slug,
    stateId,
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    active: active === false ? false : true,
  });
}

async function updateCityHierarchical(id, { name, sortOrder, active, stateId }) {
  const city = await City.findByPk(id);
  if (!city) throw httpError(404, 'City not found.');
  const patch = {};
  let parent = null;
  if (stateId !== undefined && stateId !== city.stateId) {
    parent = await State.findByPk(stateId);
    if (!parent) throw httpError(404, 'Parent state not found.');
    patch.stateId = stateId;
  }
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw httpError(400, 'City name cannot be empty.');
    patch.name = trimmed;
    const parentForSlug =
      parent || (city.stateId ? await State.findByPk(city.stateId) : null);
    const newSlug = parentForSlug
      ? `${parentForSlug.slug}-${slugify(trimmed)}`
      : slugify(trimmed);
    if (newSlug !== city.slug) {
      const dup = await City.findOne({
        where: { slug: newSlug, id: { [Op.ne]: id } },
      });
      if (dup) {
        throw httpError(
          409,
          `City "${trimmed}" already exists under that state.`
        );
      }
      patch.slug = newSlug;
    }
  }
  if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) {
    patch.sortOrder = Number(sortOrder);
  }
  if (active !== undefined) patch.active = Boolean(active);
  await city.update(patch);
  return city.toJSON();
}

// --- Case statuses --------------------------------------------------------
//
// Admin-managed lookup of court case status codes (ABATED, DISPOSED, …).
// Stable `value` field is the enum key referenced by other rows as plain
// strings; `description` is the human label rendered in dropdowns.

function normalizeValue(raw) {
  return String(raw || '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function listCaseStatusesAdmin({ search } = {}) {
  const where = {};
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    where[Op.or] = [{ value: { [Op.like]: q } }, { description: { [Op.like]: q } }];
  }
  return CaseStatus.findAll({
    where,
    order: [
      ['sortOrder', 'ASC'],
      ['value', 'ASC'],
    ],
    raw: true,
  });
}

async function listCaseStatusesPublic() {
  return CaseStatus.findAll({
    where: { active: true },
    order: [
      ['sortOrder', 'ASC'],
      ['value', 'ASC'],
    ],
    attributes: ['id', 'value', 'description'],
    raw: true,
  });
}

async function createCaseStatus({ value, description, sortOrder, active }) {
  const v = normalizeValue(value);
  if (!v) throw httpError(400, 'Case status value is required.');
  const desc = String(description || '').trim();
  if (!desc) throw httpError(400, 'Case status description is required.');
  const dup = await CaseStatus.findOne({ where: { value: v } });
  if (dup) throw httpError(409, `Case status "${v}" already exists.`);
  return CaseStatus.create({
    value: v,
    description: desc,
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    active: active === false ? false : true,
  });
}

async function updateCaseStatus(id, { value, description, sortOrder, active }) {
  const row = await CaseStatus.findByPk(id);
  if (!row) throw httpError(404, 'Case status not found.');
  const patch = {};
  if (value !== undefined) {
    const v = normalizeValue(value);
    if (!v) throw httpError(400, 'Case status value cannot be empty.');
    if (v !== row.value) {
      const dup = await CaseStatus.findOne({
        where: { value: v, id: { [Op.ne]: id } },
      });
      if (dup) throw httpError(409, `Case status "${v}" already exists.`);
      patch.value = v;
    }
  }
  if (description !== undefined) {
    const trimmed = String(description).trim();
    if (!trimmed) throw httpError(400, 'Description cannot be empty.');
    patch.description = trimmed;
  }
  if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) {
    patch.sortOrder = Number(sortOrder);
  }
  if (active !== undefined) patch.active = Boolean(active);
  await row.update(patch);
  return row.toJSON();
}

async function deleteCaseStatus(id) {
  const row = await CaseStatus.findByPk(id);
  if (!row) throw httpError(404, 'Case status not found.');
  await row.destroy();
  return { id };
}

// --- Case types -----------------------------------------------------------
//
// Same shape as CaseStatus, but the `value` field is case-sensitive
// because the partner taxonomy mixes uppercase (CC, WP_C) with mixed
// case (Arb, MCrA, Tax_Ref). The normaliser trims + collapses runs of
// non-alphanumeric chars to underscores, but does NOT uppercase.

function normalizeCaseTypeValue(raw) {
  return String(raw || '')
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function listCaseTypesAdmin({ search } = {}) {
  const where = {};
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    where[Op.or] = [{ value: { [Op.like]: q } }, { description: { [Op.like]: q } }];
  }
  return CaseType.findAll({
    where,
    order: [
      ['sortOrder', 'ASC'],
      ['value', 'ASC'],
    ],
    raw: true,
  });
}

async function listCaseTypesPublic() {
  return CaseType.findAll({
    where: { active: true },
    order: [
      ['sortOrder', 'ASC'],
      ['value', 'ASC'],
    ],
    attributes: ['id', 'value', 'description'],
    raw: true,
  });
}

async function createCaseType({ value, description, sortOrder, active }) {
  const v = normalizeCaseTypeValue(value);
  if (!v) throw httpError(400, 'Case type value is required.');
  const desc = String(description || '').trim();
  if (!desc) throw httpError(400, 'Case type description is required.');
  const dup = await CaseType.findOne({ where: { value: v } });
  if (dup) throw httpError(409, `Case type "${v}" already exists.`);
  return CaseType.create({
    value: v,
    description: desc,
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    active: active === false ? false : true,
  });
}

async function updateCaseType(id, { value, description, sortOrder, active }) {
  const row = await CaseType.findByPk(id);
  if (!row) throw httpError(404, 'Case type not found.');
  const patch = {};
  if (value !== undefined) {
    const v = normalizeCaseTypeValue(value);
    if (!v) throw httpError(400, 'Case type value cannot be empty.');
    if (v !== row.value) {
      const dup = await CaseType.findOne({
        where: { value: v, id: { [Op.ne]: id } },
      });
      if (dup) throw httpError(409, `Case type "${v}" already exists.`);
      patch.value = v;
    }
  }
  if (description !== undefined) {
    const trimmed = String(description).trim();
    if (!trimmed) throw httpError(400, 'Description cannot be empty.');
    patch.description = trimmed;
  }
  if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) {
    patch.sortOrder = Number(sortOrder);
  }
  if (active !== undefined) patch.active = Boolean(active);
  await row.update(patch);
  return row.toJSON();
}

async function deleteCaseType(id) {
  const row = await CaseType.findByPk(id);
  if (!row) throw httpError(404, 'Case type not found.');
  await row.destroy();
  return { id };
}

// --- Cause list types -----------------------------------------------------
//
// Tiny enum (CIVIL / CRIMINAL / UNKNOWN). Same normaliser as
// CaseStatus — uppercase + underscores.

async function listCauseListTypesAdmin({ search } = {}) {
  const where = {};
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    where[Op.or] = [{ value: { [Op.like]: q } }, { description: { [Op.like]: q } }];
  }
  return CauseListType.findAll({
    where,
    order: [
      ['sortOrder', 'ASC'],
      ['value', 'ASC'],
    ],
    raw: true,
  });
}

async function listCauseListTypesPublic() {
  return CauseListType.findAll({
    where: { active: true },
    order: [
      ['sortOrder', 'ASC'],
      ['value', 'ASC'],
    ],
    attributes: ['id', 'value', 'description'],
    raw: true,
  });
}

async function createCauseListType({ value, description, sortOrder, active }) {
  const v = normalizeValue(value);
  if (!v) throw httpError(400, 'Cause list type value is required.');
  const desc = String(description || '').trim();
  if (!desc) throw httpError(400, 'Cause list type description is required.');
  const dup = await CauseListType.findOne({ where: { value: v } });
  if (dup) throw httpError(409, `Cause list type "${v}" already exists.`);
  return CauseListType.create({
    value: v,
    description: desc,
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    active: active === false ? false : true,
  });
}

async function updateCauseListType(id, { value, description, sortOrder, active }) {
  const row = await CauseListType.findByPk(id);
  if (!row) throw httpError(404, 'Cause list type not found.');
  const patch = {};
  if (value !== undefined) {
    const v = normalizeValue(value);
    if (!v) throw httpError(400, 'Cause list type value cannot be empty.');
    if (v !== row.value) {
      const dup = await CauseListType.findOne({
        where: { value: v, id: { [Op.ne]: id } },
      });
      if (dup) throw httpError(409, `Cause list type "${v}" already exists.`);
      patch.value = v;
    }
  }
  if (description !== undefined) {
    const trimmed = String(description).trim();
    if (!trimmed) throw httpError(400, 'Description cannot be empty.');
    patch.description = trimmed;
  }
  if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) {
    patch.sortOrder = Number(sortOrder);
  }
  if (active !== undefined) patch.active = Boolean(active);
  await row.update(patch);
  return row.toJSON();
}

async function deleteCauseListType(id) {
  const row = await CauseListType.findByPk(id);
  if (!row) throw httpError(404, 'Cause list type not found.');
  await row.destroy();
  return { id };
}

module.exports = {
  listCategoriesAdmin,
  listCategoriesPublic,
  createCategory,
  updateCategory,
  deleteCategory,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
  listCitiesAdmin,
  listCitiesPublic,
  createCity,
  updateCity,
  deleteCity,
  // Locations hierarchy
  listLocationsAdmin,
  listLocationsPublic,
  createCountry,
  updateCountry,
  deleteCountry,
  createState,
  updateState,
  deleteState,
  createCityForState,
  updateCityHierarchical,
  // Case statuses
  listCaseStatusesAdmin,
  listCaseStatusesPublic,
  createCaseStatus,
  updateCaseStatus,
  deleteCaseStatus,
  // Case types
  listCaseTypesAdmin,
  listCaseTypesPublic,
  createCaseType,
  updateCaseType,
  deleteCaseType,
  // Cause list types
  listCauseListTypesAdmin,
  listCauseListTypesPublic,
  createCauseListType,
  updateCauseListType,
  deleteCauseListType,
};
