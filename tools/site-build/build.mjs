import { readFile, writeFile, mkdir, copyFile, rm, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const configPath = 'assets/js/supabase-config.js';

export function previewConfiguration(env, production) {
  const url = env.CHAMPION_PREVIEW_SUPABASE_URL || '';
  const publishableKey = env.CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY || '';
  // Only canonical project hosts: custom aliases could conceal a production backend.
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url) ||
      url === production.url ||
      !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey) ||
      publishableKey === production.publishableKey) return null;
  if(url!=='https://bkbmjisprwmkptywtmih.supabase.co')return null;
  return { url, publishableKey, outreachSiteKey:'1x00000000000000000000AA' };
}

export function previewScript(config) {
  const message = 'Acceptance preview: isolated Supabase configuration is missing or invalid. Sign-in and database access are disabled.';
  return `// Generated preview-only public configuration. Never falls back to production.\n` +
    `window.CHAMPION_LIFE_SUPABASE = ${JSON.stringify(config)};\n` +
    (config ? '' : `window.CHAMPION_LIFE_CONFIG_ERROR = ${JSON.stringify(message)};\n` +
    `(() => { const show = () => { const notice = document.createElement('div'); notice.id = 'preview-config-error'; notice.setAttribute('role', 'alert'); notice.textContent = window.CHAMPION_LIFE_CONFIG_ERROR; notice.style.cssText = 'position:relative;z-index:2147483647;padding:1rem;background:#fff2cc;color:#332600;border:2px solid #946200;font:16px/1.5 sans-serif'; document.body.prepend(notice); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, {once:true}); else show(); })();\n`);
}

export async function buildSite({ root = repository, env = process.env } = {}) {
  const output = path.join(root, 'dist');
  const context = env.CONTEXT || '';
  const isolated = context === 'deploy-preview' || context === 'branch-deploy';
  if ((env.NETLIFY === 'true' && !context) ||
      (context && !['production', 'deploy-preview', 'branch-deploy', 'dev'].includes(context))) {
    throw new Error('Unrecognized deployment context; refusing to publish.');
  }
  const files = JSON.parse(await readFile(path.join(root, 'tools/site-build/public-files.json'), 'utf8'));
  if (!Array.isArray(files) || new Set(files).size !== files.length || !files.includes(configPath)) {
    throw new Error('Invalid public file manifest.');
  }
  // Validate every entry and path component before copying; never follow symlinks.
  for (const file of files) {
    if (typeof file !== 'string' || file.includes('\\') || file.split('/').some(p => !p || p.startsWith('.')) ||
        /^(?:audit|docs|tools|supabase|netlify|HANDOFFS)\//i.test(file) ||
        !(/\.(?:html|css|js|png|jpe?g|webp|svg|gif|ico|pdf|woff2?|mp[34]|webm)$/i.test(file) || /^assets\/images\/food-outreach-hero-chunks\/0[0-8]\.txt$/.test(file) || file === '_redirects')) {
      throw new Error('Non-public file in public manifest.');
    }
    let target = root;
    for (const part of file.split('/')) {
      target = path.join(target, part);
      if ((await lstat(target)).isSymbolicLink()) throw new Error('Symlinks are not public assets.');
    }
    if (!(await lstat(target)).isFile()) throw new Error('Manifest entry is not a file.');
  }
  const sourceConfig = await readFile(path.join(root, configPath), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(sourceConfig, sandbox, { timeout: 1000 });
  const config = isolated ? previewConfiguration(env, sandbox.window.CHAMPION_LIFE_SUPABASE) : null;
  await rm(output, { recursive: true, force: true });
  for (const file of files) {
    const destination = path.join(output, file);
    await mkdir(path.dirname(destination), { recursive: true });
    if (isolated && file === configPath) await writeFile(destination, previewScript(config));
    else if(file===configPath && env.OUTREACH_PUBLIC_SITE_KEY && !/^[123]x0+/.test(env.OUTREACH_PUBLIC_SITE_KEY))await writeFile(destination,sourceConfig+'\nwindow.CHAMPION_LIFE_SUPABASE.outreachSiteKey='+JSON.stringify(env.OUTREACH_PUBLIC_SITE_KEY)+';\n');
    else await copyFile(path.join(root, file), destination);
  }
  if (isolated) {
    // Preview pages are not search results; production output remains byte-for-byte.
    await writeFile(path.join(output, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n/assets/js/supabase-config.js\n  Cache-Control: no-store\n');
    await writeFile(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  }
  return { files: files.length, context: context || 'local', backend: isolated ? (config ? 'isolated-preview' : 'blocked') : 'unchanged-production-default', output };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await buildSite())); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
