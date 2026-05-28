'use client';

// useLocations — fetches the admin-managed Country → State → City tree
// from /api/app-settings/locations once per session and exposes helpers
// the cascading dropdowns + the practice-cities multi-select need.
//
// Provided helpers on the returned object:
//   countries: Array<{ id, name, slug, code, states: [...] }>
//   statesByCountry(countryId): Array<{ id, name, ... }>
//   citiesByState(stateId):     Array<{ id, name, ... }>
//   flatCities:                 Array<{ id, name, stateId, stateName, countryName, label: 'State — City' }>
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
      for (const city of state.cities || []) {
        const enriched = {
          id: city.id,
          name: city.name,
          stateId: state.id,
          stateName: state.name,
          countryId: country.id,
          countryName: country.name,
          label: `${state.name} — ${city.name}`,
        };
        cityById.set(city.id, enriched);
        flatCities.push(enriched);
      }
    }
  }

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
