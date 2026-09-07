// Main Application Logic
const App = {
    // Guards against the two render entry points (the auth-state listener and the
    // login form) racing each other into a double render.
    _rendering: false,
    _renderPending: false,
    _renderedUserId: null,
    _activityTracker: null,
    _loaderHideTimer: null,

    async init() {
        console.log('[App] 🚀 Initializing...');

        // Don't block the UI on the network — render with whatever settings we have
        // after 3s. If the real settings land later, re-apply the branding then
        // instead of leaving the page on the defaults.
        const settingsReady = store.init();
        settingsReady
            .then(() => this.applySystemSettings())
            .catch(err => console.error('[App] Store init failed:', err));

        await Promise.race([
            settingsReady.catch(() => {}),
            new Promise(resolve => setTimeout(resolve, 3000)) // Max 3s for critical branding
        ]);

        this.applySystemSettings();
        this.bindEvents();

        // Auth state listener — the single source of truth for "who is logged in".
        firebase.auth().onAuthStateChanged(async (fbUser) => {
            if (auth.isMigrating) return;

            if (fbUser) {
                console.log('[App] 👤 Auth State: Logged in as', fbUser.email);
                auth.enforceSingleSession(fbUser.uid);

                if (!store.getUserByFirebaseUid(fbUser.uid)) {
                    await store.fetchUserByUid(fbUser.uid);
                }

                // NOTE: nothing role- or profile-dependent belongs in this
                // handler. It returns early for the whole of auth.login(), which
                // holds auth.isMigrating, so on a fresh form login none of it
                // runs. lastLoginAt / lastActiveAt are stamped by
                // enforceSingleSession(), and activity tracking is started from
                // _renderAuthState(), which runs on every path.
            } else {
                this._renderedUserId = null; // signed out — next login must render fresh
            }
            this.checkAuthAndRender();
        });

        // Fail-safe: hide the overlay if we somehow never finish a render.
        // Never yank it away while a render is still in flight.
        setTimeout(() => {
            if (!this._rendering) this.hideGlobalLoader();
        }, 15000);
    },

    applySystemSettings() {
        const settings = store.getSettings();
        const logoUrl = settings.logoUrl;
        const systemName = settings.systemName || 'EduHero';

        const loginSystemName = document.getElementById('login-system-name');
        if (loginSystemName) {
            loginSystemName.textContent = systemName === 'EduHero' ? 'EduHero学习重播系统' : (systemName + ' LMS');
        }
        const sidebarSystemName = document.getElementById('sidebar-system-name');
        if (sidebarSystemName) sidebarSystemName.textContent = systemName;
        const mobileSystemName = document.getElementById('mobile-system-name');
        if (mobileSystemName) mobileSystemName.textContent = systemName;
        const loaderSystemName = document.getElementById('loader-system-name');
        if (loaderSystemName) loaderSystemName.textContent = systemName + ' LMS';
        document.title = systemName + ' LMS';

        // Update Logos
        const setLogo = (wrapperId, iconId, textId) => {
            const wrapper = document.getElementById(wrapperId);
            const icon = document.getElementById(iconId);
            const textElem = textId ? document.getElementById(textId) : null;
            if (!wrapper) return;
            
            // Remove existing image if any
            const existingImg = wrapper.querySelector('img');
            if (existingImg) existingImg.remove();

            if (logoUrl) {
                if (icon) icon.style.display = 'none';
                if (textElem) textElem.style.display = 'none';
                const img = document.createElement('img');
                img.src = logoUrl;
                img.className = wrapperId === 'sidebar-logo-wrapper' || wrapperId === 'mobile-logo-wrapper' ? 'h-8 max-w-[150px] object-contain' : 'w-full h-full object-contain';
                wrapper.appendChild(img);
            } else {
                if (icon) icon.style.display = '';
                if (textElem) textElem.style.display = '';
            }
        };

        setLogo('login-logo-container', 'login-logo-icon');
        setLogo('sidebar-logo-wrapper', 'sidebar-logo-icon', 'sidebar-system-name');
        setLogo('mobile-logo-wrapper', 'mobile-logo-icon', 'mobile-system-name');
        setLogo('loader-logo-container', 'loader-logo-icon', 'loader-system-name');

        // Apply System Theme Color
        const systemColor = settings.systemColor || '#4F46E5';
        const systemColor2 = settings.systemColor2 || '#7C3AED';
        
        const hexToRgb = (h) => {
            let r = 0, g = 0, b = 0;
            if (h.length === 4) { r = parseInt(h[1] + h[1], 16); g = parseInt(h[2] + h[2], 16); b = parseInt(h[3] + h[3], 16); }
            else if (h.length === 7) { r = parseInt(h[1] + h[2], 16); g = parseInt(h[3] + h[4], 16); b = parseInt(h[5] + h[6], 16); }
            return `${r}, ${g}, ${b}`;
        };
        const rgb = hexToRgb(systemColor);
        
        let styleEl = document.getElementById('dynamic-theme-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'dynamic-theme-style';
            document.head.appendChild(styleEl);
        }
        
        styleEl.textContent = `
            .text-indigo-600 { color: ${systemColor} !important; }
            .bg-indigo-600 { background-color: ${systemColor} !important; }
            .border-indigo-600 { border-color: ${systemColor} !important; }
            .hover\\:bg-indigo-700:hover { background-color: rgba(${rgb}, 0.8) !important; }
            .hover\\:text-indigo-700:hover { color: rgba(${rgb}, 0.9) !important; }
            .hover\\:text-indigo-600:hover { color: ${systemColor} !important; }
            .focus\\:ring-indigo-500:focus { --tw-ring-color: rgba(${rgb}, 0.5) !important; }
            .focus\\:border-indigo-500:focus { border-color: ${systemColor} !important; }
            .bg-indigo-50 { background-color: rgba(${rgb}, 0.1) !important; }
            .bg-indigo-50\\/50 { background-color: rgba(${rgb}, 0.05) !important; }
            .text-indigo-700 { color: rgba(${rgb}, 0.9) !important; }
            .text-indigo-500 { color: rgba(${rgb}, 0.8) !important; }
            .bg-gradient-to-br.from-indigo-600 { --tw-gradient-from: ${systemColor} !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(${rgb}, 0)); }
            .bg-gradient-to-r.from-indigo-600 { --tw-gradient-from: ${systemColor} !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(${rgb}, 0)); }
            .bg-indigo-100 { background-color: rgba(${rgb}, 0.2) !important; }
            .border-indigo-500 { border-color: rgba(${rgb}, 0.8) !important; }
            .border-indigo-200 { border-color: rgba(${rgb}, 0.3) !important; }
            .text-indigo-800 { color: rgba(${rgb}, 0.95) !important; }
            .to-purple-700 { --tw-gradient-to: ${systemColor2} !important; }
            .to-purple-600 { --tw-gradient-to: ${systemColor2} !important; }
            .to-purple-500 { --tw-gradient-to: ${systemColor2} !important; }
            .from-indigo-400 { --tw-gradient-from: ${systemColor} !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(${rgb}, 0)); }
        `;
    },

    bindEvents() {
        const loginForm = document.getElementById('login-form');
        console.log('[App] 🖇️ bindEvents: Login form found:', !!loginForm);
        
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('[App] 🚀 SUBMIT EVENT TRIGGERED!');
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;

            App.showGlobalLoader('Authenticating...');

            const res = await auth.login(email, password);
            if (res.success) {
                ui.showToast('Login successful!');
                
                // CRITICAL FIX: Ensure user data is fetched BEFORE attempting to render
                const fbUser = firebase.auth().currentUser;
                if (fbUser && !store.getUserByFirebaseUid(fbUser.uid)) {
                    App.showGlobalLoader('Fetching your profile...');
                    await store.fetchUserByUid(fbUser.uid);
                }
                
                App.showGlobalLoader('Preparing workspace...');
                this.checkAuthAndRender();
            } else {
                App.hideGlobalLoader();
                ui.showToast(res.error || 'Invalid email or password', 'error');
            }
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        });

        // Password visibility toggle
        const toggleBtn = document.getElementById('toggle-password');
        const passwordInput = document.getElementById('login-password');
        const eyeIcon = document.getElementById('password-eye-icon');
        
        if (toggleBtn && passwordInput && eyeIcon) {
            toggleBtn.addEventListener('click', () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                eyeIcon.classList.toggle('fa-eye');
                eyeIcon.classList.toggle('fa-eye-slash');
            });
        }

        document.getElementById('logout-btn').addEventListener('click', () => {
            store.stopSync(); // detach all Firestore listeners before logout
            auth.logout();
        });

        // Mobile menu toggle
        const mobileBtn = document.getElementById('mobile-menu-btn');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        const toggleMenu = () => {
            const isClosed = sidebar.classList.contains('-translate-x-full');
            if (isClosed) {
                sidebar.classList.remove('-translate-x-full');
                overlay.classList.remove('hidden');
            } else {
                sidebar.classList.add('-translate-x-full');
                overlay.classList.add('hidden');
            }
        };

        mobileBtn.addEventListener('click', toggleMenu);
        overlay.addEventListener('click', toggleMenu);

        // Make sidebar absolute on mobile
        const adjustSidebar = () => {
            if (window.innerWidth < 768) {
                sidebar.classList.add('absolute', '-translate-x-full', 'z-40');
            } else {
                sidebar.classList.remove('absolute', '-translate-x-full', 'z-40');
                overlay.classList.add('hidden');
            }
        };
        window.addEventListener('resize', adjustSidebar);
        adjustSidebar(); // initial call
    },

    setupActivityTracking(userId) {
        // onAuthStateChanged fires again on every token refresh, so this used to
        // stack a fresh pair of document listeners each time, each with its own
        // throttle clock. Combined with a once-per-minute write to the user doc
        // — which Firestore pushes back to every listener on that doc — this was
        // the largest source of read volume in the app.
        if (this._activityTracker) {
            this._activityTracker.userId = userId;
            return;
        }
        // Seeded to now: enforceSingleSession() has just stamped lastActiveAt.
        const tracker = { userId, lastUpdate: Date.now() };
        this._activityTracker = tracker;

        const update = () => {
            const now = Date.now();
            if (now - tracker.lastUpdate > 900000) { // at most once every 15 minutes
                tracker.lastUpdate = now;
                store.updateUserActivity(tracker.userId);
            }
        };
        document.addEventListener('click', update, { passive: true });
        document.addEventListener('keydown', update, { passive: true });
    },


    showGlobalLoader(message = 'Syncing your workspace...') {
        const loader = document.getElementById('global-loader');
        if (loader) {
            // Cancel a pending hide: without this, a hide followed by a show within
            // 500ms let the old timer mark the freshly-shown loader as hidden.
            if (this._loaderHideTimer) {
                clearTimeout(this._loaderHideTimer);
                this._loaderHideTimer = null;
            }

            const textElement = loader.querySelector('p');
            if (textElement) textElement.textContent = message;

            loader.classList.remove('hidden');
            // Small delay to ensure opacity transition works if just added
            setTimeout(() => loader.classList.remove('opacity-0'), 10);
        }
    },

    hideGlobalLoader() {
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.classList.add('opacity-0');
            if (this._loaderHideTimer) clearTimeout(this._loaderHideTimer);
            this._loaderHideTimer = setTimeout(() => {
                loader.classList.add('hidden');
                this._loaderHideTimer = null;
            }, 500); // Wait for transition
        }
    },

    // Single serialized entry point for rendering the current auth state.
    // Both callers (the auth-state listener and the login form) funnel through here.
    // A request that arrives mid-render is coalesced into one follow-up pass instead
    // of interleaving a second render — which used to double-render the page and
    // tear down the Firestore listeners the first pass had just attached.
    async checkAuthAndRender() {
        this._renderPending = true;
        if (this._rendering) {
            console.log('[App] ⏳ Render already in flight — coalescing.');
            return;
        }

        this._rendering = true;
        try {
            while (this._renderPending) {
                this._renderPending = false;
                await this._renderAuthState();
            }
        } finally {
            this._rendering = false;
        }
    },

    async _renderAuthState() {
        console.log('[App] 🛡️ checkAuthAndRender started. Authenticated:', auth.isAuthenticated());
        const viewLogin = document.getElementById('view-login');
        const viewApp = document.getElementById('view-app');

        if (auth.isAuthenticated()) {
            console.log('[App] 🔓 Showing App View...');
            this.showGlobalLoader();

            const fbUser = firebase.auth().currentUser;
            if (fbUser) {
                // Make sure the profile is loaded BEFORE switching views, otherwise
                // the app view flashes up and is immediately replaced by the
                // "Account Setup Incomplete" screen.
                if (!store.getUserByFirebaseUid(fbUser.uid)) {
                    await store.fetchUserByUid(fbUser.uid);
                }
                await auth.enforceSingleSession(fbUser.uid);

                // Started here rather than in onAuthStateChanged: that handler
                // returns early while auth.isMigrating is set, and login() holds
                // that flag for its whole duration, so a fresh form login never
                // started tracking at all. lastActiveAt then stayed frozen at the
                // login time for that entire session, which made "Last Active" in
                // the admin console a duplicate of "Last Login". This runs on
                // every path, and setupActivityTracking() is idempotent.
                const profile = auth.getCurrentUser();
                if (profile) this.setupActivityTracking(profile.id);
            }

            viewLogin.classList.remove('active');
            viewApp.classList.add('active');

            // Explicitly hide sidebar on mobile during initial render
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (window.innerWidth < 768) {
                sidebar.classList.add('-translate-x-full');
                overlay.classList.add('hidden');
            }

            await this.setupAppView();
        } else {
            console.log('[App] 🔒 Showing Login View...');
            this._renderedUserId = null;
            this.hideGlobalLoader();
            viewApp.classList.remove('active');
            viewLogin.classList.add('active');
        }
    },

    async setupAppView() {
        if (auth.isMigrating) {
            this.hideGlobalLoader();
            return;
        }
        
        const user = auth.getCurrentUser();
        
        if (!user) {
            const contentArea = document.getElementById('page-content');
            contentArea.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-center p-8">
                    <div class="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                        <i class="fas fa-user-slash text-2xl"></i>
                    </div>
                    <h2 class="text-xl font-bold text-gray-800 mb-2">Account Setup Incomplete</h2>
                    <p class="text-gray-600 max-w-md mb-6">We found your login credentials, but your profile data is missing. This can happen if a migration was interrupted.</p>
                    <button onclick="auth.logout()" class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md">
                        Return to Login
                    </button>
                </div>
            `;
            this.hideGlobalLoader();
            return;
        }

        // Set user info IMMEDIATELY so sidebar is correct
        document.getElementById('user-name').textContent = user.name;
        document.getElementById('user-role').textContent = user.role;
        
        const phoneEl = document.getElementById('user-phone');
        if (phoneEl) {
            if (user.phone) {
                phoneEl.textContent = user.phone;
                phoneEl.classList.remove('hidden');
            } else {
                phoneEl.classList.add('hidden');
            }
        }

        const initialContainer = document.getElementById('user-initial');
        const settings = store.getSettings();
        if (user.role === 'student' && settings.studentAvatarUrl) {
            initialContainer.innerHTML = `<img src="${settings.studentAvatarUrl}" class="w-full h-full object-cover rounded-full" alt="Student Avatar">`;
        } else {
            const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';
            initialContainer.textContent = initial;
        }

        // Ensure we check the most up-to-date user record for the password reset flag
        const fullUser = store.getUsers().find(u => u.id === user.id) || user;

        if ((fullUser.role === 'student' || fullUser.role === 'teacher') && fullUser.mustChangePassword) {
            ui.showForceChangePasswordModal();
            this.hideGlobalLoader();
            return;
        }

        // Already rendered for this exact user — don't rebuild the page underneath
        // them (it would wipe open tabs, pagination and scroll position, and
        // re-attach the Firestore listeners for no reason).
        if (this._renderedUserId === user.id && document.getElementById('page-content').childElementCount > 0) {
            console.log('[App] ✅ View already rendered for this user — skipping rebuild.');
            this.hideGlobalLoader();
            return;
        }

        const contentArea = document.getElementById('page-content');
        
        // Set nav menu
        const navMenu = document.getElementById('nav-menu');
        
        let navItems = [];
        if (user.role === 'admin') {
            navItems = [
                { id: 'reports', icon: 'fa-chart-pie', label: 'Learning Reports' },
                { id: 'users', icon: 'fa-users', label: 'User Management' },
                { id: 'videos', icon: 'fa-play-circle', label: 'Videos Monitored' },
                { id: 'log', icon: 'fa-history', label: 'Activity Log' },
                { id: 'subjects', icon: 'fa-book', label: 'Subject Management' },
                { id: 'settings', icon: 'fa-sliders-h', label: 'System Settings' }
            ];
            contentArea.innerHTML = AdminPage.render();
            AdminPage.init();
            
            // Default view for admin should be reports
            this.switchView('reports');
        } else if (user.role === 'teacher') {
            navItems = [
                { id: 'dashboard', icon: 'fa-chalkboard-teacher', label: 'My Subjects' }
            ];
            contentArea.innerHTML = TeacherPage.render();
            TeacherPage.init();
        } else if (user.role === 'student') {
            navItems = [
                { id: 'dashboard', icon: 'fa-book-reader', label: 'My Learning' }
            ];
            contentArea.innerHTML = StudentPage.render();
            StudentPage.init();
        }

        this.renderNavMenu(navItems, user.role === 'admin' ? 'reports' : 'dashboard');
        this._renderedUserId = user.id;

        // Start role-based Firestore listeners for this user AFTER initial render
        // so that the reactive UI updates can find the newly-rendered DOM containers.
        try {
            await store.startSync(user);
        } catch (err) {
            console.error('[App] Initial sync failed:', err);
            ui.showToast('Some data could not be loaded. Please refresh.', 'error');
        }

        // Hide global loader once sync is complete
        this.hideGlobalLoader();
    },

    renderNavMenu(navItems, activeId) {
        const navMenu = document.getElementById('nav-menu');
        navMenu.innerHTML = navItems.map(item => `
            <a href="#" onclick="App.switchView('${item.id}'); return false;" class="flex items-center px-3 py-2.5 rounded-lg ${item.id === activeId ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'} transition-colors" id="nav-item-${item.id}">
                <i class="fas ${item.icon} w-5 h-5 mr-3 text-center"></i>
                ${item.label}
            </a>
        `).join('');
    },

    switchView(viewId) {
        // Update active nav style
        document.querySelectorAll('#nav-menu a').forEach(a => {
            a.classList.remove('bg-indigo-50', 'text-indigo-700', 'font-bold');
            a.classList.add('text-gray-600', 'hover:bg-gray-50', 'font-medium');
        });
        const activeItem = document.getElementById(`nav-item-${viewId}`);
        if (activeItem) {
            activeItem.classList.remove('text-gray-600', 'hover:bg-gray-50', 'font-medium');
            activeItem.classList.add('bg-indigo-50', 'text-indigo-700', 'font-bold');
        }

        // Specific view logic
        const user = auth.getCurrentUser();
        if (user && user.role === 'admin') {
            const dashboardTabs = {
                'reports': { title: 'Learning Analytics', subtitle: 'Comprehensive study behavior and video engagement tracking.' },
                'users': { title: 'User Management', subtitle: 'Manage platform access and user profiles.' },
                'videos': { title: 'Videos Monitored', subtitle: 'Track and manage uploaded video content.' },
                'log': { title: 'Activity Log', subtitle: 'Audit trail of all administrative actions.' },
                'settings': { title: 'System Settings', subtitle: 'Configure platform branding and global options.' }
            };
            
            if (dashboardTabs[viewId]) {
                document.getElementById('admin-dashboard-wrapper').classList.remove('hidden');
                document.getElementById('admin-subjects-wrapper').classList.add('hidden');
                
                // Update titles
                const titleEl = document.getElementById('admin-page-title');
                const subtitleEl = document.getElementById('admin-page-subtitle');
                if (titleEl) titleEl.textContent = dashboardTabs[viewId].title;
                if (subtitleEl) subtitleEl.textContent = dashboardTabs[viewId].subtitle;

                // Trigger the internal tab click
                const tabBtn = document.querySelector(`#admin-tabs button[data-tab="${viewId}"]`);
                if (tabBtn) tabBtn.click();
            } else if (viewId === 'subjects') {
                document.getElementById('admin-dashboard-wrapper').classList.add('hidden');
                document.getElementById('admin-subjects-wrapper').classList.remove('hidden');
                AdminPage.renderSubjects();
            }
        }
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
