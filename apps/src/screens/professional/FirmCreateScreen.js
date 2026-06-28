// FirmCreateScreen — mobile form for creating a law firm.
// Mirrors the web's /firm create page. Submits to POST /api/law-firm;
// the backend gates the call on the caller being an APPROVED
// professional. On success we route back to Manage firm where the
// new membership card surfaces immediately.

import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import ScreenContainer from '../../components/common/ScreenContainer';
import AuthInput from '../../components/auth/AuthInput';
import GradientButton from '../../components/auth/GradientButton';
import PhotoUpload from '../../components/auth/PhotoUpload';
import { createMyFirm } from '../../services/firmService';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function FirmCreateScreen({ navigation }) {
  const [form, setForm] = useState({
    // Identity
    firmName: '',
    registrationNumber: '',
    logo: '',
    website: '',
    establishedYear: '',
    // Contact
    headquarters: '',
    contactEmail: '',
    contactNumber: '',
    // Team
    totalEmployees: '',
    numberOfProfessionals: '',
    // Practice + social
    practiceAreas: '',
    linkedin: '',
    twitter: '',
    facebook: '',
    // About
    about: '',
    // Documents (logo handled separately above)
    registrationCertificate: '',
    businessLicense: '',
    taxDocuments: [], // array of S3 key strings
  });
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState({ text: '', tone: 'info' });
  const [errors, setErrors] = useState({});

  function set(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => (p[k] ? { ...p, [k]: undefined } : p));
    setBanner((b) => (b.text ? { text: '', tone: 'info' } : b));
  }

  function validate() {
    const e = {};
    if (!form.firmName.trim()) e.firmName = 'Firm name is required.';
    if (
      form.contactEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())
    ) {
      e.contactEmail = 'Enter a valid email.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (saving) return;
    if (!validate()) return;
    setSaving(true);
    setBanner({ text: '', tone: 'info' });
    try {
      const csvToArr = (s) =>
        String(s || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
      const payload = {
        firmName: form.firmName.trim(),
        registrationNumber: form.registrationNumber.trim() || undefined,
        logo: form.logo || undefined,
        website: form.website.trim() || undefined,
        establishedYear: form.establishedYear
          ? Number(form.establishedYear)
          : null,
        about: form.about.trim() || undefined,
        headquarters: form.headquarters.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        contactNumber: form.contactNumber.trim() || undefined,
        totalEmployees: form.totalEmployees
          ? Number(form.totalEmployees)
          : null,
        numberOfProfessionals: form.numberOfProfessionals
          ? Number(form.numberOfProfessionals)
          : null,
        practiceAreas: csvToArr(form.practiceAreas),
        socialLinks: {
          linkedin: form.linkedin.trim() || undefined,
          twitter: form.twitter.trim() || undefined,
          facebook: form.facebook.trim() || undefined,
        },
        registrationCertificate:
          form.registrationCertificate || undefined,
        businessLicense: form.businessLicense || undefined,
        taxDocuments: form.taxDocuments.filter(Boolean),
      };
      await createMyFirm(payload);
      // Bounce back to Manage firm — the screen reloads its
      // membership on focus and the new firm appears.
      if (navigation && navigation.goBack) navigation.goBack();
    } catch (err) {
      setBanner({
        text: err?.message || 'Could not create the firm.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  function addTaxDoc() {
    setForm((p) => ({ ...p, taxDocuments: [...p.taxDocuments, ''] }));
  }
  function updateTaxDoc(idx, url) {
    setForm((p) => {
      const next = [...p.taxDocuments];
      next[idx] = url;
      return { ...p, taxDocuments: next };
    });
  }
  function removeTaxDoc(idx) {
    setForm((p) => ({
      ...p,
      taxDocuments: p.taxDocuments.filter((_, i) => i !== idx),
    }));
  }

  return (
    <ScreenContainer hasNavHeader keyboard contentStyle={styles.page}>
      <Text style={styles.intro}>
        Set up your law firm. Once submitted, an admin will review and
        approve it. You&apos;ll be the owner.
      </Text>

      {banner.text ? (
        <View
          style={[
            styles.banner,
            banner.tone === 'success'
              ? styles.bannerSuccess
              : styles.bannerError,
          ]}
        >
          <Feather
            name={banner.tone === 'success' ? 'check-circle' : 'alert-circle'}
            size={14}
            color={banner.tone === 'success' ? '#047857' : colors.danger}
          />
          <Text
            style={[
              styles.bannerText,
              banner.tone === 'success'
                ? { color: '#047857' }
                : { color: colors.danger },
            ]}
          >
            {banner.text}
          </Text>
          <Pressable
            onPress={() => setBanner({ text: '', tone: 'info' })}
            hitSlop={6}
          >
            <Feather
              name="x"
              size={12}
              color={banner.tone === 'success' ? '#047857' : colors.danger}
            />
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.formSection}>Firm logo</Text>
      <PhotoUpload
        value={form.logo}
        onChange={(url) => set('logo', url)}
        category="firm_logo"
      />

      <Text style={styles.formSection}>Identity</Text>
      <AuthInput
        label="Firm name"
        icon="briefcase"
        autoCapitalize="words"
        placeholder="Chauhan Associates"
        value={form.firmName}
        onChangeText={(v) => set('firmName', v)}
        error={errors.firmName}
      />
      <AuthInput
        label="Registration number"
        icon="hash"
        value={form.registrationNumber}
        onChangeText={(v) => set('registrationNumber', v)}
      />
      <AuthInput
        label="Established year"
        icon="calendar"
        keyboardType="number-pad"
        value={form.establishedYear}
        onChangeText={(v) =>
          set('establishedYear', v.replace(/[^0-9]/g, '').slice(0, 4))
        }
      />
      <AuthInput
        label="Website"
        icon="link"
        keyboardType="url"
        value={form.website}
        onChangeText={(v) => set('website', v)}
      />

      <Text style={styles.formSection}>Contact</Text>
      <AuthInput
        label="Contact email"
        icon="mail"
        keyboardType="email-address"
        value={form.contactEmail}
        onChangeText={(v) => set('contactEmail', v)}
        error={errors.contactEmail}
      />
      <AuthInput
        label="Contact number"
        icon="phone"
        keyboardType="phone-pad"
        value={form.contactNumber}
        onChangeText={(v) => set('contactNumber', v)}
      />
      <AuthInput
        label="Headquarters"
        icon="map-pin"
        autoCapitalize="words"
        value={form.headquarters}
        onChangeText={(v) => set('headquarters', v)}
      />

      <Text style={styles.formSection}>Team</Text>
      <AuthInput
        label="Total employees"
        icon="users"
        keyboardType="number-pad"
        value={form.totalEmployees}
        onChangeText={(v) =>
          set('totalEmployees', v.replace(/[^0-9]/g, ''))
        }
      />
      <AuthInput
        label="Number of professionals"
        icon="user-check"
        keyboardType="number-pad"
        value={form.numberOfProfessionals}
        onChangeText={(v) =>
          set('numberOfProfessionals', v.replace(/[^0-9]/g, ''))
        }
      />

      <Text style={styles.formSection}>Practice areas</Text>
      <AuthInput
        label="Practice areas"
        icon="tag"
        placeholder="Corporate, Tax, Family law"
        autoCapitalize="words"
        value={form.practiceAreas}
        onChangeText={(v) => set('practiceAreas', v)}
        hint="Comma-separated list."
      />

      <Text style={styles.formSection}>Social links</Text>
      <AuthInput
        label="LinkedIn URL"
        icon="linkedin"
        keyboardType="url"
        value={form.linkedin}
        onChangeText={(v) => set('linkedin', v)}
      />
      <AuthInput
        label="Twitter / X URL"
        icon="twitter"
        keyboardType="url"
        value={form.twitter}
        onChangeText={(v) => set('twitter', v)}
      />
      <AuthInput
        label="Facebook URL"
        icon="facebook"
        keyboardType="url"
        value={form.facebook}
        onChangeText={(v) => set('facebook', v)}
      />

      <Text style={styles.formSection}>About</Text>
      <AuthInput
        label="Short description"
        icon="edit-3"
        autoCapitalize="sentences"
        multiline
        numberOfLines={4}
        value={form.about}
        onChangeText={(v) => set('about', v)}
      />

      <Text style={styles.formSection}>Documents</Text>
      <Text style={styles.formHint}>
        Upload identity / registration documents required for firm
        approval. PDFs or images.
      </Text>

      <Text style={styles.docLabel}>Registration certificate</Text>
      <PhotoUpload
        value={form.registrationCertificate}
        onChange={(url) => set('registrationCertificate', url)}
        category="firm_document"
      />

      <Text style={[styles.docLabel, { marginTop: spacing.md }]}>
        Business license
      </Text>
      <PhotoUpload
        value={form.businessLicense}
        onChange={(url) => set('businessLicense', url)}
        category="firm_document"
      />

      <Text style={[styles.docLabel, { marginTop: spacing.md }]}>
        Tax documents
      </Text>
      {form.taxDocuments.length === 0 ? (
        <Text style={styles.formHint}>
          Optional — add GST, PAN, or similar certificates.
        </Text>
      ) : null}
      {form.taxDocuments.map((doc, idx) => (
        <View key={idx} style={{ marginBottom: spacing.sm }}>
          <View style={styles.taxDocHead}>
            <Text style={styles.docLabel}>Document {idx + 1}</Text>
            <Pressable
              onPress={() => removeTaxDoc(idx)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.removeBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Feather name="trash-2" size={12} color={colors.danger} />
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
          <PhotoUpload
            value={doc}
            onChange={(url) => updateTaxDoc(idx, url)}
            category="firm_document"
          />
        </View>
      ))}
      <Pressable
        onPress={addTaxDoc}
        style={({ pressed }) => [
          styles.addDocBtn,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Feather name="plus" size={13} color={colors.primary} />
        <Text style={styles.addDocText}>Add tax document</Text>
      </Pressable>

      <GradientButton
        title={saving ? 'Creating…' : 'Create firm'}
        loading={saving}
        onPress={submit}
        style={{ marginTop: spacing.lg }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: spacing.md, gap: spacing.sm },
  intro: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  formSection: {
    marginTop: spacing.md,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  bannerError: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  bannerSuccess: { backgroundColor: '#d1fae5', borderColor: '#6ee7b7' },
  bannerText: { flex: 1, fontSize: 12, fontWeight: fontWeight.semibold },
  formHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  docLabel: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  taxDocHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: '#fff5f5',
  },
  removeText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.danger,
  },
  addDocBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  addDocText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
});
