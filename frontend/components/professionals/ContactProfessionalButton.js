'use client';

// ContactProfessionalButton — drop-in CTA that opens the
// ContactProfessionalModal for a given professional. Used on the
// professional card and the profile header for pros who aren't available
// for instant online booking, so visitors can still submit a lead.
//
// The heavy modal (form + submit) is `next/dynamic`-loaded only on first
// open, so listing pages full of cards don't ship the form code up front.

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Mail } from 'lucide-react';
import Button from '@/components/common/Button';
import { useLanguage } from '@/components/LanguageProvider';

const ContactProfessionalModal = dynamic(
  () => import('./ContactProfessionalModal'),
  { ssr: false, loading: () => null }
);

export default function ContactProfessionalButton({
  professional,
  variant = 'primary',
  size = 'sm',
  className = '',
  showIcon = true,
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!professional || !professional.id) return null;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        {showIcon && <Mail size={size === 'sm' ? 14 : 16} />}
        {submitted
          ? t('profCmp.contactSent')
          : t('profCmp.contactDetails')}
      </Button>
      {open && (
        <ContactProfessionalModal
          professional={professional}
          onClose={() => setOpen(false)}
          onSubmitted={() => setSubmitted(true)}
        />
      )}
    </>
  );
}
