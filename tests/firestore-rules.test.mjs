// Security-rules tests for firestore.rules, run against the Firestore emulator.
//
//   npm run test:rules
//
// Every case below mirrors a real code path in js/ (named in the test title) or
// an attack the rules are supposed to stop. When you change firestore.rules,
// run this before deploying — these rules gate every user of the live system.

import { readFileSync } from 'node:fs';
import { test, before, after, beforeEach, describe } from 'node:test';
import {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails
} from '@firebase/rules-unit-testing';
import {
    doc, getDoc, setDoc, updateDoc, deleteDoc,
    collection, query, where, limit, getDocs
} from 'firebase/firestore';

let testEnv;

// ── Fixtures ─────────────────────────────────────────────────
// Mirrors the shape store.js actually writes.
const UID = {
    admin: 'uid_admin',
    teacher: 'uid_teacher',
    student: 'uid_student',
    student2: 'uid_student2',
    // A brand-new Firebase Auth account with no user document and no roles
    // document — i.e. anyone who signs up against the public API key.
    attacker: 'uid_attacker'
};

async function seed() {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();

        await setDoc(doc(db, 'users/u_admin'), {
            name: 'Admin User', email: 'admin@eduhero.com', role: 'admin',
            uid: UID.admin, password: 'pw_admin', subjects: [], months: {}, monthExpiry: {}
        });
        await setDoc(doc(db, 'users/u_teacher'), {
            name: 'Teacher Ali', email: 'teacher@eduhero.com', role: 'teacher',
            uid: UID.teacher, password: 'pw_teacher', subjects: ['s1'], months: {}, monthExpiry: {}
        });
        await setDoc(doc(db, 'users/u_student'), {
            name: 'Student One', email: 'stu1@eduhero-lms.app', role: 'student',
            uid: UID.student, password: 'pw_stu1', subjects: ['s1'], months: {}, monthExpiry: {}
        });
        await setDoc(doc(db, 'users/u_student2'), {
            name: 'Student Two', email: 'stu2@eduhero-lms.app', role: 'student',
            uid: UID.student2, password: 'pw_stu2', subjects: ['s1'], months: {}, monthExpiry: {}
        });
        // Never migrated to Firebase Auth: no uid field. Shows as "First Login".
        await setDoc(doc(db, 'users/u_legacy'), {
            name: 'Legacy Student', email: 'legacy@eduhero-lms.app', role: 'student',
            password: 'pw_legacy', subjects: [], months: {}, monthExpiry: {}
        });

        await setDoc(doc(db, `roles/${UID.admin}`), { role: 'admin', userId: 'u_admin' });
        await setDoc(doc(db, `roles/${UID.teacher}`), { role: 'teacher', userId: 'u_teacher' });
        await setDoc(doc(db, `roles/${UID.student}`), { role: 'student', userId: 'u_student' });
        await setDoc(doc(db, `roles/${UID.student2}`), { role: 'student', userId: 'u_student2' });

        await setDoc(doc(db, 'settings/main'), { systemName: 'EduHero' });
        await setDoc(doc(db, 'secrets/bunny'), { mappings: [] });
        await setDoc(doc(db, 'subjects/s1'), { name: 'BC Form 1', level: 'Form 1', category: 'BC' });
        await setDoc(doc(db, 'videos/v1'), { title: 'Lesson 1', subjectId: 's1', teacherId: 'u_teacher', views: 0 });
        await setDoc(doc(db, 'videos/v2'), { title: 'Lesson 2', subjectId: 's1', teacherId: 'u_admin', views: 0 });
        await setDoc(doc(db, 'progress/u_student_v1'), {
            studentId: 'u_student', videoId: 'v1', watchPercentage: 10, milestones: ['10']
        });
        await setDoc(doc(db, 'progress/u_student2_v1'), {
            studentId: 'u_student2', videoId: 'v1', watchPercentage: 20, milestones: ['20']
        });
    });
}

const asAdmin = () => testEnv.authenticatedContext(UID.admin).firestore();
const asTeacher = () => testEnv.authenticatedContext(UID.teacher).firestore();
const asStudent = () => testEnv.authenticatedContext(UID.student).firestore();
const asStudent2 = () => testEnv.authenticatedContext(UID.student2).firestore();
const asAttacker = () => testEnv.authenticatedContext(UID.attacker).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'eduhero-rules-test',
        firestore: {
            rules: readFileSync('firestore.rules', 'utf8'),
            host: '127.0.0.1',
            port: 8080
        }
    });
});

after(async () => {
    if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed();
});

// ── The three holes this change is meant to close ────────────
describe('closed vulnerabilities', () => {

    test('anonymous cannot read a user document by email (was: public list limit<=1)', async () => {
        const q = query(
            collection(asAnon(), 'users'),
            where('email', '==', 'stu1@eduhero-lms.app'),
            limit(1)
        );
        await assertFails(getDocs(q));
    });

    test('anonymous cannot read a user document directly', async () => {
        await assertFails(getDoc(doc(asAnon(), 'users/u_student')));
    });

    test('anonymous cannot enumerate subjects', async () => {
        await assertFails(getDocs(query(collection(asAnon(), 'subjects'), limit(1))));
    });

    test('a student cannot overwrite another user by claiming their own uid (privilege bug)', async () => {
        // The exact old exploit: request.resource.data.uid was caller-controlled.
        await assertFails(updateDoc(doc(asStudent(), 'users/u_student2'), {
            uid: UID.student,
            subjects: ['s1', 's2']
        }));
    });

    test('a fresh signup cannot forge an admin roles document (privilege escalation)', async () => {
        await assertFails(setDoc(doc(asAttacker(), `roles/${UID.attacker}`), {
            role: 'admin',
            userId: 'u_admin'
        }));
    });

    test('a real user cannot upgrade their own role via the roles document', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await deleteDoc(doc(ctx.firestore(), `roles/${UID.student}`));
        });
        await assertFails(setDoc(doc(asStudent(), `roles/${UID.student}`), {
            role: 'admin',
            userId: 'u_student'
        }));
    });
});

// ── Paths that must keep working ─────────────────────────────
describe('roles self-repair (store.fetchUserByUid)', () => {

    test('a user may recreate their own roles document with the matching role', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await deleteDoc(doc(ctx.firestore(), `roles/${UID.student}`));
        });
        await assertSucceeds(setDoc(doc(asStudent(), `roles/${UID.student}`), {
            role: 'student',
            userId: 'u_student'
        }));
    });

    test('a user may run the uid self-lookup query', async () => {
        const q = query(collection(asStudent(), 'users'), where('uid', '==', UID.student), limit(1));
        await assertSucceeds(getDocs(q));
    });
});

describe('users: read', () => {

    test('student reads own document', async () => {
        await assertSucceeds(getDoc(doc(asStudent(), 'users/u_student')));
    });

    test('student cannot read another student', async () => {
        await assertFails(getDoc(doc(asStudent(), 'users/u_student2')));
    });

    test('teacher cannot read a student document (plaintext password exposure)', async () => {
        await assertFails(getDoc(doc(asTeacher(), 'users/u_student')));
    });

    test('teacher reads own document', async () => {
        await assertSucceeds(getDoc(doc(asTeacher(), 'users/u_teacher')));
    });

    test('admin reads any user', async () => {
        await assertSucceeds(getDoc(doc(asAdmin(), 'users/u_student')));
    });

    test('admin lists the whole collection (admin console listener)', async () => {
        await assertSucceeds(getDocs(collection(asAdmin(), 'users')));
    });

    test('student cannot list the whole collection', async () => {
        await assertFails(getDocs(collection(asStudent(), 'users')));
    });
});

describe('users: self-update paths used by the app', () => {

    test('auth.enforceSingleSession writes lastSessionId + lastLoginAt', async () => {
        await assertSucceeds(updateDoc(doc(asStudent(), 'users/u_student'), {
            lastSessionId: 'sid_123',
            lastLoginAt: Date.now()
        }));
    });

    test('store.updateUserLogin writes lastLoginAt + lastActiveAt', async () => {
        await assertSucceeds(updateDoc(doc(asStudent(), 'users/u_student'), {
            lastLoginAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString()
        }));
    });

    test('store.updateUserActivity writes lastActiveAt', async () => {
        await assertSucceeds(updateDoc(doc(asStudent(), 'users/u_student'), {
            lastActiveAt: new Date().toISOString()
        }));
    });

    test('auth.changePassword mirrors the password and clears mustChangePassword', async () => {
        await assertSucceeds(updateDoc(doc(asStudent(), 'users/u_student'), {
            password: 'new_password',
            mustChangePassword: false
        }));
    });

    test('teacher may do the same on their own document', async () => {
        await assertSucceeds(updateDoc(doc(asTeacher(), 'users/u_teacher'), {
            lastSessionId: 'sid_t', lastLoginAt: Date.now()
        }));
    });
});

describe('users: self-update limits', () => {

    test('student cannot change own role', async () => {
        await assertFails(updateDoc(doc(asStudent(), 'users/u_student'), { role: 'admin' }));
    });

    test('student cannot grant themselves subjects', async () => {
        await assertFails(updateDoc(doc(asStudent(), 'users/u_student'), { subjects: ['s1', 's2'] }));
    });

    test('student cannot extend their own access months', async () => {
        await assertFails(updateDoc(doc(asStudent(), 'users/u_student'), {
            monthExpiry: { s1: { end: '2099-01-01' } }
        }));
    });

    test('student cannot repoint uid at someone else', async () => {
        await assertFails(updateDoc(doc(asStudent(), 'users/u_student'), { uid: UID.attacker }));
    });

    test('student cannot create or delete users', async () => {
        await assertFails(setDoc(doc(asStudent(), 'users/u_new'), { name: 'X', role: 'student' }));
        await assertFails(deleteDoc(doc(asStudent(), 'users/u_student2')));
    });
});

describe('users: admin management', () => {

    test('admin updates any user', async () => {
        await assertSucceeds(updateDoc(doc(asAdmin(), 'users/u_student'), {
            subjects: ['s1'], name: 'Renamed'
        }));
    });

    test('admin creates and deletes users', async () => {
        await assertSucceeds(setDoc(doc(asAdmin(), 'users/u_new'), {
            name: 'New', email: 'new@x.com', role: 'student', subjects: [], months: {}, monthExpiry: {}
        }));
        await assertSucceeds(deleteDoc(doc(asAdmin(), 'users/u_new')));
    });
});

describe('videos', () => {

    test('teacher creates a video owned by themselves', async () => {
        await assertSucceeds(setDoc(doc(asTeacher(), 'videos/v_new'), {
            title: 'New', subjectId: 's1', teacherId: 'u_teacher', views: 0
        }));
    });

    test('teacher cannot create a video attributed to someone else', async () => {
        await assertFails(setDoc(doc(asTeacher(), 'videos/v_new2'), {
            title: 'New', subjectId: 's1', teacherId: 'u_admin', views: 0
        }));
    });

    test('teacher deletes own video but not another teacher\'s', async () => {
        await assertSucceeds(deleteDoc(doc(asTeacher(), 'videos/v1')));
        await assertFails(deleteDoc(doc(asTeacher(), 'videos/v2')));
    });

    test('student may bump views only (store.incrementVideoView)', async () => {
        await assertSucceeds(updateDoc(doc(asStudent(), 'videos/v1'), { views: 1 }));
    });

    test('student cannot edit video content', async () => {
        await assertFails(updateDoc(doc(asStudent(), 'videos/v1'), { title: 'Hacked' }));
    });

    test('every signed-in role can read videos', async () => {
        await assertSucceeds(getDoc(doc(asStudent(), 'videos/v1')));
        await assertSucceeds(getDoc(doc(asTeacher(), 'videos/v1')));
    });

    test('anonymous cannot read videos', async () => {
        await assertFails(getDoc(doc(asAnon(), 'videos/v1')));
    });
});

describe('progress', () => {

    test('student writes own progress (store.trackVideoProgress)', async () => {
        await assertSucceeds(setDoc(doc(asStudent(), 'progress/u_student_v1'), {
            studentId: 'u_student', videoId: 'v1', watchPercentage: 50, milestones: ['10', '50']
        }, { merge: true }));
    });

    test('student cannot write another student\'s progress', async () => {
        await assertFails(setDoc(doc(asStudent(), 'progress/u_student2_v1'), {
            studentId: 'u_student2', videoId: 'v1', watchPercentage: 99
        }, { merge: true }));
    });

    test('student cannot read another student\'s progress', async () => {
        await assertFails(getDoc(doc(asStudent(), 'progress/u_student2_v1')));
    });

    test('teacher and admin read all progress (reports)', async () => {
        await assertSucceeds(getDocs(collection(asTeacher(), 'progress')));
        await assertSucceeds(getDocs(collection(asAdmin(), 'progress')));
    });
});

describe('settings and secrets', () => {

    test('anonymous reads settings (login page branding)', async () => {
        await assertSucceeds(getDoc(doc(asAnon(), 'settings/main')));
    });

    test('student cannot write settings', async () => {
        await assertFails(setDoc(doc(asStudent(), 'settings/main'), { systemName: 'Hacked' }));
    });

    test('admin writes settings', async () => {
        await assertSucceeds(setDoc(doc(asAdmin(), 'settings/main'), { systemName: 'EduHero' }));
    });

    test('student cannot read the Bunny API keys', async () => {
        await assertFails(getDoc(doc(asStudent(), 'secrets/bunny')));
    });

    test('teacher and admin can read the Bunny API keys', async () => {
        await assertSucceeds(getDoc(doc(asTeacher(), 'secrets/bunny')));
        await assertSucceeds(getDoc(doc(asAdmin(), 'secrets/bunny')));
    });

    test('teacher cannot write the Bunny API keys', async () => {
        await assertFails(setDoc(doc(asTeacher(), 'secrets/bunny'), { mappings: [] }));
    });
});

// ── Accepted regression, documented on purpose ───────────────
describe('legacy accounts (accepted regression)', () => {

    test('a never-migrated account can no longer be looked up before login', async () => {
        // auth._migrateAndLogin() relied on this unauthenticated lookup. Closing
        // the public list rule removes it: such users (Status "First Login" in
        // the admin console) must now be reset by an admin instead of
        // self-migrating on first login.
        const q = query(
            collection(asAnon(), 'users'),
            where('email', '==', 'legacy@eduhero-lms.app'),
            limit(1)
        );
        await assertFails(getDocs(q));
    });

    // A user document with no `uid` field must deny cleanly rather than raising
    // an evaluation error inside the rule.
    test('a signed-in user cannot read a document that has no uid field', async () => {
        await assertFails(getDoc(doc(asStudent(), 'users/u_legacy')));
    });

    test('a signed-in user cannot write a document that has no uid field', async () => {
        await assertFails(updateDoc(doc(asStudent(), 'users/u_legacy'), {
            lastActiveAt: new Date().toISOString()
        }));
    });

    test('admin can still manage a never-migrated account', async () => {
        await assertSucceeds(updateDoc(doc(asAdmin(), 'users/u_legacy'), { password: 'reset_by_admin' }));
    });
});
