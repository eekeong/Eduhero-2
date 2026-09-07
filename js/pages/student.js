const StudentPage = {
    render() {
        return `
            <div id="student-dashboard-wrapper" class="space-y-6 fade-in">
                <div>
                    <h2 class="text-2xl font-bold text-gray-800">My Learning Dashboard</h2>
                    <p class="text-gray-500 text-sm">Welcome back! Continue learning your assigned subjects.</p>
                </div>

                <div id="student-subjects" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <!-- Subject cards -->
                </div>

                <div id="student-subject-view" class="hidden space-y-6">
                    <!-- Subject detail view -->
                </div>
            </div>
        `;
    },

    init() {
        this.renderSubjects();
    },

    renderSubjects() {
        const container = document.getElementById('student-subjects');
        if (!container) return;

        const user = auth.getCurrentUser();
        const allSubjects = store.getSubjects();
        const allVideos = store.getVideos();
        
        // STABILITY FIX: If store isn't fully ready or user data is still missing, show loading
        if (!user || (allSubjects.length === 0 && !store.isReady())) {
            container.innerHTML = `
                <div class="col-span-full py-20 text-center">
                    <i class="fas fa-spinner fa-spin text-4xl text-indigo-500 mb-4"></i>
                    <p class="text-gray-500">Loading your subjects...</p>
                </div>
            `;
            return;
        }

        const mySubjects = allSubjects.filter(s => (user.subjects || []).includes(s.id));
        const detailView = document.getElementById('student-subject-view');
        
        if (detailView) detailView.classList.add('hidden');
        container.classList.remove('hidden');

        if (mySubjects.length === 0) {
            container.innerHTML = `
                <div class="col-span-full bg-white rounded-xl p-10 text-center shadow-sm border border-gray-100">
                    <div class="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
                        <i class="fas fa-book-reader text-3xl text-blue-500"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">No Subjects Yet</h3>
                    <p class="text-gray-500">You haven't been assigned any subjects yet. Check back later!</p>
                </div>
            `;
            container.setAttribute('data-loaded', 'true');
            return;
        }

        const html = mySubjects.map(subject => {
            const videoCount = allVideos.filter(v => v.subjectId === subject.id).length;
            return `
            <div class="bg-white border border-gray-200 rounded-xl mb-3 overflow-hidden transition-all shadow-sm hover:shadow-md">
                <div class="p-4 flex items-center justify-between cursor-pointer transition-colors" style="border-left: 4px solid ${subject.color || '#4f46e5'}" onclick="StudentPage.toggleSubject('${subject.id}')">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm" style="background-color: ${(subject.color || '#4f46e5')}20; color: ${subject.color || '#4f46e5'}">
                            <i class="fas fa-book text-lg"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-gray-800">${subject.name}</h4>
                            <p class="text-xs text-gray-500 mt-1">${subject.level} &bull; ${subject.category}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="text-xs font-medium px-3 py-1 rounded-full border hidden md:inline-block" style="background-color: ${(subject.color || '#4f46e5')}10; color: ${subject.color || '#4f46e5'}; border-color: ${(subject.color || '#4f46e5')}30">${videoCount} Lessons</span>
                        <div class="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-gray-200 text-gray-500 shadow-sm ml-2">
                            <i class="fas fa-chevron-down transition-transform duration-300" id="student-subj-icon-${subject.id}"></i>
                        </div>
                    </div>
                </div>
                <div id="student-subj-content-${subject.id}" class="hidden border-t border-gray-100 p-6 bg-white"></div>
            </div>
            `;
        }).join('');

        container.innerHTML = html;
        container.classList.remove('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'gap-6');
    },

    toggleSubject(subjectId) {
        const allContents = document.querySelectorAll('[id^="student-subj-content-"]');
        const allIcons = document.querySelectorAll('[id^="student-subj-icon-"]');
        
        const content = document.getElementById(`student-subj-content-${subjectId}`);
        const icon = document.getElementById(`student-subj-icon-${subjectId}`);
        
        const isHidden = content.classList.contains('hidden');
        
        allContents.forEach(c => c.classList.add('hidden'));
        allIcons.forEach(i => i.classList.remove('rotate-180'));
        
        if (isHidden) {
            content.classList.remove('hidden');
            icon.classList.add('rotate-180');
            this.openSubject(subjectId);
        }
    },

    openSubject(subjectId) {
        // Skip teacher selection — group all teachers' videos together by year
        const videos = store.getVideos().filter(v => v.subjectId === subjectId);
        const detailView = document.getElementById(`student-subj-content-${subjectId}`);
        const currentUser = auth.getCurrentUser();
        const subjectMonths = (currentUser.months && currentUser.months[subjectId]) || [];

        if (videos.length === 0 || subjectMonths.length === 0) {
            detailView.innerHTML = `
                <div class="bg-gray-50 rounded-xl p-8 text-center border border-gray-100">
                    <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <i class="fas fa-video-slash text-2xl text-gray-400"></i>
                    </div>
                    <h3 class="text-lg font-bold text-gray-800 mb-1">No content available</h3>
                    <p class="text-gray-500">No videos have been assigned to you for this subject yet.</p>
                </div>`;
            return;
        }

        // Group by year (only years that have accessible months)
        const yearsMap = {};
        videos.forEach(v => {
            const m = v.month || new Date(v.date).toLocaleDateString('default', { month: 'long' });
            if (!subjectMonths.includes(m)) return;
            const y = v.year || new Date(v.date).getFullYear().toString();
            if (!yearsMap[y]) yearsMap[y] = [];
            yearsMap[y].push(v);
        });

        const sortedYears = Object.keys(yearsMap).sort((a, b) => b - a);
        if (sortedYears.length === 0) {
            detailView.innerHTML = '<p class="text-gray-500 p-4">No videos available for your assigned months.</p>';
            return;
        }

        const contentHtml = sortedYears.map(year => `
            <div class="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 transition-colors cursor-pointer flex items-center shadow-sm" onclick="StudentPage.openSubjectYear('${subjectId}', '${year}')">
                <div class="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mr-4">
                    <i class="fas fa-calendar text-xl"></i>
                </div>
                <div>
                    <h4 class="font-bold text-gray-800">${year}</h4>
                    <p class="text-xs text-gray-500 mt-0.5">${yearsMap[year].length} videos</p>
                </div>
                <i class="fas fa-chevron-right ml-auto text-gray-300"></i>
            </div>`).join('');

        detailView.innerHTML = `
            <p class="text-sm font-medium text-gray-500 mb-3">Select a Year</p>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${contentHtml}</div>
        `;
    },

    openSubjectYear(subjectId, year) {
        const videos = store.getVideos().filter(v => {
            const vy = v.year || new Date(v.date).getFullYear().toString();
            return v.subjectId === subjectId && vy === year;
        });
        const detailView = document.getElementById(`student-subj-content-${subjectId}`);
        const currentUser = auth.getCurrentUser();
        const subjectMonths = (currentUser.months && currentUser.months[subjectId]) || [];
        const monthExpiry = (currentUser.monthExpiry && currentUser.monthExpiry[subjectId]) || {};
        const today = new Date(); today.setHours(0,0,0,0);

        const monthsMap = {};
        videos.forEach(v => {
            const m = v.month || new Date(v.date).toLocaleDateString('default', { month: 'long' });
            if (!subjectMonths.includes(m)) return;
            if (!monthsMap[m]) monthsMap[m] = [];
            monthsMap[m].push(v);
        });

        const monthOrder = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const sortedMonths = Object.keys(monthsMap).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

        const contentHtml = sortedMonths.length === 0
            ? '<p class="text-gray-500">No videos available for this year.</p>'
            : sortedMonths.map(key => {
                const exp = monthExpiry[key] || {};
                const endDate = exp.end ? new Date(exp.end) : null;
                if (endDate) endDate.setHours(0,0,0,0);
                const startDate = exp.start ? new Date(exp.start) : null;
                if (startDate) startDate.setHours(0,0,0,0);
                
                const isExpired = endDate && endDate < today;
                const isFuture = startDate && startDate > today;

                if (isExpired) {
                    return `
                    <div class="bg-gray-100 border border-gray-200 rounded-xl p-5 flex items-center shadow-sm opacity-60 cursor-not-allowed">
                        <div class="w-12 h-12 bg-red-50 text-red-400 rounded-full flex items-center justify-center mr-4">
                            <i class="fas fa-lock text-xl"></i>
                        </div>
                        <div class="flex-grow">
                            <h4 class="font-bold text-gray-500">${key}</h4>
                            <p class="text-xs text-gray-400 mt-0.5">${monthsMap[key].length} videos &bull; Access expired</p>
                        </div>
                        <span class="text-xs font-bold px-2 py-1 bg-red-100 text-red-600 rounded-full ml-2">Expired</span>
                    </div>`;
                }

                if (isFuture) {
                    const startStr = startDate.toLocaleDateString('en-GB');
                    return `
                    <div class="bg-gray-50 border border-gray-200 rounded-xl p-5 flex items-center shadow-sm opacity-80 cursor-not-allowed">
                        <div class="w-12 h-12 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center mr-4">
                            <i class="fas fa-clock text-xl"></i>
                        </div>
                        <div class="flex-grow">
                            <h4 class="font-bold text-gray-700">${key}</h4>
                            <p class="text-xs text-gray-500 mt-0.5">${monthsMap[key].length} videos &bull; Access starts on ${startStr}</p>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-1 bg-gray-200 text-gray-600 rounded-full ml-2">Scheduled</span>
                    </div>`;
                }

                let daysChip = '';
                if (endDate) {
                    const diff = Math.ceil((endDate - today) / 86400000);
                    const color = diff <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';
                    daysChip = `<span class="text-xs font-bold px-2 py-0.5 ${color} rounded-full ml-2">${diff}d left</span>`;
                }
                return `
                <div class="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 transition-colors cursor-pointer flex items-center shadow-sm" onclick="StudentPage.openSubjectMonth('${subjectId}', '${year}', '${key}')">
                    <div class="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mr-4">
                        <i class="fas fa-calendar-alt text-xl"></i>
                    </div>
                    <div class="flex-grow">
                        <h4 class="font-bold text-gray-800">${key}</h4>
                        <p class="text-xs text-gray-500 mt-0.5">${monthsMap[key].length} videos available</p>
                    </div>
                    ${daysChip}
                    <i class="fas fa-chevron-right ml-auto text-gray-300"></i>
                </div>`;
            }).join('');

        detailView.innerHTML = `
            <div class="flex items-center mb-4">
                <button onclick="StudentPage.openSubject('${subjectId}')" class="flex items-center text-indigo-600 font-medium hover:text-indigo-800 transition mr-4 bg-indigo-50 px-3 py-1.5 rounded-lg text-sm">
                    <i class="fas fa-arrow-left mr-2"></i> Back
                </button>
                <p class="text-sm font-medium text-gray-500">${year} &bull; Select a Month</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${contentHtml}</div>
        `;
    },

    openSubjectMonth(subjectId, year, monthKey) {
        const videos = store.getVideos().filter(v => {
            const vy = v.year || new Date(v.date).getFullYear().toString();
            const vm = v.month || new Date(v.date).toLocaleDateString('default', { month: 'long' });
            return v.subjectId === subjectId && vy === year && vm === monthKey;
        });

        // Sort by Title A-Z
        videos.sort((a, b) => a.title.localeCompare(b.title));

        const currentUser = auth.getCurrentUser();
        const monthExpiry = (currentUser.monthExpiry && currentUser.monthExpiry[subjectId] && currentUser.monthExpiry[subjectId][monthKey]) || {};
        const today = new Date(); today.setHours(0,0,0,0);

        // Build days-remaining banner
        let validityBanner = '';
        if (monthExpiry.end) {
            const endDate = new Date(monthExpiry.end); endDate.setHours(0,0,0,0);
            const diff = Math.ceil((endDate - today) / 86400000);
            const startDate = monthExpiry.start ? new Date(monthExpiry.start) : null;
            if (startDate) startDate.setHours(0,0,0,0);
            
            const startStr = startDate ? startDate.toLocaleDateString('en-GB') : null;
            const endStr = endDate.toLocaleDateString('en-GB');
            
            if (startDate && startDate > today) {
                validityBanner = `<div class="mb-4 px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-700 flex items-center gap-2"><i class="fas fa-lock"></i> Access will be granted on <strong>${startStr}</strong></div>`;
            } else if (diff < 0) {
                validityBanner = `<div class="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2"><i class="fas fa-lock"></i> Access expired on ${endStr}</div>`;
            } else {
                const color = diff <= 7 ? 'amber' : 'green';
                const startLine = startStr ? `Start: ${startStr} &bull; ` : '';
                validityBanner = `<div class="mb-4 px-4 py-2.5 bg-${color}-50 border border-${color}-200 rounded-lg text-xs text-${color}-700 flex items-center gap-2"><i class="fas fa-clock"></i> ${startLine}Valid until: <strong>${endStr}</strong> &bull; <strong>${diff} day${diff !== 1 ? 's' : ''} remaining</strong></div>`;
            }
        }

        const detailView = document.getElementById(`student-subj-content-${subjectId}`);

        const videosHtml = videos.map(video => `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-3">
                <div class="px-4 py-3 flex items-center cursor-pointer hover:bg-gray-50 transition-colors group" onclick="StudentPage.playVideo('${video.id}')">
                    <div class="w-9 h-9 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0 group-hover:bg-indigo-100 transition">
                        <i class="fas fa-play text-sm"></i>
                    </div>
                    <div class="flex-grow min-w-0">
                        <h4 class="text-sm font-bold text-gray-800 truncate">${video.title}</h4>
                        ${video.description ? `<p class="text-xs text-gray-500 mt-0.5 truncate">${video.description}</p>` : ''}
                    </div>
                    <div class="text-xs text-gray-400 font-medium text-right whitespace-nowrap ml-3 hidden md:block">
                        <div>${new Date(video.date).toLocaleDateString()}</div>
                    </div>
                </div>
                <div id="video-container-${video.id}" class="bg-gray-900 hidden w-full"></div>
            </div>
        `).join('');

        detailView.innerHTML = `
            <div class="flex items-center mb-4">
                <button onclick="StudentPage.openSubjectYear('${subjectId}', '${year}')" class="flex items-center text-indigo-600 font-medium hover:text-indigo-800 transition mr-4 bg-indigo-50 px-3 py-1.5 rounded-lg text-sm">
                    <i class="fas fa-arrow-left mr-2"></i> Back
                </button>
                <p class="text-sm font-medium text-gray-500">${year} &bull; <span class="text-gray-800">${monthKey}</span></p>
            </div>
            ${validityBanner}
            <div class="space-y-1 mt-2">
                ${videosHtml || '<p class="text-gray-500">No videos available.</p>'}
            </div>
        `;
    },

    playVideo(videoId) {
        const video = store.getVideos().find(v => v.id === videoId);
        if (!video) return;

        const user = auth.getCurrentUser();
        const subjectMonths = (user.months && user.months[video.subjectId]) || [];
        const m = video.month || new Date(video.date).toLocaleDateString('default', { month: 'long' });
        
        if (user.role !== 'admin' && !subjectMonths.includes(m)) {
            ui.showToast('You do not have access to this video.', 'error');
            return;
        }

        const exp = (user.monthExpiry && user.monthExpiry[video.subjectId] && user.monthExpiry[video.subjectId][m]) || {};
        const today = new Date(); today.setHours(0,0,0,0);
        
        if (exp.start) {
            const startDate = new Date(exp.start);
            startDate.setHours(0,0,0,0);
            if (startDate > today) {
                ui.showToast(`Access to this video starts on ${startDate.toLocaleDateString('en-GB')}.`, 'error');
                return;
            }
        }
        
        if (exp.end) {
            const endDate = new Date(exp.end);
            endDate.setHours(0,0,0,0);
            if (endDate < today) {
                ui.showToast('Access to this video has expired.', 'error');
                return;
            }
        }

        // Tracking: Opened. The progress record IS the view record — there is no
        // separate counter on the video document any more (writing one pushed the
        // document to every student listening to that subject).
        store.trackVideoProgress(user.id, videoId, 'opened');
        
        // Close the previous player properly instead of just ripping the modal out:
        // a bare remove() left the old 'message' listener attached (so the new video's
        // playback was tracked against the old video) and lost the old watch session.
        if (document.getElementById('video-fullscreen-modal')) {
            this.closeVideo(this._currentVideoId);
        }

        const modalHtml = `
            <button onclick="StudentPage.closeVideo('${videoId}')" class="absolute top-4 right-4 md:top-6 md:right-8 z-[100] text-white bg-gray-900 bg-opacity-80 hover:bg-red-600 rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-colors border border-white/20">
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

        ui.showToast('Enjoy learning!');
        this.setupProgressTracking(video);
    },

    closeVideo(videoId) {
        const modal = document.getElementById('video-fullscreen-modal');
        if (!modal) return;

        videoId = videoId || this._currentVideoId;

        // Cleanup any pseudo-fullscreen elements
        document.querySelectorAll('.pseudo-fullscreen').forEach(el => el.classList.remove('pseudo-fullscreen'));

        const iframe = modal.querySelector('iframe');
        if (iframe) iframe.src = 'about:blank';

        // Final session duration track
        if (this._currentSessionStart && videoId) {
            const sessionDuration = Math.floor((Date.now() - this._currentSessionStart) / 1000);
            const user = auth.getCurrentUser();
            if (user) {
                store.trackVideoProgress(user.id, videoId, 'closed', {
                    duration: sessionDuration,
                    percentage: this._currentPercentage || 0
                });
            }
        }
        this._currentSessionStart = null;

        // Remove Bunny Listener if any
        if (this._bunnyListener) {
            window.removeEventListener('message', this._bunnyListener);
            this._bunnyListener = null;
        }

        // Stop the watermark/iframe guard timers and observers for this player.
        // Without this every opened video leaves timers running for the whole session.
        ui.releaseVideoGuards();

        // Reset per-video tracking state so it can't bleed into the next video.
        this._currentVideoId = null;
        this._currentPercentage = 0;
        this._milestonesReached = new Set();

        modal.remove();
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    },

    setupProgressTracking(video) {
        const videoId = video.id;
        const studentId = auth.getCurrentUser().id;
        // Memory to avoid redundant milestone writes
        this._milestonesReached = new Set(
            (store.getProgressRecord(studentId, videoId)?.milestones || [])
        );
        this._currentSessionStart = Date.now();
        this._currentVideoId = videoId;
        this._currentPercentage = 0;

        this.initBunnyPlayer(videoId, studentId);
    },

    initBunnyPlayer(videoId, studentId) {
        const iframe = document.querySelector(`#video-iframe-${videoId}`);
        if (!iframe) return;

        let hasStarted = false;

        this._bunnyListener = (event) => {
            if (!event.origin.includes('bunny.net') && !event.origin.includes('mediadelivery.net')) return;
            
            try {
                const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                
                if (message.context !== 'player.js') return;

                if (message.event === 'play' && !hasStarted) {
                    hasStarted = true;
                    store.trackVideoProgress(studentId, videoId, 'started');
                }

                if (message.event === 'timeupdate' && message.value && message.value.duration) {
                    const percentage = Math.floor((message.value.seconds / message.value.duration) * 100);
                    this._currentPercentage = Math.max(this._currentPercentage || 0, percentage);
                    this.checkMilestones(studentId, videoId, percentage);
                }

                if (message.event === 'ended') {
                    store.trackVideoProgress(studentId, videoId, 'completed');
                    this._milestonesReached.add('100');
                }
            } catch (e) {}
        };

        window.addEventListener('message', this._bunnyListener);
    },



    checkMilestones(studentId, videoId, percentage) {
        // Trigger a database update every 5% of progress to capture exact percentage
        // without spamming the database on every single second.
        const bucket = Math.floor(percentage / 5) * 5; 
        if (bucket > 0 && bucket <= 100 && !this._milestonesReached.has(bucket.toString())) {
            this._milestonesReached.add(bucket.toString());
            store.trackVideoProgress(studentId, videoId, 'milestone', { percentage: percentage });
        }

        // Completion threshold: 90%
        if (percentage >= 90 && !this._milestonesReached.has('completed_90')) {
            this._milestonesReached.add('completed_90');
            store.trackVideoProgress(studentId, videoId, 'completed');
        }
    }
};
