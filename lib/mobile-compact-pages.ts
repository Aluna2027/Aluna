// Only the listed pages receive the compact mobile content spacing.
// The white search icon is available on every authenticated mobile page.
const compactMobilePages = new Set([
 '/dashboard',
 '/world-map',
 '/aluna-admin',
 '/search',
 '/feed',
 '/following',
 '/profile',
 '/messages',
 '/notifications',
 '/organizations',
 '/communities',
 '/missions',
 '/fundraising',
 '/contributions',
 '/proofs',
 '/impact',
 '/donations',
]);

const detailPagePattern = /^\/(?:people|organizations|communities|missions)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCompactMobilePage(pathname: string) {
 const path = pathname.replace(/\/$/, '') || '/';
 return compactMobilePages.has(path) || detailPagePattern.test(path);
}
