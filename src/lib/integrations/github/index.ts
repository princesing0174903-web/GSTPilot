// Barrel export for the GitHub integration.
export {
  isGitHubConfigured,
  getGitHubClientId,
  buildAuthUrl,
  encodeState,
  decodeState,
  resolveRedirectUri,
  exchangeCodeForTokens,
  fetchGitHubUser,
  type GitHubUser,
  type GitHubTokenResponse,
  type GitHubExchangeResult,
  type GitHubUserResult,
  type GitHubOAuthStatePayload,
} from './auth';

export {
  resolveGitHubUser,
  issueSessionCookie,
  verifyJwt,
  buildSessionCookieHeader,
  clearSessionCookieHeader,
  GITHUB_SESSION_COOKIE_NAME,
  type ResolvedGitHubUser,
} from './session';
