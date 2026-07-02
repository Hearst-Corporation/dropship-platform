'use client';

import { useState } from 'react';
import { DS } from '@/lib/design/css-vars';

interface FaqItem {
  question: string;
  answer: string;
}

interface SmartFAQProps {
  items?: FaqItem[];
  title?: string;
}

const FALLBACK_FAQ: FaqItem[] = [
  {
    question: 'Quels sont les délais de livraison ?',
    answer: 'La livraison en France métropolitaine prend généralement 7 à 15 jours ouvrés.',
  },
  {
    question: 'Puis-je retourner ma commande ?',
    answer: 'Oui, vous disposez de 30 jours pour retourner un article qui ne vous conviendrait pas.',
  },
  {
    question: 'Le paiement est-il sécurisé ?',
    answer: 'Oui, tous les paiements sont traités par Stripe et entièrement sécurisés.',
  },
];

export function SmartFAQ({ items, title }: SmartFAQProps) {
  const faqs = items?.length ? items : FALLBACK_FAQ;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-16 sm:py-24" style={{ backgroundColor: 'var(--ds-surface)' }}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2
          className="mb-10 text-center text-2xl font-bold tracking-tight"
          style={{ fontFamily: 'var(--ds-font-display)' }}
        >
          {title ?? 'Questions fréquentes'}
        </h2>
        <div className="space-y-4">
          {faqs.map((f, i) => (
            <div
              key={i}
              className="rounded-xl border p-4"
              style={{ borderColor: DS.border, backgroundColor: 'var(--ds-bg)' }}
            >
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between text-left font-medium"
                style={{ color: 'var(--ds-text)' }}
              >
                {f.question}
                <span className="text-lg" style={{ color: DS.accent }}>
                  {open === i ? '−' : '+'}
                </span>
              </button>
              {open === i && (
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ds-text-muted)' }}>
                  {f.answer}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
