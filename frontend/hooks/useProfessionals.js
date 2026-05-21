'use client';

// Professionals listing hook with offline mock fallback and client-side
// filtering/sorting so filter UIs work even without a backend.

import { useState, useEffect, useCallback, useMemo } from 'react';
import professionalService from '@/services/professionalService';
import { professionals as mockProfessionals } from '@/data/mockData';

/**
 * Apply filtering + sorting to a list of professionals.
 * Recognised params: search, category, professionType, specialization,
 * city, language, availableNow, minExperience, maxExperience, minRate,
 * maxRate, minRating, sort.
 */
function applyFilters(list, params = {}) {
  let result = Array.isArray(list) ? [...list] : [];

  const {
    search,
    category,
    professionType,
    specialization,
    city,
    language,
    availableNow,
    minExperience,
    maxExperience,
    minRate,
    maxRate,
    minRating,
    sort,
  } = params;

  if (search) {
    const q = String(search).toLowerCase();
    result = result.filter((p) =>
      [p.name, p.professionType, p.specialization, p.city, p.bio]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }

  const typeFilter = category || professionType;
  if (typeFilter) {
    result = result.filter((p) => p.professionType === typeFilter);
  }

  if (specialization) {
    result = result.filter((p) => p.specialization === specialization);
  }

  if (city) {
    result = result.filter((p) => p.city === city);
  }

  if (language) {
    result = result.filter(
      (p) => Array.isArray(p.languages) && p.languages.includes(language)
    );
  }

  if (availableNow === true || availableNow === 'true') {
    result = result.filter((p) => p.availableNow === true);
  }

  if (minExperience !== undefined && minExperience !== null) {
    result = result.filter((p) => p.experience >= Number(minExperience));
  }
  if (
    maxExperience !== undefined &&
    maxExperience !== null &&
    Number.isFinite(Number(maxExperience))
  ) {
    result = result.filter((p) => p.experience <= Number(maxExperience));
  }

  if (minRate !== undefined && minRate !== null) {
    result = result.filter((p) => p.perMinuteRate >= Number(minRate));
  }
  if (
    maxRate !== undefined &&
    maxRate !== null &&
    Number.isFinite(Number(maxRate))
  ) {
    result = result.filter((p) => p.perMinuteRate <= Number(maxRate));
  }

  if (minRating !== undefined && minRating !== null) {
    result = result.filter((p) => p.rating >= Number(minRating));
  }

  switch (sort) {
    case 'rating':
      result.sort((a, b) => b.rating - a.rating);
      break;
    case 'experience':
      result.sort((a, b) => b.experience - a.experience);
      break;
    case 'price_low':
      result.sort((a, b) => a.perMinuteRate - b.perMinuteRate);
      break;
    case 'price_high':
      result.sort((a, b) => b.perMinuteRate - a.perMinuteRate);
      break;
    case 'availability':
      result.sort(
        (a, b) => Number(b.availableNow) - Number(a.availableNow)
      );
      break;
    default:
      break;
  }

  return result;
}

export function useProfessionals(initialParams = {}) {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [params, setParams] = useState(initialParams);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await professionalService.getAll();
      const data = (res && res.data) || [];
      setRawData(Array.isArray(data) && data.length ? data : mockProfessionals);
    } catch (err) {
      // Backend offline — fall back to mock data.
      setError(err.message || 'Failed to load professionals.');
      setRawData(mockProfessionals);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const professionals = useMemo(
    () => applyFilters(rawData, params),
    [rawData, params]
  );

  return {
    professionals,
    loading,
    error,
    params,
    setParams,
    refetch: fetchData,
  };
}

export default useProfessionals;
