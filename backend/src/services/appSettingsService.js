// App Settings service: CRUD for Category, SubCategory, City.
//
// Public reads (listCategoriesPublic, listCitiesPublic) return only active
// rows and are used by every signup / profile / search dropdown.
// Admin CRUD operations are paginated where it makes sense and validate
// uniqueness against `slug`.

const { Op } = require('sequelize');
const { Category, SubCategory, Country, State, City } = require('../models');

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
  const slug = `${parent.slug}-${slugify(trimmed)}`;
  const dup = await SubCategory.findOne({ where: { slug } });
  if (dup) {
    throw httpError(
      409,
      `Sub-category "${trimmed}" already exists under ${parent.name}.`
    );
  }
  return SubCategory.create({
    categoryId,
    name: trimmed,
    slug,
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    active: active === false ? false : true,
    featured: featured === true,
  });
}

async function updateSubCategory(
  id,
  { name, sortOrder, active, categoryId, featured }
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
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw httpError(400, 'Sub-category name cannot be empty.');
    patch.name = trimmed;
    const parentForSlug = parent || (await Category.findByPk(sub.categoryId));
    const newSlug = `${parentForSlug.slug}-${slugify(trimmed)}`;
    if (newSlug !== sub.slug) {
      const dup = await SubCategory.findOne({
        where: { slug: newSlug, id: { [Op.ne]: id } },
      });
      if (dup) {
        throw httpError(
          409,
          `Sub-category "${trimmed}" already exists under ${parentForSlug.name}.`
        );
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
      attributes: ['id', 'countryId', 'name', 'slug'],
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
};
