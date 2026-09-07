const TeacherPage = {
    // Map of videoId -> viewer count, or null until loadViewCounts() is run.
    _viewCounts: null,

    render() {
        return `
            <div id="teacher-dashboard-wrapper" class="space-y-6">
                <div id="teacher-header" class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-800">Teacher Dashboard</h2>
                        <p class="text-gray-500 text-sm">Manage videos for your assigned subjects.</p>
                    </div>
                    <div class="flex flex-wrap gap-2 w-full md:w-auto">
                    </div>
                </div>

                <div id="teacher-levels-list" class="space-y-4">
                    <!-- Dynamic level & subject sections -->
                </div>
            </div>
        `;
    },

    init() {
        this.renderSubjects();
    },

    renderSubjects() {
        const user = auth.getCurrentUser();
        const allSubjects = store.getSubjects();
        const mySubjects = allSubjects.filter(s => (user.subjects || []).includes(s.id));
        const allVideos = store.getVideos();
        const allUsers = store.getUsers();
        const container = document.getElementById('teacher-levels-list');
        if (!container) return;

        if (mySubjects.length === 0) {
            container.innerHTML = `
                <div class="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-folder-open text-2xl text-gray-400"></i>
                    </div>
                    <h3 class="text-lg font-medium text-gray-800 mb-2">No Subjects Assigned</h3>
                    <p class="text-gray-500">Please contact the administrator to get subjects assigned to you.</p>
                </div>
            `;
            // NOTE: We DON'T set data-loaded=true here so it can keep trying 
            // until the database actually returns the assigned subjects.
            return;
        }

        const levels = [...new Set(mySubjects.map(s => s.level))];
        const html = levels.map(level => {
            const levelSubjects = mySubjects.filter(s => s.level === level);
            const safeLevel = level.replace(/\s+/g, '-');

            const subjectsHtml = levelSubjects.map(s => {
                const sId = String(s.id || '').trim();
                const sName = String(s.name || '').toLowerCase().trim();
                const matchedVids = allVideos.filter(v => {
                    const vSubId = String(v.subjectId || v.subject || '').trim();
                    const isMySub = vSubId === sId || vSubId.toLowerCase() === sName;
                    return isMySub && v.teacherId === user.id;
                });
                
                const vCount = matchedVids.length;

                // Group videos by year and month
                const yearsMap = {};
                matchedVids.forEach(v => {
                    const y = v.year || new Date(v.date).getFullYear().toString();
                    const m = v.month || new Date(v.date).toLocaleDateString('default', { month: 'long' });
                    if (!yearsMap[y]) yearsMap[y] = {};
                    if (!yearsMap[y][m]) yearsMap[y][m] = [];
                    yearsMap[y][m].push(v);
                });

                const monthOrder = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                const yearsHtml = Object.keys(yearsMap).sort((a,b) => b - a).map(year => {
                    const monthsMap = yearsMap[year];
                    const monthsHtml = Object.keys(monthsMap).sort((a,b) => monthOrder.indexOf(a) - monthOrder.indexOf(b)).map(month => {
                        const videos = monthsMap[month].sort((a,b) => a.title.localeCompare(b.title));
                        const videosHtml = videos.map(video => `
                            <div class="group flex items-center justify-between p-4 hover:bg-slate-50 transition-all cursor-pointer border-b border-slate-50 last:border-0" onclick="TeacherPage.playVideo('${video.id}')">
                                <div class="flex items-center gap-4">
                                    <div class="w-10 h-10 rounded-2xl bg-white border border-slate-100 text-indigo-500 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                        <i class="fas fa-play text-[9px]"></i>
                                    </div>
                                    <div class="min-w-0">
                                        <div class="text-sm font-medium text-slate-800 truncate">${video.title}</div>
                                        <div class="flex items-center gap-3 mt-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                            <!-- Viewer counts are loaded on demand (see loadViewCounts).
                                                 Counting them for every render would mean reading the
                                                 progress records of every video on every dashboard load. -->
                                            <span><i class="fas fa-eye mr-1"></i>${TeacherPage._viewCounts ? (TeacherPage._viewCounts.get(video.id) || 0) + ' VIEWS' : '— VIEWS'}</span>
                                            <span><i class="fas fa-calendar-alt mr-1"></i>${new Date(video.date).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onclick="event.stopPropagation(); TeacherPage.editVideo('${video.id}')" class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center shadow-sm"><i class="fas fa-edit text-[10px]"></i></button>
                                    <button onclick="event.stopPropagation(); TeacherPage.deleteVideo('${video.id}')" class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center shadow-sm"><i class="fas fa-trash text-[10px]"></i></button>
                                </div>
                            </div>
                        `).join('');

                        return `
                            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-3 hover:shadow-md transition-shadow">
                                <div class="px-5 py-3.5 bg-white flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors" onclick="TeacherPage.toggleSection(event, 'month-${s.id}-${year}-${month}')">
                                    <div class="flex items-center gap-3">
                                        <div class="w-1.5 h-6 bg-indigo-500/20 rounded-full"></div>
                                        <span class="text-[11px] font-black uppercase text-slate-700 tracking-widest">${month}</span>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        <span class="px-2.5 py-1 bg-indigo-50 rounded-full text-[9px] font-black text-indigo-500 border border-indigo-100 uppercase">${videos.length} Videos</span>
                                        <i class="fas fa-chevron-right text-slate-300 text-[10px] transition-transform" id="icon-month-${s.id}-${year}-${month}"></i>
                                    </div>
                                </div>
                                <div id="month-${s.id}-${year}-${month}" class="hidden border-t border-slate-50 bg-slate-50/20">
                                    <div class="divide-y divide-slate-100">
                                        ${videosHtml}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');

                    return `
                        <div class="mb-8 last:mb-0">
                            <div class="flex items-center gap-3 py-4 cursor-pointer group" onclick="TeacherPage.toggleSection(event, 'year-${s.id}-${year}')">
                                <div class="flex items-center gap-3 bg-slate-900 text-white px-6 py-2.5 rounded-2xl shadow-xl hover:bg-indigo-600 hover:scale-105 transition-all active:scale-95">
                                    <i class="fas fa-calendar-check text-indigo-400"></i>
                                    <span class="text-xs font-black uppercase tracking-widest">${year}</span>
                                    <i class="fas fa-chevron-down text-slate-500 text-[10px] ml-1 transition-transform" id="icon-year-${s.id}-${year}"></i>
                                </div>
                                <div class="h-px flex-1 bg-slate-200"></div>
                            </div>
                            <div id="year-${s.id}-${year}" class="hidden pl-6 border-l-2 border-slate-100 ml-7 space-y-1">
                                ${monthsHtml}
                            </div>
                        </div>
                    `;
                }).join('');

                return `
                <div class="bg-white border border-gray-200 rounded-xl mb-3 overflow-hidden transition-all shadow-sm hover:shadow-md">
                    <div class="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors" style="border-left: 4px solid ${s.color || '#4f46e5'}">
                        <div class="flex items-center gap-4 flex-grow" onclick="TeacherPage.toggleSubject(event, '${s.id}')">
                            <div class="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0" style="background-color: ${(s.color || '#4f46e5')}20; color: ${s.color || '#4f46e5'}">
                                <i class="fas fa-book text-lg"></i>
                            </div>
                            <div class="min-w-0">
                                <h4 class="font-bold text-gray-800 truncate">${s.name}</h4>
                                <div class="flex flex-wrap gap-2 mt-1">
                                    <span class="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full uppercase">${s.category || 'No Category'}</span>
                                    <span class="text-[10px] font-bold px-2 py-0.5 bg-pink-100 text-pink-600 rounded-full"><i class="fas fa-video mr-1"></i>${vCount} Videos</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 ml-4">
                            <button onclick="TeacherPage.showAddVideoModal('${s.id}', '${s.name}')" class="text-emerald-500 hover:text-emerald-700 bg-emerald-50 rounded-full w-9 h-9 flex items-center justify-center shadow-sm" title="Add Video"><i class="fas fa-plus"></i></button>
                            <div class="text-gray-300 hover:text-indigo-500 bg-gray-50 rounded-full w-9 h-9 flex items-center justify-center shadow-sm" onclick="TeacherPage.toggleSubject(event, '${s.id}')"><i class="fas fa-chevron-down text-xs transition-transform" id="teacher-subj-icon-${s.id}"></i></div>
                        </div>
                    </div>
                    <div id="teacher-subj-content-${s.id}" class="hidden p-6 border-t border-gray-100 bg-gray-50/30">
                        ${yearsHtml || '<div class="py-6 text-center text-gray-400 text-sm italic">No videos uploaded yet</div>'}
                    </div>
                </div>`;
            }).join('');

            return `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-3">
                <div class="p-4 flex justify-between items-center bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition" onclick="TeacherPage.toggleLevel(event, '${safeLevel}')">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-pink-100 text-pink-600 rounded-lg flex items-center justify-center shadow-sm"><i class="fas fa-layer-group text-lg"></i></div>
                        <div>
                            <h3 class="font-bold text-gray-800 text-lg">${level}</h3>
                            <p class="text-xs text-gray-500 mt-1">${levelSubjects.length} Subjects</p>
                        </div>
                    </div>
                    <i class="fas fa-chevron-down text-gray-400 transition-transform duration-300 transform" id="teacher-lvl-icon-${safeLevel}"></i>
                </div>
                <div id="teacher-lvl-content-${safeLevel}" class="hidden p-6 border-t border-gray-100 bg-gray-50/30">
                    ${subjectsHtml}
                </div>
            </div>`;
        }).join('');

        const viewCountsBar = this._viewCounts
            ? ''
            : `<div class="mb-3 flex justify-end">
                   <button id="teacher-load-views" onclick="TeacherPage.loadViewCounts()"
                       class="text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors">
                       <i class="fas fa-eye mr-1"></i>Load view counts
                   </button>
               </div>`;

        container.innerHTML = viewCountsBar + html;
        container.setAttribute('data-loaded', 'true');
    },

    // Viewer counts are read on demand rather than on every render: counting
    // them means reading the progress records for each video, and this
    // dashboard renders every video the teacher owns at once.
    async loadViewCounts() {
        const btn = document.getElementById('teacher-load-views');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Loading...';
        }

        const user = auth.getCurrentUser();
        const myVideoIds = store.getVideos()
            .filter(v => v.teacherId === user.id)
            .map(v => v.id);

        try {
            this._viewCounts = await store.fetchViewCountsForVideos(myVideoIds);
            this.renderSubjects();
        } catch (err) {
            console.error('[Teacher] Failed to load view counts:', err);
            ui.showToast('Could not load view counts: ' + (err.message || err), 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-eye mr-1"></i>Load view counts';
            }
        }
    },

    toggleLevel(e, levelId) {
        if (e) e.stopPropagation();
        const content = document.getElementById(`teacher-lvl-content-${levelId}`);
        const icon = document.getElementById(`teacher-lvl-icon-${levelId}`);
        if (content) {
            content.classList.toggle('hidden');
            icon.classList.toggle('rotate-180');
        }
    },

    toggleSubject(e, subjectId) {
        if (e) e.stopPropagation();
        const content = document.getElementById(`teacher-subj-content-${subjectId}`);
        const icon = document.getElementById(`teacher-subj-icon-${subjectId}`);
        if (content) {
            content.classList.toggle('hidden');
            icon.classList.toggle('rotate-180');
        }
    },

    toggleSection(e, id) {
        if (e) e.stopPropagation();
        const content = document.getElementById(id);
        const icon = document.getElementById(`icon-${id}`);
        if (content) {
            content.classList.toggle('hidden');
            if (icon) icon.classList.toggle('rotate-180');
        }
    },

    showAddVideoModal(subjectId, subjectName) {
        const modalHtml = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-5">
                    <h3 class="text-xl font-bold text-gray-800">Add Video to ${subjectName}</h3>
                    <button onclick="ui.closeModal('add-video-modal')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
                </div>
                <form id="add-video-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Video Title</label>
                        <input type="text" id="av-title" required placeholder="EX. 2026 F2 SEJ FEB WEEK 1 - MR JACK (BAB 1.3)" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                        <p id="av-title-error" class="text-xs text-red-500 mt-1 hidden"></p>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Upload Year</label>
                            <select id="av-year" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                                ${[new Date().getFullYear()-1, new Date().getFullYear(), new Date().getFullYear()+1].map(y =>
                                    `<option value="${y}" ${y === new Date().getFullYear() ? 'selected' : ''}>${y}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Upload Month</label>
                            <select id="av-month" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                                ${['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => 
                                    `<option value="${m}">${m}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 relative overflow-hidden">
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Video File</label>
                        <input type="file" id="av-video-file" accept="video/*" required class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer">
                        <p class="text-xs text-red-500 mt-2 font-medium">
                            <i class="fas fa-exclamation-triangle mr-1"></i>
                            If upload fails/stucks, please switch to a different Wi-Fi or Mobile Hotspot AND use Incognito/Private mode to re-upload. If issue persists, contact Technical team.
                        </p>
                        
                        <div id="upload-progress-overlay" class="hidden absolute inset-0 bg-white/95 backdrop-blur-sm flex-col items-center justify-center p-6 z-10">
                            <div class="w-full flex justify-between text-xs font-bold text-indigo-600 uppercase mb-3 tracking-wider">
                                <span><i class="fas fa-cloud-upload-alt mr-2"></i>Uploading... Don't close</span>
                                <span id="upload-progress-text">0%</span>
                            </div>
                            <div class="w-full bg-indigo-50 rounded-full h-3 overflow-hidden shadow-inner">
                                <div id="upload-progress-bar" class="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-300 shadow-md" style="width: 0%"></div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea id="av-desc" rows="3" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"></textarea>
                    </div>
                    <button type="submit" class="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition mt-4">Add Video</button>
                </form>
            </div>
        `;
        ui.showModal('add-video-modal', modalHtml);

        document.getElementById('add-video-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fileInput = document.getElementById('av-video-file');
            const file = fileInput.files[0];
            if (!file) {
                alert('Please select a video file');
                return;
            }

            const user = auth.getCurrentUser();
            
            // Check if mapped for THIS specific teacher
            const mappings = store.getBunnySecrets().mappings || [];
            const mapping = mappings.find(m => m.subjectId === subjectId && m.teacherId === user.id);
            console.log("=== UPLOAD DEBUG ===");
            console.log("Current Teacher ID:", user.id);
            console.log("Target Subject ID:", subjectId);
            console.log("All Mappings from Store:", JSON.parse(JSON.stringify(mappings)));
            console.log("Found Mapping:", mapping);
            console.log("====================");
            
            if (!mapping || !mapping.libraryKey) {
                alert('Your teacher account is not configured for direct upload for this subject. Please contact Admin.');
                return;
            }

            const title = document.getElementById('av-title').value;
            const targetYear = document.getElementById('av-year').value;
            const targetMonth = document.getElementById('av-month').value;
            const desc = document.getElementById('av-desc').value;
            const titleError = document.getElementById('av-title-error');
            
            titleError.classList.add('hidden');

            // Check for duplicate title
            const isDuplicate = store.getVideos().some(v => 
                v.subjectId === subjectId &&
                v.teacherId === user.id &&
                v.year === targetYear &&
                v.month === targetMonth &&
                v.title.trim().toLowerCase() === title.trim().toLowerCase()
            );
            if (isDuplicate) {
                titleError.textContent = 'A video with this title already exists in this month.';
                titleError.classList.remove('hidden');
                return;
            }

            UploadManager.addUpload(file, {
                title: title,
                desc: desc,
                subjectId: subjectId,
                teacherId: user.id,
                year: targetYear,
                month: targetMonth,
                libraryId: mapping.bunnyLibraryId,
                libraryKey: mapping.libraryKey
            });

            ui.closeModal('add-video-modal');
        });
    },

    editVideo(videoId) {
        const video = store.getVideos().find(v => v.id === videoId);
        if (!video) return;

        const modalHtml = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-5">
                    <h3 class="text-xl font-bold text-gray-800">Edit Video</h3>
                    <button onclick="ui.closeModal('edit-video-modal')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
                </div>
                <form id="edit-video-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Video Title</label>
                        <input type="text" id="ev-title" value="${video.title}" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                        <p id="ev-title-error" class="text-xs text-red-500 mt-1 hidden"></p>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Year</label>
                            <input type="text" id="ev-year" value="${video.year || ''}" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Month</label>
                            <input type="text" id="ev-month" value="${video.month || ''}" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                        </div>
                    </div>
                    <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 hidden">
                        <input type="hidden" id="ev-bunny-lib" value="${video.bunnyLibraryId || ''}">
                        <input type="hidden" id="ev-bunny-vid" value="${video.bunnyVideoId || ''}">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea id="ev-desc" rows="3" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">${video.description || ''}</textarea>
                    </div>
                    <button type="submit" class="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition mt-4">Save Changes</button>
                </form>
            </div>
        `;
        ui.showModal('edit-video-modal', modalHtml);

        document.getElementById('edit-video-form').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const newTitle = document.getElementById('ev-title').value;
            const targetYear = document.getElementById('ev-year').value;
            const targetMonth = document.getElementById('ev-month').value;
            const titleError = document.getElementById('ev-title-error');
            
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
                titleError.textContent = 'A video with this title already exists in this month.';
                titleError.classList.remove('hidden');
                return;
            }

            store.updateVideo(videoId, {
                title: newTitle,
                year: targetYear,
                month: targetMonth,
                videoProvider: 'bunny',
                bunnyLibraryId: document.getElementById('ev-bunny-lib').value,
                bunnyVideoId: document.getElementById('ev-bunny-vid').value,
                description: document.getElementById('ev-desc').value
            });
            ui.closeModal('edit-video-modal');
            ui.showToast('Video updated successfully');
            TeacherPage.init();
        });
    },

    deleteVideo(videoId) {
        if (confirm('Delete this video?')) {
            store.deleteVideo(videoId);
            ui.showToast('Video deleted');
            TeacherPage.init();
        }
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
                const user = auth.getCurrentUser();
                const allSubjects = store.getSubjects();
                const mySubjects = allSubjects.filter(s => (user.subjects || []).includes(s.id));

                for (const row of results.data) {
                    const title = (row.Title || '').trim();
                    const description = (row.Description || '').trim();
                    const year = (row.Year || new Date().getFullYear()).toString().trim();
                    const month = (row.Month || '').trim();
                    const libId = (row.LibraryID || '').trim();
                    const vidId = (row.VideoID || '').trim();
                    
                    const subjName = (row.Subject || '').trim().toLowerCase();
                    const levelName = (row.Level || '').trim().toLowerCase();

                    if (title && vidId && subjName) {
                        // Find subject in teacher's assigned subjects
                        const subject = mySubjects.find(s => 
                            (s.name.toLowerCase() === subjName || s.id.toLowerCase() === subjName) && 
                            (levelName ? s.level.toLowerCase() === levelName : true)
                        );

                        if (subject) {
                            store.addVideo({
                                title,
                                description,
                                year,
                                month,
                                videoProvider: 'bunny',
                                bunnyLibraryId: libId,
                                bunnyVideoId: vidId,
                                subjectId: subject.id,
                                teacherId: user.id
                            });
                            added++;
                        } else {
                            errors++;
                        }
                    }
                }
                
                if (errors > 0) {
                    ui.showToast(`Imported ${added} videos. ${errors} skipped (Subject not assigned to you).`, 'warning');
                } else {
                    ui.showToast(`Successfully imported ${added} videos.`);
                }
                
                if (typeof store.addLog === 'function') {
                    store.addLog('Teacher Activity', `${user.name} performed bulk video import: ${added} added.`);
                }
                TeacherPage.init();
            }
        });
        event.target.value = ''; // reset
    },

    downloadVideoTemplate() {
        const headers = ['Title', 'Description', 'Year', 'Month', 'LibraryID', 'VideoID', 'Subject', 'Level'];
        const sampleData = [
            ['Testing123', '', '2026', 'January', '657583', '77f2ab7e-5a78-479c-9896-1c4c1e4001c9', 'SEJ Form 1', 'Form 1'],
            ['Testing12345', '', '2026', 'February', '657583', 'c119a2b5-0448-4e12-880c-7b1f3c3a9e22', 'SEJ Form 2', 'Form 2'],
            ['Testing12346', '', '2026', 'March', '657583', 'c119a2b5-0448-4e12-880c-7b1f3c3a9e22', 'SEJ Form 3', 'Form 3']
        ];
        
        let csvContent = headers.join(',') + '\n';
        sampleData.forEach(row => {
            csvContent += row.map(val => `"${val}"`).join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'video_import_template_teacher.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    playVideo(videoId) {
        const video = store.getVideos().find(v => v.id === videoId);
        if (!video) return;

        const modalHtml = `
            <button onclick="TeacherPage.closeVideo()" class="absolute top-4 right-4 md:top-6 md:right-8 z-[100] text-white bg-gray-900 bg-opacity-80 hover:bg-red-600 rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-colors border border-white/20">
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
        if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
};
