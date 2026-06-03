'use client';

// Professionals listing hook — fetches ONLY from the backend API.
// Filtering/sorting/pagination is done server-side; this hook simply forwards
// the current filter params as query string params and exposes the result.
// There is no mock-data fallback: on an API error the list is empty and the
// error message is surfaced.

import { useState, useEffect, useCallback, useRef } from 'react';
import professionalService from '@/services/professionalService';

/**
 * Map the UI filter params to the backend query params.
 * Unknown / empty values are dropped by api.js when the query string is built.
 */
function toQuery(params = {}) {
  const {
    search,
    category,
    professionalType,
    professionType, // legacy alias from older callers
    // Admin-managed taxonomy filter. `subCategoryId` matches a single
    // sub-category exactly; `subCategoryIdsAny` matches any in a comma-
    // separated set. Both go to the backend untouched.
    subCategoryId,
    subCategoryIdsAny,
    specialization,
    expertise,
    practiceArea,
    city,
    location,
    language,
    availableNow,
    experience,
    minExperience,
    maxExperience,
    minFee,
    maxFee,
    minRate, // legacy alias
    maxRate, // legacy alias
    minRating,
    sort,
    page,
    limit,
  } = params;

  // Normalise the legacy `price_low` / `price_high` sort values the old UI used
  // into the values the API understands.
  let apiSort = sort;
  if (sort === 'price_low' || sort === 'price_high') apiSort = 'fee';
  if (sort === 'availability') apiSort = undefined;

  return {
    search: search || undefined,
    professionalType: professionalType || professionType || (category && !String(category).startsWith('subcat-') ? category : undefined) || undefined,
    subCategoryId:
      subCategoryId ||
      (category && String(category).startsWith('subcat-') ? category : undefined) ||
      undefined,
    subCategoryIdsAny: Array.isArray(subCategoryIdsAny)
      ? subCategoryIdsAny.join(',') || undefined
      : subCategoryIdsAny || undefined,
    specialization: specialization || undefined,
    expertise: expertise || undefined,
    practiceArea: practiceArea || undefined,
    city: city || location || undefined,
    language: language || undefined,
    availableNow: availableNow === true || availableNow === 'true' ? 'true' : undefined,
    experience: experience && experience !== 'any' ? experience : undefined,
    minExperience: minExperience ?? undefined,
    maxExperience:
      maxExperience !== undefined && Number.isFinite(Number(maxExperience))
        ? maxExperience
        : undefined,
    minFee: minFee ?? minRate ?? undefined,
    maxFee:
      (maxFee ?? maxRate) !== undefined &&
      Number.isFinite(Number(maxFee ?? maxRate))
        ? maxFee ?? maxRate
        : undefined,
    minRating: minRating || undefined,
    sort: apiSort || undefined,
    page: page || undefined,
    limit: limit || undefined,
  };
}

export function useProfessionals(initialParams = {}) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [params, setParams] = useState(initialParams);

  // Serialise the params so the fetch effect only re-runs on a real change.
  const query = toQuery(params);
  const queryKey = JSON.stringify(query);
  const requestId = useRef(0);

  const fetchData = useCallback(async () => {
    const myRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await professionalService.getAll(query);
      // Ignore stale responses if params changed while this was in flight.
      if (myRequest !== requestId.current) return;
      setItems(Array.isArray(res && res.data) ? res.data : []);
      setMeta((res && res.meta) || null);
    } catch (err) {
      if (myRequest !== requestId.current) return;
      setError(err.message || 'Failed to load professionals.');
      setItems([]);
      setMeta(null);
    } finally {
      if (myRequest === requestId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    items,
    // Backward-compatible alias for pages that still read `professionals`.
    professionals: items,
    meta,
    loading,
    error,
    params,
    setParams,
    refetch: fetchData,
  };
}

export default useProfessionals;
