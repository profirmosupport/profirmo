'use client';

import { useState } from 'react';
import { Mail, Phone, MapPin, CheckCircle2, Clock } from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Card from '@/components/common/Card';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';

const CONTACT_DETAILS = [
  {
    icon: Mail,
    label: 'Email us',
    value: 'support@profirmo.in',
    hint: 'We reply within one business day.',
  },
  {
    icon: Phone,
    label: 'Call us',
    value: '+91 22 4000 1100',
    hint: 'Mon to Sat, 9:00 AM to 7:00 PM.',
  },
  {
    icon: MapPin,
    label: 'Visit us',
    value: '7th Floor, Nariman Point, Mumbai, Maharashtra 400021',
    hint: 'By appointment only.',
  },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setSubmitted(false);
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = 'Please enter your name.';
    if (!form.email.trim()) {
      next.email = 'Please enter your email.';
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
      next.email = 'Please enter a valid email address.';
    }
    if (!form.subject.trim()) next.subject = 'Please enter a subject.';
    if (!form.message.trim()) next.message = 'Please enter a message.';
    return next;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setSubmitted(false);
      return;
    }
    setSubmitted(true);
    setForm({ name: '', email: '', subject: '', message: '' });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Page header */}
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Contact us
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
              Have a question about Profirmo? We would love to hear from you —
              send us a message and our team will get back to you.
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
                    Send us a message
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Fill in the form below and we will respond shortly.
                  </p>

                  {submitted && (
                    <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                      <CheckCircle2
                        size={20}
                        className="mt-0.5 flex-shrink-0 text-emerald-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-emerald-800">
                          Thanks — we&apos;ll get back to you.
                        </p>
                        <p className="mt-0.5 text-sm text-emerald-700">
                          Your message has been received. Our team will reply
                          within one business day.
                        </p>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <Input
                        label="Full name"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Your name"
                        error={errors.name}
                        required
                      />
                      <Input
                        label="Email address"
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        error={errors.email}
                        required
                      />
                    </div>
                    <Input
                      label="Subject"
                      name="subject"
                      value={form.subject}
                      onChange={handleChange}
                      placeholder="How can we help?"
                      error={errors.subject}
                      required
                    />
                    <div className="w-full">
                      <label
                        htmlFor="message"
                        className="mb-1.5 block text-sm font-medium text-slate-700"
                      >
                        Message
                        <span className="ml-0.5 text-red-500">*</span>
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        value={form.message}
                        onChange={handleChange}
                        rows={5}
                        placeholder="Tell us a bit more..."
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
                    <Button type="submit" size="lg">
                      Send message
                    </Button>
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
                        Support hours
                      </p>
                      <p className="mt-0.5 text-sm text-slate-700">
                        Monday to Saturday
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        9:00 AM to 7:00 PM IST. Closed on public holidays.
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
    </div>
  );
}
