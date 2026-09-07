// Reusable UI Components and Utilities

const ui = {
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');

        // Clean message: Remove "Firebase:" and format technical codes
        let cleanMsg = message || '';
        if (typeof cleanMsg === 'string') {
            cleanMsg = cleanMsg.replace(/Firebase:\s*/gi, '');
            // If it's a code like (auth/weak-password), make it readable
            const codeMatch = cleanMsg.match(/\((auth\/.*?)\)/);
            if (codeMatch) {
                cleanMsg = codeMatch[1].replace('auth/', '').replace(/-/g, ' ');
                cleanMsg = cleanMsg.charAt(0).toUpperCase() + cleanMsg.slice(1);
            }
        }

        const colors = {
            success: 'bg-green-100 text-green-800 border-green-200',
            error: 'bg-red-100 text-red-800 border-red-200',
            info: 'bg-blue-100 text-blue-800 border-blue-200'
        };
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle'
        };

        toast.className = `flex items-center p-4 mb-2 rounded-lg border shadow-sm fade-in ${colors[type]} pointer-events-auto`;
        toast.innerHTML = `
            <i class="fas ${icons[type]} flex-shrink-0 w-5 h-5 mr-3"></i>
            <div class="text-sm font-medium">${cleanMsg}</div>
            <button class="ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex h-8 w-8 hover:bg-white/20 transition-colors" onclick="this.parentElement.remove()">
                <i class="fas fa-times text-current"></i>
            </button>
        `;

        container.appendChild(toast);
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(-10px)';
                toast.style.transition = 'all 0.4s ease-out';
                setTimeout(() => toast.remove(), 400);
            }
        }, 3000);
    },

    showModal(id, content, widthClass = 'max-w-lg') {
        const container = document.getElementById('modals-container');
        const modal = document.createElement('div');
        modal.id = id;
        modal.className = `fixed inset-0 z-50 flex items-center justify-center fade-in bg-gray-900 bg-opacity-50 backdrop-blur-sm px-4`;
        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-2xl w-full ${widthClass} overflow-hidden transform transition-all">
                ${content}
            </div>
        `;
        container.appendChild(modal);

        // Click outside to close
        modal.addEventListener('mousedown', (e) => {
            if (e.target === modal) this.closeModal(id);
        });
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 200);
        }
    },

    // Convert BunnyStream video data to embed URL
    getEmbedUrl(video) {
        if (!video) return '';

        // Use BunnyStream provider
        if (video.bunnyLibraryId && video.bunnyVideoId) {
            // Disable native fullscreen button to protect watermark (students must use our custom FS button)
            return `https://player.mediadelivery.net/embed/${video.bunnyLibraryId}/${video.bunnyVideoId}?autoplay=false&preload=false&fullScreenButton=false`;
        }

        // Fallback: Generic URL (if manually pasted as embed link)
        let url = (video.url || '').trim();
        if (!url) return '';

        if (url.includes('player.mediadelivery.net/embed/') || url.includes('iframe.mediadelivery.net/embed/')) {
            let baseUrl = url;
            if (!baseUrl.includes('autoplay=')) baseUrl += (baseUrl.includes('?') ? '&' : '?') + 'autoplay=false&preload=false';
            if (!baseUrl.includes('fullScreenButton=')) baseUrl += (baseUrl.includes('?') ? '&' : '?') + 'fullScreenButton=false';
            return baseUrl;
        }

        return '';
    },

    getVideoThumbnail(video) {
        if (!video) return '';

        if (video.bunnyLibraryId && video.bunnyVideoId) {
            return `https://player.mediadelivery.net/embed/${video.bunnyLibraryId}/${video.bunnyVideoId}/thumbnail.jpg`;
        }

        return 'https://via.placeholder.com/320x180.png?text=Video';
    },

    renderVideoPlayer(video, videoId = 'default') {
        const embedUrl = this.getEmbedUrl(video);
        if (!embedUrl) {
            return `
                <div class="video-container bg-gray-900 rounded-lg shadow-md flex items-center justify-center">
                    <div class="text-center p-6">
                        <i class="fas fa-exclamation-triangle text-4xl text-yellow-500 mb-3"></i>
                        <h3 class="text-white font-bold">Invalid Video Link</h3>
                        <p class="text-gray-400 text-sm mt-2">Please ask your teacher to check the video URL.</p>
                        <p class="text-gray-500 text-[10px] mt-4">Debug Info: ID=${video.id}</p>
                    </div>
                </div>
            `;
        }

        // Build watermark after next tick so the DOM is ready
        setTimeout(() => {
            ui.applyVideoWatermark(videoId);
            ui.watchVideoLoad(videoId, embedUrl);
        }, 200);

        return `
            <div id="video-wrapper-${videoId}" class="video-container bg-black rounded-lg shadow-md relative w-full aspect-video overflow-hidden group">
                <iframe id="video-iframe-${videoId}" class="w-full h-full absolute inset-0" src="${embedUrl}" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; web-share">
                </iframe>
                
                <!-- Watermark overlay -->
                <div id="watermark-overlay-${videoId}" class="absolute inset-0 z-25 pointer-events-none" style="z-index:25;"></div>

                <!-- Custom Fullscreen Toggle (To keep watermark visible) -->
                <div class="absolute bottom-4 right-4 z-40 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button onclick="ui.toggleVideoFullscreen('${videoId}')" class="p-2.5 bg-black/60 hover:bg-black/90 text-white rounded-lg backdrop-blur-md border border-white/20 shadow-lg transition-all" title="Toggle Fullscreen">
                        <i class="fas fa-expand text-lg" id="fs-icon-${videoId}"></i>
                    </button>
                </div>
            </div>
        `;
    },

    // Decide whether the player is actually blocked by watching the iframe itself.
    //
    // This used to fire a no-cors `fetch` ping at the player's origin and show the
    // "Video Blocked" screen whenever that ping failed. The ping fails for plenty of
    // reasons that have nothing to do with the video — a tracker blocker that only
    // blocks fetch, a slow connection, a captive network — so students were shown a
    // blocked-video screen on top of a video that was playing fine. The iframe's own
    // load result is the thing we actually care about.
    watchVideoLoad(videoId, url) {
        const iframe = document.getElementById(`video-iframe-${videoId}`);
        if (!iframe) return;

        let settled = false;

        const timeoutId = setTimeout(() => {
            if (!settled) this.showVideoFallback(videoId, url);
        }, 12000);

        iframe.addEventListener('load', () => {
            settled = true;
            clearTimeout(timeoutId);
        }, { once: true });

        iframe.addEventListener('error', () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            this.showVideoFallback(videoId, url);
        }, { once: true });

        // Tie the watchdog to the player so closing the video cancels it.
        this._registerVideoGuard(videoId, { interval: timeoutId });
    },

    showVideoFallback(videoId, url) {
        const wrapper = document.getElementById(`video-wrapper-${videoId}`);
        if (!wrapper) return;

        const fallbackId = `video-fallback-${videoId}`;
        if (document.getElementById(fallbackId)) return;

        const fallback = document.createElement('div');
        fallback.id = fallbackId;
        fallback.className = 'absolute inset-0 z-50 flex items-center justify-center bg-gray-900 backdrop-blur-md';
        fallback.innerHTML = `
            <div class="text-center p-6 max-w-md animate-fade-in">
                <div class="w-16 h-16 bg-red-100/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-ban text-3xl text-red-500"></i>
                </div>
                <h3 class="text-white font-bold text-lg mb-2">Video Blocked by Browser or Network</h3>
                <p class="text-gray-400 text-sm mb-5">Your browser's privacy settings, AdBlocker, or your Wi-Fi network has blocked the video player.</p>
                
                <a href="${url}" target="_blank" class="mb-5 inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg hover:scale-105 transition-all">
                    <i class="fas fa-external-link-alt"></i>
                    Play in New Tab (Bypass Block)
                </a>

                <div class="bg-gray-800/80 border border-gray-700 rounded-xl p-4 text-left text-xs text-gray-300 space-y-3">
                    <div class="flex items-start gap-3">
                        <i class="fas fa-shield-alt text-emerald-500 mt-0.5"></i>
                        <div><strong class="text-white block mb-0.5">Fix 1: Turn off Tracking Prevention</strong>Click the Lock 🔒 or Shield 🛡️ icon in the address bar and turn off Tracking Prevention for this site.</div>
                    </div>
                    <div class="flex items-start gap-3">
                        <i class="fas fa-ad text-emerald-500 mt-0.5"></i>
                        <div><strong class="text-white block mb-0.5">Fix 2: Pause AdBlockers</strong>Disable any adblocker extensions and refresh.</div>
                    </div>
                    <div class="flex items-start gap-3">
                        <i class="fas fa-wifi text-emerald-500 mt-0.5"></i>
                        <div><strong class="text-white block mb-0.5">Fix 3: Change Network</strong>Connect to a Mobile Hotspot instead of Home Wi-Fi.</div>
                    </div>
                </div>
            </div>
        `;
        wrapper.appendChild(fallback);
    },

    toggleVideoFullscreen(videoId) {
        const wrapper = document.getElementById(`video-wrapper-${videoId}`);
        const icon = document.getElementById(`fs-icon-${videoId}`);
        if (!wrapper) return;

        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isCurrentlyFs = document.fullscreenElement || document.webkitFullscreenElement || wrapper.classList.contains('pseudo-fullscreen');

        if (!isCurrentlyFs) {
            // ENTER FULLSCREEN
            if (wrapper.requestFullscreen) {
                wrapper.requestFullscreen().catch(() => {
                    // Fallback to pseudo if rejected
                    wrapper.classList.add('pseudo-fullscreen');
                });
            } else if (wrapper.webkitRequestFullscreen) {
                wrapper.webkitRequestFullscreen();
            } else {
                // iPhone/Mobile fallback: CSS Pseudo Fullscreen
                wrapper.classList.add('pseudo-fullscreen');
            }

            // iOS specific: try to lock orientation
            if (isIos && screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(() => { });
            }

            if (icon) {
                icon.classList.remove('fa-expand');
                icon.classList.add('fa-compress');
            }
        } else {
            // EXIT FULLSCREEN
            if (document.fullscreenElement || document.webkitFullscreenElement) {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            }

            wrapper.classList.remove('pseudo-fullscreen');

            if (isIos && screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }

            if (icon) {
                icon.classList.remove('fa-compress');
                icon.classList.add('fa-expand');
            }
        }

        // Global event listener to sync icon state if user uses ESC key or system gesture
        const syncState = () => {
            const stillFs = document.fullscreenElement || document.webkitFullscreenElement || wrapper.classList.contains('pseudo-fullscreen');
            if (!stillFs && icon) {
                icon.classList.remove('fa-compress');
                icon.classList.add('fa-expand');
                document.removeEventListener('fullscreenchange', syncState);
                document.removeEventListener('webkitfullscreenchange', syncState);
            }
        };
        document.addEventListener('fullscreenchange', syncState);
        document.addEventListener('webkitfullscreenchange', syncState);
    },

    applyVideoWatermark(videoId) {
        const overlay = document.getElementById(`watermark-overlay-${videoId}`);
        if (!overlay) return;

        const settings = store.getSettings();
        const logoUrl = settings.logoUrl || '';
        const currentUser = auth.getCurrentUser ? auth.getCurrentUser() : null;
        const userName = currentUser ? currentUser.name : '';

        const tileSize = 450;
        const canvas = document.createElement('canvas');
        canvas.width = tileSize;
        canvas.height = tileSize;
        const ctx = canvas.getContext('2d');

        const drawTile = (logoImg) => {
            ctx.clearRect(0, 0, tileSize, tileSize);
            ctx.save();
            ctx.translate(tileSize / 2, tileSize / 2);
            ctx.rotate(-Math.PI / 5);
            ctx.translate(-tileSize / 2, -tileSize / 2);

            if (logoImg) {
                const logoSize = 60;
                ctx.globalAlpha = 0.20;
                ctx.drawImage(logoImg, (tileSize - logoSize) / 2, tileSize / 2 - 70, logoSize, logoSize);
            }

            if (userName) {
                ctx.globalAlpha = 0.20;
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 18px Inter, Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(userName, tileSize / 2, tileSize / 2 + 50);
            }

            ctx.restore();

            const dataUrl = canvas.toDataURL('image/png');
            overlay.style.backgroundImage = `url(${dataUrl})`;
            overlay.style.backgroundRepeat = 'repeat';
            overlay.style.backgroundSize = `${tileSize}px ${tileSize}px`;

            // SECURITY: Prevent student from hiding or deleting the watermark via F12
            this.protectWatermark(overlay, dataUrl, tileSize, videoId);

            // SECURITY: Also protect the sibling iframe attributes
            const iframeId = overlay.id.replace('watermark-overlay-', 'video-iframe-');
            const iframe = document.getElementById(iframeId);
            if (iframe) this.protectIframe(iframe, videoId);
        };

        if (logoUrl) {
            const img = new Image();
            img.onload = () => drawTile(img);
            img.onerror = () => drawTile(null);
            img.src = logoUrl;
        } else {
            drawTile(null);
        }
    },

    // Guards (intervals + MutationObservers) created for an open player, keyed by
    // videoId. They MUST be released when the player closes — otherwise every video
    // the user opens leaves two 500ms timers and four observers running for the rest
    // of the session, writing styles onto detached nodes and steadily slowing the app.
    _videoGuards: {},

    _registerVideoGuard(videoId, guard) {
        const key = videoId || 'default';
        if (!this._videoGuards[key]) this._videoGuards[key] = { intervals: [], observers: [] };
        if (guard.interval) this._videoGuards[key].intervals.push(guard.interval);
        if (guard.observer) this._videoGuards[key].observers.push(guard.observer);
    },

    // Release the guards for one video, or for every video when called with no id.
    releaseVideoGuards(videoId) {
        const keys = videoId ? [videoId] : Object.keys(this._videoGuards);
        keys.forEach(key => {
            const guard = this._videoGuards[key];
            if (!guard) return;
            guard.intervals.forEach(id => { clearInterval(id); clearTimeout(id); });
            guard.observers.forEach(obs => {
                try { obs.disconnect(); } catch (e) {}
            });
            delete this._videoGuards[key];
        });
    },

    protectWatermark(element, dataUrl, tileSize, videoId) {
        if (!element || element.dataset.protected) return;
        element.dataset.protected = "true";

        const originalParent = element.parentElement || document.getElementById(element.id.replace('watermark-overlay-', 'video-wrapper-'));
        if (!originalParent) return;

        // 1. Lock styles to prevent CSS-based hiding (opacity, visibility, z-index, background-image, etc.)
        const lockStyles = () => {
            element.style.setProperty('display', 'block', 'important');
            element.style.setProperty('opacity', '1', 'important');
            element.style.setProperty('visibility', 'visible', 'important');
            element.style.setProperty('pointer-events', 'none', 'important');
            element.style.setProperty('background-image', `url(${dataUrl})`, 'important');
            element.style.setProperty('background-size', `${tileSize}px ${tileSize}px`, 'important');
            element.style.setProperty('background-repeat', 'repeat', 'important');
            element.style.setProperty('position', 'absolute', 'important');
            element.style.setProperty('inset', '0', 'important');
            element.style.setProperty('z-index', '25', 'important');
            element.style.setProperty('width', '100%', 'important');
            element.style.setProperty('height', '100%', 'important');
        };

        // 2. Parent Observer to detect if element is deleted or moved
        const parentObserver = new MutationObserver((mutations) => {
            let needsRestore = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    const removed = Array.from(mutation.removedNodes);
                    if (removed.includes(element) || !originalParent.contains(element)) {
                        needsRestore = true;
                        break;
                    }
                }
            }
            if (needsRestore) {
                originalParent.appendChild(element);
                lockStyles();
            }
        });
        parentObserver.observe(originalParent, { childList: true, subtree: true });

        // 3. Self Observer to watch the element itself for style/attribute tampering
        const selfObserver = new MutationObserver(() => {
            lockStyles();
        });
        selfObserver.observe(element, { attributes: true, attributeFilter: ['style', 'class', 'id'] });

        // Initial lock
        lockStyles();

        // 4. Fail-safe: Rapid periodic checks (every 500ms) to ensure absolute presence & correct styling
        const intervalId = setInterval(() => {
            if (!originalParent.contains(element)) {
                originalParent.appendChild(element);
            }
            lockStyles();
        }, 500);

        this._registerVideoGuard(videoId, { interval: intervalId });
        this._registerVideoGuard(videoId, { observer: parentObserver });
        this._registerVideoGuard(videoId, { observer: selfObserver });
    },

    protectIframe(iframe, videoId) {
        if (!iframe || iframe.dataset.protected) return;
        iframe.dataset.protected = "true";

        const originalParent = iframe.parentElement;
        if (!originalParent) return;

        // Force strictly safe iframe styles & attributes (prevent PiP, z-index bypass, and custom controls hijacking)
        const lockIframeStyles = () => {
            iframe.style.setProperty('z-index', '1', 'important');
            iframe.style.setProperty('position', 'absolute', 'important');
            iframe.style.setProperty('inset', '0', 'important');
            iframe.style.setProperty('display', 'block', 'important');
            iframe.style.setProperty('opacity', '1', 'important');
            iframe.style.setProperty('visibility', 'visible', 'important');
        };

        const lockAttributes = () => {
            // Force disable native fullscreen and PiP
            if (iframe.hasAttribute('allowfullscreen')) iframe.removeAttribute('allowfullscreen');
            if (iframe.hasAttribute('webkitallowfullscreen')) iframe.removeAttribute('webkitallowfullscreen');
            if (iframe.hasAttribute('mozallowfullscreen')) iframe.removeAttribute('mozallowfullscreen');

            // Strictly enforce safe 'allow' list (removes picture-in-picture)
            const targetAllow = 'accelerometer; autoplay; encrypted-media; gyroscope; web-share';
            if (iframe.getAttribute('allow') !== targetAllow) {
                iframe.setAttribute('allow', targetAllow);
            }
            lockIframeStyles();
        };

        // Watch parent to prevent iframe deletion/relocation in DOM
        const parentObserver = new MutationObserver((mutations) => {
            let needsRestore = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    const removed = Array.from(mutation.removedNodes);
                    if (removed.includes(iframe) || !originalParent.contains(iframe)) {
                        needsRestore = true;
                        break;
                    }
                }
            }
            if (needsRestore) {
                // Restore in correct layering order (before watermark overlay)
                const watermarkId = iframe.id.replace('video-iframe-', 'watermark-overlay-');
                const watermark = document.getElementById(watermarkId);
                if (watermark && originalParent.contains(watermark)) {
                    originalParent.insertBefore(iframe, watermark);
                } else {
                    originalParent.appendChild(iframe);
                }
                lockAttributes();
            }
        });
        parentObserver.observe(originalParent, { childList: true, subtree: true });

        // Watch self for attribute/style tampering
        const selfObserver = new MutationObserver(() => {
            lockAttributes();
        });
        selfObserver.observe(iframe, { attributes: true });

        // Fail-safe: Rapid periodic checks (every 500ms)
        const intervalId = setInterval(() => {
            if (!originalParent.contains(iframe)) {
                const watermarkId = iframe.id.replace('video-iframe-', 'watermark-overlay-');
                const watermark = document.getElementById(watermarkId);
                if (watermark && originalParent.contains(watermark)) {
                    originalParent.insertBefore(iframe, watermark);
                } else {
                    originalParent.appendChild(iframe);
                }
            }
            lockAttributes();
        }, 500);

        this._registerVideoGuard(videoId, { interval: intervalId });
        this._registerVideoGuard(videoId, { observer: parentObserver });
        this._registerVideoGuard(videoId, { observer: selfObserver });

        // Initial lock
        lockAttributes();
    },

    showChangePasswordModal() {
        const modalHtml = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-5">
                    <h3 class="text-xl font-bold text-gray-800">Change Password</h3>
                    <button onclick="ui.closeModal('change-pw-modal')" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
                </div>
                <form id="change-pw-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                        <input type="password" id="cpw-new" required minlength="6" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Min. 6 characters">
                        <p class="text-[10px] text-gray-400 mt-1"><i class="fas fa-info-circle mr-1"></i>Must be at least 6 letters or numbers.</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                        <input type="password" id="cpw-confirm" required minlength="6" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Confirm new password">
                    </div>
                    <button type="submit" class="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition mt-4 shadow-sm">Update Password</button>
                </form>
            </div>
        `;
        this.showModal('change-pw-modal', modalHtml);

        document.getElementById('change-pw-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPw = document.getElementById('cpw-new').value;
            const confirmPw = document.getElementById('cpw-confirm').value;

            if (newPw !== confirmPw) {
                this.showToast('Passwords do not match!', 'error');
                return;
            }

            const btn = e.target.querySelector('button[type="submit"]');
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            btn.disabled = true;

            try {
                await auth.changePassword(newPw);

                // Sync new password to Firestore for Admin visibility
                const user = auth.getCurrentUser();
                if (user) {
                    store.updateUser(user.id, { password: newPw });
                }

                this.closeModal('change-pw-modal');
                this.showToast('Password updated successfully');
            } catch (err) {
                this.showToast(err.message, 'error');
            } finally {
                if (btn) {
                    btn.innerHTML = orig;
                    btn.disabled = false;
                }
            }
        });
    },

    showForceChangePasswordModal() {
        const modalHtml = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-5">
                    <h3 class="text-xl font-bold text-gray-800">Welcome! Please Change Your Password</h3>
                </div>
                <p class="text-sm text-gray-600 mb-4">For security reasons, you must change your default password before continuing.</p>
                <form id="force-change-pw-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                        <input type="password" id="fcpw-new" required minlength="6" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Min. 6 characters">
                        <p class="text-[10px] text-gray-400 mt-1"><i class="fas fa-info-circle mr-1"></i>Must be at least 6 letters or numbers.</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                        <input type="password" id="fcpw-confirm" required minlength="6" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Confirm new password">
                    </div>
                    <button type="submit" class="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition mt-4 shadow-sm">Update Password</button>
                </form>
            </div>
        `;
        // Use showModal but remove click outside to close
        const container = document.getElementById('modals-container');
        const modal = document.createElement('div');
        modal.id = 'force-change-pw-modal';
        modal.className = `fixed inset-0 z-50 flex items-center justify-center fade-in bg-gray-900 bg-opacity-80 backdrop-blur-sm px-4`;
        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
                ${modalHtml}
            </div>
        `;
        container.appendChild(modal);

        document.getElementById('force-change-pw-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPw = document.getElementById('fcpw-new').value;
            const confirmPw = document.getElementById('fcpw-confirm').value;

            if (newPw !== confirmPw) {
                this.showToast('Passwords do not match!', 'error');
                return;
            }

            const btn = e.target.querySelector('button[type="submit"]');
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            btn.disabled = true;

            try {
                await auth.changePassword(newPw);

                // Sync new password to Firestore for Admin visibility
                const user = auth.getCurrentUser();
                if (user) {
                    store.updateUser(user.id, { password: newPw });
                }

                this.closeModal('force-change-pw-modal');
                this.showToast('Password updated successfully');

                // Re-render app view
                App.setupAppView();
            } catch (err) {
                this.showToast(err.message, 'error');
            } finally {
                if (btn) {
                    btn.innerHTML = orig;
                    btn.disabled = false;
                }
            }
        });
    },

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Copied to clipboard!');
        }).catch(err => {
            console.error('Copy failed:', err);
            this.showToast('Failed to copy', 'error');
        });
    },

    formatRelativeTime(dateString) {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';

        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;

        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays}d ago`;

        return date.toLocaleDateString();
    }
};
