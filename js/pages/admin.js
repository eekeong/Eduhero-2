const AdminPage = {
    render() {
        return `
            <div id="admin-dashboard-wrapper" class="space-y-6 fade-in">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-800" id="admin-page-title">Admin Dashboard</h2>
                        <p class="text-gray-500 text-sm" id="admin-page-subtitle">Manage users and monitor platform activity.</p>
                    </div>
                    <button id="admin-refresh-btn" onclick="AdminPage.reloadData()" title="Re-read users and videos from the database"
                        class="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 hover:text-indigo-600 transition disabled:opacity-50">
                        <i class="fas fa-rotate"></i><span>Refresh</span>
                    </button>
                </div>

                <!-- Stats Grid -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4" id="admin-stats"></div>

                <!-- Tabs (Hidden, managed by sidebar) -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div class="flex border-b border-gray-200 hidden" id="admin-tabs">
                        <button class="flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50" data-tab="users">Users Management</button>
                        <button class="flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50" data-tab="videos">Videos Monitored</button>
                        <button class="flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50" data-tab="log">Activity Log</button>
                        <button class="flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50" data-tab="reports">Learning Reports</button>
                        <button class="flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50" data-tab="settings">System Settings</button>
                    </div>
                    
                    <div class="p-6">
                        <!-- Users Tab -->
                        <div id="tab-users" class="tab-content hidden space-y-4">
                            <div class="flex justify-between items-center mb-4">
                                <h3 class="text-lg font-semibold text-gray-800">All Users</h3>
                                <div class="flex gap-2">
                                    <button onclick="AdminPage.showAddUserModal()" class="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition">
                                        <i class="fas fa-plus mr-1"></i> Add User
                                    </button>
                                    <label class="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition cursor-pointer">
                                        <i class="fas fa-file-import mr-1"></i> Bulk Import
                                        <input type="file" accept=".csv" class="hidden" onchange="AdminPage.handleBulkImport(event)">
                                    </label>
                                    <button onclick="AdminPage.downloadUserTemplate()" class="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-200 transition">
                                        <i class="fas fa-download mr-1"></i> Template
                                    </button>
                                </div>
                            </div>

                            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                                <div class="flex bg-gray-100 p-1 rounded-lg">
                                    <button class="px-4 py-1.5 rounded-md text-sm font-medium bg-white shadow-sm text-indigo-700 admin-user-filter" data-role="all" onclick="AdminPage.filterUsers('all', this)">All</button>
                                    <button class="px-4 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 admin-user-filter" data-role="admin" onclick="AdminPage.filterUsers('admin', this)">Admin</button>
                                    <button class="px-4 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 admin-user-filter" data-role="teacher" onclick="AdminPage.filterUsers('teacher', this)">Teacher</button>
                                    <button class="px-4 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 admin-user-filter" data-role="student" onclick="AdminPage.filterUsers('student', this)">Student</button>
                                </div>
                                <div class="relative w-full md:w-64">
                                    <i class="fas fa-search absolute left-3 top-2.5 text-gray-400"></i>
                                    <input type="text" id="admin-user-search" placeholder="Search by name or email..." class="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500" onkeyup="clearTimeout(AdminPage.userSearchTimeout); AdminPage.userSearchTimeout = setTimeout(() => AdminPage.renderUsers(), 1000)">
                                </div>
                            </div>

                             <div class="overflow-x-auto rounded-lg border border-gray-200">
                                <table class="w-full text-sm text-left text-gray-500">
                                    <thead class="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th class="px-4 py-3">Name</th>
                                            <th class="px-4 py-3">Email</th>
                                            <th class="px-4 py-3">Role</th>
                                            <th class="px-4 py-3">Status</th>
                                            <th class="px-4 py-3">Subjects</th>
                                            <th class="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="admin-users-list" class="divide-y divide-gray-100"></tbody>
                                </table>
                            </div>
                            <div id="admin-users-pagination" class="mt-4 flex flex-col md:flex-row items-center justify-between gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200"></div>
                            <p class="text-xs text-gray-500 mt-2"><i class="fas fa-info-circle mr-1"></i>CSV Format: Name, Email, Password, Role (student/teacher), Level, Subject</p>
                        </div>
                        <!-- Videos Tab -->
                        <div id="tab-videos" class="tab-content hidden space-y-4">
                            <div class="flex justify-between items-center mb-4">
                                <h3 class="text-lg font-semibold text-gray-800">Monitored Videos</h3>
                                <div class="relative w-full md:w-64">
                                    <i class="fas fa-search absolute left-3 top-2.5 text-gray-400 text-xs"></i>
                                    <input type="text" id="admin-video-search" placeholder="Search videos..." class="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500" oninput="AdminPage.onVideoSearch()">
                                </div>
                            </div>
                            <div class="overflow-x-auto rounded-lg border border-gray-200">
                                <table class="w-full text-sm text-left text-gray-500">
                                    <thead class="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th class="px-4 py-3">Title</th>
                                            <th class="px-4 py-3">Subject</th>
                                            <th class="px-4 py-3">Uploaded By</th>
                                            <th class="px-4 py-3">Date</th>
                                            <th class="px-4 py-3">Views</th>
                                            <th class="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="admin-videos-list" class="divide-y divide-gray-100"></tbody>
                                </table>
                            </div>
                            <div class="flex flex-col md:flex-row justify-between items-center gap-4 mt-4 mb-2">
                                <p class="text-xs text-gray-500"><i class="fas fa-info-circle mr-1"></i>CSV Format: Title, Description, Year, Month, LibraryID, VideoID, Subject, Level, Teacher</p>
                                <div id="admin-videos-pagination" class="flex items-center gap-2"></div>
                            </div>
                        </div>

                        <!-- Activity Log Tab -->
                        <div id="tab-log" class="tab-content hidden space-y-4">
                            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
                                <h3 class="text-lg font-semibold text-gray-800">Activity Log</h3>
                                <div class="flex items-center gap-2">
                                    <div class="relative">
                                        <i class="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                                        <input type="text" id="log-search" placeholder="Search logs..." class="pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-48 md:w-64" onkeyup="AdminPage.logPage=1; AdminPage.renderActivityLog()">
                                    </div>
                                </div>
                            </div>
                            <div id="admin-activity-log" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>
                            <div id="admin-log-pagination" class="mt-6 flex justify-center pb-4"></div>
                        </div>

                        <!-- Settings Tab -->
                        <div id="tab-settings" class="tab-content hidden space-y-4">
                            <h3 class="text-lg font-semibold text-gray-800 mb-4">Platform Settings</h3>
                            <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm max-w-2xl">
                                <form id="admin-settings-form" class="space-y-4">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">System Name</label>
                                        <input type="text" id="setting-system-name" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">System Color (Gradient Start) - Hex Code</label>
                                        <div class="flex items-center gap-3">
                                            <input type="color" id="setting-system-color-picker" class="h-10 w-10 cursor-pointer rounded border border-gray-300 flex-shrink-0">
                                            <input type="text" id="setting-system-color" placeholder="#4F46E5" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase" pattern="^#[0-9A-Fa-f]{6}$" maxlength="7">
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">System Color (Gradient End) - Hex Code</label>
                                        <div class="flex items-center gap-3">
                                            <input type="color" id="setting-system-color2-picker" class="h-10 w-10 cursor-pointer rounded border border-gray-300 flex-shrink-0">
                                            <input type="text" id="setting-system-color2" placeholder="#7C3AED" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase" pattern="^#[0-9A-Fa-f]{6}$" maxlength="7">
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Logo</label>
                                        <div class="flex items-center gap-4">
                                            <div id="settings-logo-preview" class="w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                                                <i class="fas fa-image text-gray-400" id="settings-logo-icon"></i>
                                                <img id="settings-logo-img" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" class="w-full h-full object-contain hidden" alt="">
                                            </div>
                                            <div>
                                                <input type="file" id="setting-logo-file" accept="image/*" class="hidden">
                                                <label for="setting-logo-file" class="cursor-pointer px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Upload File</label>
                                                <button type="button" id="setting-logo-remove" class="ml-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-red-600 hover:bg-gray-50 hidden">Remove</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Default Student Avatar</label>
                                        <div class="flex items-center gap-4">
                                            <div id="settings-student-avatar-preview" class="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                                                <i class="fas fa-user-graduate text-gray-400" id="settings-student-avatar-icon"></i>
                                                <img id="settings-student-avatar-img" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" class="w-full h-full object-contain hidden" alt="">
                                            </div>
                                            <div>
                                                <input type="file" id="setting-student-avatar-file" accept="image/*" class="hidden">
                                                <label for="setting-student-avatar-file" class="cursor-pointer px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Upload File</label>
                                                <button type="button" id="setting-student-avatar-remove" class="ml-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-red-600 hover:bg-gray-50 hidden">Remove</button>
                                            </div>
                                        </div>
                                    </div>
                                    <button type="submit" class="bg-indigo-600 text-white font-medium py-2.5 px-6 rounded-lg hover:bg-indigo-700 transition shadow-sm mt-4">Save Settings</button>
                                </form>

                                <!-- Bunny Stream Sync Tool -->
                                <div class="mt-12 pt-8 border-t border-gray-100">
                                    <h4 class="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                                        <i class="fas fa-cloud-upload-alt mr-2 text-indigo-500"></i>Bunny Stream Sync
                                    </h4>
                                    <div class="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
                                        <p class="text-xs text-indigo-700 mb-4">Sync and map Bunny Stream Libraries to EduHero Subjects to enable one-click teacher uploads. The Account Key is not saved.</p>
                                        <div class="flex gap-2 mb-4">
                                            <input type="password" id="bunny-account-key" placeholder="Enter Bunny Account API Key" class="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                                            <button onclick="AdminPage.fetchBunnyLibraries()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition" id="btn-fetch-bunny">Fetch Libraries</button>
                                        </div>
                                        <div id="bunny-sync-container" class="hidden space-y-4">
                                            <div class="max-h-96 overflow-y-auto space-y-2 pr-2" id="bunny-mapping-list"></div>
                                            <button onclick="AdminPage.saveBunnyMappings()" class="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition shadow-sm">Save Mappings</button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Monthly Access Management -->
                                <div class="mt-12 pt-8 border-t border-gray-100">
                                    <h4 class="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                                        <i class="fas fa-calendar-check mr-2 text-emerald-500"></i>Monthly Access Management
                                    </h4>
                                    <div class="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
                                        <p class="text-xs text-emerald-700 mb-4">Grant access to currently assigned subjects for all students for a specific month.</p>
                                        <div class="flex flex-col md:flex-row items-end gap-4">
                                            <div class="flex-1 w-full">
                                                <label class="block text-sm font-medium text-emerald-900 mb-1">Select Month</label>
                                                <select id="access-month" class="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white">
                                                    ${['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => `<option value="${m}" ${new Date().toLocaleString('default', { month: 'long' }) === m ? 'selected' : ''}>${m}</option>`).join('')}
                                                </select>
                                            </div>
                                            <div class="flex-1 w-full">
                                                <label class="block text-sm font-medium text-emerald-900 mb-1">Start Date</label>
                                                <input type="date" id="access-start-date" class="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white text-gray-700">
                                            </div>
                                            <div class="flex-1 w-full">
                                                <label class="block text-sm font-medium text-emerald-900 mb-1">Days to Activate</label>
                                                <input type="number" id="access-days" value="45" min="1" class="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm">
                                            </div>
                                            <button onclick="AdminPage.grantMonthlyAccess(event)" class="w-full md:w-auto px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition shadow-sm whitespace-nowrap h-10">
                                                <i class="fas fa-unlock-alt mr-2"></i> Grant Access
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Maintenance Tools -->
                                <div class="mt-12 pt-8 border-t border-gray-100">
                                    <h4 class="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                                        <i class="fas fa-tools mr-2 text-rose-500"></i>Maintenance Tools
                                    </h4>
                                    <div class="bg-rose-50 border border-rose-100 rounded-2xl p-6">
                                        <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                                            <div>
                                                <h5 class="text-rose-800 font-bold">Bulk Password Reset</h5>
                                                <p class="text-rose-600/70 text-xs mt-1">Set all user passwords in database to <span class="font-bold underline">"eduhero"</span>. This affects migration for non-activated users.</p>
                                            </div>
                                            <button onclick="AdminPage.resetAllPasswords()" class="px-6 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition shadow-md whitespace-nowrap">
                                                <i class="fas fa-key mr-2"></i> Reset All to "eduhero"
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Reports Tab -->
                        <div id="tab-reports" class="tab-content active space-y-6">
                            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h3 class="text-lg font-semibold text-gray-800">Learning Analytics</h3>
                                    <p class="text-xs text-gray-500">Comprehensive study behavior and video engagement tracking.</p>
                                </div>
                                <button onclick="AdminPage.renderReports()" class="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-100 transition shadow-sm">
                                    <i class="fas fa-sync-alt mr-2"></i> Refresh Data
                                </button>
                            </div>

                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <!-- Unwatched Students -->
                                <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                    <div class="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                        <h4 class="text-sm font-bold text-gray-700"><i class="fas fa-user-clock mr-2 text-amber-500"></i>Unwatched This Week</h4>
                                        <span class="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase">Critical Follow-up</span>
                                    </div>
                                    <div id="report-unwatched-list" class="divide-y divide-gray-50 max-h-[350px] overflow-y-auto"></div>
                                </div>

                                <!-- Low Progress Students -->
                                <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                    <div class="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                        <h4 class="text-sm font-bold text-gray-700"><i class="fas fa-chart-line mr-2 text-red-500"></i>Low Completion (<50%)</h4>
                                        <span class="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase">Needs Attention</span>
                                    </div>
                                    <div id="report-low-progress-list" class="divide-y divide-gray-50 max-h-[350px] overflow-y-auto"></div>
                                </div>
                            </div>

                            <!-- Video Performance Table -->
                            <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                <div class="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                    <h4 class="text-sm font-bold text-gray-700"><i class="fas fa-video mr-2 text-indigo-500"></i>Video Performance & Average Watch Time</h4>
                                    <span class="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-tight">Grouped by Level</span>
                                </div>
                                <div id="report-video-stats-container" class="divide-y divide-gray-50">
                                    <!-- Accordions injected here -->
                                    <div class="p-12 text-center text-gray-400">
                                        <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                        <p class="text-xs">Loading analytics...</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="admin-subjects-wrapper" class="space-y-6 fade-in hidden">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-800">Subject Management</h2>
                        <p class="text-gray-500 text-sm">Manage subjects and monitor content by level and category.</p>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-6">
                    <div id="admin-subjects-main">
                        <div class="flex flex-col md:flex-row justify-between items-center gap-3 mb-6">
                            <h3 class="text-lg font-semibold text-gray-800">Subjects by Level</h3>
                            <div class="flex gap-2 w-full md:w-auto">
                                <div class="relative flex-grow md:w-64">
                                    <i class="fas fa-search absolute left-3 top-2.5 text-gray-400 text-sm"></i>
                                    <input type="text" id="admin-subject-search" placeholder="Search subjects..." class="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500" oninput="AdminPage.renderSubjects()">
                                </div>
                                <button onclick="AdminPage.showAddSubjectModal()" class="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition whitespace-nowrap">
                                    <i class="fas fa-plus mr-1"></i> Add Subject
                                </button>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4" id="admin-levels-list"></div>
                        <div id="admin-level-subjects" class="mt-8 hidden fade-in">
                            <div class="flex items-center mb-6 border-b pb-4">
                                <button onclick="AdminPage.backToLevels()" class="text-indigo-600 mr-3 hover:text-indigo-800"><i class="fas fa-arrow-left"></i></button>
                                <h4 class="text-xl font-bold text-gray-800" id="admin-level-title">Level Subjects</h4>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6" id="admin-subjects-list"></div>
                        </div>
                    </div>
                    <div id="admin-subject-detail" class="hidden fade-in">
                        <!-- Student-like view injected here -->
                    </div>
                </div>
            </div>
        `;
    },

    async cleanSystemAdmins() {
        if (!confirm('Are you sure you want to delete all "System Admin" accounts?')) return;
        try {
            const submitBtn = document.querySelector('button[onclick="AdminPage.cleanSystemAdmins()"]');
            const originalText = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Cleaning...';
                submitBtn.disabled = true;
            }

            const usersSnap = await db.collection('users').get();
            let count = 0;
            const batch = db.batch();
            
            usersSnap.forEach(doc => {
                const data = doc.data();
                if (data.name && data.name.toLowerCase().trim() === 'system admin') {
                    batch.delete(doc.ref);
                    count++;
                }
            });
            
            if (count > 0) {
                await batch.commit(); // Ensure it actually deletes from the server!
                ui.showToast(`Successfully deleted ${count} "System Admin" accounts.`);
                setTimeout(() => location.reload(), 1500);
            } else {
                if (submitBtn) {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
                ui.showToast(`No "System Admin" accounts found.`, 'warning');
            }
        } catch (e) {
            console.error(e);
            ui.showToast(`Failed to clean System Admins: ${e.message}`, 'error');
        }
    },

    // init() — call ONCE, right after AdminPage.render() has replaced the DOM.
    // It resets view state and binds every persistent listener.
    // To redraw after a data change, call refresh() — NOT init(). Re-running init()
    // on an already-rendered page used to stack a duplicate handler on every tab
    // button and on the settings form, so one click fired the handler N times.
    init() {
        this.currentRoleFilter = 'all';
        this.userPage = 1;
        this.usersPerPage = 50;

        this.videoPage = 1;
        this.videosPerPage = 50;

        this.logPage = 1;
        this.logsPerPage = 30;

        this.refresh();
        this.syncSettingsForm();
        this.setupTabs();
        this.bindSettingsForm();
    },

    // refresh() — redraw the lists from the current store cache.
    // Binds nothing and resets no pagination/filter state, so it is safe to call
    // from anywhere (mutations, snapshot listeners) as often as needed.
    refresh() {
        this.renderStats();
        this.renderUsers();
        this.renderSubjects();
        this.renderVideos();
        // NOTE: renderActivityLog() is NOT called here.
        // Activity log is fetched from Firestore on-demand
        // when the admin clicks the Activity Log tab.
    },

    // Load the settings tab's inputs from the store. Deliberately NOT part of
    // refresh(): a background snapshot must never overwrite what the admin is typing.
    syncSettingsForm() {
        const settings = store.getSettings();
        const nameEl = document.getElementById('setting-system-name');
        if (!nameEl) return;

        nameEl.value = settings.systemName || 'EduHero';
        document.getElementById('setting-system-color').value = settings.systemColor || '#4F46E5';
        document.getElementById('setting-system-color-picker').value = settings.systemColor || '#4F46E5';
        document.getElementById('setting-system-color2').value = settings.systemColor2 || '#7C3AED';
        document.getElementById('setting-system-color2-picker').value = settings.systemColor2 || '#7C3AED';

        this._pendingLogoUrl = settings.logoUrl || '';
        this._pendingStudentAvatar = settings.studentAvatarUrl || '';
        this.updateLogoPreview(this._pendingLogoUrl);
        this.updateStudentAvatarPreview(this._pendingStudentAvatar);
    },

    updateLogoPreview(url) {
        const logoImg = document.getElementById('settings-logo-img');
        const logoIcon = document.getElementById('settings-logo-icon');
        const removeBtn = document.getElementById('setting-logo-remove');
        if (!logoImg) return;

        if (url) {
            logoImg.src = url;
            logoImg.classList.remove('hidden');
            logoIcon.style.display = 'none';
            removeBtn.classList.remove('hidden');
        } else {
            logoImg.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
            logoImg.classList.add('hidden');
            logoIcon.style.display = '';
            removeBtn.classList.add('hidden');
        }
    },

    updateStudentAvatarPreview(url) {
        const stuAvatarImg = document.getElementById('settings-student-avatar-img');
        const stuAvatarIcon = document.getElementById('settings-student-avatar-icon');
        const stuRemoveBtn = document.getElementById('setting-student-avatar-remove');
        if (!stuAvatarImg) return;

        if (url) {
            stuAvatarImg.src = url;
            stuAvatarImg.classList.remove('hidden');
            stuAvatarIcon.style.display = 'none';
            stuRemoveBtn.classList.remove('hidden');
        } else {
            stuAvatarImg.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
            stuAvatarImg.classList.add('hidden');
            stuAvatarIcon.style.display = '';
            stuRemoveBtn.classList.add('hidden');
        }
    },

    // Read an image file into a base64 data URL for the settings doc.
    // Firestore caps a document at 1MB and base64 inflates a file by ~33%, so the
    // real ceiling is well under 1MB — a larger file used to fail the write silently.
    _readImageForSettings(input, label, onLoaded) {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 700 * 1024) {
            ui.showToast(`${label} must be less than 700KB (Firestore document limit)`, 'error');
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => onLoaded(event.target.result);
        reader.readAsDataURL(file);
    },

    // Bind the settings tab. Guarded by a data attribute on the form itself, so a
    // stray second call can never stack duplicate handlers; a fresh render() yields
    // a fresh node without the attribute and rebinds correctly.
    bindSettingsForm() {
        const form = document.getElementById('admin-settings-form');
        if (!form || form.dataset.bound) return;
        form.dataset.bound = '1';

        const syncColor = (pickerId, inputId) => {
            const picker = document.getElementById(pickerId);
            const input = document.getElementById(inputId);
            picker.addEventListener('input', (e) => input.value = e.target.value.toUpperCase());
            input.addEventListener('input', (e) => {
                if (/^#[0-9A-Fa-f]{6}$/i.test(e.target.value)) {
                    picker.value = e.target.value;
                }
            });
        };
        syncColor('setting-system-color-picker', 'setting-system-color');
        syncColor('setting-system-color2-picker', 'setting-system-color2');

        document.getElementById('setting-logo-file').addEventListener('change', (e) => {
            this._readImageForSettings(e.target, 'Logo', (dataUrl) => {
                this._pendingLogoUrl = dataUrl;
                this.updateLogoPreview(dataUrl);
            });
        });

        document.getElementById('setting-logo-remove').addEventListener('click', () => {
            this._pendingLogoUrl = '';
            document.getElementById('setting-logo-file').value = '';
            this.updateLogoPreview('');
        });

        document.getElementById('setting-student-avatar-file').addEventListener('change', (e) => {
            this._readImageForSettings(e.target, 'Avatar', (dataUrl) => {
                this._pendingStudentAvatar = dataUrl;
                this.updateStudentAvatarPreview(dataUrl);
            });
        });

        document.getElementById('setting-student-avatar-remove').addEventListener('click', () => {
            this._pendingStudentAvatar = '';
            document.getElementById('setting-student-avatar-file').value = '';
            this.updateStudentAvatarPreview('');
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';
            }

            try {
                // Await the write: a failure here (permission, oversized document)
                // used to be swallowed while the UI still claimed success.
                await store.updateSettings({
                    systemName: document.getElementById('setting-system-name').value || 'EduHero',
                    systemColor: document.getElementById('setting-system-color').value || '#4F46E5',
                    systemColor2: document.getElementById('setting-system-color2').value || '#7C3AED',
                    logoUrl: this._pendingLogoUrl || '',
                    studentAvatarUrl: this._pendingStudentAvatar || ''
                });
                ui.showToast('Settings saved successfully');
                App.applySystemSettings();
                this.refresh();
            } catch (err) {
                console.error('[Admin] Settings save failed:', err);
                ui.showToast('Failed to save settings: ' + (err.message || err), 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            }
        });
    },

    filterUsers(role, btn) {
        this.currentRoleFilter = role;
        this.userPage = 1; // Reset to page 1
        
        // Update active button styles
        document.querySelectorAll('.admin-user-filter').forEach(b => {
            b.classList.remove('bg-white', 'shadow-sm', 'text-indigo-700');
            b.classList.add('text-gray-600');
        });
        btn.classList.add('bg-white', 'shadow-sm', 'text-indigo-700');
        btn.classList.remove('text-gray-600');
        
        this.renderUsers();
    },

    setupTabs() {
        const tabBar = document.getElementById('admin-tabs');
        // Guard on the container: re-binding these would make one tab click run the
        // handler N times — including N on-demand fetches of 500 activity-log docs.
        if (!tabBar || tabBar.dataset.bound) return;
        tabBar.dataset.bound = '1';

        const tabs = document.querySelectorAll('#admin-tabs button');
        const contents = document.querySelectorAll('.tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Reset styles
                tabs.forEach(t => {
                    t.classList.remove('border-indigo-600', 'text-indigo-600', 'bg-indigo-50/50');
                    t.classList.add('border-transparent', 'text-gray-500');
                });
                contents.forEach(c => c.classList.add('hidden'));
                
                // Set active
                tab.classList.add('border-indigo-600', 'text-indigo-600', 'bg-indigo-50/50');
                tab.classList.remove('border-transparent', 'text-gray-500');
                document.getElementById(`tab-${tab.dataset.tab}`).classList.remove('hidden');
                document.getElementById(`tab-${tab.dataset.tab}`).classList.add('fade-in');

                // Activity Log: fetch fresh data from Firestore on-demand
                // (no persistent listener — saves Firebase reads)
                if (tab.dataset.tab === 'log') {
                    const logContainer = document.getElementById('admin-activity-log');
                    if (logContainer) logContainer.innerHTML = `<div class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl"></i><p class="mt-2 text-sm">Loading logs...</p></div>`;
                    store.fetchActivityLog().then(() => AdminPage.renderActivityLog());
                }
                
                if (tab.dataset.tab === 'reports') {
                    AdminPage.renderReports();
                }
            });
        });
    },    async grantMonthlyAccess(event) {
        const month = document.getElementById('access-month').value;
        const daysStr = document.getElementById('access-days').value;
        const startDateStr = document.getElementById('access-start-date').value;
        const days = parseInt(daysStr, 10);

        if (isNaN(days) || days <= 0) {
            return ui.showToast('Please enter a valid number of days', 'error');
        }
        
        let startDate = new Date();
        if (startDateStr) {
            startDate = new Date(startDateStr);
            startDate.setHours(0, 0, 0, 0);
        }

        if (!confirm(`Are you sure you want to grant ${days} days of access for the month of ${month} to ALL students for their assigned subjects starting from ${startDate.toLocaleDateString()}?`)) {
            return;
        }

        event = event || window.event;
        const btn = event ? event.target.closest('button') : null;
        let originalHtml = '';
        if (btn) {
            originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
            btn.disabled = true;
        }

        try {
            App.showGlobalLoader('Analyzing student data...');
            const users = store.getUsers().filter(u => u.role === 'student');
            
            const expiryDate = new Date(startDate.getTime() + (days * 24 * 60 * 60 * 1000));
            const fmtDate = d => { const z = n => ('0'+n).slice(-2); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; };
            const startISO = fmtDate(startDate);
            const expiryISO = fmtDate(expiryDate);

            // Prepare batches
            const batches = [];
            let currentBatch = db.batch();
            let operationsInCurrentBatch = 0;

            let updatedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;

            for (const user of users) {
                if (!user.subjects || user.subjects.length === 0) {
                    skippedCount++;
                    continue;
                }

                let updatedMonths = user.months ? { ...user.months } : {};
                let updatedMonthExpiry = user.monthExpiry ? { ...user.monthExpiry } : {};
                let modified = false;

                user.subjects.forEach(subjId => {
                    // Add month to months array if not present
                    if (!updatedMonths[subjId]) updatedMonths[subjId] = [];
                    if (!updatedMonths[subjId].includes(month)) {
                        updatedMonths[subjId].push(month);
                        modified = true;
                    }

                    // Set expiry
                    if (!updatedMonthExpiry[subjId]) updatedMonthExpiry[subjId] = {};
                    // Always overwrite/renew the expiry
                    updatedMonthExpiry[subjId][month] = {
                        start: startISO,
                        end: expiryISO
                    };
                    modified = true;
                });

                if (modified) {
                    const userRef = db.collection('users').doc(user.id);
                    currentBatch.update(userRef, {
                        months: updatedMonths,
                        monthExpiry: updatedMonthExpiry
                    });
                    updatedCount++;
                    operationsInCurrentBatch++;

                    // Firestore batch limit is 500, we use 450 for safety
                    if (operationsInCurrentBatch === 450) {
                        batches.push(currentBatch);
                        currentBatch = db.batch();
                        operationsInCurrentBatch = 0;
                    }
                } else {
                    skippedCount++;
                }
            }

            // Push the last batch if it has operations
            if (operationsInCurrentBatch > 0) {
                batches.push(currentBatch);
            }

            // Execute batches sequentially
            for (let i = 0; i < batches.length; i++) {
                App.showGlobalLoader(`Saving Data: Batch ${i + 1} of ${batches.length}...`);
                try {
                    await batches[i].commit();
                } catch (batchErr) {
                    console.error('Batch commit error:', batchErr);
                    errorCount += 450; // Approximation for the UI report if a batch fails
                }
            }

            store.addLog('Update Permissions', `Bulk granted ${days} days for ${month}.`);
            
            App.hideGlobalLoader();

            // Show a detailed report modal
            const reportHtml = `
                <div class="text-center">
                    <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-check-circle text-3xl"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">Access Granted Successfully</h3>
                    <div class="bg-gray-50 rounded-lg p-4 mb-4 text-left">
                        <div class="flex justify-between py-1 border-b border-gray-200">
                            <span class="text-gray-500 font-medium">Total Students:</span>
                            <span class="font-bold text-gray-800">${users.length}</span>
                        </div>
                        <div class="flex justify-between py-1 border-b border-gray-200">
                            <span class="text-emerald-600 font-medium">Successfully Updated:</span>
                            <span class="font-bold text-emerald-700">${updatedCount}</span>
                        </div>
                        <div class="flex justify-between py-1 border-b border-gray-200">
                            <span class="text-amber-500 font-medium">Skipped (No Subjects):</span>
                            <span class="font-bold text-amber-600">${skippedCount}</span>
                        </div>
                        <div class="flex justify-between py-1">
                            <span class="text-rose-500 font-medium">Failed/Errors:</span>
                            <span class="font-bold text-rose-600">${errorCount > 0 ? errorCount : 0}</span>
                        </div>
                    </div>
                    <p class="text-sm text-gray-500 mb-4">The students' access to their assigned subjects for <strong>${month}</strong> has been updated and will expire on <strong>${expiryDate.toLocaleDateString()}</strong>.</p>
                    <button onclick="document.getElementById('monthly-access-report-modal').remove()" class="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition shadow-sm">
                        Done
                    </button>
                </div>
            `;
            
            const modalContainer = document.createElement('div');
            modalContainer.id = 'monthly-access-report-modal';
            modalContainer.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm fade-in';
            modalContainer.innerHTML = `
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden scale-in">
                    <div class="p-6">
                        ${reportHtml}
                    </div>
                </div>
            `;
            document.getElementById('modals-container').appendChild(modalContainer);

        } catch (err) {
            console.error(err);
            App.hideGlobalLoader();
            ui.showToast('Failed to grant access: ' + err.message, 'error');
        } finally {
            if (btn) {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        }
    },

    async resetAllPasswords() {
        if (!confirm('⚠️ DANGER: Are you sure you want to change ALL user passwords to "eduhero"?\n\nThis will update all Firestore records. Non-activated users will need to use "eduhero" to login and migrate. Activated users will NOT have their Firebase Auth password changed, but their database record will be updated.')) {
            return;
        }

        const btn = event.target.closest('button');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
        btn.disabled = true;

        try {
            const users = store.getUsers();
            let count = 0;
            
            // We do this in batches of 10 to avoid hitting limits too hard if there are thousands, 
            // though store.updateUser handles individual writes.
            for (const user of users) {
                // We only change the password field. 
                // We don't change UID or Role to keep status intact.
                await store.updateUser(user.id, { 
                    password: 'eduhero'
                });
                count++;
            }

            ui.showToast(`Successfully reset ${count} passwords to "eduhero"`);
            store.addLog('Maintenance', `Bulk password reset performed for ${count} users.`);
            this.renderUsers();
        } catch (err) {
            console.error(err);
            ui.showToast('Reset failed: ' + err.message, 'error');
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    },

    async fetchBunnyLibraries() {
        const keyInput = document.getElementById('bunny-account-key');
        const btn = document.getElementById('btn-fetch-bunny');
        const accountKey = keyInput.value.trim();
        if (!accountKey) return ui.showToast('Please enter an Account API Key', 'warning');

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';
        
        try {
            const libraries = await BunnyStreamAPI.getLibraries(accountKey);
            const subjects = store.getSubjects();
            const teachers = store.getUsers().filter(u => u.role === 'teacher' || u.role === 'admin');
            const existingMappings = store.getBunnySecrets().mappings || [];
            
            const listHtml = subjects.map(subject => {
                const assignedTeachers = teachers.filter(t => (t.subjects || []).includes(subject.id));
                if (assignedTeachers.length === 0) return '';
                
                const teacherRows = assignedTeachers.map(teacher => {
                    const existing = existingMappings.find(m => m.subjectId === subject.id && m.teacherId === teacher.id) || {};
                    const options = libraries.map(lib => 
                        `<option value='${JSON.stringify({id: lib.Id, key: lib.ApiKey})}' ${existing.bunnyLibraryId == lib.Id ? 'selected' : ''}>${lib.Name}</option>`
                    ).join('');
                    
                    return `
                        <div class="flex items-center justify-between p-2 pl-6 mt-1 bg-gray-50 rounded border border-gray-100">
                            <div class="flex-1 text-xs font-medium text-gray-600">
                                <i class="fas fa-chalkboard-teacher mr-2 text-indigo-400"></i>${teacher.name}
                            </div>
                            <div class="flex-1 pl-4">
                                <select class="bunny-mapping-select w-full px-2 py-1.5 text-xs border border-gray-200 rounded outline-none focus:border-indigo-500" data-subject-id="${subject.id}" data-teacher-id="${teacher.id}">
                                    <option value="">-- Select Bunny Library --</option>
                                    ${options}
                                </select>
                            </div>
                        </div>
                    `;
                }).join('');
                
                return `
                    <div class="mb-3 p-3 bg-white rounded border border-gray-200 shadow-sm">
                        <div class="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2 mb-2">
                            ${subject.name} <span class="text-xs text-gray-400 font-normal ml-2">(${subject.level})</span>
                        </div>
                        ${teacherRows}
                    </div>
                `;
            }).filter(html => html !== '').join('');
            
            if (!listHtml) {
                document.getElementById('bunny-mapping-list').innerHTML = '<div class="p-4 text-center text-sm text-gray-500">No teachers are assigned to any subjects yet.</div>';
            } else {
                document.getElementById('bunny-mapping-list').innerHTML = listHtml;
            }
            document.getElementById('bunny-sync-container').classList.remove('hidden');
            ui.showToast('Libraries fetched successfully');
            
        } catch (e) {
            ui.showToast('Failed to fetch libraries. Check your key.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Fetch Libraries';
        }
    },

    saveBunnyMappings() {
        const selects = document.querySelectorAll('.bunny-mapping-select');
        const mappings = [];
        
        selects.forEach(select => {
            if (select.value) {
                const libData = JSON.parse(select.value);
                mappings.push({
                    subjectId: select.dataset.subjectId,
                    teacherId: select.dataset.teacherId,
                    bunnyLibraryId: String(libData.id),
                    libraryKey: libData.key
                });
            }
        });
        
        store.saveBunnySecrets(mappings).then(() => {
            ui.showToast('Mappings saved securely!');
            document.getElementById('bunny-account-key').value = '';
            document.getElementById('bunny-sync-container').classList.add('hidden');
        }).catch(err => {
            console.error(err);
            ui.showToast('Failed to save mappings', 'error');
        });
    },

    renderStats() {
        const container = document.getElementById('admin-stats');
        if (!container) return;

        const users = store.getUsers();
        const subjects = store.getSubjects();
        const videos = store.getVideos();

        // Show loading skeletons if data hasn't synced yet
        if (!store.areUsersLoaded()) {
            container.innerHTML = `
                <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between animate-pulse">
                    <div class="flex items-center">
                        <div class="w-12 h-12 rounded-lg bg-gray-200 mr-4"></div>
                        <div>
                            <div class="h-3 w-16 bg-gray-200 rounded mb-2"></div>
                            <div class="h-6 w-10 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between animate-pulse">
                    <div class="flex items-center">
                        <div class="w-12 h-12 rounded-lg bg-gray-200 mr-4"></div>
                        <div>
                            <div class="h-3 w-16 bg-gray-200 rounded mb-2"></div>
                            <div class="h-6 w-10 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between animate-pulse">
                    <div class="flex items-center">
                        <div class="w-12 h-12 rounded-lg bg-gray-200 mr-4"></div>
                        <div>
                            <div class="h-3 w-16 bg-gray-200 rounded mb-2"></div>
                            <div class="h-6 w-10 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between animate-pulse">
                    <div class="flex items-center">
                        <div class="w-12 h-12 rounded-lg bg-gray-200 mr-4"></div>
                        <div>
                            <div class="h-3 w-16 bg-gray-200 rounded mb-2"></div>
                            <div class="h-6 w-10 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        const students = users.filter(u => u.role === 'student').length;
        const teachers = users.filter(u => u.role === 'teacher').length;

        const statsHtml = `
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center">
                <div class="p-3 bg-blue-50 text-blue-600 rounded-lg"><i class="fas fa-user-graduate text-xl"></i></div>
                <div class="ml-4"><p class="text-sm text-gray-500">Students</p><p class="text-2xl font-bold text-gray-800">${students}</p></div>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center">
                <div class="p-3 bg-purple-50 text-purple-600 rounded-lg"><i class="fas fa-chalkboard-teacher text-xl"></i></div>
                <div class="ml-4"><p class="text-sm text-gray-500">Teachers</p><p class="text-2xl font-bold text-gray-800">${teachers}</p></div>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center">
                <div class="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><i class="fas fa-book text-xl"></i></div>
                <div class="ml-4"><p class="text-sm text-gray-500">Subjects</p><p class="text-2xl font-bold text-gray-800">${subjects.length}</p></div>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center">
                <div class="p-3 bg-rose-50 text-rose-600 rounded-lg"><i class="fas fa-video text-xl"></i></div>
                <div class="ml-4"><p class="text-sm text-gray-500">Videos</p><p class="text-2xl font-bold text-gray-800">${videos.length}</p></div>
            </div>
        `;
        document.getElementById('admin-stats').innerHTML = statsHtml;
    },

    // Users and videos are read once at login rather than subscribed to, so
    // this is how an admin picks up changes made by someone else.
    async reloadData() {
        const btn = document.getElementById('admin-refresh-btn');
        if (btn) {
            btn.disabled = true;
            btn.querySelector('i').classList.add('fa-spin');
        }
        try {
            const reportsWereLoaded = store.isProgressLoaded();
            await store.refreshAdminData();
            this.refresh();
            // Only re-pull the reports collection if it was already on screen —
            // otherwise Refresh would quietly cost thousands of reads.
            const reports = document.getElementById('tab-reports');
            if (reports && !reports.classList.contains('hidden')) {
                if (reportsWereLoaded) await store.fetchAllProgress();
                this.renderReports();
            }
            ui.showToast('Data refreshed');
        } catch (err) {
            ui.showToast(err.message || 'Could not refresh — please retry', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.querySelector('i').classList.remove('fa-spin');
            }
        }
    },

    // Pulls the progress collection, then re-renders the reports tab.
    async loadReportData() {
        const btn = document.getElementById('admin-load-reports');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Loading...';
        }
        try {
            await store.fetchAllProgress();
            this.renderReports();
        } catch (err) {
            ui.showToast(err.message || 'Could not load report data — please retry', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-download mr-2"></i>Load report data';
            }
        }
    },

    async resetStudentProgress(userId) {
        if (confirm('Are you sure you want to reset ALL viewing progress for this student? This action cannot be undone.')) {
            try {
                // Queried directly instead of filtering the cached collection:
                // progress is no longer loaded on every admin page load.
                const progressRecords = await store.fetchProgressForStudent(userId);
                if (progressRecords.length === 0) {
                    ui.showToast('No viewing records found for this student.', 'info');
                    return;
                }
                
                const batch = db.batch();
                progressRecords.forEach(p => {
                    batch.delete(db.collection(COLLECTIONS.PROGRESS).doc(p.id));
                });
                await batch.commit();
                ui.showToast(`Successfully reset ${progressRecords.length} viewing records.`, 'success');
                
                // Force UI update
                this.renderUsers();
            } catch (e) {
                console.error(e);
                ui.showToast('Error resetting progress', 'error');
            }
        }
    },

    renderUsers() {
        let users = store.getUsers();
        const subjectsMap = store.getSubjects().reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {});

        // 1. COMPLEX SORTING LOGIC
        // Priority: Admin (0) > Teacher (1) > Student (2)
        const rolePriority = { 'admin': 0, 'teacher': 1, 'student': 2 };
        
        users.sort((a, b) => {
            const roleA = a.role || '';
            const roleB = b.role || '';
            const priorityA = rolePriority[roleA] !== undefined ? rolePriority[roleA] : 99;
            const priorityB = rolePriority[roleB] !== undefined ? rolePriority[roleB] : 99;

            // Sort by Role Priority first
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            // Same Role - Secondary Sorting
            if (roleA === 'teacher') {
                // Teacher: A to Z by Name
                return (a.name || '').localeCompare(b.name || '', 'en', { sensitivity: 'base' });
            } else if (roleA === 'student') {
                // Student: By Student Code (extracted from email)
                const codeA = (a.email || '').split('@')[0];
                const codeB = (b.email || '').split('@')[0];
                return codeA.localeCompare(codeB, 'en', { numeric: true, sensitivity: 'base' });
            } else {
                // Admin/Others: A to Z by Name
                return (a.name || '').localeCompare(b.name || '', 'en', { sensitivity: 'base' });
            }
        });

        // 2. Filter by role
        if (this.currentRoleFilter && this.currentRoleFilter !== 'all') {
            users = users.filter(u => u.role === this.currentRoleFilter);
        }

        // 3. Filter by search
        const searchInput = document.getElementById('admin-user-search');
        if (searchInput && searchInput.value.trim() !== '') {
            const query = searchInput.value.toLowerCase().trim();
            users = users.filter(u => (u.name || '').toLowerCase().includes(query) || (u.email || '').toLowerCase().includes(query));
            // When searching, we stay on page 1
            if (this.userPage !== 1 && !this._searchTriggered) {
                this.userPage = 1;
                this._searchTriggered = true;
            }
        } else {
            this._searchTriggered = false;
        }

        const totalFiltered = users.length;
        const totalPages = Math.ceil(totalFiltered / (this.usersPerPage || 50));
        if (this.userPage > totalPages) this.userPage = Math.max(1, totalPages);

        const startIdx = (this.userPage - 1) * (this.usersPerPage || 50);
        const paginatedUsers = users.slice(startIdx, startIdx + (this.usersPerPage || 50));

        if (totalFiltered === 0) {
            document.getElementById('admin-users-list').innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">No users found.</td></tr>`;
            const paginationContainer = document.getElementById('admin-users-pagination');
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        const settings = store.getSettings();
        const currentUser = auth.getCurrentUser();
        const isSuperAdmin = currentUser && (currentUser.email === 'admin@eduhero.com' || currentUser.email === 'systemadmin@eduhero.com');

        const html = paginatedUsers.map(user => {
            const avatarHtml = (user.role === 'student' && settings.studentAvatarUrl) ? 
                `<img src="${settings.studentAvatarUrl}" class="w-full h-full object-cover">` : 
                user.name.charAt(0).toUpperCase();

            const canDelete = user.role !== 'admin' || (isSuperAdmin && user.id !== currentUser.id);

            return `
            <tr class="hover:bg-gray-50 transition-colors cursor-pointer" onclick="AdminPage.viewUser('${user.id}')">
                <td class="px-4 py-3 font-medium text-gray-900 flex items-center">
                    <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-3 text-xs font-bold text-gray-600 overflow-hidden">
                        ${avatarHtml}
                    </div>
                    ${user.name}
                </td>
                <td class="px-4 py-3">${user.email}</td>
                <td class="px-4 py-3 capitalize"><span class="px-2 py-1 bg-${user.role==='admin'?'rose':(user.role==='teacher'?'purple':'blue')}-100 text-${user.role==='admin'?'rose':(user.role==='teacher'?'purple':'blue')}-800 rounded-full text-xs font-medium">${user.role}</span></td>
                <td class="px-4 py-3">
                    ${user.uid ? 
                        '<span class="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">Activated</span>' : 
                        '<span class="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200">First Login</span>'}
                </td>
                <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1 max-w-[240px]">
                        ${user.role === 'admin' ? 
                            '<span class="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">All</span>' : 
                            (() => {
                                const sList = (user.subjects || []).map(sid => subjectsMap[sid] || sid);
                                if (sList.length === 0) return '<span class="text-gray-400">-</span>';
                                
                                let html = sList.map((s, idx) => {
                                    const hiddenClass = idx >= 2 ? 'hidden extra-subject' : '';
                                    return `<span class="${hiddenClass} text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100 whitespace-nowrap truncate max-w-[100px]" title="${s}">${s}</span>`;
                                }).join('');

                                if (sList.length > 2) {
                                    html += `
                                        <button onclick="event.stopPropagation(); this.parentElement.querySelectorAll('.extra-subject').forEach(el=>el.classList.remove('hidden')); this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden');" 
                                            class="text-[10px] px-1.5 py-0.5 bg-indigo-600 text-white rounded border border-indigo-700 hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm">
                                            +${sList.length - 2} more
                                        </button>
                                        <button onclick="event.stopPropagation(); this.parentElement.querySelectorAll('.extra-subject').forEach(el=>el.classList.add('hidden')); this.classList.add('hidden'); this.previousElementSibling.classList.remove('hidden');" 
                                            class="hidden text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200 hover:bg-gray-200 transition-colors cursor-pointer">
                                            Show Less
                                        </button>`;
                                }
                                return html;
                            })()
                        }
                    </div>
                </td>
                <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end gap-3 flex-nowrap whitespace-nowrap">
                        ${user.role === 'student' ? `<button onclick="event.stopPropagation(); AdminPage.resetStudentProgress('${user.id}')" class="text-amber-600 hover:text-amber-900 transition-colors" title="Reset Progress"><i class="fas fa-history"></i></button>` : ''}
                        <button onclick="event.stopPropagation(); AdminPage.editUser('${user.id}')" class="text-pink-600 hover:text-pink-900 transition-colors" title="Edit/Assign"><i class="fas fa-edit"></i></button>
                        ${canDelete ? `<button onclick="event.stopPropagation(); AdminPage.deleteUser('${user.id}')" class="text-red-600 hover:text-red-900 transition-colors"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                </td>
            </tr>
        `}).join('');
        document.getElementById('admin-users-list').innerHTML = html;

        // Render Pagination UI
        const paginationContainer = document.getElementById('admin-users-pagination');
        if (paginationContainer) {
            const endIdx = Math.min(startIdx + (this.usersPerPage || 50), totalFiltered);
            paginationContainer.innerHTML = `
                <div class="text-xs text-gray-500 font-medium">
                    Showing <span class="font-bold text-gray-800">${startIdx + 1}</span> to <span class="font-bold text-gray-800">${endIdx}</span> of <span class="font-bold text-gray-800">${totalFiltered}</span> users
                </div>
                <div class="flex items-center gap-1">
                    <button onclick="AdminPage.changePage(${this.userPage - 1})" 
                        ${this.userPage === 1 ? 'disabled' : ''} 
                        class="p-2 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <i class="fas fa-chevron-left text-xs"></i>
                    </button>
                    
                    <div class="flex items-center gap-1 px-2">
                        <span class="text-xs font-bold text-gray-400 uppercase tracking-widest mr-1">Page</span>
                        <input type="number" value="${this.userPage}" min="1" max="${totalPages}" 
                            onchange="AdminPage.changePage(parseInt(this.value))"
                            class="w-12 px-2 py-1 border border-gray-200 rounded text-xs font-bold text-center focus:outline-none focus:border-indigo-500">
                        <span class="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">of ${totalPages}</span>
                    </div>

                    <button onclick="AdminPage.changePage(${this.userPage + 1})" 
                        ${this.userPage >= totalPages ? 'disabled' : ''} 
                        class="p-2 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <i class="fas fa-chevron-right text-xs"></i>
                    </button>
                </div>
            `;
        }
    },

    changePage(newPage) {
        let users = store.getUsers();
        if (this.currentRoleFilter && this.currentRoleFilter !== 'all') {
            users = users.filter(u => u.role === this.currentRoleFilter);
        }
        const searchInput = document.getElementById('admin-user-search');
        if (searchInput && searchInput.value.trim() !== '') {
            const query = searchInput.value.toLowerCase().trim();
            users = users.filter(u => (u.name || '').toLowerCase().includes(query) || (u.email || '').toLowerCase().includes(query));
        }

        const totalPages = Math.ceil(users.length / (this.usersPerPage || 50));
        
        if (newPage < 1) newPage = 1;
        if (newPage > totalPages) newPage = totalPages;
        
        this.userPage = newPage;
        this.renderUsers();
        
        // Scroll to top of table
        document.getElementById('tab-users').scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    renderSubjects() {
        const subjects = store.getSubjects();
        const allVideos = store.getVideos();
        const allUsers = store.getUsers();
        
        const searchEl = document.getElementById('admin-subject-search');
        const query = (searchEl ? searchEl.value : '').toLowerCase().trim();

        // 1. PRE-CALCULATE COUNTS to avoid O(N^2) loops
        const videoCountMap = {};
        const teacherCountMap = {};
        
        allVideos.forEach(v => {
            const sId = String(v.subjectId || v.subject || '').trim();
            videoCountMap[sId] = (videoCountMap[sId] || 0) + 1;
        });

        allUsers.forEach(u => {
            if (u.role === 'teacher' || u.role === 'admin') {
                (u.subjects || []).forEach(sid => {
                    const cleanSid = String(sid || '').trim();
                    teacherCountMap[cleanSid] = (teacherCountMap[cleanSid] || 0) + 1;
                });
            }
        });

        const renderSubjectRow = (s, isSearch = false) => {
            const sId = String(s.id || '').trim();
            const vCount = videoCountMap[sId] || 0;
            const tCount = teacherCountMap[sId] || 0;
            
            const highlight = (text) => {
                if (!isSearch || !query || !text) return text || '';
                const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                return text.replace(re, '<mark class="bg-yellow-100 text-yellow-800 rounded px-0.5">$1</mark>');
            };

            return `
            <div class="bg-white border border-gray-200 rounded-xl mb-3 overflow-hidden transition-all shadow-sm hover:shadow-md">
                <div class="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors" style="border-left: 4px solid ${s.color || '#4f46e5'}">
                    <div class="flex items-center gap-4 flex-grow" onclick="AdminPage.toggleSubject('${s.id}')">
                        <div class="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0" style="background-color: ${(s.color || '#4f46e5')}20; color: ${s.color || '#4f46e5'}">
                            <i class="fas fa-book text-lg"></i>
                        </div>
                        <div class="min-w-0">
                            <h4 class="font-bold text-gray-800 truncate">${highlight(s.name)}</h4>
                            <div class="flex flex-wrap gap-2 mt-1">
                                <span class="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full uppercase">${highlight(s.category || 'No Category')}</span>
                                <span class="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full"><i class="fas fa-video mr-1"></i>${vCount} Videos</span>
                                <span class="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full"><i class="fas fa-chalkboard-teacher mr-1"></i>${tCount} Teachers</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 ml-4">
                        <button onclick="AdminPage.showAddVideoModal('${s.id}')" class="text-emerald-500 hover:text-emerald-700 bg-emerald-50 rounded-full w-9 h-9 flex items-center justify-center shadow-sm" title="Add Video"><i class="fas fa-plus"></i></button>
                        <button onclick="AdminPage.showEditSubjectModal('${s.id}')" class="text-indigo-500 hover:text-indigo-700 bg-indigo-50 rounded-full w-9 h-9 flex items-center justify-center shadow-sm" title="Edit Subject"><i class="fas fa-edit"></i></button>
                        <button onclick="AdminPage.deleteSubject('${s.id}')" class="text-red-500 hover:text-red-700 bg-red-50 rounded-full w-9 h-9 flex items-center justify-center shadow-sm" title="Delete Subject"><i class="fas fa-trash"></i></button>
                        <div class="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-gray-200 text-gray-500 shadow-sm ml-2 cursor-pointer" onclick="AdminPage.toggleSubject('${s.id}')">
                            <i class="fas fa-chevron-down transition-transform duration-300" id="admin-subj-icon-${s.id}"></i>
                        </div>
                    </div>
                </div>
                <div id="admin-subj-content-${s.id}" class="hidden border-t border-gray-100 p-6 bg-white"></div>
            </div>`;
        };

        if (query) {
            const matched = subjects.filter(s => {
                if (s.name.toLowerCase().includes(query)) return true;
                if ((s.category || '').toLowerCase().includes(query)) return true;
                if ((s.level || '').toLowerCase().includes(query)) return true;
                return allVideos.some(v => (v.subjectId || v.subject || '').trim() === String(s.id).trim() && v.title.toLowerCase().includes(query));
            });

            if (matched.length === 0) {
                document.getElementById('admin-levels-list').innerHTML = `<div class="col-span-full py-10 text-center text-gray-400"><i class="fas fa-search text-3xl mb-2 block"></i><p>No subjects found for "${query}".</p></div>`;
            } else {
                const html = matched.map(s => renderSubjectRow(s, true)).join('');
                document.getElementById('admin-levels-list').innerHTML = `<div class="col-span-full"><p class="text-xs text-gray-400 mb-3"><i class="fas fa-filter mr-1"></i>${matched.length} results</p>${html}</div>`;
            }
            document.getElementById('admin-levels-list').className = 'block';
            return;
        }

        const levels = [...new Set(subjects.map(s => s.level))];
        const html = levels.map(level => {
            const levelSubjects = subjects.filter(s => s.level === level);
            const subjectsHtml = levelSubjects.map(s => renderSubjectRow(s)).join('');
            const safeLevel = level.replace(/\s+/g, '-');

            return `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-3">
                <div class="p-4 flex justify-between items-center bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition" onclick="AdminPage.toggleLevel('${safeLevel}')">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center"><i class="fas fa-layer-group text-lg"></i></div>
                        <div><h3 class="font-bold text-gray-800 text-lg">${level}</h3><p class="text-xs text-gray-500 mt-1">${levelSubjects.length} Subjects</p></div>
                    </div>
                    <i class="fas fa-chevron-down text-gray-400 transition-transform duration-300 transform" id="admin-lvl-icon-${safeLevel}"></i>
                </div>
                <div id="admin-lvl-content-${safeLevel}" class="hidden p-6 border-t border-gray-100 bg-gray-50/30">${subjectsHtml}</div>
            </div>`;
        }).join('');
        
        document.getElementById('admin-levels-list').innerHTML = html;
        document.getElementById('admin-levels-list').className = 'space-y-4';

        // Hide unused sections
        document.getElementById('admin-level-subjects').classList.add('hidden');
        document.getElementById('admin-subject-detail').classList.add('hidden');
        document.getElementById('admin-subjects-main').classList.remove('hidden');
    },

    editLevelName(oldLevelName) {
        const modalHtml = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-5">
                    <h3 class="text-xl font-bold text-gray-800">Edit Level Name</h3>
                    <button onclick="ui.closeModal('edit-level-modal')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
                </div>
                <form id="edit-level-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Level Name</label>
                        <input type="text" id="el-name" value="${oldLevelName}" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                    </div>
                    <div class="flex gap-4">
                        <button type="button" onclick="AdminPage.deleteLevel('${oldLevelName}')" class="w-1/3 bg-red-50 text-red-600 font-medium py-2.5 rounded-lg hover:bg-red-100 transition mt-4"><i class="fas fa-trash mr-1"></i> Delete</button>
                        <button type="submit" class="w-2/3 bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition mt-4">Save Changes</button>
                    </div>
                </form>
            </div>
        `;
        ui.showModal('edit-level-modal', modalHtml);

        document.getElementById('edit-level-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = document.getElementById('el-name').value.trim();
            if (!newName || newName === oldLevelName) {
                ui.closeModal('edit-level-modal');
                return;
            }
            const targets = store.getSubjects().filter(s => s.level === oldLevelName);
            ui.closeModal('edit-level-modal');
            try {
                await Promise.all(targets.map(s => store.updateSubject(s.id, { level: newName })));
                ui.showToast(`Level name updated for ${targets.length} subjects`);
            } catch (err) {
                ui.showToast(err.message || 'Some subjects were not renamed — please retry', 'error');
            }
            AdminPage.refresh();
        });
    },

    async deleteLevel(levelName) {
        if (!confirm(`Are you sure you want to delete the level "${levelName}"? This will permanently delete ALL subjects under this level and their videos.`)) return;
        const subjects = store.getSubjects().filter(s => s.level === levelName);
        ui.closeModal('edit-level-modal');
        try {
            // Sequential: each delete fans out into video and comment writes, and
            // firing a whole level at once overruns Firestore's write limits.
            for (const s of subjects) await store.deleteSubject(s.id);
            ui.showToast(`Deleted level and its ${subjects.length} subjects`);
        } catch (err) {
            ui.showToast(err.message || 'Delete did not fully complete — please retry', 'error');
        }
        AdminPage.refresh();
    },

    async syncPresetSubjects() {
        if (confirm('This will automatically generate the missing subjects for Year 3 to Form 5 according to the new structure. Existing subjects will not be deleted. Continue?')) {
            const btn = document.querySelector('button[onclick="AdminPage.syncPresetSubjects()"]');
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
            btn.disabled = true;

            try {
                await store.reorganizeSubjects();
                ui.showToast('Subjects synchronized successfully');
                this.init();
            } catch (err) {
                ui.showToast('Sync failed: ' + err.message, 'error');
            } finally {
                btn.innerHTML = orig;
                btn.disabled = false;
            }
        }
    },

    toggleLevel(levelId) {
        const allContents = document.querySelectorAll('[id^="admin-lvl-content-"]');
        const allIcons = document.querySelectorAll('[id^="admin-lvl-icon-"]');
        
        const content = document.getElementById(`admin-lvl-content-${levelId}`);
        const icon = document.getElementById(`admin-lvl-icon-${levelId}`);
        
        const isHidden = content.classList.contains('hidden');
        
        allContents.forEach(c => c.classList.add('hidden'));
        allIcons.forEach(i => i.classList.remove('rotate-180'));
        
        if (isHidden) {
            content.classList.remove('hidden');
            icon.classList.add('rotate-180');
        }
    },

    toggleSubject(subjectId) {
        const content = document.getElementById(`admin-subj-content-${subjectId}`);
        const icon = document.getElementById(`admin-subj-icon-${subjectId}`);
        const isHidden = content.classList.contains('hidden');
        
        // Close others
        document.querySelectorAll('[id^="admin-subj-content-"]').forEach(c => c.classList.add('hidden'));
        document.querySelectorAll('[id^="admin-subj-icon-"]').forEach(i => i.classList.remove('rotate-180'));
        
        if (isHidden) {
            content.classList.remove('hidden');
            if (icon) icon.classList.add('rotate-180');
            this.openSubject(subjectId);
        }
    },

    backToSubjectList() {
        document.getElementById('admin-subject-detail').classList.add('hidden');
        document.getElementById('admin-subjects-main').classList.remove('hidden');
    },

    openSubject(subjectId) {
        const subject = store.getSubjects().find(s => s.id === subjectId);
        const allVideos = store.getVideos();
        const videos = allVideos.filter(v => v.subjectId === subjectId);
        const detailView = document.getElementById(`admin-subj-content-${subjectId}`);
        const users = store.getUsers();

        // Get IDs of teachers who are EITHER assigned to this subject OR have uploaded videos to it
        const assignedTeacherIds = users
            .filter(u => (u.role === 'teacher' || u.role === 'admin') && (u.subjects || []).includes(subjectId))
            .map(u => u.id);
        
        const uploaderIds = [...new Set(videos.map(v => v.teacherId))];
        const teacherIds = [...new Set([...assignedTeacherIds, ...uploaderIds])];

        let contentHtml = '';
        if (teacherIds.length === 0) {
            contentHtml = `
                <div class="bg-gray-50 rounded-xl p-8 text-center border border-gray-100">
                    <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <i class="fas fa-chalkboard-teacher text-2xl text-gray-400"></i>
                    </div>
                    <h3 class="text-lg font-bold text-gray-800 mb-1">No teachers assigned</h3>
                    <p class="text-gray-500">Assign teachers to this subject in the User Management tab.</p>
                </div>
            `;
        } else {
            contentHtml = teacherIds.map(tId => {
                const t = users.find(u => u.id === tId);
                const tVideos = videos.filter(v => v.teacherId === tId);
                return `
                    <div class="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 transition-colors cursor-pointer flex items-center shadow-sm" onclick="AdminPage.openSubjectTeacher('${subjectId}', '${tId}')">
                        <div class="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mr-4">
                            <i class="fas fa-chalkboard-teacher text-xl"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-gray-800">${t ? t.name : 'Unknown Teacher'}</h4>
                            <p class="text-xs ${tVideos.length === 0 ? 'text-amber-500 font-medium' : 'text-gray-500'} mt-0.5">
                                ${tVideos.length > 0 ? `${tVideos.length} videos available` : '<i class="fas fa-exclamation-circle mr-1"></i>0 videos uploaded'}
                            </p>
                        </div>
                        <i class="fas fa-chevron-right ml-auto text-gray-300"></i>
                    </div>
                `;
            }).join('');
            contentHtml = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${contentHtml}</div>`;
        }

        detailView.innerHTML = `
            <div class="mb-4">
                <p class="text-sm font-medium text-gray-500 mb-2">Select a Teacher</p>
            </div>
            ${contentHtml}
        `;
    },

    openSubjectTeacher(subjectId, teacherId) {
        const teacher = store.getUsers().find(u => u.id === teacherId);
        const videos = store.getVideos().filter(v => v.subjectId === subjectId && v.teacherId === teacherId);
        const detailView = document.getElementById(`admin-subj-content-${subjectId}`);

        // Group by year
        const yearsMap = {};
        videos.forEach(v => {
            const y = v.year || new Date(v.date).getFullYear().toString();
            if (!yearsMap[y]) yearsMap[y] = [];
            yearsMap[y].push(v);
        });

        const sortedYears = Object.keys(yearsMap).sort((a,b) => b - a);
        let contentHtml = sortedYears.map(year => `
            <div class="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 transition-colors cursor-pointer flex items-center shadow-sm" onclick="AdminPage.openSubjectTeacherYear('${subjectId}', '${teacherId}', '${year}')">
                <div class="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mr-4">
                    <i class="fas fa-calendar text-xl"></i>
                </div>
                <div>
                    <h4 class="font-bold text-gray-800">${year}</h4>
                    <p class="text-xs text-gray-500 mt-0.5">${yearsMap[year].length} videos</p>
                </div>
                <i class="fas fa-chevron-right ml-auto text-gray-300"></i>
            </div>
        `).join('');
        contentHtml = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${contentHtml}</div>`;

        detailView.innerHTML = `
            <div class="flex items-center mb-4">
                <button onclick="AdminPage.openSubject('${subjectId}')" class="flex items-center text-indigo-600 font-medium hover:text-indigo-800 transition mr-4 bg-indigo-50 px-3 py-1.5 rounded-lg text-sm">
                    <i class="fas fa-arrow-left mr-2"></i> Back
                </button>
                <p class="text-sm font-medium text-gray-500">Teacher: <span class="text-gray-800">${teacher ? teacher.name : 'Unknown'}</span> &bull; Select a Year</p>
            </div>
            ${contentHtml}
        `;
    },

    openSubjectTeacherYear(subjectId, teacherId, year) {
        const teacher = store.getUsers().find(u => u.id === teacherId);
        const videos = store.getVideos().filter(v => {
            const y = v.year || new Date(v.date).getFullYear().toString();
            return v.subjectId === subjectId && v.teacherId === teacherId && y === year;
        });
        const detailView = document.getElementById(`admin-subj-content-${subjectId}`);

        const monthsMap = {};
        videos.forEach(v => {
            const m = v.month || new Date(v.date).toLocaleDateString('default', { month: 'long' });
            if (!monthsMap[m]) monthsMap[m] = [];
            monthsMap[m].push(v);
        });

        const monthOrder = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const sortedMonths = Object.keys(monthsMap).sort((a,b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

        let contentHtml = sortedMonths.map(key => `
            <div class="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 transition-colors cursor-pointer flex items-center shadow-sm" onclick="AdminPage.openSubjectTeacherMonth('${subjectId}', '${teacherId}', '${year}', '${key}')">
                <div class="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mr-4">
                    <i class="fas fa-calendar-alt text-xl"></i>
                </div>
                <div>
                    <h4 class="font-bold text-gray-800">${key}</h4>
                    <p class="text-xs text-gray-500 mt-0.5">${monthsMap[key].length} videos available</p>
                </div>
                <i class="fas fa-chevron-right ml-auto text-gray-300"></i>
            </div>
        `).join('');
        contentHtml = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${contentHtml}</div>`;

        detailView.innerHTML = `
            <div class="flex items-center mb-4">
                <button onclick="AdminPage.openSubjectTeacher('${subjectId}', '${teacherId}')" class="flex items-center text-indigo-600 font-medium hover:text-indigo-800 transition mr-4 bg-indigo-50 px-3 py-1.5 rounded-lg text-sm">
                    <i class="fas fa-arrow-left mr-2"></i> Back
                </button>
                <p class="text-sm font-medium text-gray-500">Teacher: <span class="text-gray-800">${teacher ? teacher.name : 'Unknown'}</span> &bull; ${year} &bull; Select a Month</p>
            </div>
            ${contentHtml}
        `;
    },

    openSubjectTeacherMonth(subjectId, teacherId, year, monthKey) {
        const subject = store.getSubjects().find(s => s.id === subjectId);
        const teacher = store.getUsers().find(u => u.id === teacherId);
        
        const videos = store.getVideos().filter(v => {
            const vy = v.year || new Date(v.date).getFullYear().toString();
            const vm = v.month || new Date(v.date).toLocaleDateString('default', { month: 'long' });
            return v.subjectId === subjectId && v.teacherId === teacherId && vy === year && vm === monthKey;
        });

        // Sort by Title A-Z
        videos.sort((a, b) => a.title.localeCompare(b.title));

        const detailView = document.getElementById(`admin-subj-content-${subjectId}`);

        let videosHtml = videos.map(video => `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
                <div class="p-4 flex flex-col md:flex-row gap-4 items-center cursor-pointer hover:bg-gray-50 transition-colors group" onclick="AdminPage.playVideo('${video.id}')">
                    <div class="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition">
                        <i class="fas fa-play text-lg"></i>
                    </div>
                    <div class="flex-grow">
                        <h4 class="text-lg font-bold text-gray-800">${video.title}</h4>
                        <p class="text-gray-600 text-sm mt-1 line-clamp-2">${video.description || 'No description provided.'}</p>
                        <div class="mt-2 text-xs text-gray-500">
                            <i class="fas fa-eye mr-1"></i> ${store.getVideoViews(video.id)} views
                        </div>
                    </div>
                    <div class="text-xs text-gray-400 font-medium md:text-right whitespace-nowrap min-w-[120px]">
                        <div class="mb-1"><i class="fas fa-calendar-alt mr-1"></i> ${new Date(video.date).toLocaleDateString()}</div>
                        <div>${new Date(video.date).toLocaleTimeString()}</div>
                        <div class="flex gap-2 justify-end mt-2">
                            <button onclick="event.stopPropagation(); AdminPage.editVideo('${video.id}')" class="px-3 py-1.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition shadow-sm text-xs"><i class="fas fa-edit"></i> Edit</button>
                            <button onclick="event.stopPropagation(); AdminPage.deleteVideoFromSubject('${video.id}', '${subjectId}', '${teacherId}', '${year}', '${monthKey}')" class="px-3 py-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition shadow-sm text-xs"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
                <div id="admin-video-container-${video.id}" class="bg-gray-900 hidden w-full"></div>
            </div>
        `).join('');

        detailView.innerHTML = `
            <div class="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                <div class="flex items-center">
                    <button onclick="AdminPage.openSubjectTeacherYear('${subjectId}', '${teacherId}', '${year}')" class="flex items-center text-indigo-600 font-medium hover:text-indigo-800 transition mr-4 bg-indigo-50 px-3 py-1.5 rounded-lg text-sm">
                        <i class="fas fa-arrow-left mr-2"></i> Back
                    </button>
                    <p class="text-sm font-medium text-gray-500">Teacher: <span class="text-gray-800">${teacher ? teacher.name : 'Unknown'}</span> &bull; ${year} &bull; Month: <span class="text-gray-800">${monthKey}</span></p>
                </div>
                <button onclick="AdminPage.showAddVideoModal('${subjectId}', '${teacherId}', '${year}', '${monthKey}')" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm flex items-center justify-center">
                    <i class="fas fa-plus mr-2"></i> Add Video
                </button>
            </div>
            <div class="space-y-4 mt-4">
                ${videosHtml}
            </div>
        `;
    },

    showAddVideoModal(subjectId, preselectedTeacherId = '', preselectedYear = '', preselectedMonth = '') {
        const subject = store.getSubjects().find(s => s.id === subjectId);
        const teachers = store.getUsers().filter(u => u.role === 'teacher' || u.role === 'admin');
        const years = ['2024', '2025', '2026', '2027'];
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

        const modalHtml = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-5">
                    <div>
                        <h3 class="text-xl font-bold text-gray-800">Add New Video</h3>
                        <p class="text-xs text-indigo-600 font-medium">${subject ? subject.name : 'Unknown Subject'}</p>
                    </div>
                    <button onclick="ui.closeModal('admin-add-video-modal')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
                </div>
                <form id="admin-add-video-form" class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Target Teacher</label>
                            <select id="aav-teacher" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                <option value="">Select Teacher...</option>
                                ${teachers.map(t => `<option value="${t.id}" ${t.id === preselectedTeacherId ? 'selected' : ''}>${t.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Year</label>
                                <select id="aav-year" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                    ${years.map(y => `<option value="${y}" ${y === (preselectedYear || '2026') ? 'selected' : ''}>${y}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Month</label>
                                <select id="aav-month" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                    ${months.map(m => `<option value="${m}" ${m === preselectedMonth ? 'selected' : ''}>${m}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Video Title</label>
                        <input type="text" id="aav-title" required placeholder="EX. 2026 F2 SEJ FEB WEEK 1 - MR JACK (BAB 1.3)" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                        <p id="aav-title-error" class="text-xs text-red-500 mt-1 hidden"></p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Select Video File</label>
                        <div class="relative border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-indigo-500 hover:bg-indigo-50 transition cursor-pointer" onclick="document.getElementById('aav-video-file').click()">
                            <input type="file" id="aav-video-file" accept="video/mp4,video/x-m4v,video/*" class="hidden" onchange="document.getElementById('aav-file-name').textContent = this.files[0] ? this.files[0].name : 'No file selected'">
                            <i class="fas fa-cloud-upload-alt text-3xl text-indigo-400 mb-2"></i>
                            <p class="text-sm text-gray-600 font-medium" id="aav-file-name">Click to browse or drag and drop</p>
                            <p class="text-xs text-gray-400 mt-1">MP4, WebM up to 5GB</p>
                        </div>
                        <p class="text-xs text-red-500 mt-2 font-medium">
                            <i class="fas fa-exclamation-triangle mr-1"></i>
                            If upload fails/stucks, please switch to a different Wi-Fi or Mobile Hotspot AND use Incognito/Private mode to re-upload. If issue persists, contact Technical team.
                        </p>
                    </div>

                    <div id="aav-progress-container" class="hidden mt-4">
                        <div class="flex justify-between text-xs font-bold text-gray-500 mb-1">
                            <span>Uploading to BunnyStream...</span>
                            <span id="aav-progress-text">0%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2.5">
                            <div id="aav-progress-bar" class="bg-indigo-600 h-2.5 rounded-full" style="width: 0%"></div>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea id="aav-desc" rows="2" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"></textarea>
                    </div>
                    <button type="submit" id="aav-submit-btn" class="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition mt-4 shadow-md">
                        <i class="fas fa-cloud-upload-alt mr-2"></i> Create & Upload
                    </button>
                </form>
            </div>
        `;
        ui.showModal('admin-add-video-modal', modalHtml);

        document.getElementById('admin-add-video-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fileInput = document.getElementById('aav-video-file');
            const file = fileInput.files[0];
            if (!file) return ui.showToast('Please select a video file', 'warning');

            const targetTeacherId = document.getElementById('aav-teacher').value;
            if (!targetTeacherId) return ui.showToast('Please select a target teacher', 'warning');

            // Find mapping for Admin
            const mappings = store.getBunnySecrets().mappings || [];
            const mapping = mappings.find(m => m.subjectId === subjectId && m.teacherId === targetTeacherId);
            
            if (!mapping || !mapping.libraryKey) {
                return ui.showToast('This teacher is not configured for direct upload for this subject. Please map the library first in System Settings.', 'error');
            }

            const title = document.getElementById('aav-title').value;
            const targetYear = document.getElementById('aav-year').value;
            const targetMonth = document.getElementById('aav-month').value;
            const desc = document.getElementById('aav-desc').value;
            const titleError = document.getElementById('aav-title-error');
            
            titleError.classList.add('hidden');

            const isDuplicate = store.getVideos().some(v => 
                v.subjectId === subjectId &&
                v.teacherId === targetTeacherId &&
                v.year === targetYear &&
                v.month === targetMonth &&
                v.title.trim().toLowerCase() === title.trim().toLowerCase()
            );
            if (isDuplicate) {
                titleError.textContent = 'A video with this title already exists for this teacher in this month.';
                titleError.classList.remove('hidden');
                return;
            }

            UploadManager.addUpload(file, {
                title: title,
                desc: desc,
                subjectId: subjectId,
                teacherId: targetTeacherId,
                year: targetYear,
                month: targetMonth,
                libraryId: mapping.bunnyLibraryId,
                libraryKey: mapping.libraryKey
            });

            ui.closeModal('admin-add-video-modal');
        });
    },

    backToSubjectList() {
        document.getElementById('admin-subject-detail').classList.add('hidden');
        document.getElementById('admin-subjects-main').classList.remove('hidden');
    },

    playVideo(videoId) {
        const video = store.getVideos().find(v => v.id === videoId);
        if (!video) return;

        // Ensure any existing modal is removed first
        const existingModal = document.getElementById('video-fullscreen-modal');
        if (existingModal) existingModal.remove();

        const modalHtml = `
            <button onclick="AdminPage.closeVideo()" class="absolute top-4 right-4 md:top-6 md:right-8 z-[100] text-white bg-gray-900 bg-opacity-80 hover:bg-red-600 rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-colors border border-white/20">
                <i class="fas fa-times text-2xl"></i>
            </button>
            <div class="w-full max-w-5xl p-4">
                ${ui.renderVideoPlayer(video, videoId)}
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.id = 'video-fullscreen-modal';
        modal.className = 'fixed inset-0 z-[100] bg-gray-900/90 backdrop-blur-md flex items-center justify-center';
        modal.innerHTML = modalHtml;
        document.body.appendChild(modal);
    },

    closeVideo() {
        const modal = document.getElementById('video-fullscreen-modal');
        if (!modal) return;
        
        // Cleanup any pseudo-fullscreen elements
        document.querySelectorAll('.pseudo-fullscreen').forEach(el => el.classList.remove('pseudo-fullscreen'));
        
        const iframe = modal.querySelector('iframe');
        if (iframe) iframe.src = 'about:blank';

        // Stop the watermark/iframe guard timers and observers for this player.
        ui.releaseVideoGuards();

        modal.remove();
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    },

    editVideo(videoId) {
        const video = store.getVideos().find(v => v.id === videoId);
        if (!video) return;

        const modalHtml = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-5">
                    <h3 class="text-xl font-bold text-gray-800">Edit Video</h3>
                    <button onclick="ui.closeModal('admin-edit-video-modal')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
                </div>
                <form id="admin-edit-video-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Video Title</label>
                        <input type="text" id="aev-title" value="${video.title}" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                        <p id="aev-title-error" class="text-xs text-red-500 mt-1 hidden"></p>
                        <p class="text-xs text-gray-500 mt-1">EX. 2026 F2 SEJ FEB WEEK 1 - BAB 1.3</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Upload Year</label>
                        <select id="aev-year" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                            ${[new Date().getFullYear()-1, new Date().getFullYear(), new Date().getFullYear()+1].map(y =>
                                `<option value="${y}" ${(video.year || new Date().getFullYear().toString()) === y.toString() ? 'selected' : ''}>${y}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Upload Month</label>
                        <select id="aev-month" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                            ${['January','February','March','April','May','June','July','August','September','October','November','December'].map(m =>
                                `<option value="${m}" ${video.month === m ? 'selected' : ''}>${m}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
                        <div id="aev-bunny-fields" class="space-y-4">
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-2">BunnyStream Details</label>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Library ID</label>
                                    <input type="text" id="aev-bunny-lib" value="${video.bunnyLibraryId || ''}" placeholder="12345" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Video ID</label>
                                    <input type="text" id="aev-bunny-vid" value="${video.bunnyVideoId || ''}" placeholder="abc-def-ghi" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea id="aev-desc" rows="3" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">${video.description || ''}</textarea>
                    </div>
                    <button type="submit" class="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition mt-4 shadow-sm">Save Changes</button>
                </form>
            </div>
        `;
        ui.showModal('admin-edit-video-modal', modalHtml);

        document.getElementById('admin-edit-video-form').addEventListener('submit', (e) => {
            e.preventDefault();

            const newTitle = document.getElementById('aev-title').value;
            const targetYear = document.getElementById('aev-year').value;
            const targetMonth = document.getElementById('aev-month').value;
            const titleError = document.getElementById('aev-title-error');
            
            titleError.classList.add('hidden');

            const isDuplicate = store.getVideos().some(v => 
                v.id !== videoId &&
                v.subjectId === video.subjectId &&
                v.teacherId === video.teacherId &&
                v.year === targetYear &&
                v.month === targetMonth &&
                v.title.trim().toLowerCase() === newTitle.trim().toLowerCase()
            );
            if (isDuplicate) {
                titleError.textContent = 'A video with this title already exists for this teacher in this month.';
                titleError.classList.remove('hidden');
                return;
            }

            store.updateVideo(videoId, {
                title: newTitle,
                year: targetYear,
                month: targetMonth,
                videoProvider: 'bunny',
                bunnyLibraryId: document.getElementById('aev-bunny-lib').value,
                bunnyVideoId: document.getElementById('aev-bunny-vid').value,
                description: document.getElementById('aev-desc').value
            });
            store.addLog('Edit Video', `"${document.getElementById('aev-title').value}"`);
            ui.closeModal('admin-edit-video-modal');
            ui.showToast('Video updated successfully');
            
            // Refresh Monitored Videos Tab
            AdminPage.renderVideos();
            
            // Refresh Subject Detail View if it's open
            const refreshYear = document.getElementById('aev-year') ? document.getElementById('aev-year').value : (video.year || new Date().getFullYear().toString());
            const detailView = document.getElementById(`admin-subj-content-${video.subjectId}`);
            if (detailView && !detailView.classList.contains('hidden')) {
                AdminPage.openSubjectTeacherMonth(video.subjectId, video.teacherId, refreshYear, document.getElementById('aev-month').value);
            }
        });
    },

    deleteVideoFromSubject(videoId, subjectId, teacherId, year, monthKey) {
        const video = store.getVideos().find(v => v.id === videoId);
        if (confirm('Are you sure you want to delete this video?')) {
            store.addLog('Delete Video', `"${video ? video.title : videoId}" from ${year} ${monthKey}`);
            store.deleteVideo(videoId);
            ui.showToast('Video deleted');
            AdminPage.openSubjectTeacherMonth(subjectId, teacherId, year, monthKey);
        }
    },

    renderActivityLog() {
        const container = document.getElementById('admin-activity-log');
        if (!container) return;
        const searchEl = document.getElementById('log-search');
        const query = (searchEl ? searchEl.value : '').toLowerCase().trim();
        let logs = store.getLog();
        const users = store.getUsers();
        
        // Filter out logs created by students (keep only Admin and Teacher logs)
        logs = logs.filter(l => {
            if (l.adminId === 'system' || !l.adminId) return true; // Show system logs and legacy logs
            const user = users.find(u => u.id === l.adminId);
            return !user || (user.role === 'admin' || user.role === 'teacher');
        });

        if (query) {
            logs = logs.filter(l =>
                (l.action || '').toLowerCase().includes(query) ||
                (l.details || '').toLowerCase().includes(query) ||
                (l.adminName || '').toLowerCase().includes(query)
            );
        }

        if (logs.length === 0) {
            container.innerHTML = `<div class="text-center py-10 text-gray-400 w-full col-span-full"><i class="fas fa-history text-3xl mb-2 block"></i>${query ? 'No matching logs found.' : 'No activity recorded yet.'}</div>`;
            document.getElementById('admin-log-pagination').innerHTML = '';
            return;
        }

        // Pagination
        const totalLogs = logs.length;
        const totalPages = Math.ceil(totalLogs / this.logsPerPage);
        if (this.logPage > totalPages) this.logPage = totalPages || 1;
        
        const start = (this.logPage - 1) * this.logsPerPage;
        const paginatedLogs = logs.slice(start, start + this.logsPerPage);

        const actionColors = {
            'Create User': 'bg-green-100 text-green-700',
            'Delete User': 'bg-red-100 text-red-700',
            'Bulk Import': 'bg-blue-100 text-blue-700',
            'Update Permissions': 'bg-yellow-100 text-yellow-700',
            'Upload Video': 'bg-purple-100 text-purple-700',
            'Delete Video': 'bg-red-100 text-red-700',
            'Edit Video': 'bg-indigo-100 text-indigo-700',
        };

        container.innerHTML = paginatedLogs.map(log => {
            const color = actionColors[log.action] || 'bg-gray-100 text-gray-700';
            const dt = new Date(log.timestamp);
            const timeStr = dt.toLocaleDateString('en-GB') + ' ' + dt.toLocaleTimeString();
            
            // Dynamic fix for legacy "to Subject {ID}" logs
            let displayDetails = log.details || '-';
            if (log.action === 'Upload Video (Background)' && displayDetails.includes('to Subject ')) {
                const parts = displayDetails.split('to Subject ');
                if (parts.length === 2) {
                    const subjectId = parts[1].trim();
                    const allSubjects = store.getSubjects();
                    const subject = allSubjects.find(s => s.id === subjectId);
                    if (subject) {
                        displayDetails = `${parts[0]}to [${subject.level}] ${subject.name}`;
                    }
                }
            }

            return `
                <div class="p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                    <div class="flex justify-between items-center mb-3">
                        <span class="px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-black ${color}">${log.action}</span>
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-50 text-violet-600 rounded-full text-xs font-bold border border-violet-100 shadow-sm">
                            <i class="fas fa-user-shield text-[10px]"></i>${log.adminName}
                        </span>
                    </div>
                    <div class="text-sm text-gray-700 leading-relaxed mb-3 break-words font-medium">
                        ${displayDetails}
                    </div>
                    <div class="text-[10px] font-bold text-gray-400 flex items-center gap-1.5 uppercase tracking-tight">
                        <i class="far fa-clock text-gray-300"></i>${timeStr}
                    </div>
                </div>
            `;
        }).join('');

        // Render Pagination UI
        this.renderPagination('admin-log-pagination', this.logPage, totalPages, 'AdminPage.changeLogPage');
    },

    changeLogPage(page) {
        this.logPage = page;
        this.renderActivityLog();
        document.getElementById('tab-log').scrollIntoView({ behavior: 'smooth' });
    },

    async clearLog() {
        if (!confirm('Clear all activity logs?')) return;
        this.renderActivityLog();
        try {
            await store.clearLog();
            ui.showToast('Activity log cleared');
        } catch (err) {
            ui.showToast(err.message || 'Could not clear the whole log — please retry', 'error');
        }
    },

    // Debounced so a fast typist triggers one re-render instead of one per keystroke.
    onVideoSearch() {
        clearTimeout(this.videoSearchTimeout);
        this.videoSearchTimeout = setTimeout(() => {
            this.videoPage = 1;
            this.renderVideos();
        }, 250);
    },

    renderVideos() {
        const container = document.getElementById('admin-videos-list');
        if (!container) return;

        let videos = store.getVideos();

        // Index users and subjects by id once. Looking them up with Array.find()
        // per video turned this into ~16M comparisons on a 3k-video / 5k-user
        // database, which froze the page on every keystroke in the search box.
        const usersById = new Map(store.getUsers().map(u => [u.id, u]));
        const subjectsById = new Map(store.getSubjects().map(s => [s.id, s]));

        // Count views for every video in one pass over the progress collection.
        // This used to be called twice per sort comparison — each call rescanning
        // the entire collection — which was by far the most expensive part.
        const viewCounts = store.getVideoViewCounts();

        // Search Filter
        const searchVal = (document.getElementById('admin-video-search')?.value || '').toLowerCase().trim();
        if (searchVal) {
            videos = videos.filter(v => {
                const s = subjectsById.get(v.subjectId);
                const u = usersById.get(v.teacherId);
                return (v.title || '').toLowerCase().includes(searchVal) ||
                       (s && (s.name || '').toLowerCase().includes(searchVal)) ||
                       (u && (u.name || '').toLowerCase().includes(searchVal));
            });
        }

        // Sort by Views (descending), then by Level
        videos.sort((a, b) => {
            const viewsA = viewCounts.get(a.id) || 0;
            const viewsB = viewCounts.get(b.id) || 0;
            if (viewsB !== viewsA) return viewsB - viewsA;

            const sA = subjectsById.get(a.subjectId);
            const sB = subjectsById.get(b.subjectId);
            const levelA = sA ? (sA.level || '') : '';
            const levelB = sB ? (sB.level || '') : '';
            return levelA.localeCompare(levelB);
        });

        // Pagination
        const totalVideos = videos.length;
        const totalPages = Math.ceil(totalVideos / this.videosPerPage);
        if (this.videoPage > totalPages) this.videoPage = totalPages || 1;

        const start = (this.videoPage - 1) * this.videosPerPage;
        const paginatedVideos = videos.slice(start, start + this.videosPerPage);

        const html = paginatedVideos.map(v => {
            const u = usersById.get(v.teacherId);
            const s = subjectsById.get(v.subjectId);
            return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3 font-medium text-gray-900">${v.title}</td>
                <td class="px-4 py-3">${s ? s.name : '-'}</td>
                <td class="px-4 py-3">${u ? u.name : '-'}</td>
                <td class="px-4 py-3 text-xs text-gray-400">${new Date(v.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td class="px-4 py-3 font-semibold text-indigo-600">${viewCounts.get(v.id) || 0}</td>
                <td class="px-4 py-3 text-right flex gap-3 justify-end items-center">
                    <button onclick="AdminPage.playVideo('${v.id}')" class="text-indigo-600 hover:text-indigo-900 font-medium whitespace-nowrap"><i class="fas fa-play-circle mr-1"></i> Preview</button>
                    <button onclick="AdminPage.editVideo('${v.id}')" class="text-emerald-600 hover:text-emerald-900 font-medium whitespace-nowrap"><i class="fas fa-edit mr-1"></i> Edit</button>
                </td>
            </tr>
        `}).join('');
        
        container.innerHTML = html || '<tr><td colspan="6" class="p-8 text-center text-gray-400 italic">No videos found</td></tr>';

        // Render Pagination UI
        this.renderPagination('admin-videos-pagination', this.videoPage, totalPages, 'AdminPage.changeVideoPage');
    },

    changeVideoPage(page) {
        this.videoPage = page;
        this.renderVideos();
        document.getElementById('tab-videos').scrollIntoView({ behavior: 'smooth' });
    },

    renderPagination(containerId, currentPage, totalPages, callbackName) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = `
            <div class="flex items-center gap-1">
                <button onclick="${callbackName}(1)" ${currentPage === 1 ? 'disabled' : ''} class="p-2 rounded-lg ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}">
                    <i class="fas fa-angle-double-left"></i>
                </button>
                <button onclick="${callbackName}(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="p-2 rounded-lg ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}">
                    <i class="fas fa-angle-left"></i>
                </button>
                <span class="px-4 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg">
                    Page ${currentPage} / ${totalPages}
                </span>
                <button onclick="${callbackName}(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} class="p-2 rounded-lg ${currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}">
                    <i class="fas fa-angle-right"></i>
                </button>
                <button onclick="${callbackName}(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''} class="p-2 rounded-lg ${currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}">
                    <i class="fas fa-angle-double-right"></i>
                </button>
            </div>
        `;
        container.innerHTML = html;
    },

    handleBulkImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async function(results) {
                let added = 0;
                let updated = 0;
                const allSubjects = store.getSubjects();

                for (const row of results.data) {
                    const rowName = (row.Name || '').trim();
                    const rowEmail = (row.Email || '').trim();
                    
                    if (rowName && rowEmail) {
                        const email = auth._toAuthEmail(rowEmail);
                        const existing = await store.getUserByEmail(email);
                        
                        let assignedIds = [];
                        
                        // Handle Level + Subject format
                        const rowLevel = (row.Level || '').trim().toLowerCase();
                        const rowSubjects = (row.Subject || '').trim();
                        
                        if (rowLevel && rowSubjects) {
                            const parts = rowSubjects.split(',').map(s => s.trim().toLowerCase());
                            parts.forEach(p => {
                                const match = allSubjects.find(s => 
                                    (s.level || '').toLowerCase() === rowLevel &&
                                    (
                                        (s.category || '').toLowerCase() === p ||
                                        (s.name || '').toLowerCase() === p ||
                                        (s.name || '').toLowerCase() === `${p} ${rowLevel}` ||
                                        (s.name || '').toLowerCase() === `${rowLevel} ${p}` ||
                                        (p === 'history' && (s.category || '').toLowerCase() === 'sej') ||
                                        (p === 'geography' && (s.category || '').toLowerCase() === 'geo') ||
                                        (p === 'science' && (s.category || '').toLowerCase() === 'sci')
                                    )
                                );
                                if (match) assignedIds.push(match.id);
                            });
                        }

                        if (!existing) {
                            const rowPassword = (row.Password || 'password').trim();
                            const rowRole = row.Role ? row.Role.trim().toLowerCase() : 'student';
                            
                            await store.addUser(null, {
                                name: rowName,
                                email: email,
                                password: rowPassword,
                                role: rowRole,
                                subjects: assignedIds,
                                months: {},
                                monthExpiry: {},
                                mustChangePassword: true
                            });
                            added++;
                        } else {
                            // Smart Update existing user
                            const currentSubjects = existing.subjects || [];
                            const newUniqueSubjects = [...new Set([...currentSubjects, ...assignedIds])];
                            
                            let updatePayload = {
                                subjects: newUniqueSubjects
                            };
                            
                            const rowPassword = (row.Password || '').trim();
                            if (rowPassword) {
                                updatePayload.password = rowPassword;
                                updatePayload.mustChangePassword = true;
                            }
                            
                            const rowRole = (row.Role || '').trim().toLowerCase();
                            if (rowRole) {
                                updatePayload.role = rowRole;
                            }
                            
                            // Check if subjects actually changed or anything else updated
                            if (currentSubjects.length !== newUniqueSubjects.length || rowPassword || rowRole) {
                                await store.updateUser(existing.id, updatePayload);
                                updated++;
                            }
                        }
                    }
                }
                ui.showToast(`Successfully imported: ${added} added, ${updated} updated.`);
                AdminPage.refresh();
            }
        });
        event.target.value = ''; // reset
    },

    handleVideoBulkImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async function(results) {
                let added = 0;
                let errors = 0;
                const allSubjects = store.getSubjects();
                const allUsers = store.getUsers();

                for (const row of results.data) {
                    const title = (row.Title || '').trim();
                    const description = (row.Description || '').trim();
                    const year = (row.Year || new Date().getFullYear()).toString().trim();
                    const month = (row.Month || '').trim();
                    const libId = (row.LibraryID || '').trim();
                    const vidId = (row.VideoID || '').trim();
                    
                    const subjName = (row.Subject || '').trim().toLowerCase();
                    const levelName = (row.Level || '').trim().toLowerCase();
                    const teacherName = (row.Teacher || '').trim().toLowerCase();

                    if (title && vidId && subjName) {
                        // Find subject by name/ID and level
                        const subject = allSubjects.find(s => 
                            (s.name.toLowerCase() === subjName || s.id.toLowerCase() === subjName) && 
                            (levelName ? s.level.toLowerCase() === levelName : true)
                        );

                        // Find teacher by name or email or ID
                        const teacher = allUsers.find(u => 
                            u.role === 'teacher' && 
                            (u.name.toLowerCase() === teacherName || u.email.toLowerCase() === teacherName || u.id.toLowerCase() === teacherName)
                        );

                        if (subject && teacher) {
                            store.addVideo({
                                title,
                                description,
                                year,
                                month,
                                videoProvider: 'bunny',
                                bunnyLibraryId: libId,
                                bunnyVideoId: vidId,
                                subjectId: subject.id,
                                teacherId: teacher.id
                            });
                            added++;
                        } else {
                            errors++;
                        }
                    }
                }
                
                if (errors > 0) {
                    ui.showToast(`Imported ${added} videos. ${errors} skipped (Subject/Teacher not found).`, 'warning');
                } else {
                    ui.showToast(`Successfully imported ${added} videos.`);
                }
                
                if (typeof store.addLog === 'function') {
                    store.addLog('Maintenance', `Bulk video import performed: ${added} added.`);
                }
                AdminPage.refresh();
            }
        });
        event.target.value = ''; // reset
    },

    downloadUserTemplate() {
        const headers = ['Name', 'Email', 'Password', 'Role', 'Level', 'Subject'];
        const sampleData = [
            ['Ali bin Abu', 'ali@example.com', '', 'student', 'Form 1', 'SEJ, GEO'],
            ['Tan Ah Kow', 'tan@example.com', '', 'student', 'Form 2', 'SCI'],
            ['John Doe', 'john@example.com', '123456', 'student', 'Form 3', 'SEJ, GEO']
        ];
        
        let csvContent = headers.join(',') + '\n';
        sampleData.forEach(row => {
            csvContent += row.map(val => `"${val}"`).join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'user_import_template_admin.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    downloadVideoTemplate() {
        const headers = ['Title', 'Description', 'Year', 'Month', 'LibraryID', 'VideoID', 'Subject', 'Level', 'Teacher'];
        const sampleData = [
            ['Testing123', '', '2026', 'January', '657583', '77f2ab7e-5a78-479c-9896-1c4c1e4001c9', 'SEJ Form 1', 'Form 1', 'Mr Jack'],
            ['Testing12345', '', '2026', 'February', '657583', 'c119a2b5-0448-4e12-880c-7b1f3c3a9e22', 'SEJ Form 2', 'Form 2', 'Ms Angie'],
            ['Testing12346', '', '2026', 'March', '657583', 'c119a2b5-0448-4e12-880c-7b1f3c3a9e22', 'SEJ Form 3', 'Form 3', 'Ms Angeline']
        ];
        
        let csvContent = headers.join(',') + '\n';
        sampleData.forEach(row => {
            csvContent += row.map(val => `"${val}"`).join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'video_import_template_admin.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    showAddUserModal() {
        const modalHtml = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-5">
                    <h3 class="text-xl font-bold text-gray-800">Add New User</h3>
                    <button onclick="ui.closeModal('add-user-modal')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
                </div>
                <form id="add-user-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input type="text" id="au-name" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                    </div>
                    <div>
                        <label id="au-email-label" class="block text-sm font-medium text-gray-700 mb-1">Student Code</label>
                        <input type="text" id="au-email" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input type="text" id="au-password" required minlength="6" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Min. 6 characters">
                        <p class="text-[10px] text-gray-400 mt-1"><i class="fas fa-info-circle mr-1"></i>Must be at least 6 letters or numbers.</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Phone Number (Optional)</label>
                        <input type="tel" id="au-phone" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="+60123456789">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select id="au-role" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <button type="submit" class="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition mt-4">Create User</button>
                </form>
            </div>
        `;
        ui.showModal('add-user-modal', modalHtml);

        // Dynamic label change based on role
        document.getElementById('au-role').addEventListener('change', (e) => {
            const label = document.getElementById('au-email-label');
            label.innerText = e.target.value === 'student' ? 'Student Code' : 'Email';
        });

        document.getElementById('add-user-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('au-name').value.trim();
            const emailOrCode = document.getElementById('au-email').value.trim();
            const password = document.getElementById('au-password').value.trim();
            const role = document.getElementById('au-role').value;
            
            // Smarter check: search by identifier (email or code)
            const email = auth._toAuthEmail(emailOrCode);
            const existing = store.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
            if (existing) {
                ui.showToast(`${role === 'student' ? 'Student Code' : 'Email'} already exists in database!`, 'error');
                return;
            }
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
            submitBtn.disabled = true;

            try {
                const email = auth._toAuthEmail(emailOrCode);
                // Creating as legacy user (uid=null). 
                // They will be migrated to Firebase Auth on their first login.
                await store.addUser(null, {
                    name: name,
                    email: email,
                    phone: document.getElementById('au-phone').value,
                    password: password,
                    role: role,
                    subjects: [],
                    months: {},
                    mustChangePassword: true // Force password change for manually added users
                });
                store.addLog('Create User', `${role}: ${name} (${email})`);
                ui.closeModal('add-user-modal');
                ui.showToast('User added. Status: First Login');
                AdminPage.refresh();
            } catch (err) {
                ui.showToast('Error: ' + err.message, 'error');
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    },

    viewUser(userId) {
        const user = store.getUsers().find(u => u.id === userId);
        if (!user) return;
        
        let contentHtml = '';
               if (user.role === 'teacher') {
            const videos = store.getVideos().filter(v => v.teacherId === userId);
            // Sort videos by Title A-Z
            videos.sort((a, b) => a.title.localeCompare(b.title));
            
            const allSubjects = store.getSubjects();
            const teacherSubjectIds = user.subjects || [];
            const teacherSubjects = allSubjects.filter(s => teacherSubjectIds.includes(s.id));
            
            // Group teacher subjects by level
            const byLevel = {};
            teacherSubjects.forEach(s => {
                if (!byLevel[s.level]) byLevel[s.level] = [];
                byLevel[s.level].push(s);
            });

            let subjectsHtml = '';
            if (teacherSubjects.length === 0) {
                subjectsHtml = '<p class="text-gray-500 text-sm italic">No subjects assigned to this teacher yet.</p>';
            } else {
                subjectsHtml = Object.keys(byLevel).sort().map(level => {
                    const levelSubjs = byLevel[level];
                    return `
                        <div class="mb-4">
                            <h6 class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">${level}</h6>
                            <div class="space-y-2">
                                ${levelSubjs.map(s => {
                                    const sVideos = videos.filter(v => v.subjectId === s.id);
                                    const accordionId = `teacher-view-subj-${s.id}`;
                                    return `
                                        <div class="border border-gray-100 rounded-lg overflow-hidden bg-gray-50/30">
                                            <div class="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors" 
                                                 onclick="document.getElementById('${accordionId}').classList.toggle('hidden'); this.querySelector('i.fa-chevron-right').classList.toggle('rotate-90');">
                                                <div class="flex items-center gap-3">
                                                    <div class="w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold" style="background-color: ${s.color || '#6366f1'}">
                                                        ${s.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div class="text-sm font-bold text-gray-800">${s.name}</div>
                                                        <div class="text-[10px] text-gray-500">${sVideos.length} uploaded videos</div>
                                                    </div>
                                                </div>
                                                <i class="fas fa-chevron-right text-gray-300 text-xs transition-transform"></i>
                                            </div>
                                            <div id="${accordionId}" class="hidden bg-white border-t border-gray-50 p-3 space-y-2">
                                                ${sVideos.length === 0 ? '<p class="text-[10px] text-gray-400 italic py-1 px-2">No videos uploaded for this subject.</p>' : sVideos.map(v => `
                                                    <div class="flex items-center justify-between p-2 rounded bg-gray-50/50 group hover:bg-indigo-50/50 transition-colors cursor-pointer"
                                                         onclick="AdminPage.playVideo('${v.id}')">
                                                        <div class="min-w-0 flex-1 flex items-center gap-2">
                                                            <div class="w-6 h-6 bg-white rounded flex items-center justify-center text-indigo-400 shadow-sm border border-gray-100 group-hover:text-indigo-600">
                                                                <i class="fas fa-play text-[8px]"></i>
                                                            </div>
                                                            <div class="min-w-0 flex-1">
                                                                <div class="text-xs font-semibold text-gray-700 truncate group-hover:text-indigo-700">${v.title}</div>
                                                                <div class="text-[9px] text-gray-400 mt-0.5">${v.year || '-'} &bull; ${v.month || '-'} &bull; ${v.videoProvider || 'youtube'}</div>
                                                            </div>
                                                        </div>
                                                        <div class="text-[10px] font-bold text-indigo-500 ml-2 whitespace-nowrap">${store.getVideoViews(v.id)} views</div>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }).join('');
            }
            
            contentHtml = `
                <div class="py-2 min-h-[400px] flex flex-col">
                    <div class="mb-4 bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-xl text-white shadow-lg relative overflow-hidden">
                        <div class="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
                        <div class="relative z-10 flex items-center gap-4">
                            <div class="w-14 h-14 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-2xl font-black border border-white/30 shadow-inner">
                                ${user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h4 class="text-xl font-black tracking-tight">${user.name}</h4>
                                <p class="text-white/80 text-xs font-medium"><i class="fas fa-envelope mr-1.5 opacity-70"></i>${user.email}</p>
                                <div class="flex gap-2 mt-1.5">
                                    <span class="px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[9px] font-bold uppercase tracking-wider border border-white/20">Teacher</span>
                                    <span class="px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[9px] font-bold uppercase tracking-wider border border-white/20"><i class="fas fa-video mr-1"></i>${videos.length} Videos</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="px-1 flex-1 flex flex-col overflow-hidden">
                        <div class="flex items-center justify-between mb-3">
                            <h5 class="text-[11px] font-black text-gray-800 uppercase tracking-widest"><i class="fas fa-th-large mr-2 text-indigo-500"></i>Assigned Subjects</h5>
                        </div>
                        <div class="max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                            ${subjectsHtml}
                        </div>
                    </div>
                </div>
            `;
        } else if (user.role === 'student') {
            const rawProgress = store.getAllProgressForStudent ? store.getAllProgressForStudent(userId) : [];
            const videos = store.getVideos();
            const allSubjects = store.getSubjects();
            const subjectsMap = allSubjects.reduce((acc, s) => { acc[s.id] = s; return acc; }, {});

            // Helper for percentage fallback
            const getPct = (p) => p ? (p.watchPercentage || p.percentage || 0) : 0;
            
            // Safe Date Parser
            const parseDate = (d) => {
                if (!d) return null;
                const dt = new Date(d);
                return isNaN(dt.getTime()) ? null : dt;
            };

            // 1. Filter videos student has access to
            const authorizedVideos = videos.filter(v => {
                const hasSubject = (user.subjects || []).includes(v.subjectId);
                const hasMonth = (user.months && user.months[v.subjectId] && user.months[v.subjectId].includes(v.month));
                return hasSubject && hasMonth;
            });

            // 2. Identify "This Month" (last 30 days)
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            const thisMonthVideos = authorizedVideos.filter(v => new Date(v.date) >= thirtyDaysAgo);

            // 3. Status Calculation Helper
            const getStatus = (vidId) => {
                const p = rawProgress.find(prog => prog.videoId === vidId);
                const pct = getPct(p);
                if (pct >= 90) return 'Completed';
                if (pct > 0 || (p && p.watchDuration > 0)) return 'In Progress';
                return 'Not Started';
            };

            // 4. Monthly Statistics
            const monthlyStats = {
                total: thisMonthVideos.length,
                completed: thisMonthVideos.filter(v => getStatus(v.id) === 'Completed').length,
                duration: thisMonthVideos.reduce((sum, v) => {
                    const p = rawProgress.find(prog => prog.videoId === v.id);
                    return sum + (p ? (p.watchDuration || 0) : 0);
                }, 0)
            };
            const monthlyRate = monthlyStats.total > 0 ? Math.round((monthlyStats.completed / monthlyStats.total) * 100) : 0;

            // 5. Subject Table Data with Expiry & Countdown
            const subjectStats = (user.subjects || []).map(sid => {
                const s = subjectsMap[sid];
                if (!s) return null;
                const sVideos = thisMonthVideos.filter(v => v.subjectId === sid);
                const assignedMonths = user.months ? (user.months[sid] || []) : [];
                
                // Get expiry dates and countdown for this subject
                const expiries = assignedMonths.map(m => {
                    const exp = user.monthExpiry?.[sid]?.[m]?.end;
                    if (!exp) return null;
                    const expDate = parseDate(exp);
                    if (!expDate) return null;
                    
                    const daysLeft = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
                    let statusColor = 'text-indigo-500'; // Default Blue/Indigo
                    if (daysLeft < 0) statusColor = 'text-rose-600 font-black'; // Expired - Red
                    else if (daysLeft <= 3) statusColor = 'text-rose-600 font-bold'; // Critical - Red
                    else if (daysLeft <= 10) statusColor = 'text-amber-500 font-bold'; // Warning - Yellow
                    
                    const statusText = daysLeft < 0 ? `<span class="${statusColor}">(Expired)</span>` : 
                                      daysLeft === 0 ? `<span class="text-rose-600 font-black">(Today)</span>` : 
                                      `<span class="${statusColor}">(${daysLeft} days left)</span>`;
                    
                    // Format date as dd/mm/yyyy
                    const dateStr = expDate.toLocaleDateString('en-GB');
                    return `<div class="mb-1 whitespace-nowrap">${m}: ${dateStr} ${statusText}</div>`;
                }).filter(Boolean);

                const sProgress = rawProgress.filter(p => {
                    const v = videos.find(vid => vid.id === p.videoId);
                    return v && v.subjectId === sid;
                });

                return {
                    id: sid,
                    name: s.name,
                    total: sVideos.length,
                    completed: sVideos.filter(v => getStatus(v.id) === 'Completed').length,
                    expiry: expiries.length > 0 ? expiries.join('') : '<span class="opacity-30 italic">No expiry set</span>',
                    lastWatch: sProgress.reduce((latest, p) => {
                        const dt = parseDate(p.lastWatchedAt);
                        return (dt && (!latest || dt > latest)) ? dt : latest;
                    }, null)
                };
            }).filter(s => s !== null);

            const systemSettings = store.getSettings();
            const avatarSrc = user.photoURL || systemSettings.studentAvatarUrl;

            // 6. Video Data BY SUBJECT (All videos in assigned subjects, with access status)
            const videoDetailsBySubject = (user.subjects || []).map(sid => {
                const subj = subjectsMap[sid];
                if (!subj) return null;
                
                // Get all videos for this subject, not just authorized ones
                const sVideos = videos.filter(v => v.subjectId === sid).sort((a,b) => a.title.localeCompare(b.title));
                if (sVideos.length === 0) return null;
                
                // Group videos for this subject by month
                const monthsMap = {};
                sVideos.forEach(v => {
                    if (!monthsMap[v.month]) monthsMap[v.month] = [];
                    const p = rawProgress.find(prog => prog.videoId === v.id);
                    const isAuthorized = (user.months && user.months[sid] && user.months[sid].includes(v.month));
                    monthsMap[v.month].push({
                        title: v.title,
                        status: getStatus(v.id),
                        isAuthorized,
                        month: v.month,
                        pct: getPct(p),
                        duration: p ? (p.watchDuration || 0) : 0,
                        rewatch: p ? (p.rewatchCount || 0) : 0,
                        lastWatch: p ? parseDate(p.lastWatchedAt) : null
                    });
                });
                
                return {
                    subjectId: sid,
                    subjectName: subj.name,
                    months: monthsMap,
                    totalVideos: sVideos.length
                };
            }).filter(s => s !== null);

            // 7. Parent Summary Generation (CHINESE)
            const laggingSubjects = subjectStats.filter(s => s.total > 0 && (s.completed / s.total) < 0.5).map(s => s.name);
            const parentSummary = `英雄家人，您好！这是 ${user.name} 本月的学习进度汇报。

*学习概览：*
- 本月应看视频：${monthlyStats.total} 支
- 已完成视频：${monthlyStats.completed} 支
- 总观看时长：${Math.round(monthlyStats.duration / 60)} 分钟
- 活跃程度：${monthlyRate}% 完成率

${laggingSubjects.length > 0 ? `*需要关注：*
目前 ${user.name} 在以下科目进度稍慢：${laggingSubjects.join('、')}。建议家长提醒孩子尽快完成视频，以免错过学习进度。` : `*表现优异：*
${user.name} 本月表现非常积极，已经跟上所有进度，请继续保持！`}

*后续跟进：*
请确保孩子在 Dashboard 里检查是否还有未完成的视频。感谢您的配合！`;

            contentHtml = `
                <div class="space-y-6 pb-2 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
                    <!-- Top Row: Profile and Overview -->
                    <div class="grid grid-cols-12 gap-4">
                        <div class="col-span-4 bg-slate-900 rounded-3xl p-5 text-white shadow-xl flex flex-col justify-center">
                            <div class="flex items-center gap-4">
                                <div class="w-14 h-14 bg-slate-800 rounded-2xl overflow-hidden flex items-center justify-center shadow-inner border border-white/10">
                                    ${avatarSrc ? `<img src="${avatarSrc}" class="w-full h-full object-cover">` : `<span class="text-2xl font-black text-white">${user.name.charAt(0)}</span>`}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="text-xl font-black truncate">${user.name}</h4>
                                    <p class="text-[10px] text-indigo-300 font-bold uppercase tracking-widest mt-0.5">${user.email.split('@')[0]}</p>
                                </div>
                            </div>
                            <div class="mt-5 space-y-2 text-[10px] text-slate-300 border-t border-white/5 pt-4">
                                <div class="flex justify-between"><span class="opacity-40 uppercase font-bold text-[8px]">Phone</span><span>${user.phone || '-'}</span></div>
                                <div class="flex justify-between"><span class="opacity-40 uppercase font-bold text-[8px]">Last Login</span><span>${user.lastLoginAt ? parseDate(user.lastLoginAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'}</span></div>
                                <div class="flex justify-between items-start gap-4">
                                    <span class="opacity-40 uppercase font-bold text-[8px] whitespace-nowrap">Enrolled</span>
                                    <span class="text-right text-[9px] text-slate-400 font-medium leading-tight">${(user.subjects || []).map(sid => subjectsMap[sid]?.name).filter(Boolean).join(', ') || 'None'}</span>
                                </div>
                            </div>
                        </div>

                        <div class="col-span-8 grid grid-cols-3 gap-3">
                            <div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm text-center flex flex-col justify-center">
                                <div class="text-[11px] font-black text-slate-400 uppercase mb-1">Monthly Tasks</div>
                                <div class="text-2xl font-black text-slate-800">${monthlyStats.total}</div>
                                <div class="text-[10px] text-slate-500 mt-1 font-black">本月应看视频</div>
                            </div>
                            <div class="bg-emerald-50 p-4 rounded-3xl border border-emerald-100 shadow-sm text-center flex flex-col justify-center">
                                <div class="text-[11px] font-black text-emerald-600/50 uppercase mb-1">Completed</div>
                                <div class="text-2xl font-black text-emerald-600">${monthlyStats.completed}</div>
                                <div class="text-[10px] text-emerald-600/80 mt-1 font-black">${monthlyRate}% 完成率</div>
                            </div>
                            <div class="bg-amber-50 p-4 rounded-3xl border border-amber-100 shadow-sm text-center flex flex-col justify-center">
                                <div class="text-[11px] font-black text-amber-600/50 uppercase mb-1">Total Watch</div>
                                <div class="text-2xl font-black text-amber-600">${Math.round(monthlyStats.duration / 60)}<span class="text-sm ml-0.5">m</span></div>
                                <div class="text-[10px] text-amber-600/80 mt-1 font-black">总观看时长</div>
                            </div>
                        </div>
                    </div>

                    <!-- Middle Row: Subject Stats and Parent Summary -->
                    <div class="grid grid-cols-12 gap-4">
                        <div class="col-span-7">
                            <div class="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden h-full">
                                <div class="px-5 py-3 border-b border-slate-50 bg-slate-50/50">
                                    <h5 class="text-[10px] font-black text-slate-800 uppercase tracking-widest">Monthly Subject Performance</h5>
                                </div>
                                <div class="overflow-x-auto">
                                    <table class="w-full text-left text-[10px]">
                                        <thead class="bg-slate-50 text-slate-400 font-bold uppercase text-[8px]">
                                            <tr>
                                                <th class="px-5 py-2">Subject</th>
                                                <th class="px-5 py-2 text-center">Done/Total</th>
                                                <th class="px-5 py-2">Access Expiry</th>
                                                <th class="px-5 py-2">Last Activity</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-slate-50">
                                            ${subjectStats.map(s => `
                                                <tr class="hover:bg-slate-50 transition-colors">
                                                    <td class="px-5 py-3 font-bold text-slate-700">${s.name}</td>
                                                    <td class="px-5 py-3 text-center font-black text-slate-800">${s.completed} / ${s.total}</td>
                                                    <td class="px-5 py-3 text-[9px] leading-tight">${s.expiry}</td>
                                                    <td class="px-5 py-3 text-slate-400 font-medium">${s.lastWatch ? ui.formatRelativeTime(s.lastWatch) : '-'}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div class="col-span-5">
                            <div class="bg-indigo-900 rounded-3xl p-5 text-white relative overflow-hidden h-full flex flex-col shadow-xl">
                                <div class="relative z-10 flex flex-col h-full">
                                    <div class="flex items-center gap-3 mb-3">
                                        <div class="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-lg"><i class="fas fa-magic text-xs"></i></div>
                                        <h5 class="text-[11px] font-black tracking-tight uppercase">家长汇报 (月度)</h5>
                                    </div>
                                    <div class="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 mb-3 flex-1 overflow-y-auto max-h-[120px] custom-scrollbar-light">
                                        <pre id="parent-summary-text" class="text-[10px] font-medium whitespace-pre-wrap font-sans text-indigo-50 leading-relaxed">${parentSummary}</pre>
                                    </div>
                                    <button onclick="ui.copyToClipboard(document.getElementById('parent-summary-text').innerText)" class="w-full bg-white text-indigo-900 font-black py-2 rounded-xl hover:bg-indigo-50 transition flex items-center justify-center gap-2 text-xs">
                                        <i class="fas fa-copy"></i> 复制汇报文案
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Video Watch Details Grouped BY SUBJECT (Accordions) -->
                    <div class="space-y-4">
                        <div class="flex items-center gap-3 px-1">
                            <h5 class="text-[11px] font-black text-slate-800 uppercase tracking-widest">Video Watch Details (By Subject)</h5>
                            <div class="h-px flex-1 bg-slate-100"></div>
                        </div>
                        
                        ${videoDetailsBySubject.map(group => `
                            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div class="px-5 py-3 bg-slate-50 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors" 
                                     onclick="const content = document.getElementById('log-subj-${group.subjectId}'); const icon = this.querySelector('i.fa-chevron-down'); content.classList.toggle('hidden'); icon.classList.toggle('rotate-180');">
                                    <div class="flex items-center gap-3">
                                        <span class="text-[10px] font-black uppercase tracking-wider text-slate-700">${group.subjectName}</span>
                                        <span class="px-2 py-0.5 bg-white rounded-full text-[8px] font-black text-slate-400 border border-slate-100 uppercase">${group.totalVideos} Videos</span>
                                    </div>
                                    <i class="fas fa-chevron-down text-slate-300 text-xs transition-transform"></i>
                                </div>
                                <div id="log-subj-${group.subjectId}" class="hidden border-t border-slate-100 p-4 space-y-3 bg-slate-50/20">
                                    ${Object.keys(group.months).sort((a,b) => {
                                        const order = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                                        return order.indexOf(a) - order.indexOf(b);
                                    }).map(month => `
                                        <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                                            <div class="px-4 py-2.5 bg-white flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                                                 onclick="const content = document.getElementById('log-subj-${group.subjectId}-${month}'); const icon = this.querySelector('i.fa-chevron-right'); content.classList.toggle('hidden'); icon.classList.toggle('rotate-90');">
                                                <div class="flex items-center gap-2">
                                                    <i class="fas fa-chevron-right text-[8px] text-slate-300 transition-transform"></i>
                                                    <span class="text-[9px] font-black uppercase tracking-widest text-slate-600">${month}</span>
                                                    <span class="px-1.5 py-0.5 bg-slate-50 rounded text-[7px] font-bold text-slate-400 uppercase">${group.months[month].length} Videos</span>
                                                    ${!group.months[month][0].isAuthorized ? `<span class="px-1.5 py-0.5 bg-rose-50 text-rose-600 text-[7px] font-black rounded border border-rose-100 uppercase tracking-tighter ml-1" title="Student has no access to this month"><i class="fas fa-lock mr-0.5 text-[6px]"></i>No Access</span>` : ''}
                                                </div>
                                            </div>
                                            <div id="log-subj-${group.subjectId}-${month}" class="hidden overflow-x-auto border-t border-slate-50">
                                                <table class="w-full text-left text-[10px]">
                                                    <thead class="bg-slate-50/50 text-slate-400 font-bold uppercase text-[8px] border-b border-slate-50">
                                                        <tr>
                                                            <th class="px-5 py-2">Video Title</th>
                                                            <th class="px-5 py-2">Status</th>
                                                            <th class="px-5 py-2">Progress</th>
                                                            <th class="px-5 py-2">Duration</th>
                                                            <th class="px-6 py-2 text-center">Rewatch</th>
                                                            <th class="px-6 py-2">Last Active</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody class="divide-y divide-slate-50">
                                                        ${group.months[month].map(v => {
                                                            const statusColor = v.status === 'Completed' ? 'text-emerald-600' : 
                                                                              v.status === 'In Progress' ? 'text-amber-600' : 'text-slate-400';
                                                            return `
                                                                <tr class="hover:bg-slate-50/50 transition-colors">
                                                                    <td class="px-5 py-2.5">
                                                                        <div class="font-bold text-slate-800 leading-tight">${v.title}</div>
                                                                    </td>
                                                                    <td class="px-5 py-2.5">
                                                                        <div class="flex items-center gap-2">
                                                                            <span class="font-black uppercase text-[8px] ${statusColor}">${v.status}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td class="px-5 py-2.5 font-black text-slate-700">${v.pct}%</td>
                                                                    <td class="px-5 py-2.5 font-medium text-slate-500">${Math.floor(v.duration / 60)}m ${v.duration % 60}s</td>
                                                                    <td class="px-6 py-2.5 text-center font-bold text-indigo-600">${v.rewatch}x</td>
                                                                    <td class="px-6 py-2.5 text-slate-400 font-medium">${v.lastWatch ? ui.formatRelativeTime(v.lastWatch) : '-'}</td>
                                                                </tr>
                                                            `;
                                                        }).join('')}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            contentHtml = `
                <div class="mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div class="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-2xl font-bold">
                        ${user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h4 class="text-xl font-bold text-gray-800">${user.name}</h4>
                        <p class="text-sm text-gray-500">${user.role === 'student' ? 'Student Code: ' : ''}${user.email} &bull; ${user.phone || 'No phone'}</p>
                        <span class="inline-block mt-1 px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full text-xs font-medium capitalize">${user.role}</span>
                    </div>
                </div>
            `;
        }
        
        const modalWidthClass = user.role === 'student' ? 'max-w-5xl' : 'max-w-lg';
        const modalHtml = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-black text-slate-800 tracking-tight">User Details</h3>
                    <div class="flex items-center gap-3">
                        ${user.role === 'student' ? `<button onclick="AdminPage.resetStudentProgress('${user.id}'); ui.closeModal('view-user-modal');" class="px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors shadow-sm border border-amber-200"><i class="fas fa-history mr-1.5"></i>Reset Progress</button>` : ''}
                        <button onclick="ui.closeModal('view-user-modal')" class="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"><i class="fas fa-times text-xs"></i></button>
                    </div>
                </div>
                ${contentHtml}
            </div>
        `;
        ui.showModal('view-user-modal', modalHtml, modalWidthClass);
    },

    editUser(userId) {
        const user = store.getUsers().find(u => u.id === userId);
        const subjects = store.getSubjects();
        
        let subjectsHtml = '';
        if (user.role !== 'admin') {
            const levels = [...new Set(subjects.map(s => s.level))];
            subjectsHtml = levels.map(level => {
                const levelSubjects = subjects.filter(s => s.level === level);
                const safeLevel = level.replace(/\s+/g, '-');
                const checks = levelSubjects.map(s => {
                    const isSubjectAssigned = user.subjects?.includes(s.id);
                    let monthsContent = '';
                    
                    if (user.role === 'student') {
                        const allMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                        const assignedMonthsForSubj = (user.months && user.months[s.id]) || [];
                        const monthExpiry = (user.monthExpiry && user.monthExpiry[s.id]) || {};
                        const monthChecks = allMonths.map(m => {
                            const formatInputDate = (dStr) => {
                                if (!dStr) return '';
                                if (!dStr.includes('T')) return dStr;
                                const dt = new Date(dStr);
                                const z = n => ('0'+n).slice(-2);
                                return `${dt.getFullYear()}-${z(dt.getMonth()+1)}-${z(dt.getDate())}`;
                            };
                            const exp = monthExpiry[m] || {};
                            const startVal = formatInputDate(exp.start);
                            const endVal = formatInputDate(exp.end);
                            const sid = s.id;
                            // Auto-fill handler: set today as start, today+45d as end when checked
                            const autoFill = `if(this.checked){
                                var today=new Date();
                                var end=new Date(today); end.setDate(end.getDate()+45);
                                var fmt=d=>{var z=n=>('0'+n).slice(-2); return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());};
                                var row=this.closest('.month-row-${sid}-'+this.value.replace(/ /g,'_'));
                                var sEl=document.querySelector('.month-start-${sid}[data-month="'+this.value+'"]');
                                var eEl=document.querySelector('.month-exp-${sid}[data-month="'+this.value+'"]');
                                if(sEl&&!sEl.value) sEl.value=fmt(today);
                                if(eEl&&!eEl.value) eEl.value=fmt(end);
                            }`;
                            return `
                            <div class="flex items-center gap-1 mb-1 p-2 border rounded bg-white shadow-sm text-xs">
                                <input type="checkbox" class="month-cb-${s.id} h-3 w-3 text-indigo-600 rounded border-gray-300 flex-shrink-0" value="${m}" ${assignedMonthsForSubj.includes(m) ? 'checked' : ''} onchange="${autoFill.replace(/"/g, '&quot;')}">
                                <span class="font-medium text-gray-800 w-16 flex-shrink-0">${m}</span>
                                <input type="date" class="month-start-${s.id} border border-gray-200 rounded px-1 py-0.5 text-xs text-gray-500 flex-grow" data-month="${m}" value="${startVal}" title="Start Date">
                                <span class="text-gray-300 flex-shrink-0">→</span>
                                <input type="date" class="month-exp-${s.id} border border-gray-200 rounded px-1 py-0.5 text-xs text-gray-500 flex-grow" data-month="${m}" value="${endVal}" title="End Date">
                            </div>`;
                        }).join('');
                        monthsContent = `
                            <div id="eu-subj-months-${s.id}" class="${isSubjectAssigned ? '' : 'hidden'} mt-2 pl-4 border-l-2 border-indigo-100">
                                <div class="flex text-xs font-semibold text-gray-500 mb-1 gap-1 pl-4"><span class="w-16">Month</span><span class="flex-grow text-center">Start</span><span class="w-4"></span><span class="flex-grow text-center">End (Expiry)</span></div>
                                <div>${monthChecks}</div>
                            </div>
                        `;
                    }

                    return `
                    <div class="p-3 border rounded-lg mb-2 bg-white shadow-sm">
                        <label class="flex items-center cursor-pointer group">
                            <input type="checkbox" class="subject-cb mr-3 h-4 w-4 text-indigo-600 rounded border-gray-300" value="${s.id}" ${isSubjectAssigned ? 'checked' : ''} onchange="AdminPage.toggleSubjectMonths('${s.id}', this.checked, '${user.role}')">
                            <div class="flex-grow">
                                <div class="font-medium text-sm text-gray-800 group-hover:text-indigo-600 transition-colors">${s.name}</div>
                                <div class="text-xs text-gray-500">${s.category}</div>
                            </div>
                        </label>
                        ${monthsContent}
                    </div>
                `}).join('');
                return `
                    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3">
                        <div class="px-4 py-3 flex justify-between items-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition" onclick="AdminPage.toggleEditUserLevel('${safeLevel}')">
                            <span class="font-bold text-gray-700 text-sm">${level}</span>
                            <i class="fas fa-chevron-down text-gray-400 transition-transform duration-300" id="eu-lvl-icon-${safeLevel}"></i>
                        </div>
                        <div id="eu-lvl-content-${safeLevel}" class="hidden p-3 border-t border-gray-100 bg-gray-50/50">
                            ${checks}
                        </div>
                    </div>
                `;
            }).join('');
            subjectsHtml = `<div class="mt-4"><label class="block text-sm font-medium text-gray-700 mb-2">Assign Subjects ${user.role === 'student' ? '& Months' : ''}</label><div class="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">${subjectsHtml}</div></div>`;
        }

        const modalHtml = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-5">
                    <h3 class="text-xl font-bold text-gray-800">Edit User</h3>
                    <button onclick="ui.closeModal('edit-user-modal')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
                </div>
                <form id="edit-user-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input type="text" id="eu-name" value="${user.name}" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input type="tel" id="eu-phone" value="${user.phone || ''}" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="+60123456789">
                    </div>
                    <div class="relative">
                        <label class="block text-sm font-medium text-gray-700 mb-1">User Password</label>
                        <div class="relative">
                            <input type="password" id="eu-password" value="${user.password || ''}" readonly class="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed outline-none pr-10">
                            <button type="button" onclick="const p=document.getElementById('eu-password'); p.type=p.type==='password'?'text':'password'; this.querySelector('i').classList.toggle('fa-eye'); this.querySelector('i').classList.toggle('fa-eye-slash');" class="absolute right-3 top-2 text-gray-400 hover:text-gray-600">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                        <p class="text-[10px] text-gray-400 mt-1"><i class="fas fa-info-circle mr-1"></i>Admin can view only. Users must change their own password.</p>
                    </div>
                    ${subjectsHtml}
                    <button type="submit" class="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition mt-6">Save Changes</button>
                </form>
            </div>
        `;
        ui.showModal('edit-user-modal', modalHtml);

        document.getElementById('edit-user-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const updates = { 
                name: document.getElementById('eu-name').value,
                phone: document.getElementById('eu-phone').value
            };
            
            if (user.role !== 'admin') {
                const checked = Array.from(document.querySelectorAll('.subject-cb:checked')).map(cb => cb.value);
                const prevChecked = user.subjects || [];
                const addedSubjs = checked.filter(sid => !prevChecked.includes(sid));
                const removedSubjs = prevChecked.filter(sid => !checked.includes(sid));
                
                const allSubjects = store.getSubjects();
                const getSubjDetail = (sid) => {
                    const s = allSubjects.find(subj => subj.id === sid);
                    return s ? `[${s.level} - ${s.category}] ${s.name}` : sid;
                };

                if (addedSubjs.length || removedSubjs.length) {
                    const logParts = [];
                    if (addedSubjs.length) logParts.push(`+Assign: ${addedSubjs.map(getSubjDetail).join(', ')}`);
                    if (removedSubjs.length) logParts.push(`-Unassign: ${removedSubjs.map(getSubjDetail).join(', ')}`);
                    store.addLog('Update Permissions', `${user.role}: ${user.name} — ${logParts.join(' | ')}`);
                }

                updates.subjects = checked;
                
                if (user.role === 'student') {
                    const subjectMonths = {};
                    const subjectMonthExpiry = {};
                    const oldMonths = user.months || {};
                    const monthLogLines = [];

                    checked.forEach(sid => {
                        const checkedMonths = Array.from(document.querySelectorAll(`.month-cb-${sid}:checked`)).map(cb => cb.value);
                        subjectMonths[sid] = checkedMonths;

                        const expiryMap = {};
                        document.querySelectorAll(`.month-exp-${sid}`).forEach(el => {
                            const startEl = document.querySelector(`.month-start-${sid}[data-month="${el.dataset.month}"]`);
                            expiryMap[el.dataset.month] = { start: startEl ? startEl.value : '', end: el.value };
                        });
                        subjectMonthExpiry[sid] = expiryMap;

                        const prev = oldMonths[sid] || [];
                        const added = checkedMonths.filter(m => !prev.includes(m));
                        const removed = prev.filter(m => !checkedMonths.includes(m));
                        const sDetail = getSubjDetail(sid);
                        
                        if (added.length) {
                            const dateLines = added.map(m => {
                                const e = expiryMap[m] || {};
                                const s = e.start ? ` (${e.start} → ${e.end || '?'})` : '';
                                return `${m}${s}`;
                            }).join(', ');
                            monthLogLines.push(`${sDetail} +Month: ${dateLines}`);
                        }
                        if (removed.length) monthLogLines.push(`${sDetail} -Month: ${removed.join(', ')}`);

                        checkedMonths.filter(m => prev.includes(m)).forEach(m => {
                            const e = expiryMap[m] || {};
                            const oldExp = (user.monthExpiry?.[sid]?.[m]) || {};
                            if ((e.start !== (oldExp.start || '')) || (e.end !== (oldExp.end || ''))) {
                                monthLogLines.push(`${sDetail} ${m} dates: ${e.start || '-'} → ${e.end || '-'}`);
                            }
                        });
                    });

                    // Removed subjects entirely from months
                    Object.keys(oldMonths).forEach(sid => {
                        if (!checked.includes(sid) && (oldMonths[sid] || []).length > 0) {
                            monthLogLines.push(`${getSubjDetail(sid)} -All months removed`);
                        }
                    });

                    updates.months = subjectMonths;
                    updates.monthExpiry = subjectMonthExpiry;
                    if (monthLogLines.length) {
                        store.addLog('Update Permissions', `${user.name}: ${monthLogLines.join(' | ')}`);
                    }
                }
            }

            try {
                const submitBtn = e.target.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';
                submitBtn.disabled = true;

                Promise.resolve(store.updateUser(userId, updates)).then(() => {
                    ui.showToast('User updated successfully');
                    AdminPage.renderUsers(); // update table in background
                }).catch(err => {
                    ui.showToast(err.message || 'Update failed', 'error');
                }).finally(() => {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                });
            } catch (err) {
                ui.showToast(err.message || 'Error updating user', 'error');
            }
        });
    },

    toggleSubjectMonths(subjectId, isChecked, role) {
        if (role === 'student') {
            const monthsContainer = document.getElementById(`eu-subj-months-${subjectId}`);
            if (monthsContainer) {
                if (isChecked) {
                    monthsContainer.classList.remove('hidden');
                } else {
                    monthsContainer.classList.add('hidden');
                }
            }
        }
    },

    toggleEditUserLevel(levelId) {
        const content = document.getElementById(`eu-lvl-content-${levelId}`);
        const icon = document.getElementById(`eu-lvl-icon-${levelId}`);
        
        const isHidden = content.classList.contains('hidden');
        if (isHidden) {
            content.classList.remove('hidden');
            icon.classList.add('rotate-180');
        } else {
            content.classList.add('hidden');
            icon.classList.remove('rotate-180');
        }
    },

    async deleteUser(userId) {
        const user = store.getUsers().find(u => u.id === userId);
        if (confirm(`Are you sure you want to delete "${user ? user.name : 'this user'}"?\n\n⚠️ IMPORTANT: This only deletes their profile data. The account still exists in Firebase Authentication. If you want to reuse this email with a new password, you MUST manually delete the user from the Firebase Console first.`)) {
            store.addLog('Delete User', `${user ? user.role : 'user'}: ${user ? user.name : userId}`);
            await store.deleteUser(userId);
            ui.showToast('User deleted from database');
            AdminPage.refresh();
        }
    },

    showAddSubjectModal() {
        const modalHtml = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-5">
                    <h3 class="text-xl font-bold text-gray-800">Add New Subject</h3>
                    <button onclick="ui.closeModal('add-subject-modal')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
                </div>
                <form id="add-subject-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
                        <input type="text" id="as-name" placeholder="e.g. Math Form 1" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Level</label>
                            <input type="text" id="as-level" placeholder="e.g. Form 1" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Category</label>
                            <input type="text" id="as-category" placeholder="e.g. Math" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Theme Color</label>
                        <div class="flex items-center gap-3">
                            <input type="color" id="as-color" value="#4F46E5" class="h-10 w-20 cursor-pointer rounded border border-gray-300">
                            <span class="text-sm text-gray-500">Select a color to identify this subject easily.</span>
                        </div>
                    </div>
                    <button type="submit" class="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition mt-4">Create Subject</button>
                </form>
            </div>
        `;
        ui.showModal('add-subject-modal', modalHtml);

        document.getElementById('add-subject-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const created = store.addSubject({
                name: document.getElementById('as-name').value,
                level: document.getElementById('as-level').value,
                category: document.getElementById('as-category').value,
                color: document.getElementById('as-color').value
            });
            ui.closeModal('add-subject-modal');
            try {
                await created.saved;
                ui.showToast('Subject created successfully');
            } catch (err) {
                ui.showToast(err.message || 'Could not save the subject — please retry', 'error');
            }
            AdminPage.refresh();
        });
    },

    showEditSubjectModal(subjectId) {
        const subject = store.getSubjects().find(s => s.id === subjectId);
        if (!subject) return;

        const modalHtml = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-5">
                    <h3 class="text-xl font-bold text-gray-800">Edit Subject</h3>
                    <button onclick="ui.closeModal('edit-subject-modal')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
                </div>
                <form id="edit-subject-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
                        <input type="text" id="es-name" value="${subject.name}" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Level</label>
                            <input type="text" id="es-level" value="${subject.level}" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Category</label>
                            <input type="text" id="es-category" value="${subject.category}" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Theme Color</label>
                        <div class="flex items-center gap-3">
                            <input type="color" id="es-color" value="${subject.color || '#4F46E5'}" class="h-10 w-20 cursor-pointer rounded border border-gray-300">
                            <span class="text-sm text-gray-500">Select a color to identify this subject easily.</span>
                        </div>
                    </div>
                    <button type="submit" class="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition mt-4">Save Changes</button>
                </form>
            </div>
        `;
        ui.showModal('edit-subject-modal', modalHtml);

        document.getElementById('edit-subject-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const saving = store.updateSubject(subjectId, {
                name: document.getElementById('es-name').value,
                level: document.getElementById('es-level').value,
                category: document.getElementById('es-category').value,
                color: document.getElementById('es-color').value
            });
            ui.closeModal('edit-subject-modal');
            try {
                await saving;
                ui.showToast('Subject updated successfully');
            } catch (err) {
                ui.showToast(err.message || 'Could not save the subject — please retry', 'error');
            }
            AdminPage.refresh();
        });
    },

    async deleteSubject(subjectId) {
        if (!confirm('Delete this subject? This will remove all associated videos and unassign it from all users.')) return;
        try {
            await store.deleteSubject(subjectId);
            ui.showToast('Subject deleted');
        } catch (err) {
            ui.showToast(err.message || 'Delete did not fully complete — please retry', 'error');
        }
        AdminPage.refresh();
    },

    renderReports() {
        const container = document.getElementById('tab-reports');
        if (!container || container.classList.contains('hidden')) return;

        // Progress is the largest collection in the system and this tab is the
        // only screen that reads all of it. It is NOT fetched automatically:
        // this tab is the admin landing view, so auto-loading would put those
        // thousands of reads back on every single page load — which is the whole
        // point of not subscribing to the collection. Same on-demand pattern as
        // the teacher dashboard's view counts.
        if (!store.isProgressLoaded()) {
            container.innerHTML = `
                <div class="text-center py-16">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 mb-4"><i class="fas fa-chart-line text-xl"></i></div>
                    <h3 class="text-lg font-semibold text-gray-800">Learning Reports</h3>
                    <p class="mt-2 text-sm text-gray-500 max-w-md mx-auto">Report data is loaded on request so it does not count against the daily database quota every time you open the dashboard.</p>
                    <button id="admin-load-reports" onclick="AdminPage.loadReportData()" class="mt-5 px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition">
                        <i class="fas fa-download mr-2"></i>Load report data
                    </button>
                </div>`;
            return;
        }

        const students = store.getUsers().filter(u => u.role === 'student');
        const videos = store.getVideos();
        const progress = store.getProgressRecords ? store.getProgressRecords() : [];
        const subjects = store.getSubjects();
        
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

        // Index progress by studentId for faster lookup O(P)
        const progressByStudent = {};
        progress.forEach(p => {
            if (!progressByStudent[p.studentId]) progressByStudent[p.studentId] = [];
            progressByStudent[p.studentId].push(p);
        });

        // 1. Unwatched This Week (Limit to 50 for performance)
        const unwatchedList = students.filter(s => {
            const sProgress = progressByStudent[s.id] || [];
            if (sProgress.length === 0) return true;
            const lastWatch = sProgress.reduce((latest, p) => {
                const pDate = p.lastWatchedAt ? new Date(p.lastWatchedAt) : new Date(0);
                return pDate > latest ? pDate : latest;
            }, new Date(0));
            return lastWatch < sevenDaysAgo;
        }).slice(0, 50);

        const unwatchedEl = document.getElementById('report-unwatched-list');
        if (unwatchedEl) {
            unwatchedEl.innerHTML = unwatchedList.length === 0 
                ? '<p class="p-8 text-center text-gray-400 text-xs">All students have been active this week!</p>'
                : unwatchedList.map(s => `
                    <div class="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div class="flex items-center gap-3 cursor-pointer group" onclick="AdminPage.viewUser('${s.id}')">
                            <div class="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs group-hover:bg-amber-100 transition-colors">
                                ${s.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div class="font-bold text-gray-800 text-xs group-hover:text-indigo-600 transition-colors">${s.name}</div>
                                <div class="text-[10px] text-gray-400">Last Active: ${s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleDateString() : 'Never'}</div>
                            </div>
                        </div>
                        <button onclick="AdminPage.viewUser('${s.id}')" class="text-[10px] font-bold text-indigo-600 hover:underline">Parent Report</button>
                    </div>
                `).join('') + (unwatchedList.length >= 50 ? '<div class="p-3 text-center text-[10px] text-gray-400 border-t bg-gray-50/50">Showing first 50 results. Use search/filter for more.</div>' : '');
        }

        // 2. Low Progress (< 50%) (Limit to 50 for performance)
        const lowProgressList = [];
        for (const s of students) {
            const sProgress = progressByStudent[s.id] || [];
            const lowVideos = sProgress.filter(p => (p.watchPercentage || p.percentage || 0) < 50);
            if (lowVideos.length > 0) {
                lowProgressList.push({ student: s, lowCount: lowVideos.length });
                if (lowProgressList.length >= 50) break; // Limit reached
            }
        }

        const lowProgressEl = document.getElementById('report-low-progress-list');
        if (lowProgressEl) {
            lowProgressEl.innerHTML = lowProgressList.length === 0
                ? '<p class="p-8 text-center text-gray-400 text-xs">No students with low progress.</p>'
                : lowProgressList.map(item => `
                    <div class="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div class="flex items-center gap-3 cursor-pointer group" onclick="AdminPage.viewUser('${item.student.id}')">
                            <div class="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs group-hover:bg-red-100 transition-colors">
                                ${item.student.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div class="font-bold text-gray-800 text-xs group-hover:text-indigo-600 transition-colors">${item.student.name}</div>
                                <div class="text-[10px] text-red-500 font-medium">${item.lowCount} videos < 50% watched</div>
                            </div>
                        </div>
                        <button onclick="AdminPage.viewUser('${item.student.id}')" class="text-[10px] font-bold text-pink-600 hover:underline">View Details</button>
                    </div>
                `).join('') + (lowProgressList.length >= 50 ? '<div class="p-3 text-center text-[10px] text-gray-400 border-t bg-gray-50/50">Showing first 50 results.</div>' : '');
        }
        // Index progress by videoId for section 3
        const progressByVideo = {};
        progress.forEach(p => {
            if (!progressByVideo[p.videoId]) progressByVideo[p.videoId] = [];
            progressByVideo[p.videoId].push(p);
        });

        // 3. Video Stats - Grouped by Level
        const statsContainer = document.getElementById('report-video-stats-container');
        if (!statsContainer) return;

        // Group videos by level
        const levelGroups = {};
        videos.forEach(v => {
            const subj = subjects.find(s => s.id === v.subjectId);
            const level = subj ? (subj.level || 'Uncategorized') : 'Uncategorized';
            if (!levelGroups[level]) levelGroups[level] = [];
            levelGroups[level].push(v);
        });

        const sortedLevels = Object.keys(levelGroups).sort();
        
        statsContainer.innerHTML = sortedLevels.map(level => {
            const levelVideos = levelGroups[level];
            const safeLevel = level.replace(/\s+/g, '-');
            
            const rowsHtml = levelVideos.map(v => {
                const vProgress = progressByVideo[v.id] || [];
                const totalWatchers = vProgress.length;
                const completedCount = vProgress.filter(p => (p.watchPercentage || p.percentage || 0) >= 90).length;
                const completionRate = totalWatchers > 0 ? Math.round((completedCount / totalWatchers) * 100) : 0;
                
                const totalDuration = vProgress.reduce((sum, p) => sum + (p.watchDuration || 0), 0);
                const avgDuration = totalWatchers > 0 ? Math.round(totalDuration / totalWatchers) : 0;
                
                const lastOpened = vProgress.length > 0 
                    ? new Date(vProgress.reduce((latest, p) => {
                        const pDate = p.lastWatchedAt ? new Date(p.lastWatchedAt) : (p.openedAt ? new Date(p.openedAt) : new Date(0));
                        return pDate > latest ? pDate : latest;
                    }, new Date(0))).toLocaleDateString('en-GB')
                    : '-';

                return `
                    <tr class="hover:bg-gray-50/50 transition-colors">
                        <td class="px-6 py-4 font-bold text-gray-800 text-[11px]">${v.title}</td>
                        <td class="px-6 py-4 font-medium text-[10px]">${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s</td>
                        <td class="px-6 py-4 text-[10px]">${totalWatchers} Students</td>
                        <td class="px-6 py-4 text-gray-400 text-[10px]">${lastOpened}</td>
                    </tr>
                `;
            }).join('');

            return `
                <div class="border-b border-gray-100 last:border-0">
                    <div class="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors" onclick="AdminPage.toggleVideoReportLevel('${safeLevel}')">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center shadow-sm">
                                <i class="fas fa-layer-group text-xs"></i>
                            </div>
                            <div>
                                <h5 class="text-sm font-black text-gray-800">${level}</h5>
                                <p class="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">${levelVideos.length} Videos Analyzed</p>
                            </div>
                        </div>
                        <i class="fas fa-chevron-down text-gray-300 transition-transform duration-300" id="report-lvl-icon-${safeLevel}"></i>
                    </div>
                    <div id="report-lvl-content-${safeLevel}" class="hidden overflow-x-auto bg-gray-50/30">
                        <table class="w-full text-xs text-left">
                            <thead class="bg-white/50 text-gray-400 uppercase font-black text-[9px] border-y border-gray-100">
                                <tr>
                                    <th class="px-6 py-2.5">Video Title</th>
                                    <th class="px-6 py-2.5">Total Duration</th>
                                    <th class="px-6 py-2.5">Total Watchers</th>
                                    <th class="px-6 py-2.5">Last Opened</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100/50">
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join('');
    },

    toggleVideoReportLevel(levelId) {
        const content = document.getElementById(`report-lvl-content-${levelId}`);
        const icon = document.getElementById(`report-lvl-icon-${levelId}`);
        if (!content || !icon) return;
        
        const isHidden = content.classList.contains('hidden');
        if (isHidden) {
            content.classList.remove('hidden');
            icon.classList.add('rotate-180');
        } else {
            content.classList.add('hidden');
            icon.classList.remove('rotate-180');
        }
    },

    showParentSummary(studentId) {
        const student = store.getUsers().find(u => u.id === studentId);
        if (!student) return;

        const progress = store.getAllProgressForStudent ? store.getAllProgressForStudent(studentId) : [];
        const videos = store.getVideos();
        const subjects = store.getSubjects();

        let totalDuration = 0;
        let completedCount = 0;
        const subjectStats = {};

        progress.forEach(p => {
            totalDuration += (p.watchDuration || 0);
            if ((p.watchPercentage || p.percentage || 0) === 100) completedCount++;
            
            const v = videos.find(vid => vid.id === p.videoId);
            if (v) {
                if (!subjectStats[v.subjectId]) subjectStats[v.subjectId] = { watched: 0, total: 0 };
                subjectStats[v.subjectId].watched++;
                subjectStats[v.subjectId].total = videos.filter(vid => vid.subjectId === v.subjectId).length;
            }
        });

        const modalHtml = `
            <div class="p-8 max-w-2xl mx-auto bg-white" id="parent-report-print">
                <div class="flex justify-between items-start border-b-2 border-indigo-600 pb-6 mb-6">
                    <div>
                        <h2 class="text-3xl font-black text-gray-800 uppercase tracking-tight">Learning Summary</h2>
                        <p class="text-indigo-600 font-bold uppercase text-xs tracking-widest mt-1">Academic Progress Report</p>
                    </div>
                    <button onclick="ui.closeModal('parent-summary-modal')" class="text-gray-400 hover:text-gray-600 no-print"><i class="fas fa-times text-xl"></i></button>
                </div>

                <div class="grid grid-cols-2 gap-8 mb-8">
                    <div class="space-y-1">
                        <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Student Name</label>
                        <p class="text-xl font-bold text-gray-800">${student.name}</p>
                    </div>
                    <div class="space-y-1 text-right">
                        <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Report Date</label>
                        <p class="text-lg font-bold text-gray-800">${new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-4 mb-8">
                    <div class="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 text-center">
                        <div class="text-2xl font-black text-indigo-600">${Math.round(totalDuration / 60)}m</div>
                        <div class="text-[9px] font-black text-indigo-400 uppercase tracking-widest mt-1">Total Watch Time</div>
                    </div>
                    <div class="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center">
                        <div class="text-2xl font-black text-emerald-600">${completedCount}</div>
                        <div class="text-[9px] font-black text-emerald-400 uppercase tracking-widest mt-1">Lessons Completed</div>
                    </div>
                    <div class="bg-purple-50 p-4 rounded-2xl border border-purple-100 text-center">
                        <div class="text-2xl font-black text-purple-600">${student.lastLoginAt ? new Date(student.lastLoginAt).toLocaleDateString() : 'Never'}</div>
                        <div class="text-[9px] font-black text-purple-400 uppercase tracking-widest mt-1">Last Login</div>
                    </div>
                </div>

                <div class="mb-8">
                    <h3 class="text-xs font-black text-gray-800 uppercase tracking-widest mb-4 flex items-center">
                        <span class="w-8 h-px bg-gray-200 mr-3"></span>
                        Subject Engagement
                        <span class="w-8 h-px bg-gray-200 ml-3"></span>
                    </h3>
                    <div class="space-y-3">
                        ${Object.keys(subjectStats).map(sid => {
                            const s = subjects.find(sub => sub.id === sid);
                            if (!s) return '';
                            const percent = Math.round((subjectStats[sid].watched / (subjectStats[sid].total || 1)) * 100);
                            return `
                                <div class="flex items-center justify-between">
                                    <span class="text-sm font-bold text-gray-700">${s.name}</span>
                                    <div class="flex items-center gap-3">
                                        <div class="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div class="h-full bg-indigo-500" style="width: ${percent}%"></div>
                                        </div>
                                        <span class="text-xs font-black text-indigo-600 w-8">${percent}%</span>
                                    </div>
                                </div>
                            `;
                        }).join('') || '<p class="text-center py-4 text-gray-400 text-xs italic">No activity recorded for assigned subjects.</p>'}
                    </div>
                </div>

                <div class="bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-gray-200">
                    <h4 class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Teacher's Remarks</h4>
                    <p class="text-sm text-gray-500 italic leading-relaxed">
                        This summary provides a snapshot of the student's interaction with replay materials. Regular review of these lessons significantly improves retention and academic performance.
                    </p>
                </div>
                
                <div class="mt-8 pt-6 border-t border-gray-100 text-center no-print">
                    <button onclick="window.print()" class="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-black transition">
                        <i class="fas fa-print mr-2"></i> Print Report for Parents
                    </button>
                </div>
            </div>
            <style>
                @media print {
                    .no-print { display: none !important; }
                    body * { visibility: hidden; }
                    #parent-report-print, #parent-report-print * { visibility: visible; }
                    #parent-report-print { position: absolute; left: 0; top: 0; width: 100%; }
                }
            </style>
        `;
        ui.showModal('parent-summary-modal', modalHtml);
    },
};
