'use client';

import { useState } from 'react';
import { Mail, Phone, MapPin, CheckCircle2, Clock, Loader2, AlertCircle } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import LeadGenFloater from '@/components/common/LeadGenFloater';
import Card from '@/components/common/Card';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import { useLanguage } from '@/components/LanguageProvider';
import { post } from '@/services/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactPage() {
  const { t } = useLanguage();

  const CONTACT_DETAILS = [
    {
      icon: Mail,
      label: t('contact.details.email.label'),
      value: 'support@profirmo.com',
      hint: t('contact.details.email.hint'),
    },
    {
      icon: Phone,
      label: t('contact.details.phone.label'),
      value: '+91 22 4000 1100',
      hint: t('contact.details.phone.hint'),
    },
    {
      icon: MapPin,
      label: t('contact.details.visit.label'),
      value: t('contact.details.visit.value'),
      hint: t('contact.details.visit.hint'),
    },
  ];

  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setSubmitted(false);
    setSubmitError('');
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = t('contact.error.name');
    if (!form.email.trim()) {
      next.email = t('contact.error.emailRequired');
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
      next.email = t('contact.error.emailInvalid');
    }
    if (!form.subject.trim()) next.subject = t('contact.error.subject');
    if (!form.message.trim()) next.message = t('contact.error.message');
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setSubmitted(false);
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await post('/api/support/contact', {
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setSubmitted(true);
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setSubmitError(
        err.message || 'Could not send your message. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Page header */}
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              {t('contact.hero.title')}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
              {t('contact.hero.subtitle')}
            </p>
          </div>
        </section>

        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
              {/* Form */}
              <div className="lg:col-span-3">
                <Card padding={false} className="p-6 sm:p-8">
                  <h2 className="text-xl font-semibold text-slate-900">
                    {t('contact.form.title')}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('contact.form.subtitle')}
                  </p>

                  {submitted && (
                    <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                      <CheckCircle2
                        size={20}
                        className="mt-0.5 flex-shrink-0 text-emerald-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-emerald-800">
                          {t('contact.form.successTitle')}
                        </p>
                        <p className="mt-0.5 text-sm text-emerald-700">
                          {t('contact.form.successBody')}
                        </p>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <Input
                        label={t('contact.form.nameLabel')}
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder={t('contact.form.namePlaceholder')}
                        error={errors.name}
                        required
                      />
                      <Input
                        label={t('contact.form.emailLabel')}
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder={t('contact.form.emailPlaceholder')}
                        error={errors.email}
                        required
                      />
                    </div>
                    <Input
                      label={t('contact.form.subjectLabel')}
                      name="subject"
                      value={form.subject}
                      onChange={handleChange}
                      placeholder={t('contact.form.subjectPlaceholder')}
                      error={errors.subject}
                      required
                    />
                    <div className="w-full">
                      <label
                        htmlFor="message"
                        className="mb-1.5 block text-sm font-medium text-slate-700"
                      >
                        {t('contact.form.messageLabel')}
                        <span className="ml-0.5 text-red-500">*</span>
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        value={form.message}
                        onChange={handleChange}
                        rows={5}
                        placeholder={t('contact.form.messagePlaceholder')}
                        aria-invalid={errors.message ? 'true' : 'false'}
                        className={`w-full rounded-lg border px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 ${
                          errors.message
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                            : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200'
                        }`}
                      />
                      {errors.message && (
                        <p className="mt-1 text-xs text-red-600">
                          {errors.message}
                        </p>
                      )}
                    </div>
                    <Button type="submit" size="lg" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Sending…
                        </>
                      ) : (
                        t('contact.form.submit')
                      )}
                    </Button>
                    {submitError && (
                      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <span>{submitError}</span>
                      </div>
                    )}
                  </form>
                </Card>
              </div>

              {/* Contact details */}
              <div className="space-y-4 lg:col-span-2">
                {CONTACT_DETAILS.map((detail) => {
                  const Icon = detail.icon;
                  return (
                    <Card key={detail.label}>
                      <div className="flex items-start gap-4">
                        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          <Icon size={20} />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {detail.label}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-700">
                            {detail.value}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {detail.hint}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
                <Card className="bg-slate-50">
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600">
                      <Clock size={20} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {t('contact.details.hours.label')}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-700">
                        {t('contact.details.hours.value')}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t('contact.details.hours.hint')}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <LeadGenFloater source="contact-page" />
    </div>
  );
}
