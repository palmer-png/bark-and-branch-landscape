// Login for the broker planting-quote page (HTTP Basic Auth). Vercel runs this before
// serving /planting-quotes.html and everything under /planting-quotes/.
// The username and password are the QUOTES_USER and QUOTES_PASSWORD environment
// variables of this Vercel project, so they never sit in this public repo.
// Until both are set, the page stays locked for everyone.

export const config = {
  matcher: ['/planting-quotes.html', '/planting-quotes', '/planting-quotes/:path*'],
};

function locked() {
  return new Response('Log in to use the Bark & Branch planting quote page.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Bark & Branch planting quotes", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}

export default function middleware(request) {
  const user = (process.env.QUOTES_USER || '').trim().toLowerCase();
  const pass = process.env.QUOTES_PASSWORD || '';
  const header = request.headers.get('authorization') || '';
  if (!user || !pass || !header.startsWith('Basic ')) return locked();
  let decoded = '';
  try {
    decoded = atob(header.slice(6).trim());
  } catch (e) {
    return locked();
  }
  const i = decoded.indexOf(':');
  // the username ignores capitals (phones capitalize the first letter); the password must match exactly
  if (i < 1 || decoded.slice(0, i).trim().toLowerCase() !== user || decoded.slice(i + 1) !== pass) return locked();
  // returning nothing lets Vercel serve the page
}
