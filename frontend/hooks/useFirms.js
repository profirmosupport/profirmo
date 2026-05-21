'use client';

// Firms listing hook with offline mock fallback and client-side
// filtering/sorting.

import { useState, useEffect, useCallback, useMemo } from 'react';
import firmService from '@/services/firmService';
import { firms as mockFirms } from '@/data/mockData';

/**
 * Apply filtering + sorting to a list of firms.
 * Recognised params: search, firmType, city, minRating, sort.
 */
function applyFilters(list, params = {}) {
  let result = Array.isArray(list) ? [...list] : [];
  const { search, firmType, city, minRating, sort } = params;

  if (search) {
    const q = String(search).toLowerCase();
    result = result.filter((f) =>
      [f.name, f.firmType, f.city, f.description]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }

  if (firmType) {
    result = result.filter((f) => f.firmType === firmType);
  }

  if (city) {
    result = result.filter((f) => f.city === city);
  }

  if (minRating !== undefined && minRating !== null) {
    result = result.filter((f) => f.rating >= Number(minRating));
  }

  switch (sort) {
    case 'rating':
      result.sort((a, b) => b.rating - a.rating);
      break;
    case 'professionals':
      result.sort((a, b) => b.professionalCount - a.professionalCount);
      break;
    case 'reviews':
      result.sort((a, b) => b.reviewsCount - a.reviewsCount);
      break;
    default:
      break;
  }

  return result;
}

export function useFirms(initialParams = {}) {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [params, setParams] = useState(initialParams);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await firmService.getAll();
      const data = (res && res.data) || [];
      setRawData(Array.isArray(data) && data.length ? data : mockFirms);
    } catch (err) {
      setError(err.message || 'Failed to load firms.');
      setRawData(mockFirms);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const firms = useMemo(() => applyFilters(rawData, params), [rawData, params]);

  return {
    firms,
    loading,
    error,
    params,
    setParams,
    refetch: fetchData,
  };
}

export default useFirms;
