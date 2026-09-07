// ============================================================
// EduHero LMS — Firestore-backed Store
// ============================================================
// Architecture:
//   • store.init()      → seeds DB + one-time reads → warms cache
//   • store.startSync() → attaches ROLE-SPECIFIC real-time listeners
//                          (called after user logs in)
//   • store.stopSync()  → detaches all listeners (called on logout)
//   • store.fetchActivityLog() → on-demand admin-only fetch
// ============================================================

const COLLECTIONS = {
    USERS:    'users',
    SUBJECTS: 'subjects',
    VIDEOS:   'videos',
    COMMENTS: 'comments',
    PROGRESS: 'progress',
    LOG:      'activityLog',
    SETTINGS: 'settings',
    ROLES:    'roles',
    SECRETS:  'secrets',
};

// ── In-Memory Cache ──────────────────────────────────────────
const _cache = {
    users:       [],
    subjects:    [],
    videos:      [],
    comments:    [],
    progress:    [],
    activityLog: [],
    settings:    { logoUrl: '', systemName: 'EduHero', systemColor: '#4F46E5', systemColor2: '#7C3AED', studentAvatarUrl: '' },
    bunnySecrets: null,
    ready:       false,
    listeners:   [],  // array of unsubscribe functions
    initialUsersLoaded: false,
    progressLoaded: false,
    adminDataLoaded: false,
    counts: null
};

// ── Helpers ──────────────────────────────────────────────────
const generateId = (prefix) =>
    prefix + '_' + Math.random().toString(36).substr(2, 9);

const docToObj = (doc) => ({ id: doc.id, ...doc.data() });

// ── Default Values ────────────────────────────────────────────
const DEFAULT_SETTINGS = {
    logoUrl: '',
    systemName: 'EduHero',
    systemColor: '#4F46E5',
    systemColor2: '#7C3AED',
    studentAvatarUrl: ''
};

const SUBJECT_MAP = {
    'Year 3': ['BC', 'BMP', 'BMK', 'BIP', 'BIK', 'MM', 'SCI'],
    'Year 4': ['BC', 'BMP', 'BMK', 'BIP', 'BIK', 'MM', 'SCI', 'SEJ'],
    'Year 5': ['BC', 'BMP', 'BMK', 'BIP', 'BIK', 'MM', 'SCI', 'SEJ'],
    'Year 6': ['BC', 'BMP', 'BMK', 'BIP', 'BIK', 'MM', 'SCI', 'SEJ'],
    'Form 1': ['BC', 'BMP', 'BMK', 'BIP', 'BIK', 'MM', 'SCI', 'SEJ', 'GEO', 'RBT'],
    'Form 2': ['BC', 'BMP', 'BMK', 'BIP', 'BIK', 'MM', 'SCI', 'SEJ', 'GEO', 'RBT'],
    'Form 3': ['BC', 'BMP', 'BMK', 'BIP', 'BIK', 'MM', 'SCI', 'SEJ', 'GEO', 'RBT'],
    'Form 4': ['BC', 'BMP', 'BMK', 'BIP', 'BIK', 'MM', 'SCI', 'SEJ', 'ACC', 'AM', 'BIO', 'CHE', 'PHY', 'EKO', 'PER'],
    'Form 5': ['BC', 'BMP', 'BMK', 'BIP', 'BIK', 'MM', 'SCI', 'SEJ', 'ACC', 'AM', 'BIO', 'CHE', 'PHY', 'EKO', 'PER']
};

const REQUIRED_LEVELS = Object.keys(SUBJECT_MAP);

// ── Seeding ──────────────────────────────────────────────────
async function seedIfEmpty() {
    try {
        console.log('[Store] 🌱 Seeding check started...');
        console.log('[Store] 🔍 Checking settings...');
        const settingsDoc = await db.collection(COLLECTIONS.SETTINGS).doc('main').get();
        if (!settingsDoc.exists) {
            console.log('[Store] ✨ Creating default settings...');
            await db.collection(COLLECTIONS.SETTINGS).doc('main').set(DEFAULT_SETTINGS);
        }

        console.log('[Store] 🔍 Checking for existing users...');
        const userSnap = await db.collection(COLLECTIONS.USERS).limit(1).get();
        if (userSnap.empty) {
            console.log('[Store] ✨ Creating default users...');
            await db.collection(COLLECTIONS.USERS).doc('u_1').set({
                name: 'Admin User', email: 'admin@eduhero.com', password: 'password',
                role: 'admin', subjects: [], months: {}, monthExpiry: {}
            });
            await db.collection(COLLECTIONS.USERS).doc('u_2').set({
                name: 'Teacher Ali', email: 'teacher@eduhero.com', password: 'password',
                role: 'teacher', subjects: [], months: {}, monthExpiry: {}
            });
            await db.collection(COLLECTIONS.USERS).doc('u_3').set({
                name: 'Student Abu', email: 'student_code', password: 'password',
                role: 'student', subjects: [], months: {}, monthExpiry: {}
            });
        }

        console.log('[Store] 🔍 Checking subjects...');
        const subjectCount = await db.collection(COLLECTIONS.SUBJECTS).limit(1).get();
        if (subjectCount.empty) {
            console.log('[Store] ✨ Initializing subjects...');
            await store.reorganizeSubjects();
        }
        console.log('[Store] ✅ Seeding check complete.');
    } catch (err) {
        if (err.code === 'permission-denied') {
            console.log('[Store] ℹ️ Skipping seed check (expected for non-admins).');
        } else {
            console.error('[Store] ❌ Seeding failed:', err);
        }
    }
}

// ── Role-based Real-time Listeners ───────────────────────────
//
// Listener strategy (minimise Firebase reads):
//
//  ALL roles   → settings (1 doc), subjects (small collection)
//  admin       → users, videos   (admin manages all)
//  teacher     → videos where teacherId == self
//  student     → videos (all, to show assigned), progress where studentId == self
//
//  activityLog → NO persistent listener.
//                Fetched on-demand via store.fetchActivityLog()
//                (admin only, when the Log tab is opened)
//
//  comments    → NO persistent listener.
//                Read once per video when a video is opened.
//
// ── Subject-scoped video listeners (students & teachers) ─────
//
// Both roles only ever display videos for the subjects they are assigned, but
// both used to subscribe to the entire videos collection — every fresh login
// read every video document in the database (3000+ on the live project, which
// is what exhausts the daily Firestore read quota). These listeners are scoped
// to the user's own subjects and rebuilt if that assignment changes.
const _scopedVideos = { unsubs: [], chunks: new Map(), scopeKey: null, role: null };

function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function releaseScopedVideoSubs() {
    _scopedVideos.unsubs.forEach(unsub => {
        try { unsub(); } catch (e) {}
    });
    _scopedVideos.unsubs = [];
    _scopedVideos.chunks.clear();
    _scopedVideos.scopeKey = null;
    _scopedVideos.role = null;
}

// Merge the per-chunk results back into one cache array and refresh the page.
function applyScopedVideos() {
    const merged = new Map();
    _scopedVideos.chunks.forEach(list => list.forEach(v => merged.set(v.id, v)));
    _cache.videos = [...merged.values()];

    if (_scopedVideos.role === 'teacher') {
        if (typeof TeacherPage !== 'undefined' && document.getElementById('teacher-levels-list')) {
            TeacherPage.renderSubjects();
        }
    } else if (typeof StudentPage !== 'undefined' && document.getElementById('student-dashboard-wrapper')) {
        StudentPage.renderSubjects();
    }
}

// Returns an array of promises that resolve once each chunk's first snapshot
// has arrived. Safe to call again when the user's subjects change — it is a
// no-op if the scope is unchanged.
function subscribeScopedVideos(user) {
    const subjectIds = [...new Set((user.subjects || []).filter(Boolean))];
    const scopeKey = subjectIds.slice().sort().join('|');

    if (_scopedVideos.scopeKey === scopeKey && _scopedVideos.unsubs.length) {
        return []; // already listening to exactly this set of subjects
    }

    releaseScopedVideoSubs();
    _scopedVideos.scopeKey = scopeKey;
    _scopedVideos.role = user.role;

    if (subjectIds.length === 0) {
        applyScopedVideos(); // no subjects assigned yet — show an empty list
        return [];
    }

    // The compat SDK caps an 'in' filter at 10 values, so split the subject
    // list and merge the results.
    return chunkArray(subjectIds, 10).map((ids, index) => waitForSnapshot(
        db.collection(COLLECTIONS.VIDEOS).where('subjectId', 'in', ids),
        snap => {
            _scopedVideos.chunks.set(index, snap.docs.map(docToObj));
            applyScopedVideos();
        },
        _scopedVideos.unsubs
    ));
}

// Admin data is READ ONCE, not subscribed to.
//
// A collection listener is billed for its initial load and then again for every
// document change pushed to it for as long as it stays open. The admin was
// listening to all of users (5031), videos (3221) and progress (4001), so every
// student login, every lastActiveAt heartbeat and every progress write anywhere
// in the system was billed a second time to each open admin tab, all day long.
//
// Admin mutations already update the local cache optimistically, so the screen
// stays correct after the admin's own actions. The Refresh button re-reads when
// they want to pick up other people's changes.
async function loadAdminUsers() {
    const snap = await db.collection(COLLECTIONS.USERS).get();
    _cache.users = snap.docs.map(docToObj);
    _cache.initialUsersLoaded = true;
}

async function loadAdminVideos() {
    const snap = await db.collection(COLLECTIONS.VIDEOS).get();
    _cache.videos = snap.docs.map(docToObj);
}

// Counts for the dashboard cards, without downloading the collections.
//
// Aggregation queries are not an option here: count() exists only in the
// modular SDK (never in compat, at any version), the modular build cannot be
// pointed at the compat instance because gstatic ships them as separate module
// instances, and the REST aggregation endpoint answers RESOURCE_EXHAUSTED on
// this project while ordinary reads still succeed.
//
// So the counts live in a single document that costs one read. It is rewritten
// from the real collections every time the admin actually loads them — opening
// Users, Videos or Reports, or pressing Refresh — so it self-heals on any
// normal use of the console and needs no bookkeeping on individual writes.
async function readCounts() {
    const doc = await db.collection(COLLECTIONS.SETTINGS).doc('counts').get();
    _cache.counts = doc.exists ? doc.data() : null;
    return _cache.counts;
}

async function writeCountsFromLoadedData() {
    const counts = {
        students: _cache.users.filter(u => u.role === 'student').length,
        teachers: _cache.users.filter(u => u.role === 'teacher').length,
        videos: _cache.videos.length,
        subjects: _cache.subjects.length,
        updatedAt: new Date().toISOString()
    };
    _cache.counts = counts;
    try {
        await db.collection(COLLECTIONS.SETTINGS).doc('counts').set(counts);
    } catch (err) {
        console.warn('[Store] Could not cache dashboard counts:', err);
    }
    return counts;
}

function waitForSnapshot(query, callback, unsubsArray) {
    return new Promise(resolve => {
        let isResolved = false;
        const unsub = query.onSnapshot(snap => {
            callback(snap);
            // Determine if it has data. For single docs, snap.exists is boolean. For collections, snap.docs is array.
            const hasData = snap.exists !== undefined ? snap.exists : (snap.docs && snap.docs.length > 0);
            if (!isResolved && (!snap.metadata.fromCache || hasData)) {
                isResolved = true;
                resolve();
            }
        }, err => {
            console.error('[Store] Snapshot error:', err);
            if (!isResolved) {
                isResolved = true;
                resolve();
            }
        });
        unsubsArray.push(unsub);
    });
}

async function attachRoleListeners(user) {
    const unsubs = [];
    const promises = [];

    // ── SETTINGS (all roles) ──────────────────────────────────
    // Single-document listener — very cheap (1 read on change)
    promises.push(waitForSnapshot(
        db.collection(COLLECTIONS.SETTINGS).doc('main'),
        doc => {
            if (doc.exists) {
                _cache.settings = { ...DEFAULT_SETTINGS, ...doc.data() };
                // Re-apply branding so a settings change (or settings that arrived
                // after the 3s boot timeout) shows up without a page reload.
                if (typeof App !== 'undefined' && typeof App.applySystemSettings === 'function') {
                    App.applySystemSettings();
                }
            }
        },
        unsubs
    ));

    // ── SECRETS (admin & teacher) ─────────────────────────────
    if (user.role === 'admin' || user.role === 'teacher') {
        promises.push(waitForSnapshot(
            db.collection(COLLECTIONS.SECRETS).doc('bunny'),
            doc => {
                if (doc.exists) _cache.bunnySecrets = doc.data();
            },
            unsubs
        ));
    }

    // ── SUBJECTS (all roles) ──────────────────────────────────
    // Small collection (~77 docs), needed by all roles
    promises.push(waitForSnapshot(
        db.collection(COLLECTIONS.SUBJECTS),
        snap => {
            _cache.subjects = snap.docs.map(docToObj);
            // Reactive UI updates for all roles
            if (typeof AdminPage !== 'undefined' && typeof AdminPage.renderSubjects === 'function' && document.getElementById('admin-subjects-main')) {
                AdminPage.renderSubjects();
                AdminPage.renderStats();
            }
            // Smart refresh for Teacher: Only render if not loaded yet
            if (typeof TeacherPage !== 'undefined' && document.getElementById('teacher-levels-list')) {
                const container = document.getElementById('teacher-levels-list');
                if (!container.hasAttribute('data-loaded')) {
                    TeacherPage.renderSubjects();
                }
            }
            // Smart refresh for Student
            if (typeof StudentPage !== 'undefined' && document.getElementById('student-dashboard-wrapper')) {
                const container = document.getElementById('student-subjects');
                if (container) {
                    StudentPage.renderSubjects();
                }
            }
        },
        unsubs
    ));

    // ── CURRENT USER DATA (all roles) ────────────────────────
    // Exactly one document. Students and teachers need it for subject/month
    // changes; every role needs it for the single-session check. Admin used to
    // get this from the all-users listener — 5031 documents watched to read one
    // field on one of them.
    {
        promises.push(waitForSnapshot(
            db.collection(COLLECTIONS.USERS).doc(user.id),
            doc => {
                if (doc.exists) {
                    const userData = docToObj(doc);
                    const oldUser = _cache.users.find(u => u.id === user.id);
                    
                    // DEFINITIVE FIX: Re-render if subjects, months, or expiry changed.
                    const oldState = JSON.stringify({
                        s: oldUser?.subjects || [],
                        m: oldUser?.months || {},
                        e: oldUser?.monthExpiry || {}
                    });
                    const newState = JSON.stringify({
                        s: userData.subjects || [],
                        m: userData.months || {},
                        e: userData.monthExpiry || {}
                    });
                    const hasSignificantChange = !oldUser || oldState !== newState;

                    const idx = _cache.users.findIndex(u => u.id === user.id);
                    if (idx === -1) _cache.users.push(userData);
                    else _cache.users[idx] = userData;

                    // Single-session check. auth used to run its own onSnapshot on
                    // this exact document to do this, so every write to it was
                    // billed twice.
                    if (typeof auth !== 'undefined') auth.checkSession(userData);

                    if (hasSignificantChange && user.role !== 'admin') {
                        // Admin has no scoped video listener — it reads the whole
                        // collection once instead.
                        // The video listeners are scoped to this user's subjects,
                        // so a change in that assignment has to re-scope them.
                        // No-op when the subject list is actually unchanged.
                        subscribeScopedVideos(userData);

                        // Smart UI updates
                        if (user.role === 'teacher' && typeof TeacherPage !== 'undefined' && document.getElementById('teacher-levels-list')) {
                            TeacherPage.renderSubjects();
                        }
                        if (user.role === 'student' && typeof StudentPage !== 'undefined' && document.getElementById('student-dashboard-wrapper')) {
                            StudentPage.renderSubjects();
                        }
                    }
                }
            },
            unsubs
        ));
    }

    // ── ADMIN-only data: one-time reads, see loadAdminUsers() above ──
    if (user.role === 'admin') {
        // Nothing eager. The dashboard lands on a view that needs no collection,
        // so an admin who opens the app and leaves pays for the shared listeners
        // and four count queries — not 8000+ documents.
        //
        // store.ensureAdminData() pulls users + videos the first time a screen
        // actually needs them; the reports tab and the activity log fetch their
        // own data on demand.

    // ── TEACHER-only listeners ────────────────────────────────
    } else if (user.role === 'teacher') {
        // Only the videos in the teacher's own subjects — that is all the
        // dashboard renders, and it is what they may edit or delete.
        promises.push(...subscribeScopedVideos(user));

        // NOTE: no progress listener. The teacher dashboard's only use of
        // progress is a view count per video, which is now loaded on demand via
        // store.fetchViewCountsForVideos(). Subscribing here meant downloading
        // the entire progress collection on every teacher login.

    // ── STUDENT-only listeners ────────────────────────────────
    } else if (user.role === 'student') {
        // Only the videos in the subjects this student is assigned.
        promises.push(...subscribeScopedVideos(user));
        // Only this student's progress (not all students')
        promises.push(waitForSnapshot(
            db.collection(COLLECTIONS.PROGRESS).where('studentId', '==', user.id),
            snap => {
                // Merge: keep other students' progress in cache
                const myProgress    = snap.docs.map(docToObj);
                const otherProgress = _cache.progress.filter(p => p.studentId !== user.id);
                _cache.progress = [...otherProgress, ...myProgress];
            },
            unsubs
        ));
    }

    _cache.listeners = unsubs;
    console.log(`[Store] Attached ${unsubs.length} listener(s) for role: ${user.role}`);
    
    // Wait for all initial snapshots to resolve
    await Promise.all(promises);
    console.log('[Store] Initial sync complete.');
}

// ── Public Store API ─────────────────────────────────────────
const store = {

    // ----------------------------------------------------------
    // init() — call once on app boot (before login).
    // Does one-time reads to warm the cache for the login page
    // (settings for branding) and any pre-auth data.
    // Does NOT attach persistent listeners yet.
    // ----------------------------------------------------------
    async init() {
        // CRITICAL: Fetch settings for UI branding
        try {
            const settingsDoc = await db.collection(COLLECTIONS.SETTINGS).doc('main').get();
            if (settingsDoc.exists) {
                _cache.settings = { ...DEFAULT_SETTINGS, ...settingsDoc.data() };
            }
            
            // Cache warming for subjects and videos removed because it requires authentication.
            // They will be loaded by startSync() after successful login.
            _cache.ready = true;
            
        } catch (err) {
            console.warn('[Store] ⚠️ Network delay: UI might be temporarily empty.');
        }

        // seedIfEmpty() is NOT called here any more. It is a first-deployment
        // bootstrap, but it ran on every page load for every visitor — three
        // extra document reads (settings again, users.limit(1),
        // subjects.limit(1)) just to re-confirm that a database with thousands
        // of documents is not empty. Across the user base that alone was tens
        // of thousands of reads a day against a 50k/day quota.
        //
        // If a fresh database ever needs seeding, run store.seedIfEmpty() once
        // from the console as an admin.
        return true;
    },

    seedIfEmpty,

    // ----------------------------------------------------------
    // startSync(user) — call after successful login.
    // Attaches role-specific real-time listeners.
    // ----------------------------------------------------------
    async startSync(user) {
        this.stopSync(); // detach any existing listeners first
        if (user) await attachRoleListeners(user);
    },

    // ----------------------------------------------------------
    // stopSync() — call on logout. Detaches all listeners.
    // ----------------------------------------------------------
    stopSync() {
        _cache.listeners.forEach(unsub => {
            try { unsub(); } catch(e) {}
        });
        _cache.listeners = [];
        releaseScopedVideoSubs(); // subject-scoped video listeners live outside _cache.listeners
        console.log('[Store] All listeners detached.');
    },

    // ----------------------------------------------------------
    // Settings
    // ----------------------------------------------------------
    getSettings() {
        return { ...DEFAULT_SETTINGS, ..._cache.settings };
    },

    async updateSettings(updates) {
        const previous = { ...this.getSettings() };
        const merged = { ...previous, ...updates };
        _cache.settings = merged; // optimistic local update
        try {
            await db.collection(COLLECTIONS.SETTINGS).doc('main').set(merged);
        } catch (err) {
            _cache.settings = previous; // roll back so the UI stops showing a value that was never saved
            throw err;
        }
    },

    // ----------------------------------------------------------
    // Secrets
    // ----------------------------------------------------------
    getBunnySecrets() {
        return _cache.bunnySecrets || { mappings: [] };
    },

    saveBunnySecrets(mappings) {
        _cache.bunnySecrets = { mappings };
        return db.collection(COLLECTIONS.SECRETS).doc('bunny').set({ mappings });
    },

    // ----------------------------------------------------------
    // Activity Log — ON-DEMAND ONLY (no persistent listener)
    // Call store.fetchActivityLog() when admin opens the log tab.
    // ----------------------------------------------------------
    async fetchActivityLog() {
        const snap = await db.collection(COLLECTIONS.LOG)
            .orderBy('timestamp', 'desc')
            .limit(500)
            .get();
        _cache.activityLog = snap.docs.map(docToObj);
        return _cache.activityLog;
    },

    addLog(action, details) {
        let adminName = 'System';
        let adminId = 'system';
        try {
            const u = auth.getCurrentUser();
            if (u) {
                adminName = u.name;
                adminId = u.id;
            }
        } catch(e) {}
        const entry = {
            id: generateId('log'),
            action,
            details,
            adminName,
            adminId,
            timestamp: new Date().toISOString()
        };
        _cache.activityLog.unshift(entry);
        if (_cache.activityLog.length > 500) _cache.activityLog = _cache.activityLog.slice(0, 500);
        return db.collection(COLLECTIONS.LOG).doc(entry.id).set(entry);
    },

    getLog() {
        return [..._cache.activityLog];
    },

    clearLog() {
        _cache.activityLog = [];
        // A batch is capped at 500 writes, so the log has to be cleared in chunks.
        // The old version built one batch over the whole collection and never
        // awaited it, so on a log of any size it failed in silence.
        return (async () => {
            while (true) {
                const snap = await db.collection(COLLECTIONS.LOG).limit(400).get();
                if (snap.empty) return;
                const batch = db.batch();
                snap.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                if (snap.size < 400) return;
            }
        })();
    },

    // ----------------------------------------------------------
    // Users
    // ----------------------------------------------------------
    isReady() {
        return _cache.ready;
    },

    areUsersLoaded() {
        return _cache.initialUsersLoaded;
    },

    getUsers() {
        return [..._cache.users];
    },

    async getUserByEmail(email, password = null) {
        const cleanEmail = (email || '').toLowerCase().trim();
        
        // Always check cache first
        const cached = _cache.users.find(u => (u.email || '').toLowerCase() === cleanEmail);
        if (cached && (!password || cached.password === password)) {
            return cached;
        }

        // If not in cache or if we need to verify password against DB (legacy)
        // or if we are not Admin (so cache isn't full)
        let query = db.collection(COLLECTIONS.USERS).where('email', '==', cleanEmail).limit(1);
        if (password) {
            query = query.where('password', '==', password);
        }
        
        try {
            const snap = await query.get();
            if (snap.empty) return null;
            
            const userData = docToObj(snap.docs[0]);
            // Update cache
            const idx = _cache.users.findIndex(u => u.id === userData.id);
            if (idx === -1) _cache.users.push(userData);
            else _cache.users[idx] = userData;
            
            return userData;
        } catch (err) {
            console.error('[Store] getUserByEmail error:', err);
            return null;
        }
    },

    getUserByFirebaseUid(uid) {
        return _cache.users.find(u => u.uid === uid) || null;
    },

    async fetchUserByUid(uid) {
        if (!uid) return null;
        
        // Check cache first to avoid slow Firestore calls
        const cached = _cache.users.find(u => u.uid === uid);
        if (cached) return cached;

        try {
            console.log('[Store] 📡 Fetching role document for UID:', uid);
            const roleDoc = await db.collection(COLLECTIONS.ROLES).doc(uid).get();
            
            let userId;
            if (roleDoc.exists) {
                userId = roleDoc.data().userId;
                console.log('[Store] 🆔 Role found. Mapped to UserId:', userId);
            } else {
                console.warn('[Store] ❓ Role document missing for UID:', uid, '. Attempting direct search...');
                // Fallback: Search users collection for this UID
                const userSnap = await db.collection(COLLECTIONS.USERS).where('uid', '==', uid).limit(1).get();
                if (userSnap.empty) {
                    console.error('[Store] ❌ No user found with UID:', uid);
                    return null;
                }
                const userData = docToObj(userSnap.docs[0]);
                console.log('[Store] ✅ User found by direct UID search. Repairing role document...');
                // Repair the roles document
                await db.collection(COLLECTIONS.ROLES).doc(uid).set({ role: userData.role, userId: userData.id });
                
                // Update cache and return
                const idx = _cache.users.findIndex(u => u.id === userData.id);
                if (idx === -1) _cache.users.push(userData);
                else _cache.users[idx] = userData;
                return userData;
            }
            
            console.log('[Store] 📡 Fetching user document:', userId);
            const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
            
            if (userDoc.exists) {
                console.log('[Store] ✅ User document found and loaded.');
                const userData = docToObj(userDoc);
                const idx = _cache.users.findIndex(u => u.id === userId);
                if (idx === -1) {
                    _cache.users.push(userData);
                } else {
                    _cache.users[idx] = userData;
                }
                return userData;
            } else {
                console.error('[Store] ❌ User document missing for ID:', userId);
            }
        } catch (e) {
            console.error('[Store] 🔥 Permission or Network error during fetch:', e);
        }
        return null;
    },

    async migrateUserToFirebaseAuth(userObj, uid, isDefaultPassword) {
        const userId = userObj.id;
        const idx = _cache.users.findIndex(u => u.id === userId);
        if (idx !== -1) {
            _cache.users[idx].uid = uid;
            _cache.users[idx].mustChangePassword = isDefaultPassword;
            delete _cache.users[idx].password;
        } else {
            _cache.users.push({ ...userObj, uid, mustChangePassword: isDefaultPassword });
        }

        const batch = db.batch();
        batch.update(db.collection(COLLECTIONS.USERS).doc(userId), {
            uid,
            mustChangePassword: isDefaultPassword,
            password: firebase.firestore.FieldValue.delete()
        });

        // Write to roles collection for security rules
        batch.set(db.collection(COLLECTIONS.ROLES).doc(uid), { role: userObj.role, userId });

        await batch.commit();
    },

    async addUser(uid, user) {
        const id = generateId('u');
        // IMPORTANT: For legacy users (uid=null), we MUST store the password in Firestore.
        // For Auth-migrated users, we can strip it.
        let newUser;
        if (uid) {
            const { password, ...userData } = user;
            newUser = { id, uid, subjects: [], months: {}, monthExpiry: {}, ...userData };
        } else {
            newUser = { id, uid, subjects: [], months: {}, monthExpiry: {}, ...user };
        }
        _cache.users.push(newUser);
        
        const batch = db.batch();
        batch.set(db.collection(COLLECTIONS.USERS).doc(id), newUser);
        if (uid) {
            batch.set(db.collection(COLLECTIONS.ROLES).doc(uid), { role: user.role, userId: id });
        }
        await batch.commit();
        return newUser;
    },

    // Returns a promise. It used to return undefined AND skip the database write
    // entirely when the user was not in the local cache, so callers that did
    // Promise.resolve(store.updateUser(...)).then(showSuccessToast) reported
    // success for a write that never happened.
    updateUser(id, updates) {
        const idx = _cache.users.findIndex(u => u.id === id);
        if (idx !== -1) {
            _cache.users[idx] = { ..._cache.users[idx], ...updates };
        }
        return db.collection(COLLECTIONS.USERS).doc(id).update(updates);
    },

    async deleteUser(id) {
        const user = _cache.users.find(u => u.id === id);
        _cache.users = _cache.users.filter(u => u.id !== id);
        
        const batch = db.batch();
        batch.delete(db.collection(COLLECTIONS.USERS).doc(id));
        if (user && user.uid) {
            batch.delete(db.collection(COLLECTIONS.ROLES).doc(user.uid));
        }
        await batch.commit();
    },

    // ----------------------------------------------------------
    // Subjects
    // ----------------------------------------------------------
    getSubjects() {
        const levelOrder = REQUIRED_LEVELS;
        return [..._cache.subjects].sort((a, b) => {
            let idxLevelA = levelOrder.indexOf(a.level);
            let idxLevelB = levelOrder.indexOf(b.level);
            if (idxLevelA === -1) idxLevelA = 999;
            if (idxLevelB === -1) idxLevelB = 999;

            if (idxLevelA !== idxLevelB) return idxLevelA - idxLevelB;
            
            // Within same level, sort by the 'order' field we assigned
            const orderA = a.order !== undefined ? a.order : 999;
            const orderB = b.order !== undefined ? b.order : 999;
            if (orderA !== orderB) return orderA - orderB;

            return (a.name || '').localeCompare(b.name || '');
        });
    },

    addSubject(subject) {
        const id = generateId('s');
        const newSubject = { id, color: '#4F46E5', ...subject };
        _cache.subjects.push(newSubject);
        // The caller gets the fields synchronously (the UI renders optimistically)
        // plus the write on .saved, so a failure can be reported instead of
        // leaving a subject that exists only in this browser. The promise is kept
        // off the cached object so it is never handed to Firestore or the UI.
        return { ...newSubject, saved: db.collection(COLLECTIONS.SUBJECTS).doc(id).set(newSubject) };
    },

    updateSubject(id, updates) {
        const idx = _cache.subjects.findIndex(s => s.id === id);
        if (idx !== -1) _cache.subjects[idx] = { ..._cache.subjects[idx], ...updates };
        return db.collection(COLLECTIONS.SUBJECTS).doc(id).update(updates);
    },

    // Deleting a subject fans out into user, video and comment writes. None of
    // them used to be awaited, so a partial failure left orphaned videos behind
    // while the UI reported a clean delete.
    async deleteSubject(id) {
        _cache.subjects = _cache.subjects.filter(s => s.id !== id);
        const writes = [];

        _cache.users.forEach(u => {
            if (u.subjects && u.subjects.includes(id)) {
                writes.push(this.updateUser(u.id, { subjects: u.subjects.filter(sid => sid !== id) }));
            }
        });

        const vidsToDelete = _cache.videos.filter(v => v.subjectId === id);
        _cache.videos = _cache.videos.filter(v => v.subjectId !== id);
        vidsToDelete.forEach(v => {
            writes.push(db.collection(COLLECTIONS.VIDEOS).doc(v.id).delete());
            _cache.comments = _cache.comments.filter(c => c.videoId !== v.id);
            writes.push(
                db.collection(COLLECTIONS.COMMENTS).where('videoId', '==', v.id).get()
                    .then(snap => {
                        if (snap.empty) return;
                        const b = db.batch();
                        snap.docs.forEach(d => b.delete(d.ref));
                        return b.commit();
                    })
            );
        });

        writes.push(db.collection(COLLECTIONS.SUBJECTS).doc(id).delete());
        await Promise.all(writes);
    },

    // ----------------------------------------------------------
    // Videos
    // ----------------------------------------------------------
    getVideos() {
        return [..._cache.videos];
    },

    getVideoViews(videoId) {
        // Count how many unique progress records (students) exist for this video
        return (_cache.progress || []).filter(p => p.videoId === videoId).length;
    },

    // Same counts as getVideoViews(), but for every video in a single pass.
    // Use this when rendering a list: calling getVideoViews() per row (or worse,
    // inside a sort comparator) rescans the whole progress collection each time.
    getVideoViewCounts() {
        const counts = new Map();
        (_cache.progress || []).forEach(p => {
            if (!p.videoId) return;
            counts.set(p.videoId, (counts.get(p.videoId) || 0) + 1);
        });
        return counts;
    },

    addVideo(video) {
        const id = generateId('v');
        const newVideo = {
            id,
            date: new Date().toISOString(),
            views: 0,
            year: new Date().getFullYear().toString(),
            ...video
        };
        _cache.videos.push(newVideo);
        db.collection(COLLECTIONS.VIDEOS).doc(id).set(newVideo);
        return newVideo;
    },

    async updateVideo(videoId, data) {
        try {
            // Sync title update to BunnyStream if title is changed
            if (data.title && typeof BunnyStreamAPI !== 'undefined') {
                const doc = await db.collection(COLLECTIONS.VIDEOS).doc(videoId).get();
                if (doc.exists) {
                    const video = doc.data();
                    if (video.videoProvider === 'bunny' && video.bunnyLibraryId && video.bunnyVideoId && video.title !== data.title) {
                        const mappings = this.getBunnySecrets().mappings || [];
                        const mapping = mappings.find(m => m.bunnyLibraryId === video.bunnyLibraryId);
                        if (mapping && mapping.libraryKey) {
                            await BunnyStreamAPI.updateVideo(video.bunnyLibraryId, mapping.libraryKey, video.bunnyVideoId, data.title).catch(e => console.warn('Bunny update failed:', e));
                        }
                    }
                }
            }
            const idx = _cache.videos.findIndex(v => v.id === videoId);
            if (idx !== -1) _cache.videos[idx] = { ..._cache.videos[idx], ...data };
            await db.collection(COLLECTIONS.VIDEOS).doc(videoId).update(data);
        } catch (e) {
            console.error('Error updating video:', e);
            throw e;
        }
    },

    // Count viewers for a specific set of videos, on demand.
    //
    // This replaces the old incrementVideoView(), which wrote a `views` counter
    // onto the video document every time a student opened a video. That
    // document is inside the realtime query every student in the subject is
    // listening to, so each increment pushed the updated document to every
    // connected student — one billed read each — and before this change nothing
    // in the app displayed video.views at all. Progress records already record
    // who watched what.
    async fetchViewCountsForVideos(videoIds) {
        const counts = new Map();
        const ids = [...new Set((videoIds || []).filter(Boolean))];
        if (ids.length === 0) return counts;
        ids.forEach(id => counts.set(id, 0));

        // The compat SDK caps an 'in' filter at 10 values.
        for (let i = 0; i < ids.length; i += 10) {
            const chunk = ids.slice(i, i + 10);
            const snap = await db.collection(COLLECTIONS.PROGRESS)
                .where('videoId', 'in', chunk)
                .get();
            snap.docs.forEach(doc => {
                const videoId = doc.data().videoId;
                counts.set(videoId, (counts.get(videoId) || 0) + 1);
            });
        }
        return counts;
    },
    async deleteVideo(id) {
        _cache.videos = _cache.videos.filter(v => v.id !== id);
        _cache.comments = _cache.comments.filter(c => c.videoId !== id);
        
        try {
            // Delete from BunnyStream first to save storage costs
            if (typeof BunnyStreamAPI !== 'undefined') {
                const doc = await db.collection(COLLECTIONS.VIDEOS).doc(id).get();
                if (doc.exists) {
                    const video = doc.data();
                    if (video.videoProvider === 'bunny' && video.bunnyLibraryId && video.bunnyVideoId) {
                        const mappings = this.getBunnySecrets().mappings || [];
                        const mapping = mappings.find(m => m.bunnyLibraryId === video.bunnyLibraryId);
                        if (mapping && mapping.libraryKey) {
                            await BunnyStreamAPI.deleteVideo(video.bunnyLibraryId, mapping.libraryKey, video.bunnyVideoId).catch(e => console.warn('Bunny delete failed:', e));
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Error in BunnyStream delete sync:', err);
        }

        db.collection(COLLECTIONS.VIDEOS).doc(id).delete();
        db.collection(COLLECTIONS.COMMENTS).where('videoId', '==', id).get()
            .then(snap => {
                const b = db.batch();
                snap.docs.forEach(d => b.delete(d.ref));
                return b.commit();
            });
    },

    // ----------------------------------------------------------
    // Comments
    // ----------------------------------------------------------
    getComments(videoId) {
        return _cache.comments.filter(c => c.videoId === videoId);
    },

    addComment(videoId, userId, text) {
        const id = generateId('c');
        const newComment = { id, videoId, userId, text, date: new Date().toISOString() };
        _cache.comments.push(newComment);
        db.collection(COLLECTIONS.COMMENTS).doc(id).set(newComment);
        return newComment;
    },

    // ----------------------------------------------------------
    // Progress
    // ----------------------------------------------------------
    // Enhanced Replay Tracking
    async trackVideoProgress(studentId, videoId, event, data = {}) {
        if (!studentId || !videoId) return;

        const id = `${studentId}_${videoId}`;
        const now = new Date().toISOString();
        let prog = _cache.progress.find(p => p.id === id);

        if (!prog) {
            // Cache miss. Read the record once instead of assuming it does not
            // exist. The old code assumed zeros here and then wrote the whole
            // rebuilt record back, so opening a video before the progress
            // listener had settled reset that video's real progress to 0%.
            try {
                const snap = await db.collection(COLLECTIONS.PROGRESS).doc(id).get();
                if (snap.exists) prog = docToObj(snap);
            } catch (err) {
                console.warn('[Store] Could not read existing progress for', id, err);
            }
        }

        const isNew = !prog;
        if (isNew) {
            prog = {
                id, studentId, videoId,
                watchDuration: 0,
                watchPercentage: 0,
                rewatchCount: 0,
                milestones: [],
                openedAt: now,
                lastWatchedAt: now,
                completedAt: null,
                startedAt: null
            };
        }
        const seededIdx = _cache.progress.findIndex(p => p.id === id);
        if (seededIdx === -1) _cache.progress.push(prog);
        else _cache.progress[seededIdx] = prog;

        // 'updates' is what changes in the local cache; 'payload' is what goes to
        // Firestore. They differ for the accumulating fields, which are applied
        // server-side so two tabs cannot each add to their own stale copy.
        const updates = { lastWatchedAt: now };
        const payload = { lastWatchedAt: now };
        let addedDuration = 0;
        let addedMilestone = null;

        switch (event) {
            case 'opened':
                if (!prog.openedAt) { updates.openedAt = now; payload.openedAt = now; }
                break;
            case 'started':
                if (!prog.startedAt) { updates.startedAt = now; payload.startedAt = now; }
                // If previously completed, count this as a rewatch.
                if (prog.completedAt || (prog.watchPercentage && prog.watchPercentage >= 90)) {
                    updates.rewatchCount = (prog.rewatchCount || 0) + 1;
                    payload.rewatchCount = firebase.firestore.FieldValue.increment(1);
                }
                break;
            case 'milestone': {
                const percent = data.percentage || 0;
                if (percent > (prog.watchPercentage || 0)) {
                    updates.watchPercentage = percent;
                    payload.watchPercentage = percent;
                    if (!(prog.milestones || []).includes(String(percent))) addedMilestone = String(percent);
                }
                if (data.duration) addedDuration = data.duration;
                break;
            }
            case 'completed':
                if (!prog.completedAt) { updates.completedAt = now; payload.completedAt = now; }
                updates.watchPercentage = 100;
                payload.watchPercentage = 100;
                if (!(prog.milestones || []).includes('100')) addedMilestone = '100';
                break;
            case 'closed': {
                if (data.duration) addedDuration = data.duration;
                const pct = data.percentage || 0;
                if (pct > (prog.watchPercentage || 0)) {
                    updates.watchPercentage = pct;
                    payload.watchPercentage = pct;
                    if (!(prog.milestones || []).includes(String(pct))) addedMilestone = String(pct);
                }
                break;
            }
        }

        if (addedDuration) {
            updates.watchDuration = (prog.watchDuration || 0) + addedDuration;
            payload.watchDuration = firebase.firestore.FieldValue.increment(addedDuration);
        }
        if (addedMilestone) {
            updates.milestones = [...(prog.milestones || []), addedMilestone];
            payload.milestones = firebase.firestore.FieldValue.arrayUnion(addedMilestone);
        }

        // A brand-new record needs its identifying and baseline fields. An
        // existing one must never have them rewritten from a stale cache.
        if (isNew) {
            payload.id = id;
            payload.studentId = studentId;
            payload.videoId = videoId;
            payload.openedAt = prog.openedAt;
            if (payload.rewatchCount === undefined) payload.rewatchCount = 0;
            if (payload.watchDuration === undefined) payload.watchDuration = 0;
            if (payload.watchPercentage === undefined) payload.watchPercentage = 0;
        }

        const idx = _cache.progress.findIndex(p => p.id === id);
        _cache.progress[idx] = { ..._cache.progress[idx], ...updates };

        // Swallowed, not rethrown: all six call sites in student.js fire this
        // without awaiting, so rethrowing would only surface as an unhandled
        // rejection. Losing a progress write must never interrupt playback.
        return db.collection(COLLECTIONS.PROGRESS).doc(id).set(payload, { merge: true })
            .catch(err => console.error('[Store] Failed to save progress for', id, err));
    },

    updateUserActivity(userId) {
        const updates = { lastActiveAt: new Date().toISOString() };
        const idx = _cache.users.findIndex(u => u.id === userId);
        if (idx !== -1) _cache.users[idx] = { ..._cache.users[idx], ...updates };
        return db.collection(COLLECTIONS.USERS).doc(userId).update(updates)
            .catch(err => console.warn('[Store] activity stamp failed:', err));
    },

    // NOTE: auth.enforceSingleSession() already stamps lastLoginAt/lastActiveAt
    // in the same write that locks the session, so nothing calls this on login
    // any more. Kept for any manual/admin use.
    updateUserLogin(userId) {
        const now = new Date().toISOString();
        const updates = { lastLoginAt: now, lastActiveAt: now };
        const idx = _cache.users.findIndex(u => u.id === userId);
        if (idx !== -1) _cache.users[idx] = { ..._cache.users[idx], ...updates };
        return db.collection(COLLECTIONS.USERS).doc(userId).update(updates);
    },

    getProgress(studentId, videoId) {
        const prog = _cache.progress.find(p => p.studentId === studentId && p.videoId === videoId);
        return prog ? (prog.watchPercentage || 0) : 0;
    },

    getProgressRecord(studentId, videoId) {
        return _cache.progress.find(p => p.studentId === studentId && p.videoId === videoId) || null;
    },

    getAllProgressForVideo(videoId) {
        return _cache.progress.filter(p => p.videoId === videoId);
    },

    getAllProgressForStudent(studentId) {
        return _cache.progress.filter(p => p.studentId === studentId);
    },

    // The Learning Reports tab calls this the first time it is opened. Nothing
    // loads the progress collection eagerly any more.
    async fetchAllProgress() {
        const snap = await db.collection(COLLECTIONS.PROGRESS).get();
        _cache.progress = snap.docs.map(docToObj);
        _cache.progressLoaded = true;
        return [..._cache.progress];
    },

    isProgressLoaded() {
        return !!_cache.progressLoaded;
    },

    // One student's records, without pulling the whole collection.
    async fetchProgressForStudent(studentId) {
        const snap = await db.collection(COLLECTIONS.PROGRESS)
            .where('studentId', '==', studentId).get();
        return snap.docs.map(docToObj);
    },

    // Users and videos, fetched once and then reused. Every admin screen that
    // needs either of them awaits this first.
    async ensureAdminData() {
        if (_cache.adminDataLoaded) return;
        await Promise.all([loadAdminUsers(), loadAdminVideos()]);
        _cache.adminDataLoaded = true;
        // The collections are in memory now, so the cards can be made exact
        // again for free.
        await writeCountsFromLoadedData();
        if (typeof AdminPage !== 'undefined' && document.getElementById('admin-stats')) {
            AdminPage.renderStats();
        }
    },

    isAdminDataLoaded() {
        return !!_cache.adminDataLoaded;
    },

    // Dashboard cards: one document read per admin page load.
    async fetchCounts() {
        return readCounts();
    },

    getCounts() {
        return _cache.counts;
    },

    // Re-read what the admin screen shows. These are no longer live listeners,
    // so the Refresh button is how an admin picks up other people's changes.
    async refreshAdminData() {
        _cache.progressLoaded = false;
        _cache.adminDataLoaded = false;
        // ensureAdminData() rewrites the counts document from the freshly
        // loaded collections, so there is nothing else to refresh.
        await this.ensureAdminData();
    },

    getProgressRecords() {
        return [..._cache.progress];
    },

    // ----------------------------------------------------------
    // Utility
    // ----------------------------------------------------------
    async reorganizeSubjects() {
        console.log('[Store] 🔄 Reorganizing subjects based on new map...');
        const batch = db.batch();
        
        // Ensure we have latest data
        const snap = await db.collection(COLLECTIONS.SUBJECTS).get();
        const currentSubjects = snap.docs.map(docToObj);
        
        const normalize = (s) => (s || '').toString().toLowerCase().trim();

        for (const [level, cats] of Object.entries(SUBJECT_MAP)) {
            cats.forEach((cat, index) => {
                const exists = currentSubjects.find(s => 
                    normalize(s.level) === normalize(level) && 
                    normalize(s.category) === normalize(cat)
                );
                
                if (!exists) {
                    const ref = db.collection(COLLECTIONS.SUBJECTS).doc();
                    const newSub = { 
                        id: ref.id, 
                        name: `${cat} ${level}`, 
                        level: level.trim(),
                        category: cat.trim(), 
                        color: '#4F46E5',
                        order: index // Add order for sorting
                    };
                    batch.set(ref, newSub);
                } else {
                    // Update order if it's missing or different
                    if (exists.order !== index) {
                        batch.update(db.collection(COLLECTIONS.SUBJECTS).doc(exists.id), { order: index });
                    }
                }
            });
        }
        await batch.commit();
        console.log('[Store] ✅ Subjects reorganization complete.');
    },

    generateId,
};
