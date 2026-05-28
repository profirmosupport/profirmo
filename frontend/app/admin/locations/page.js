'use client';

// Admin — App Settings: Locations (Country → State → City).
// Renders the three-level tree as collapsible cards. Each level supports
// add / edit / delete; the writes propagate immediately to every signup,
// profile-edit and search dropdown across the platform.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe2,
  MapPin,
  Building2,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Input from '@/components/common/Input';
import Modal from '@/components/common/Modal';
import EmptyState from '@/components/common/EmptyState';
import { useAuth } from '@/components/AuthProvider';
import { ROLES } from '@/utils/constants';
import {
  adminListLocations,
  adminCreateCountry,
  adminUpdateCountry,
  adminDeleteCountry,
  adminCreateState,
  adminUpdateState,
  adminDeleteState,
  adminCreateCityForState,
  adminUpdateCityHierarchical,
  adminDeleteCityHierarchical,
} from '@/services/appSettingsService';
import { invalidateLocations } from '@/hooks/useLocations';

const EMPTY_COUNTRY_FORM = { name: '', code: '', sortOrder: 0, active: true };
const EMPTY_STATE_FORM = { name: '', sortOrder: 0, active: true };
const EMPTY_CITY_FORM = { name: '', sortOrder: 0, active: true };

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="h-24 w-full animate-pulse rounded-xl bg-slate-100"
        />
      ))}
    </div>
  );
}

export default function AdminLocationsPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedCountries, setExpandedCountries] = useState(() => new Set());
  const [expandedStates, setExpandedStates] = useState(() => new Set());

  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const isAdmin = user && user.role === ROLES.PLATFORM_ADMIN;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/login');
  }, [authLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminListLocations();
      setTree(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load locations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated && isAdmin) load();
  }, [authLoading, isAuthenticated, isAdmin, load]);

  function toggle(setter, id) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function close() {
    if (submitting) return;
    setModal(null);
    setModalError('');
  }

  async function submit(e) {
    if (e) e.preventDefault();
    if (!modal || submitting) return;
    setSubmitting(true);
    setModalError('');
    try {
      const { kind, mode, target, form } = modal;
      if (kind === 'country') {
        if (mode === 'create') await adminCreateCountry(form);
        else if (mode === 'edit') await adminUpdateCountry(target.id, form);
        else if (mode === 'delete') await adminDeleteCountry(target.id);
      } else if (kind === 'state') {
        if (mode === 'create')
          await adminCreateState({ ...form, countryId: modal.countryId });
        else if (mode === 'edit') await adminUpdateState(target.id, form);
        else if (mode === 'delete') await adminDeleteState(target.id);
      } else if (kind === 'city') {
        if (mode === 'create')
          await adminCreateCityForState({ ...form, stateId: modal.stateId });
        else if (mode === 'edit')
          await adminUpdateCityHierarchical(target.id, form);
        else if (mode === 'delete')
          await adminDeleteCityHierarchical(target.id);
      }
      invalidateLocations();
      setModal(null);
      await load();
    } catch (err) {
      setModalError(err.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  }

  // --- Modal openers ------------------------------------------------------
  function openCountryCreate() {
    setModal({ kind: 'country', mode: 'create', form: { ...EMPTY_COUNTRY_FORM } });
    setModalError('');
  }
  function openCountryEdit(c) {
    setModal({
      kind: 'country',
      mode: 'edit',
      target: c,
      form: {
        name: c.name,
        code: c.code || '',
        sortOrder: c.sortOrder || 0,
        active: !!c.active,
      },
    });
    setModalError('');
  }
  function openCountryDelete(c) {
    setModal({ kind: 'country', mode: 'delete', target: c });
    setModalError('');
  }

  function openStateCreate(countryId) {
    setModal({
      kind: 'state',
      mode: 'create',
      countryId,
      form: { ...EMPTY_STATE_FORM },
    });
    setModalError('');
  }
  function openStateEdit(s) {
    setModal({
      kind: 'state',
      mode: 'edit',
      target: s,
      form: {
        name: s.name,
        sortOrder: s.sortOrder || 0,
        active: !!s.active,
      },
    });
    setModalError('');
  }
  function openStateDelete(s) {
    setModal({ kind: 'state', mode: 'delete', target: s });
    setModalError('');
  }

  function openCityCreate(stateId) {
    setModal({
      kind: 'city',
      mode: 'create',
      stateId,
      form: { ...EMPTY_CITY_FORM },
    });
    setModalError('');
  }
  function openCityEdit(c) {
    setModal({
      kind: 'city',
      mode: 'edit',
      target: c,
      form: {
        name: c.name,
        sortOrder: c.sortOrder || 0,
        active: !!c.active,
      },
    });
    setModalError('');
  }
  function openCityDelete(c) {
    setModal({ kind: 'city', mode: 'delete', target: c });
    setModalError('');
  }

  if (authLoading || !isAuthenticated) {
    return <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Locations" />;
  }
  if (!isAdmin) {
    return (
      <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Locations">
        <EmptyState
          icon={<ShieldAlert size={24} />}
          title="Access denied"
          description="Platform administrator account required."
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Locations"
      subtitle="Countries → States → Cities. Drives every address dropdown across the platform."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Globe2 size={18} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {loading
                ? 'Loading…'
                : `${tree.length} countr${tree.length === 1 ? 'y' : 'ies'}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw size={15} />
              Refresh
            </Button>
            <Button size="sm" onClick={openCountryCreate}>
              <Plus size={15} />
              Add country
            </Button>
          </div>
        </div>

        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <Card>
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle size={22} />
              </span>
              <p className="text-sm font-medium text-slate-700">{error}</p>
              <Button size="sm" onClick={load}>
                <RefreshCw size={15} />
                Try again
              </Button>
            </div>
          </Card>
        ) : tree.length === 0 ? (
          <EmptyState
            icon={<Globe2 size={24} />}
            title="No countries yet"
            description="Add a country to start building your location tree."
            action={<Button onClick={openCountryCreate}>Add country</Button>}
          />
        ) : (
          <div className="space-y-3">
            {tree.map((country) => {
              const cOpen = expandedCountries.has(country.id);
              return (
                <Card key={country.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggle(setExpandedCountries, country.id)}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      {cOpen ? (
                        <ChevronDown size={18} className="text-slate-500" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-500" />
                      )}
                      <Globe2 size={16} className="text-amber-600" />
                      <h3 className="text-base font-semibold text-slate-900">
                        {country.name}
                      </h3>
                      {country.code && (
                        <span className="text-xs text-slate-500">{country.code}</span>
                      )}
                      <Badge variant={country.active ? 'green' : 'gray'}>
                        {country.active ? 'Active' : 'Hidden'}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {(country.states || []).length} state{(country.states || []).length === 1 ? '' : 's'}
                      </span>
                    </button>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => openCountryEdit(country)}>
                        <Pencil size={14} /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openCountryDelete(country)}>
                        <Trash2 size={14} /> Delete
                      </Button>
                    </div>
                  </div>

                  {cOpen && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-700">States</p>
                        <Button size="sm" onClick={() => openStateCreate(country.id)}>
                          <Plus size={14} /> Add state
                        </Button>
                      </div>
                      {(country.states || []).length === 0 ? (
                        <p className="text-sm text-slate-500">No states yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {country.states.map((state) => {
                            const sOpen = expandedStates.has(state.id);
                            return (
                              <li key={state.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <button
                                    type="button"
                                    onClick={() => toggle(setExpandedStates, state.id)}
                                    className="flex flex-1 items-center gap-2 text-left"
                                  >
                                    {sOpen ? (
                                      <ChevronDown size={16} className="text-slate-500" />
                                    ) : (
                                      <ChevronRight size={16} className="text-slate-500" />
                                    )}
                                    <MapPin size={14} className="text-teal-600" />
                                    <span className="text-sm font-medium text-slate-800">{state.name}</span>
                                    <Badge variant={state.active ? 'green' : 'gray'}>
                                      {state.active ? 'Active' : 'Hidden'}
                                    </Badge>
                                    <span className="text-xs text-slate-500">
                                      {(state.cities || []).length} cit{(state.cities || []).length === 1 ? 'y' : 'ies'}
                                    </span>
                                  </button>
                                  <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => openStateEdit(state)}>
                                      <Pencil size={14} /> Edit
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => openStateDelete(state)}>
                                      <Trash2 size={14} /> Delete
                                    </Button>
                                  </div>
                                </div>

                                {sOpen && (
                                  <div className="mt-3 border-t border-slate-200 pt-3">
                                    <div className="mb-2 flex items-center justify-between">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Cities
                                      </p>
                                      <Button size="sm" onClick={() => openCityCreate(state.id)}>
                                        <Plus size={14} /> Add city
                                      </Button>
                                    </div>
                                    {(state.cities || []).length === 0 ? (
                                      <p className="text-xs text-slate-500">No cities yet.</p>
                                    ) : (
                                      <ul className="space-y-1.5">
                                        {state.cities.map((city) => (
                                          <li
                                            key={city.id}
                                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5"
                                          >
                                            <div className="flex flex-wrap items-center gap-2">
                                              <Building2 size={12} className="text-slate-400" />
                                              <span className="text-sm text-slate-800">{city.name}</span>
                                              <Badge variant={city.active ? 'green' : 'gray'}>
                                                {city.active ? 'Active' : 'Hidden'}
                                              </Badge>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                              <Button variant="outline" size="sm" onClick={() => openCityEdit(city)}>
                                                <Pencil size={12} /> Edit
                                              </Button>
                                              <Button variant="outline" size="sm" onClick={() => openCityDelete(city)}>
                                                <Trash2 size={12} /> Delete
                                              </Button>
                                            </div>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / edit modal */}
      <Modal
        open={!!modal && modal.mode !== 'delete'}
        onClose={close}
        title={
          !modal
            ? ''
            : modal.mode === 'edit'
              ? `Edit ${modal.kind}`
              : `Add ${modal.kind}`
        }
        footer={
          <>
            <Button variant="outline" size="sm" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={submit} disabled={submitting}>
              {submitting ? 'Saving…' : modal && modal.mode === 'edit' ? 'Save changes' : 'Create'}
            </Button>
          </>
        }
      >
        {modal && modal.mode !== 'delete' && (
          <form onSubmit={submit} className="space-y-3">
            <Input
              label="Name"
              name="name"
              value={modal.form.name}
              onChange={(e) =>
                setModal((m) => ({ ...m, form: { ...m.form, name: e.target.value } }))
              }
              required
            />
            {modal.kind === 'country' && (
              <Input
                label="Code"
                name="code"
                value={modal.form.code || ''}
                onChange={(e) =>
                  setModal((m) => ({ ...m, form: { ...m.form, code: e.target.value } }))
                }
                hint="ISO-2 country code, e.g. IN, US"
              />
            )}
            <Input
              label="Sort order"
              name="sortOrder"
              type="number"
              value={modal.form.sortOrder}
              onChange={(e) =>
                setModal((m) => ({ ...m, form: { ...m.form, sortOrder: e.target.value } }))
              }
              hint="Lower numbers appear first"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={modal.form.active}
                onChange={(e) =>
                  setModal((m) => ({ ...m, form: { ...m.form, active: e.target.checked } }))
                }
              />
              Active (visible in dropdowns)
            </label>
            <button type="submit" className="hidden" aria-hidden="true" />
          </form>
        )}
        {modalError && <p className="mt-3 text-xs text-red-600">{modalError}</p>}
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!modal && modal.mode === 'delete'}
        onClose={close}
        title={`Delete ${modal ? modal.kind : ''}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={submit} disabled={submitting}>
              {submitting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        {modal && modal.mode === 'delete' && (
          <p className="text-sm text-slate-600">
            Permanently delete <strong>{modal.target.name}</strong>?
            {modal.kind !== 'city' && ' Every nested location will be removed too.'}
          </p>
        )}
        {modalError && <p className="mt-3 text-xs text-red-600">{modalError}</p>}
      </Modal>
    </DashboardLayout>
  );
}
