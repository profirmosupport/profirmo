'use client';

// useCategories / useCities — fetch the admin-managed taxonomy + city list
// from /api/app-settings/* once per session and return arrays the forms and
// dropdowns can render directly. Results are cached at module scope so the
// same hook in multiple components only triggers one network call.
//
// `useSubCategoriesFlat` is a convenience helper that returns a flat list of
// every active sub-category with its parent category name, used by the
// search filter pill row and any place a single list is easier to render.

import { useEffect, useState } from 'react';
import {
  listCategories,
  listCities,
} from '@/services/appSettingsService';

let categoriesCache = null;
let categoriesPromise = null;
let citiesCache = null;
let citiesPromise = null;

function loadCategories() {
  if (categoriesCache) return Promise.resolve(categoriesCache);
  if (categoriesPromise) return categoriesPromise;
  categoriesPromise = listCategories()
    .then((data) => {
      categoriesCache = Array.isArray(data) ? data : [];
      return categoriesCache;
    })
    .catch(() => {
      categoriesPromise = null;
      return [];
    });
  return categoriesPromise;
}

function loadCities() {
  if (citiesCache) return Promise.resolve(citiesCache);
  if (citiesPromise) return citiesPromise;
  citiesPromise = listCities()
    .then((data) => {
      citiesCache = Array.isArray(data) ? data : [];
      return citiesCache;
    })
    .catch(() => {
      citiesPromise = null;
      return [];
    });
  return citiesPromise;
}

/** Clear the in-memory cache. Admin pages call this after a CRUD mutation. */
export function invalidateAppSettings() {
  categoriesCache = null;
  categoriesPromise = null;
  citiesCache = null;
  citiesPromise = null;
}

export function useCategories() {
  const [categories, setCategories] = useState(categoriesCache || []);
  const [loading, setLoading] = useState(!categoriesCache);

  useEffect(() => {
    let active = true;
    if (categoriesCache) {
      setCategories(categoriesCache);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    loadCategories().then((data) => {
      if (!active) return;
      setCategories(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { categories, loading };
}

export function useCities() {
  const [cities, setCities] = useState(citiesCache || []);
  const [loading, setLoading] = useState(!citiesCache);

  useEffect(() => {
    let active = true;
    if (citiesCache) {
      setCities(citiesCache);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    loadCities().then((data) => {
      if (!active) return;
      setCities(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { cities, loading };
}

export function useSubCategoriesFlat() {
  const { categories, loading } = useCategories();
  const flat = [];
  for (const c of categories) {
    for (const s of c.subCategories || []) {
      flat.push({
        id: s.id,
        name: s.name,
        slug: s.slug,
        parentSubCategoryId: s.parentSubCategoryId || null,
        featured: !!s.featured,
        categoryId: c.id,
        categoryName: c.name,
        categorySlug: c.slug,
      });
    }
  }
  return { subCategories: flat, loading };
}

export default useCategories;
