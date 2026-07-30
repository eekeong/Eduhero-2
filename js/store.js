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
    initialUsersLoaded: false
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
            if (doc.exists) _cache.settings = { ...DEFAULT_SETTINGS, ...doc.data() };
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

    // ── CURRENT USER DATA (student/teacher) ──────────────────
    // Admin already listens to ALL users below.
    // Students/Teachers need to listen to their own doc for subject/month updates.
    if (user.role !== 'admin') {
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

                    if (hasSignificantChange) {
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

    // ── ADMIN-only listeners ──────────────────────────────────
    if (user.role === 'admin') {
        // Full users list (needed for user management)
        promises.push(waitForSnapshot(
            db.collection(COLLECTIONS.USERS),
            snap => {
                _cache.users = snap.docs.map(docToObj);
                
                // Prevent local cache from instantly bypassing skeleton loader if it only has the admin user
                if (!snap.metadata.fromCache || snap.docs.length > 1) {
                    _cache.initialUsersLoaded = true;
                }
                
                // Reactive UI update for Admin
                if (typeof AdminPage !== 'undefined' && document.getElementById('admin-users-list')) {
                    AdminPage.renderUsers();
                    AdminPage.renderSubjects(); // Update teacher counts in subjects list
                    AdminPage.renderStats();
                }
            },
            unsubs
        ));
        // All videos (needed for admin monitoring)
        promises.push(waitForSnapshot(
            db.collection(COLLECTIONS.VIDEOS),
            snap => {
                _cache.videos = snap.docs.map(docToObj);
                // Reactive UI update for Admin
                if (typeof AdminPage !== 'undefined' && document.getElementById('admin-videos-list')) {
                    AdminPage.renderVideos();
                    AdminPage.renderSubjects(); // CRITICAL: Update video counts in subjects list
                    AdminPage.renderStats();
                }
            },
            unsubs
        ));
        // NOTE: activityLog has NO listener — fetched on-demand only
        
        // Progress (Admin needs to see everyone's progress for reports)
        promises.push(waitForSnapshot(
            db.collection(COLLECTIONS.PROGRESS),
            snap => {
                _cache.progress = snap.docs.map(docToObj);
                // Refresh reports if visible
                if (typeof AdminPage !== 'undefined' && document.getElementById('tab-reports') && !document.getElementById('tab-reports').classList.contains('hidden')) {
                    AdminPage.renderReports();
                }
            },
            unsubs
        ));

    // ── TEACHER-only listeners ────────────────────────────────
    } else if (user.role === 'teacher') {
        // Teachers should see all videos (similar to students) so they can see existing content
        // in their assigned subjects. They can only edit/delete their own videos via UI logic.
        promises.push(waitForSnapshot(
            db.collection(COLLECTIONS.VIDEOS),
            snap => {
                _cache.videos = snap.docs.map(docToObj);
                // Reactive UI update for Teacher dashboard video counts
                if (typeof TeacherPage !== 'undefined' && document.getElementById('teacher-levels-list')) {
                    TeacherPage.renderSubjects();
                }
            },
            unsubs
        ));
        // Progress (Teacher needs to see progress for view counts)
        promises.push(waitForSnapshot(
            db.collection(COLLECTIONS.PROGRESS),
            snap => {
                _cache.progress = snap.docs.map(docToObj);
                if (typeof TeacherPage !== 'undefined' && document.getElementById('teacher-levels-list')) {
                    TeacherPage.renderSubjects();
                }
            },
            unsubs
        ));

    // ── STUDENT-only listeners ────────────────────────────────
    } else if (user.role === 'student') {
        // All videos (student needs to see videos for their subjects)
        promises.push(waitForSnapshot(
            db.collection(COLLECTIONS.VIDEOS),
            snap => {
                _cache.videos = snap.docs.map(docToObj);
                // Refresh student dashboard when videos arrive (needed for lesson counts)
                if (typeof StudentPage !== 'undefined' && document.getElementById('student-dashboard-wrapper')) {
                    StudentPage.renderSubjects();
                }
            },
            unsubs
        ));
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

        seedIfEmpty(); // Non-blocking
        return true;
    },

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
        console.log('[Store] All listeners detached.');
    },

    // ----------------------------------------------------------
    // Settings
    // ----------------------------------------------------------
    getSettings() {
        return { ...DEFAULT_SETTINGS, ..._cache.settings };
    },

    updateSettings(updates) {
        const merged = { ...this.getSettings(), ...updates };
        _cache.settings = merged; // optimistic local update
        return db.collection(COLLECTIONS.SETTINGS).doc('main').set(merged);
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
        db.collection(COLLECTIONS.LOG).get().then(snap => {
            const batch = db.batch();
            snap.docs.forEach(doc => batch.delete(doc.ref));
            return batch.commit();
        });
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
        const cached = _cache.users.find(u => u.email.toLowerCase() === cleanEmail);
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

    updateUser(id, updates) {
        const idx = _cache.users.findIndex(u => u.id === id);
        if (idx !== -1) {
            _cache.users[idx] = { ..._cache.users[idx], ...updates };
            db.collection(COLLECTIONS.USERS).doc(id).update(updates);
        }
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
        db.collection(COLLECTIONS.SUBJECTS).doc(id).set(newSubject);
        return newSubject;
    },

    updateSubject(id, updates) {
        const idx = _cache.subjects.findIndex(s => s.id === id);
        if (idx !== -1) {
            _cache.subjects[idx] = { ..._cache.subjects[idx], ...updates };
            db.collection(COLLECTIONS.SUBJECTS).doc(id).update(updates);
        }
    },

    deleteSubject(id) {
        _cache.subjects = _cache.subjects.filter(s => s.id !== id);
        _cache.users.forEach(u => {
            if (u.subjects && u.subjects.includes(id)) {
                const updated = u.subjects.filter(sid => sid !== id);
                this.updateUser(u.id, { subjects: updated });
            }
        });
        const vidsToDelete = _cache.videos.filter(v => v.subjectId === id);
        _cache.videos = _cache.videos.filter(v => v.subjectId !== id);
        vidsToDelete.forEach(v => {
            db.collection(COLLECTIONS.VIDEOS).doc(v.id).delete();
            _cache.comments = _cache.comments.filter(c => c.videoId !== v.id);
            db.collection(COLLECTIONS.COMMENTS).where('videoId', '==', v.id).get()
                .then(snap => {
                    const b = db.batch();
                    snap.docs.forEach(d => b.delete(d.ref));
                    return b.commit();
                });
        });
        db.collection(COLLECTIONS.SUBJECTS).doc(id).delete();
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

    incrementVideoView(id) {
        const idx = _cache.videos.findIndex(v => v.id === id);
        if (idx !== -1) {
            _cache.videos[idx].views = (_cache.videos[idx].views || 0) + 1;
            db.collection(COLLECTIONS.VIDEOS).doc(id).update({
                views: firebase.firestore.FieldValue.increment(1)
            });
        }
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
        
        // If not in cache, create initial structure
        if (!prog) {
            prog = {
                id,
                studentId,
                videoId,
                watchDuration: 0,
                watchPercentage: 0,
                rewatchCount: 0,
                milestones: [],
                openedAt: now,
                lastWatchedAt: now,
                completedAt: null,
                startedAt: null
            };
            _cache.progress.push(prog);
        }

        const updates = { lastWatchedAt: now };

        switch (event) {
            case 'opened':
                if (!prog.openedAt) updates.openedAt = now;
                break;
            case 'started':
                if (!prog.startedAt) updates.startedAt = now;
                // If previously completed, increment rewatch
                if (prog.completedAt || (prog.watchPercentage && prog.watchPercentage >= 90)) {
                    updates.rewatchCount = (prog.rewatchCount || 0) + 1;
                }
                break;
            case 'milestone':
                const percent = data.percentage || 0;
                if (percent > prog.watchPercentage) {
                    updates.watchPercentage = percent;
                    // Add milestone if not already reached
                    const milestoneStr = percent.toString();
                    if (!(prog.milestones || []).includes(milestoneStr)) {
                        updates.milestones = [...(prog.milestones || []), milestoneStr];
                    }
                }
                if (data.duration) {
                    updates.watchDuration = (prog.watchDuration || 0) + data.duration;
                }
                break;
            case 'completed':
                if (!prog.completedAt) updates.completedAt = now;
                updates.watchPercentage = 100;
                if (!(prog.milestones || []).includes('100')) {
                    updates.milestones = [...(prog.milestones || []), '100'];
                }
                break;
            case 'closed':
                if (data.duration) {
                    updates.watchDuration = (prog.watchDuration || 0) + data.duration;
                }
                if (data.percentage && data.percentage > (prog.watchPercentage || 0)) {
                    updates.watchPercentage = data.percentage;
                    const milestoneStr = data.percentage.toString();
                    if (!(prog.milestones || []).includes(milestoneStr)) {
                        updates.milestones = [...(prog.milestones || []), milestoneStr];
                    }
                }
                break;
        }

        // Apply to local cache
        const idx = _cache.progress.findIndex(p => p.id === id);
        const finalData = { ..._cache.progress[idx], ...updates };
        _cache.progress[idx] = finalData;

        // Save to Firestore
        return db.collection(COLLECTIONS.PROGRESS).doc(id).set(finalData, { merge: true });
    },

    updateUserActivity(userId) {
        const now = new Date().toISOString();
        const updates = { lastActiveAt: now };
        
        const idx = _cache.users.findIndex(u => u.id === userId);
        if (idx !== -1) {
            _cache.users[idx] = { ..._cache.users[idx], ...updates };
            db.collection(COLLECTIONS.USERS).doc(userId).update(updates);
        }
    },

    updateUserLogin(userId) {
        const now = new Date().toISOString();
        const updates = { lastLoginAt: now, lastActiveAt: now };
        
        const idx = _cache.users.findIndex(u => u.id === userId);
        if (idx !== -1) {
            _cache.users[idx] = { ..._cache.users[idx], ...updates };
            db.collection(COLLECTIONS.USERS).doc(userId).update(updates);
        }
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
