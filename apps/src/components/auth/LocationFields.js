// LocationFields — three cascading SearchableSelects for Country →
// State → City. Used by the signup wizard AND the profile editor so
// the address-edit UI reads identically on both surfaces.
//
// Props:
//   countries  - hierarchy: [{ id, name, states: [{ id, name, cities: [...] }] }]
//   countryId, stateId, cityId  - currently selected ids
//   onChange({ countryId, stateId, cityId })
//   errors = { country, state, city }

import { View } from 'react-native';
import SearchableSelect from './SearchableSelect';

export default function LocationFields({
  countries,
  countryId,
  stateId,
  cityId,
  onChange,
  errors = {},
}) {
  const country = countries.find((c) => c.id === countryId) || null;
  const states = country ? country.states || [] : [];
  const stateRow = states.find((s) => s.id === stateId) || null;
  const cities = stateRow ? stateRow.cities || [] : [];

  return (
    <View>
      <SearchableSelect
        label="Country"
        icon="globe"
        placeholder="Select country…"
        options={countries.map((c) => ({ value: c.id, label: c.name }))}
        value={countryId}
        onChange={(v) =>
          onChange({ countryId: v, stateId: '', cityId: '' })
        }
        error={errors.country}
      />
      <SearchableSelect
        label="State"
        icon="map"
        placeholder={countryId ? 'Select state…' : 'Pick a country first'}
        options={states.map((s) => ({ value: s.id, label: s.name }))}
        value={stateId}
        onChange={(v) => onChange({ countryId, stateId: v, cityId: '' })}
        disabled={!countryId}
        error={errors.state}
      />
      <SearchableSelect
        label="City"
        icon="map-pin"
        placeholder={stateId ? 'Select city…' : 'Pick a state first'}
        options={cities.map((c) => ({ value: c.id, label: c.name }))}
        value={cityId}
        onChange={(v) => onChange({ countryId, stateId, cityId: v })}
        disabled={!stateId}
        error={errors.city}
      />
    </View>
  );
}
