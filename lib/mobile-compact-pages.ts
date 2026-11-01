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
// City Hub routes use dataset keys (for example, bd-dhaka) rather than UUIDs.
const cityDetailPagePattern = /^\/cities\/[^/]+$/;
// These pages have their own detail header, so use the same compact mobile spacing.
const fundraisingCampaignDetailPattern = /^\/fundraising\/campaigns\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fundraiserDetailPattern = /^\/fundraising\/[^/]+$/;

export function isCompactMobilePage(pathname: string) {
 const path = pathname.replace(/\/$/, '') || '/';
 return compactMobilePages.has(path) || detailPagePattern.test(path) || cityDetailPagePattern.test(path)
    || fundraisingCampaignDetailPattern.test(path)
    || (fundraiserDetailPattern.test(path) && !['/fundraising/new', '/fundraising/performance'].includes(path));
}
