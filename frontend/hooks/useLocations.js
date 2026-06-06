'use client';

// useLocations — fetches the admin-managed Country → State → City tree
// from /api/app-settings/locations once per session and exposes helpers
// the cascading dropdowns + the practice-cities multi-select need.
//
// Provided helpers on the returned object:
//   countries: Array<{ id, name, slug, code, states: [...] }>
//   statesByCountry(countryId): Array<{ id, name, ... }>
//   citiesByState(stateId):     Array<{ id, name, ... }>
//   flatCities:                 Array<{ id, name, stateId, stateName, stateCode, countryName, label: 'UP — Lucknow' }>, sorted by state code then city
//   cityById(id):               object | null
//   loading

import { useEffect, useState } from 'react';
import { get } from '@/services/api';

let cache = null;
let pending = null;

function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

async function load() {
  if (cache) return cache;
  if (pending) return pending;
  pending = (async () => {
    try {
      const res = await get('/api/app-settings/locations');
      const data = unwrap(res) || [];
      cache = Array.isArray(data) ? data : [];
      return cache;
    } catch {
      pending = null;
      return [];
    }
  })();
  return pending;
}

export function invalidateLocations() {
  cache = null;
  pending = null;
}

export function useLocations() {
  const [countries, setCountries] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let active = true;
    if (cache) {
      setCountries(cache);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    load().then((data) => {
      if (!active) return;
      setCountries(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // Index by id for O(1) lookups by the cascading dropdowns.
  const countryById = new Map(countries.map((c) => [c.id, c]));
  const stateById = new Map();
  const cityById = new Map();
  const flatCities = [];

  for (const country of countries) {
    for (const state of country.states || []) {
      stateById.set(state.id, {
        ...state,
        countryName: country.name,
        countryId: country.id,
      });
      // Prefer the admin-maintained 2-letter state code (e.g. UP, MH, DL)
      // and fall back to the first two letters of the state name when a
      // code has not been entered yet.
      const stateCode =
        String(state.code || '').trim() ||
        String(state.name || '')
          .trim()
          .slice(0, 2)
          .toUpperCase();
      for (const city of state.cities || []) {
        const enriched = {
          id: city.id,
          name: city.name,
          stateId: state.id,
          stateName: state.name,
          stateCode,
          countryId: country.id,
          countryName: country.name,
          label: `${stateCode} — ${city.name}`,
        };
        cityById.set(city.id, enriched);
        flatCities.push(enriched);
      }
    }
  }
  // Order the flat list by state code (so all UP cities sit together
  // alphabetically with the rest of the country), then by city name.
  flatCities.sort(
    (a, b) =>
      String(a.stateCode).localeCompare(String(b.stateCode), undefined, {
        sensitivity: 'base',
      }) ||
      String(a.name).localeCompare(String(b.name), undefined, {
        sensitivity: 'base',
      })
  );

  function statesByCountry(countryId) {
    const c = countryById.get(countryId);
    return c ? c.states || [] : [];
  }
  function citiesByState(stateId) {
    const s = stateById.get(stateId);
    return s ? s.cities || [] : [];
  }

  return {
    countries,
    loading,
    statesByCountry,
    citiesByState,
    flatCities,
    cityById: (id) => cityById.get(id) || null,
    stateById: (id) => stateById.get(id) || null,
    countryById: (id) => countryById.get(id) || null,
  };
}

export default useLocations;
