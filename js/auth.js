// Authentication Logic — Firebase Authentication
const auth = {

    isMigrating: false,
    sessionEnforced: false,
    sessionStamping: false,
    localSid: null,

    // Convert student code or email → Firebase Auth email format
    _toAuthEmail(val) {
        val = (val || '').trim().toLowerCase();
        return val.includes('@') ? val : `${val}@eduhero-lms.app`;
    },

    // Login: tries Firebase Auth first; lazy-migrates old accounts on first login
    async login(emailOrCode, password) {
        const authEmail = this._toAuthEmail(emailOrCode);
        password = (password || '').trim();
        try {
            this.isMigrating = true; // Set flag IMMEDIATELY to block the global listener
            console.log('[Auth] 🚀 Attempting Firebase Auth login for:', authEmail);
            const cred = await firebase.auth().signInWithEmailAndPassword(authEmail, password);
            console.log('[Auth] ✅ Firebase Auth success. UID:', cred.user.uid);
            
            // Re-sync password to Firestore for Admin visibility
            let userInStore = await store.fetchUserByUid(cred.user.uid);
            if (userInStore) {
                // Best-effort mirror for the admin's plaintext view. Deliberately
                // not awaited — it must never block or fail a login — but the
                // rejection is caught so it cannot surface as an unhandled one.
                store.updateUser(userInStore.id, { password: password })
                    .catch(err => console.warn('[Auth] Could not mirror password to Firestore:', err));
            }
            
            console.log('[Auth] 🔍 Checking Firestore for user roles...');
            
            if (!userInStore) {
                console.warn('[Auth] ⚠️ User found in Auth but not in Firestore roles. Starting Recovery...');
                
                // Since we already signed in successfully with Firebase Auth, 
                // we can safely link the Firestore record by email.
                let oldUser = await store.getUserByEmail(authEmail);
                if (oldUser) {
                    console.log('[Auth] 🔄 Found user record in Firestore. Linking to UID:', cred.user.uid);
                    await store.migrateUserToFirebaseAuth(oldUser, cred.user.uid, oldUser.mustChangePassword || password === 'password');
                    userInStore = await store.fetchUserByUid(cred.user.uid);
                } else {
                    console.error('[Auth] ❌ Recovery failed: User record not found in Firestore for email:', authEmail);
                }
                this.isMigrating = false;
            }
            
            if (!userInStore) {
                console.error('[Auth] ❌ Final user check failed. Account is broken.');
                await firebase.auth().signOut();
                return { success: false, error: 'Account setup incomplete. Please contact admin.' };
            }

            console.log('[Auth] 🎉 Login process complete. Returning success.');
            this.isMigrating = false;
            // Enforce single device login
            await this.enforceSingleSession(cred.user.uid);
            return { success: true };
        } catch (err) {
            this.isMigrating = false;
            console.error('[Auth] ❌ Login error:', err.code, err.message);
            const notFound = ['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-email', 'auth/invalid-login-credentials', 'auth/invalid-email'];
            if (notFound.includes(err.code)) {
                console.log('[Auth] 🔄 Error suggests user not found in Auth. Attempting migration...');
                return this._migrateAndLogin(emailOrCode, password, authEmail);
            }
            if (err.code === 'auth/wrong-password') {
                console.warn('[Auth] ⚠️ Wrong password for existing Auth account.');
                return { success: false, error: 'Incorrect password.' };
            }
            return { success: false, error: err.message };
        }
    },

    // Lazy migration: if user exists in old Firestore-password system, promote to Firebase Auth
    async _migrateAndLogin(originalCode, password, authEmail) {
        console.log('[Auth] 🔄 Starting migration for:', authEmail);
        // Search by email only to find both legacy (with password) and migrated (without password) users
        let oldUser = await store.getUserByEmail(authEmail);
        if (!oldUser) oldUser = await store.getUserByEmail(originalCode);
        
        if (!oldUser) {
            console.error('[Auth] ❌ Migration failed: No user found in Firestore for:', authEmail);
            return { success: false, error: 'User not found. Please contact admin.' };
        }
        
        // If user already has a UID but we are here, it means they are in Auth but missing Role doc.
        // We handle this in the main login flow's recovery block now.
        // But if we are here via a 400 user-not-found, they shouldn't have a UID.
        
        if (oldUser.password && oldUser.password !== password) {
            console.error('[Auth] ❌ Migration failed: Password mismatch for legacy user.');
            return { success: false, error: 'Incorrect password.' };
        }

        try {
            this.isMigrating = true;
            console.log('[Auth] 🔄 Creating new Firebase Auth account...');
            const cred = await firebase.auth().createUserWithEmailAndPassword(authEmail, password);
            console.log('[Auth] ✅ Auth account created. Updating Firestore...');
            await store.migrateUserToFirebaseAuth(oldUser, cred.user.uid, (oldUser.mustChangePassword !== false) || password === 'password');
            console.log('[Auth] ✅ Migration successful.');
            this.isMigrating = false;
            // Enforce single device login
            await this.enforceSingleSession(cred.user.uid);
            return { success: true };
        } catch (e) {
            this.isMigrating = false;
            console.error('[Auth] 🔥 Migration error:', e.code, e.message);
            if (e.code === 'auth/email-already-in-use') {
                console.log('[Auth] ℹ️ Email already exists in Firebase Auth. Attempting to link...');
                try {
                    // If account exists, try to sign in with the provided password.
                    // This allows us to get the UID and link the Firestore profile.
                    const cred = await firebase.auth().signInWithEmailAndPassword(authEmail, password);
                    console.log('[Auth] ✅ Signed in to existing Auth account. Linking Firestore profile...');
                    await store.migrateUserToFirebaseAuth(oldUser, cred.user.uid, (oldUser.mustChangePassword !== false) || password === 'password');
                    return { success: true };
                } catch (signInErr) {
                    console.error('[Auth] ❌ Failed to sign in to existing account:', signInErr.code);
                    return { success: false, error: 'This account is already activated. Please use your original password to login, or contact admin to reset your account in Firebase Console.' };
                }
            }
            return { success: false, error: e.message };
        }
    },

    logout() {
        console.warn('[Auth] 🚪 logout() called.');
        this.sessionEnforced = false;
        this.sessionStamping = false;
        this.localSid = null;
        localStorage.removeItem('eh_session_id');
        store.stopSync();
        return firebase.auth().signOut().then(() => {
            const loginView = document.getElementById('view-login');
            if (loginView && loginView.classList.contains('active')) {
                console.log('[Auth] Already on login view, skipping reload.');
            } else {
                console.log('[Auth] Reloading page to clear state...');
                window.location.reload();
            }
        });
    },

    getCurrentUser() {
        const fbUser = firebase.auth().currentUser;
        if (!fbUser) return null;
        return store.getUserByFirebaseUid(fbUser.uid);
    },

    isAuthenticated() {
        const fbUser = firebase.auth().currentUser;
        if (!fbUser) return false;
        // If we have an FB user but no store user yet, it might be syncing.
        // checkAuthAndRender handles the redirect if setupAppView fails.
        return !!this.getCurrentUser() || !!fbUser;
    },

    hasRole(role) {
        const user = this.getCurrentUser();
        return user && user.role === role;
    },

    // Change password via Firebase Auth (no plaintext in Firestore)
    async changePassword(newPassword) {
        const fbUser = firebase.auth().currentUser;
        if (!fbUser) throw new Error('Not signed in.');
        try {
            await fbUser.updatePassword(newPassword);
            const user = this.getCurrentUser();
            // Awaited: if this write is lost the student is forced through the
            // change-password screen again on every subsequent login.
            if (user) await store.updateUser(user.id, { mustChangePassword: false });
        } catch (err) {
            if (err.code === 'auth/requires-recent-login') {
                throw new Error('Please log out and log back in to change your password.');
            }
            throw err;
        }
    },

    // Create a Firebase Auth account for a new user WITHOUT signing out the current admin.
    // Uses a secondary Firebase app instance (standard Firebase pattern).
    async createFirebaseAuthUser(emailOrCode, password) {
        const authEmail = this._toAuthEmail(emailOrCode);
        const tempName = 'TempApp_' + Date.now();
        const secondaryApp = firebase.initializeApp(firebase.app().options, tempName);
        try {
            const cred = await secondaryApp.auth().createUserWithEmailAndPassword(authEmail, password);
            return cred.user.uid;
        } finally {
            await secondaryApp.delete();
        }
    },

    // --- Single Session Enforcement ---
    //
    // The session id lives in localStorage, NOT sessionStorage. sessionStorage is
    // scoped to one tab, so a student who opened the dashboard in a second tab
    // minted a second id, wrote it to their own user doc, and the first tab's
    // listener then logged them out of their own account. localStorage is shared
    // by every tab in the browser, which is what "one device" actually means.
    async enforceSingleSession(uid) {
        if (!uid) return;
        if (this.sessionEnforced || this.sessionStamping) return;
        this.sessionStamping = true;

        try {
            let localSid = localStorage.getItem('eh_session_id');
            if (!localSid) {
                localSid = 'sid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                localStorage.setItem('eh_session_id', localSid);
            }
            this.localSid = localSid;

            // Note: we MUST use the internal userId (e.g. u_1), not the Firebase UID.
            let user = store.getUserByFirebaseUid(uid);
            if (!user) user = await store.fetchUserByUid(uid);

            if (!user) {
                console.warn('[Auth] ⏳ User doc not ready for session enforcement, will retry...');
                return;
            }

            // One write per page load. lastLoginAt / lastActiveAt used to be
            // stamped a second time by store.updateUserLogin() right after this;
            // every write to a user doc is pushed back to every listener on it,
            // so the duplicate was billed as real reads on every single login.
            const now = new Date().toISOString();
            await firebase.firestore().collection('users').doc(user.id).update({
                lastSessionId: localSid,
                lastLoginAt: now,
                lastActiveAt: now
            });

            // Only arm the check once the write is acknowledged. Arming earlier
            // would let a snapshot still carrying the PREVIOUS session id — one
            // emitted before this write — read as a login from another device and
            // log the user straight back out. Staying disarmed on failure (e.g.
            // offline) is the safe direction: no enforcement beats a false one.
            this.sessionEnforced = true;
            console.log('[Auth] 🔒 Session locked:', localSid);
        } catch (err) {
            console.error('[Auth] Could not stamp session:', err);
        } finally {
            this.sessionStamping = false;
        }
    },

    // Called by the store's user-doc listeners whenever this user's document
    // changes. There used to be a second onSnapshot on that same document doing
    // only this check, which doubled the reads billed for every write to it.
    checkSession(userData) {
        if (!this.sessionEnforced || !this.localSid || !userData) return;
        const serverSid = userData.lastSessionId;
        if (serverSid && serverSid !== this.localSid) {
            console.error('[Auth] 💥 Session invalid! Newer login detected elsewhere.');
            this.sessionEnforced = false; // stop re-firing while we tear down
            alert('Your account has been logged in on another device. You will be logged out.');
            this.logout();
        }
    }
};
