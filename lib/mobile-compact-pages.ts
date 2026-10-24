// Mobile-only header changes for selected directories and four detail types.
// Leave Overview, World Map, Admin, forms and management pages unchanged.
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

const detailPagePattern = /^\/(?:people|organizations|communities|missions)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCompactMobilePage(pathname: string) {
 const path = pathname.replace(/\/$/, '') || '/';
 return compactMobilePages.has(path) || detailPagePattern.test(path);
}
