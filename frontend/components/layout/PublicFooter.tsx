import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';

/** Public-site footer with navigation and general placeholder contact details. */
export const PublicFooter = () => {
  const t = useTranslations('Footer');
  const currentYear = new Date().getFullYear();

  const navLinks = [
    { name: t('home'), href: '/' },
    { name: t('events'), href: '/events' },
    { name: t('support'), href: '/support' },
    { name: t('membership'), href: '/membership' },
    { name: t('about'), href: '/about' },
    { name: t('partners'), href: '/partners' },
  ] as const;

  return (
    <footer className="w-full bg-msscc-teal text-white">
      <div className="my-3 mx-auto grid w-full gap-7 px-4 py-8 pb-6 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr] lg:gap-10 lg:px-8">
        <section aria-labelledby="footer-about-heading">
          <h2 id="footer-about-heading" className="font-heading text-heading-3 text-white">
            {t('organizationName')}
          </h2>
          <p className="mt-3 max-w-md text-caption leading-relaxed text-white">
            {t('description')}
          </p>
          <a href="https://www.facebook.com/MSSCC1/" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex text-caption !text-white underline-offset-4 transition-colors hover:!text-msscc-teal-sky hover:underline">
            {t('facebook')}
          </a>
        </section>

        <nav aria-labelledby="footer-navigation-heading">
          <h2 id="footer-navigation-heading" className="font-heading text-heading-3 text-white">
            {t('navigation')}
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-caption">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="!text-white transition-colors hover:!text-msscc-teal-sky hover:underline hover:underline-offset-4">
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="footer-contact-heading">
          <h2 id="footer-contact-heading" className="font-heading text-heading-3 text-white">
            {t('contact')}
          </h2>
          <address className="mt-3 space-y-1.5 text-label not-italic text-white/85">
            <p className="text-white/85">{t('fullName')}</p>
            <p className="text-white/85">{t('address')}</p>
            <p><span className='!text-white/85'>{t('emailLabel')}</span><a className="!text-white transition-colors hover:!text-msscc-teal-sky hover:underline" href={`mailto:${t('email')}`}>{t('email')}</a></p>
            <p><a className="!text-white transition-colors hover:!text-msscc-teal-sky hover:underline" href={`tel:${t('phone')}`}>{t('phone')}</a></p>
            <p className="text-white/85">{t('TAX_ID')}</p>
          </address>
        </section>
      </div>

      <div className="border-t border-white/15 px-4 py-3 text-center text-caption text-white/60 sm:px-6">
        © {currentYear} {t('organizationName')}. {t('rightsReserved')}
      </div>
    </footer>
  );
};
