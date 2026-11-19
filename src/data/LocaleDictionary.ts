export type LocaleCode = 'es' | 'fr' | 'de' | 'sv' | 'en';

export interface SupportedLocale {
  code: LocaleCode;
  name: string;
  label: string;
  previewRequiredHeadings: string[];
  previewCtaPattern: RegExp;
  checkoutRequiredTerms: string[];
}

export const SUPPORTED_LOCALES: SupportedLocale[] = [
  {
    code: 'es',
    name: 'Español',
    label: 'Español (ES)',
    previewRequiredHeadings: [
      'Especificaciones',
      'Elige un paquete',
      'Comprobación de robo',
      'Aspectos destacados del vehículo',
      'Preguntas frecuentes',
    ],
    previewCtaPattern: /Acceder al historial del vehículo|Acceder a la hoja/i,
    checkoutRequiredTerms: [
      'Pago seguro',
      'Resumen del pedido',
      'Cifrado SSL',
      'Tarjeta',
      'Pagar',
      'Aplicar',
      'Acceso inmediato',
    ],
  },
  {
    code: 'fr',
    name: 'Français',
    label: 'Français (FR)',
    previewRequiredHeadings: [
      'Caractéristiques',
      'Choisissez un forfait',
      'Contrôle de vol',
      'Faits marquants du véhicule',
      'Questions fréquentes',
    ],
    previewCtaPattern: /Accéder à l[’']historique du véhicule|Accéder à la fiche/i,
    checkoutRequiredTerms: [
      'Paiement sécurisé',
      'Récapitulatif de la commande',
      'Chiffrement SSL',
      'Carte',
      'Payer',
      'Appliquer',
      'Accès immédiat',
    ],
  },
  {
    code: 'de',
    name: 'Deutsch',
    label: 'Deutsch (DE)',
    previewRequiredHeadings: [
      'Technische Daten',
      'Paket wählen',
      'Überprüfung auf Diebstahl',
      'Fahrzeug-Highlights',
      'Häufig gestellte Fragen',
    ],
    previewCtaPattern: /Auf Fahrzeugverlauf zugreifen|Auf Datenblatt zugreifen/i,
    checkoutRequiredTerms: [
      'Sichere Zahlung',
      'Bestellübersicht',
      'SSL-verschlüsselt',
      'Karte',
      'bezahlen',
      'Anwenden',
      'Sofortiger Zugriff',
    ],
  },
  {
    code: 'sv',
    name: 'Svenska',
    label: 'Svenska (SV)',
    previewRequiredHeadings: [
      'Specifikationer',
      'Välj paket',
      'Stöldkontroll',
      'Fordonets höjdpunkter',
      'Vanliga frågor',
    ],
    previewCtaPattern: /Tillgång till fordons historia|Tillgång till byggblad/i,
    checkoutRequiredTerms: [
      'Säker betalning',
      'Ordersammanfattning',
      'SSL-krypterad',
      'Kort',
      'Betala',
      'Använd',
      'Omedelbar åtkomst',
    ],
  },
  {
    code: 'en',
    name: 'English',
    label: 'English (EN)',
    previewRequiredHeadings: [
      'Specifications',
      'Choose Package',
      'Stolen Check',
      'Vehicle Highlights',
      'Frequently Asked Questions',
    ],
    previewCtaPattern: /Access Vehicle History|Access Build Sheet/i,
    checkoutRequiredTerms: [
      'Secure checkout',
      'Order summary',
      'SSL encrypted',
      'Card',
      'Pay',
      'Apply',
      'Instant access',
    ],
  },
];

export const ENGLISH_CORE_LEAK_MARKERS = {
  preview: [
    'Choose Package',
    'Frequently Asked Questions',
    'Access Vehicle History',
    'Where Do We Send Your Report?',
    "What's In Your Vehicle History Report?",
  ],
  checkout: ['Secure checkout', 'Order summary', 'Instant access', 'Paying as '],
};

export class LocaleDictionary {
  static getByCode(code: string): SupportedLocale {
    const normalized = code.trim().toLowerCase();
    const match = SUPPORTED_LOCALES.find((l) => l.code === normalized);
    if (!match) {
      throw new Error(`[LocaleDictionary] Unsupported locale code: "${code}"`);
    }
    return match;
  }

  static getNonEnglishLocales(): SupportedLocale[] {
    return SUPPORTED_LOCALES.filter((l) => l.code !== 'en');
  }

  static parseCodeFromMenuText(text: string): string | null {
    const match = text.match(/\(([A-Z]{2})\)/i);
    return match ? match[1].toLowerCase() : null;
  }
}
