// Broker account login for the estimate builder. Vercel runs this before every request to the paths below.
// /broker-login shows the login page (GET) and checks the username and password (POST). They are the
// QUOTES_USER and QUOTES_PASSWORD environment variables of this Vercel project, never in this public repo.
// A correct login sets a signed cookie for 30 days; the builder and its images and PDFs need it.
// /broker-logout clears it. Changing QUOTES_PASSWORD (then redeploying) logs every broker out.

export const config = {
  matcher: ['/broker-login', '/broker-logout', '/brokerestimatebuilder', '/brokerestimatebuilder/',
            '/brokerestimatebuilder.html', '/planting-quotes.html', '/planting-quotes', '/planting-quotes/:path*'],
};

const COOKIE = 'bb_broker';
const DAYS = 30;
const enc = new TextEncoder();

async function sign(text, key) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(text)));
  let bin = '';
  for (const b of sig) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function settings() {
  const user = (process.env.QUOTES_USER || '').trim().toLowerCase();
  const pass = process.env.QUOTES_PASSWORD || '';
  return user && pass ? { user, pass, key: 'bb-broker:' + user + ':' + pass } : null;
}

function cookieValue(request, name) {
  const m = (request.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : '';
}

async function loggedIn(request, s) {
  const [exp, sig] = cookieValue(request, COOKIE).split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  return sig === (await sign(exp, s.key));
}

function go(location, cookie) {
  const headers = { Location: location, 'Cache-Control': 'no-store' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(null, { status: 303, headers });
}

export default async function middleware(request) {
  const path = new URL(request.url).pathname;
  const s = settings();

  if (path === '/broker-logout') {
    return go('/broker-login?out=1', COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  }
  if (path === '/broker-login') {
    if (request.method === 'POST') {
      let user = '';
      let pass = '';
      try {
        const form = await request.formData();
        user = String(form.get('username') || '');
        pass = String(form.get('password') || '');
      } catch (e) {
        // an empty or broken form is just a failed login
      }
      // the username ignores capitals (phones capitalize the first letter); the password must match exactly
      if (s && user.trim().toLowerCase() === s.user && pass === s.pass) {
        const exp = String(Math.floor(Date.now() / 1000) + DAYS * 86400);
        return go('/brokerestimatebuilder', COOKIE + '=' + exp + '.' + (await sign(exp, s.key)) +
          '; Path=/; Max-Age=' + DAYS * 86400 + '; HttpOnly; Secure; SameSite=Lax');
      }
      await new Promise((r) => setTimeout(r, 800)); // slows down guessing
      return go('/broker-login?e=1');
    }
    if (s && (await loggedIn(request, s))) return go('/brokerestimatebuilder');
    return; // show the login page
  }
  // the builder, its old address, and its images and PDFs
  if (s && (await loggedIn(request, s))) return; // returning nothing lets Vercel serve it
  if (path.startsWith('/planting-quotes/')) {
    return new Response('Log in first.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  return go('/broker-login');
}
