export function getSiteInfo() {
  const year = parseInt(process.env.SITE_YEAR, 10);
  const currentYear = new Date().getFullYear();
  const yearRange = year ? `${year} - ${currentYear}` : `${currentYear}`;

  const showCopyright = process.env.SITE_COPYRIGHT !== 'false';
  const author = process.env.SITE_AUTHOR || '';

  return {
    icp: process.env.SITE_ICP || '',
    year: yearRange,
    showCopyright,
    author,
    authorUrl: 'https://guole.fun',
    siteUrl: 'https://github.com/kuole-o/glean',
    siteName: '拾句',
  };
}
