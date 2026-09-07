// UploadManager - Global Background Upload Queue
const UploadManager = {
    queue: [],
    isUploading: false,
    isMinimized: false,

    init() {
        if (!document.getElementById('upload-manager-widget')) {
            const container = document.createElement('div');
            container.id = 'upload-manager-widget';
            container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 transition-all w-80 pointer-events-none';
            document.body.appendChild(container);
        }
        if (!document.getElementById('upload-notifications')) {
            const notifContainer = document.createElement('div');
            notifContainer.id = 'upload-notifications';
            notifContainer.className = 'fixed top-20 right-4 z-50 flex flex-col gap-2 transition-all w-80 pointer-events-none';
            document.body.appendChild(notifContainer);
        }
    },

    addUpload(file, uploadData) {
        this.init();
        const id = 'up_' + Date.now() + Math.floor(Math.random() * 1000);
        this.queue.push({
            id: id,
            file: file,
            data: uploadData, // { title, subjectId, teacherId, year, month, libraryId, libraryKey, desc }
            progress: 0,
            status: 'pending', // pending, uploading, done, error
            errorMsg: ''
        });

        ui.showToast(`"${uploadData.title}" added to upload queue.`);
        this.renderWidget();

        if (!this.isUploading) {
            this.processNext();
        }
    },

    async processNext() {
        const next = this.queue.find(item => item.status === 'pending');
        if (!next) {
            this.isUploading = false;
            this.renderWidget();
            return;
        }

        this.isUploading = true;
        next.status = 'uploading';
        this.renderWidget();

        try {
            // 1. Create Placeholder
            const bunnyData = await BunnyStreamAPI.createVideo(next.data.libraryId, next.data.libraryKey, next.data.title);
            const videoId = bunnyData.guid;

            // 2. Upload file
            await BunnyStreamAPI.uploadVideo(next.data.libraryId, next.data.libraryKey, videoId, next.file, (progress) => {
                next.progress = Math.round(progress * 100);
                this.renderWidget();
            });

            // 3. Save to Firestore
            await store.addVideo({
                title: next.data.title,
                description: next.data.desc || '',
                subjectId: next.data.subjectId,
                teacherId: next.data.teacherId,
                year: next.data.year,
                month: next.data.month,
                videoProvider: 'bunny',
                bunnyLibraryId: next.data.libraryId,
                bunnyVideoId: videoId,
                date: new Date().toISOString()
            });

            const subject = store.getSubjects().find(s => s.id === next.data.subjectId);
            const subjectName = subject ? `[${subject.level}] ${subject.name}` : next.data.subjectId;
            store.addLog('Upload Video (Background)', `"${next.data.title}" to ${subjectName}`);

            next.status = 'done';
            this.showCompletionNotification(next, true);

            // Refresh UI if necessary
            if (typeof TeacherPage !== 'undefined' && document.getElementById('teacher-levels-list')) {
                TeacherPage.init();
            }
            if (typeof AdminPage !== 'undefined' && document.getElementById('admin-subject-detail') && !document.getElementById('admin-subject-detail').classList.contains('hidden')) {
                // Admin page uses init() or just render users/videos. We can just re-init to be safe, but they might lose their current view.
                // We'll leave it as a no-op or just refresh the list if needed.
                if (typeof AdminPage.renderVideos === 'function') {
                    AdminPage.renderVideos();
                }
            }

        } catch (err) {
            console.error('Background upload failed:', err);
            next.status = 'error';
            next.errorMsg = err.message;
            this.showCompletionNotification(next, false);
        }

        // Process next item immediately
        this.processNext();
    },

    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        this.renderWidget();
    },

    renderWidget() {
        const activeItems = this.queue.filter(q => q.status === 'pending' || q.status === 'uploading');
        const container = document.getElementById('upload-manager-widget');
        if (!container) return;

        if (activeItems.length === 0) {
            container.innerHTML = '';
            return;
        }

        const headerHtml = `
            <div class="pointer-events-auto bg-gray-800 text-white rounded-lg shadow-xl px-4 py-2 flex justify-between items-center cursor-pointer" onclick="UploadManager.toggleMinimize()">
                <span class="text-sm font-semibold"><i class="fas fa-cloud-upload-alt mr-2"></i> ${activeItems.length} Uploads Active</span>
                <button class="text-gray-300 hover:text-white transition"><i class="fas ${this.isMinimized ? 'fa-chevron-up' : 'fa-chevron-down'}"></i></button>
            </div>
        `;

        if (this.isMinimized) {
            container.innerHTML = headerHtml;
            return;
        }

        const itemsHtml = activeItems.map(item => `
            <div class="pointer-events-auto bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden p-3 relative">
                <div class="flex justify-between items-center mb-2">
                    <div class="text-sm font-bold text-gray-800 truncate pr-4" title="${item.data.title}">${item.data.title}</div>
                    <div class="text-xs font-semibold text-${item.status === 'uploading' ? 'indigo-600' : 'gray-400'}">
                        ${item.status === 'uploading' ? item.progress + '%' : 'Pending'}
                    </div>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-2">
                    <div class="bg-indigo-600 h-2 rounded-full transition-all duration-300" style="width: ${item.progress}%"></div>
                </div>
            </div>
        `).join('');

        container.innerHTML = headerHtml + '<div class="flex flex-col gap-2 max-h-64 overflow-y-auto p-1">' + itemsHtml + '</div>';
    },

    showCompletionNotification(item, success) {
        const notifContainer = document.getElementById('upload-notifications');
        if (!notifContainer) return;

        const elId = 'notif_' + item.id;
        const colorClass = success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800';
        const icon = success ? '<i class="fas fa-check-circle text-green-500 mr-3 text-xl"></i>' : '<i class="fas fa-exclamation-circle text-red-500 mr-3 text-xl"></i>';
        const title = success ? 'Upload Complete' : 'Upload Failed';
        const msg = success ? `"${item.data.title}" has been successfully uploaded and saved.` : `"${item.data.title}" failed: ${item.errorMsg}`;

        const html = `
            <div id="${elId}" class="pointer-events-auto ${colorClass} border rounded-lg shadow-lg p-4 flex items-start w-full transform transition-all duration-300 translate-x-4 opacity-0">
                ${icon}
                <div class="flex-1">
                    <h4 class="font-bold text-sm mb-1">${title}</h4>
                    <p class="text-xs opacity-90">${msg}</p>
                </div>
                <button onclick="document.getElementById('${elId}').remove()" class="ml-3 text-gray-400 hover:text-gray-700">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        notifContainer.insertAdjacentHTML('beforeend', html);

        // Trigger animation
        setTimeout(() => {
            const el = document.getElementById(elId);
            if (el) {
                el.classList.remove('translate-x-4', 'opacity-0');
            }
        }, 50);
    }
};
