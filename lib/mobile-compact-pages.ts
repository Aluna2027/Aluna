// Mobile-only header changes are limited to these main navigation pages.
// Keep Overview, World Map, Admin and all detail pages unchanged.
const compactMobilePages = new Set([
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

export function isCompactMobilePage(pathname: string) {
 return compactMobilePages.has(pathname.replace(/\/$/, '') || '/');
}
