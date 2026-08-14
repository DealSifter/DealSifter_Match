const APP_NAVIGATION_TIMEOUT = 60_000;
const APP_READY_TIMEOUT = 20_000;

function sanitizeDiagnostic(value) {
  return String(value || '')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-token]')
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/g, '[redacted-key]')
    .replace(/(authorization|apikey|token|cookie|key)(\s*[:=]\s*)[^\s,;]+/gi, '$1$2[redacted]')
    .replace(/https?:\/\/[^\s)]+/g, (rawUrl) => {
      try {
        const parsed = new URL(rawUrl);
        return `${parsed.origin}${parsed.pathname}`;
      } catch {
        return '[redacted-url]';
      }
    })
    .slice(0, 300);
}

function safePageUrl(page) {
  try {
    const parsed = new URL(page.url());
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '[unavailable]';
  }
}

export async function waitForAppReady(page) {
  await page.locator('#root').waitFor({ state: 'attached', timeout: APP_READY_TIMEOUT });
  return Promise.any([
    page.getByTestId('nav-login').waitFor({ state: 'visible', timeout: APP_READY_TIMEOUT }).then(() => 'landing-desktop'),
    page.getByTestId('nav-app-menu').waitFor({ state: 'visible', timeout: APP_READY_TIMEOUT }).then(() => 'landing-mobile'),
    page.getByTestId('dashboard-root').waitFor({ state: 'visible', timeout: APP_READY_TIMEOUT }).then(() => 'authenticated'),
    page.getByTestId('auth-modal').waitFor({ state: 'visible', timeout: APP_READY_TIMEOUT }).then(() => 'auth-modal'),
  ]);
}

export async function gotoApp(page) {
  const consoleErrors = [];
  const failedRequests = [];
  let documentStatus = null;
  const onConsole = (message) => {
    if (message.type() === 'error' && consoleErrors.length < 5) {
      consoleErrors.push(sanitizeDiagnostic(message.text()));
    }
  };
  const onRequestFailed = (request) => {
    if (failedRequests.length < 5) {
      failedRequests.push({
        type: request.resourceType(),
        url: sanitizeDiagnostic(request.url()),
        error: sanitizeDiagnostic(request.failure()?.errorText),
      });
    }
  };
  const onResponse = (response) => {
    if (response.request().resourceType() === 'document') documentStatus = response.status();
  };
  page.on('console', onConsole);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: APP_NAVIGATION_TIMEOUT });
    return await waitForAppReady(page);
  } catch (error) {
    const diagnostic = {
      url: safePageUrl(page),
      documentStatus,
      title: sanitizeDiagnostic(await page.title().catch(() => '[unavailable]')),
      rootPresent: await page.locator('#root').count().catch(() => 0),
      consoleErrors,
      failedRequests,
    };
    throw new Error(`App readiness failed: ${JSON.stringify(diagnostic)}`, { cause: error });
  } finally {
    page.off('console', onConsole);
    page.off('requestfailed', onRequestFailed);
    page.off('response', onResponse);
  }
}

export async function openLogin(page) {
  await gotoApp(page);
  const desktopLogin = page.getByTestId('nav-login');
  if (await desktopLogin.isVisible().catch(() => false)) {
    await desktopLogin.click();
    return;
  }
  await page.getByTestId('nav-app-menu').click();
  await page.getByTestId('nav-login-mobile').click();
}

export async function loginAs(page, user) {
  await openLogin(page);
  await page.getByTestId('auth-tab-login').click();
  await page.getByTestId('auth-email').fill(user.email);
  await page.getByTestId('auth-password').fill(user.password);
  const loginResponsePromise = page.waitForResponse((response) => response.url().includes('/auth/v1/token'));
  await page.getByTestId('auth-submit').click({ force: true });
  const loginResponse = await loginResponsePromise;
  if (!loginResponse.ok()) {
    throw new Error(`E2E login failed with ${loginResponse.status()}: ${await loginResponse.text()}`);
  }
  await page.getByTestId('dashboard-root').waitFor({ state: 'visible' });
}

export async function logout(page) {
  await page.evaluate(async () => {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key) keys.push(key);
    }
    keys
      .filter((key) => key.includes('auth') || key.includes('supabase'))
      .forEach((key) => localStorage.removeItem(key));
    localStorage.setItem('ds_last_page', 'landing');
  });
}

export async function openMaxxis(page) {
  await page.getByTestId('maxxis-fab').evaluate((element) => element.click());
  await page.getByTestId('maxxis-panel').waitFor({ state: 'visible' });
}
