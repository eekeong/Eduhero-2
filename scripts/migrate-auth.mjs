// Firebase Auth migration — DRY RUN ONLY.
//
// Every user document that has no `uid` is an account that was never migrated
// to Firebase Auth (the admin console shows these as "First Login"). Their
// login today depends on an unauthenticated Firestore lookup, which is exactly
// the access-control hole firestore.rules needs to close. This script surveys
// what a migration would involve, so the real run can be planned against real
// numbers instead of guesses.
//
// It reads Firestore and Firebase Auth. It writes NOTHING except local CSV
// reports. There is deliberately no --apply flag yet: the writing half should
// only be built once the report below has been reviewed.
//
// Usage:
//   node scripts/migrate-auth.mjs --key "C:\\path\\to\\serviceaccount.json"
//   node scripts/migrate-auth.mjs --key ... --out ./migration-report
//
// The service account key bypasses all security rules. Keep it outside the
// repository and revoke it when the migration is finished.

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// ── Args ─────────────────────────────────────────────────────
function arg(name, fallback = null) {
    const i = process.argv.indexOf(`--${name}`);
    return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const keyPath = arg('key', process.env.GOOGLE_APPLICATION_CREDENTIALS);
const outDir = arg('out', './migration-report');

if (process.argv.includes('--apply')) {
    console.error('--apply is not implemented. Review the dry-run report first.');
    process.exit(1);
}
if (!keyPath) {
    console.error('Missing --key <path to service account json> (or set GOOGLE_APPLICATION_CREDENTIALS).');
    process.exit(1);
}

// ── Rules copied from the app, so the survey matches reality ──

// Must stay identical to auth._toAuthEmail() in js/auth.js — the address this
// computes is the address the student's browser will compute at login.
function toAuthEmail(val) {
    val = (val || '').toString().trim().toLowerCase();
    return val.includes('@') ? val : `${val}@eduhero-lms.app`;
}

// Mirrors auth._migrateAndLogin(): a legacy document has no mustChangePassword
// field, so `!== false` is true and these users are prompted to change their
// password on first login. Migrating must not silently change that.
function willForcePasswordChange(user) {
    return (user.mustChangePassword !== false) || user.password === 'password';
}

const FIREBASE_MIN_PASSWORD = 6;
// Local part of the generated address. Anything outside this makes an address
// Firebase Auth will reject.
const VALID_LOCAL_PART = /^[A-Za-z0-9._%+-]+$/;
const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function classify(user) {
    const problems = [];

    const rawLogin = (user.email || '').toString();
    if (!rawLogin.trim()) {
        problems.push('NO_EMAIL');
    }

    const authEmail = toAuthEmail(rawLogin);
    if (rawLogin.trim()) {
        const localPart = rawLogin.includes('@') ? null : rawLogin.trim().toLowerCase();
        if (localPart !== null && !VALID_LOCAL_PART.test(localPart)) {
            problems.push('INVALID_CHARS_IN_CODE');
        }
        if (!VALID_EMAIL.test(authEmail)) {
            problems.push('INVALID_EMAIL');
        }
    }

    const pw = user.password;
    if (pw === undefined || pw === null || pw === '') {
        problems.push('NO_PASSWORD');
    } else if (typeof pw !== 'string') {
        problems.push('PASSWORD_NOT_STRING');
    } else if (pw.length < FIREBASE_MIN_PASSWORD) {
        problems.push('PASSWORD_TOO_SHORT');
    }

    if (!user.role) problems.push('NO_ROLE');

    return { authEmail, problems };
}

function csv(rows, headers) {
    const esc = (v) => {
        const s = v === undefined || v === null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n') + '\n';
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
    const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
    initializeApp({ credential: cert(serviceAccount) });
    const db = getFirestore();
    const auth = getAuth();

    console.log(`[dry-run] project: ${serviceAccount.project_id}`);
    console.log('[dry-run] reading users collection...');

    const snap = await db.collection('users').get();
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`[dry-run] ${users.length} user documents`);

    const migrated = users.filter(u => u.uid);
    const candidates = users.filter(u => !u.uid);

    // ── Duplicate login addresses ────────────────────────────
    // Firebase Auth requires a unique email, so two documents that resolve to
    // the same address cannot both be migrated.
    const byAuthEmail = new Map();
    for (const u of users) {
        if (!u.email) continue;
        const e = toAuthEmail(u.email);
        if (!byAuthEmail.has(e)) byAuthEmail.set(e, []);
        byAuthEmail.get(e).push(u);
    }
    const duplicates = [...byAuthEmail.entries()].filter(([, list]) => list.length > 1);

    // ── Does an Auth account already exist for a candidate? ──
    console.log('[dry-run] checking Firebase Auth for existing accounts...');
    const existingAuth = new Set();
    const lookups = candidates
        .map(u => u.email ? toAuthEmail(u.email) : null)
        .filter(e => e && VALID_EMAIL.test(e));
    const uniqueLookups = [...new Set(lookups)];

    for (let i = 0; i < uniqueLookups.length; i += 100) {
        const batch = uniqueLookups.slice(i, i + 100).map(email => ({ email }));
        try {
            const res = await auth.getUsers(batch);
            res.users.forEach(r => existingAuth.add(r.email));
        } catch (err) {
            console.warn(`[dry-run] auth lookup failed for batch ${i}: ${err.message}`);
        }
        if (i && i % 1000 === 0) console.log(`[dry-run]   ...${i}/${uniqueLookups.length}`);
    }

    // ── Classify candidates ──────────────────────────────────
    const rows = candidates.map(u => {
        const { authEmail, problems } = classify(u);
        if (existingAuth.has(authEmail)) problems.push('AUTH_ACCOUNT_ALREADY_EXISTS');
        if ((byAuthEmail.get(authEmail) || []).length > 1) problems.push('DUPLICATE_LOGIN');
        return {
            docId: u.id,
            name: u.name || '',
            loginCode: u.email || '',
            authEmail,
            role: u.role || '',
            passwordLength: typeof u.password === 'string' ? u.password.length : '',
            willForcePasswordChange: willForcePasswordChange(u),
            hasLastLoginAt: !!u.lastLoginAt,
            problems: problems.join('|'),
            status: problems.length === 0 ? 'READY' : 'NEEDS_DECISION'
        };
    });

    const ready = rows.filter(r => r.status === 'READY');
    const blocked = rows.filter(r => r.status !== 'READY');

    const problemCounts = {};
    blocked.forEach(r => r.problems.split('|').forEach(p => {
        problemCounts[p] = (problemCounts[p] || 0) + 1;
    }));

    // ── "First Login" badge replacement ──────────────────────
    // Today the badge is derived from `uid`. After a migration everyone has a
    // uid, so it has to be derived from lastLoginAt instead. That only works if
    // already-migrated users reliably have the field — this measures it.
    const migratedNoLastLogin = migrated.filter(u => !u.lastLoginAt);
    const lastLoginTypes = {};
    users.forEach(u => {
        if (u.lastLoginAt === undefined) return;
        const t = typeof u.lastLoginAt;
        lastLoginTypes[t] = (lastLoginTypes[t] || 0) + 1;
    });

    const byRole = {};
    candidates.forEach(u => {
        const r = u.role || '(none)';
        byRole[r] = (byRole[r] || 0) + 1;
    });

    // ── Reports ──────────────────────────────────────────────
    mkdirSync(outDir, { recursive: true });
    const headers = ['docId', 'name', 'loginCode', 'authEmail', 'role', 'passwordLength',
        'willForcePasswordChange', 'hasLastLoginAt', 'problems', 'status'];
    writeFileSync(join(outDir, 'ready.csv'), csv(ready, headers));
    writeFileSync(join(outDir, 'needs-decision.csv'), csv(blocked, headers));
    writeFileSync(join(outDir, 'duplicate-logins.csv'), csv(
        duplicates.flatMap(([email, list]) => list.map(u => ({
            authEmail: email, docId: u.id, name: u.name || '', role: u.role || '', hasUid: !!u.uid
        }))),
        ['authEmail', 'docId', 'name', 'role', 'hasUid']
    ));
    writeFileSync(join(outDir, 'migrated-without-lastlogin.csv'), csv(
        migratedNoLastLogin.map(u => ({ docId: u.id, name: u.name || '', role: u.role || '', loginCode: u.email || '' })),
        ['docId', 'name', 'role', 'loginCode']
    ));

    // ── Summary ──────────────────────────────────────────────
    const line = (label, value) => console.log(`  ${label.padEnd(46)} ${value}`);
    console.log('\n══ DRY RUN — nothing was written ══\n');
    line('User documents total', users.length);
    line('Already migrated (has uid)', migrated.length);
    line('Never migrated ("First Login")', candidates.length);
    console.log('\n  Never-migrated by role:');
    Object.entries(byRole).sort((a, b) => b[1] - a[1])
        .forEach(([r, n]) => line(`    ${r}`, n));

    console.log('\n  Migration outcome:');
    line('Can migrate as-is (password unchanged)', ready.length);
    line('Need a decision', blocked.length);
    if (blocked.length) {
        console.log('\n  Reasons (a user may have several):');
        Object.entries(problemCounts).sort((a, b) => b[1] - a[1])
            .forEach(([p, n]) => line(`    ${p}`, n));
    }

    console.log('\n  Forced password change on first login:');
    line('Would be prompted (same as today)', ready.filter(r => r.willForcePasswordChange).length);
    line('Would not be prompted', ready.filter(r => !r.willForcePasswordChange).length);

    console.log('\n  Replacing the "First Login" badge with lastLoginAt:');
    line('Migrated users missing lastLoginAt', migratedNoLastLogin.length);
    console.log('    (these would be mislabelled "never logged in" —');
    console.log('     if this is large the script must backfill a flag)');
    line('lastLoginAt stored as', JSON.stringify(lastLoginTypes));
    console.log('    (mixed types confirm the ISO-string vs Date.now() bug)');

    console.log(`\n  Duplicate login addresses: ${duplicates.length}`);
    console.log(`\n  Reports written to ${outDir}/`);
    console.log('    ready.csv, needs-decision.csv, duplicate-logins.csv,');
    console.log('    migrated-without-lastlogin.csv\n');
}

main().catch(err => {
    console.error('\n[dry-run] failed:', err.message);
    process.exit(1);
});
