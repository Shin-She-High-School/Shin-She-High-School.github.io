let currentIndependentPage = null;
const teacherCache = new Map();
window.checkIsTeacherAccount = async function(cleanSid) {
    if (!cleanSid) return false;
    const lowerSid = cleanSid.toLowerCase().trim();
    if (teacherCache.has(lowerSid)) {
        return teacherCache.get(lowerSid);
    }
    if (!dbClient) return false;
    try {
        const { data, error } = await dbClient
            .from('teacher_whitelist')
            .select('teacher_id')
            .ilike('teacher_id', lowerSid)
            .maybeSingle();
        const isTeacher = !!(!error && data);
        teacherCache.set(lowerSid, isTeacher);
        return isTeacher;
    } catch (e) {
        return false;
    }
};
window.handleTeacherTypeChange = function() {
    const teacherType = document.getElementById('authTeacherType')?.value;
    const regYearGroup = document.getElementById('regYearGroup');
    const regDeptGroup = document.getElementById('regDeptGroup');
    if (teacherType === 'tutor') {
        if (regYearGroup) regYearGroup.style.display = 'block';
        if (regDeptGroup) regDeptGroup.style.display = 'block';
    } else {
        if (regYearGroup) regYearGroup.style.display = 'none';
        if (regDeptGroup) regDeptGroup.style.display = 'none';
    }
};
let checkHintDebounceTimer = null;
window.checkAuthIdRoleHint = function() {
    clearTimeout(checkHintDebounceTimer);
    checkHintDebounceTimer = setTimeout(async () => {
        const sidInput = document.getElementById('authID')?.value.trim();
        const hintEl = document.getElementById('authRoleHint');
        const regTeacherRoleGroup = document.getElementById('regTeacherRoleGroup');
        const regYearGroup = document.getElementById('regYearGroup');
        const regDeptGroup = document.getElementById('regDeptGroup');
        const isReg = document.getElementById('regFields')?.style.display === 'block';
        if (!sidInput) {
            if (hintEl) hintEl.innerHTML = '';
            if (regTeacherRoleGroup) regTeacherRoleGroup.style.display = 'none';
            if (regYearGroup) regYearGroup.style.display = 'block';
            if (regDeptGroup) regDeptGroup.style.display = 'block';
            return;
        }
        const cleanSid = sidInput.split('@')[0].toLowerCase().trim();
        const isTeacher = await checkIsTeacherAccount(cleanSid);
        if (isTeacher) {
            if (hintEl) hintEl.innerHTML = '👨‍🏫 教師帳號';
            if (isReg) {
                if (regTeacherRoleGroup) regTeacherRoleGroup.style.display = 'block';
                handleTeacherTypeChange();
            }
        } else {
            if (hintEl) hintEl.innerHTML = '';
            if (isReg) {
                if (regTeacherRoleGroup) regTeacherRoleGroup.style.display = 'none';
                if (regYearGroup) regYearGroup.style.display = 'block';
                if (regDeptGroup) regDeptGroup.style.display = 'block';
            }
        }
    }, 200);
};
window.formatDateTime = function(isoStr) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '-';
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`;
};
window.openIndependentPage = function(pageType) {
    currentIndependentPage = pageType;
    const mainDashboard = document.getElementById('mainDashboardView');
    const announcePage = document.getElementById('pageAnnounceView');
    const auditPage = document.getElementById('pageAuditLogView');
    const feedbackPage = document.getElementById('pageFeedbackListView');
    const announceMgmtPage = document.getElementById('pageAnnounceMgmtView');
    if (mainDashboard) mainDashboard.classList.add('hidden');
    if (announcePage) announcePage.classList.add('hidden');
    if (auditPage) auditPage.classList.add('hidden');
    if (feedbackPage) feedbackPage.classList.add('hidden');
    if (announceMgmtPage) announceMgmtPage.classList.add('hidden');
    if (pageType === 'announceView') {
        if (announcePage) announcePage.classList.remove('hidden');
        renderIndependentAnnouncements();
    } else if (pageType === 'auditLogView') {
        if (auditPage) auditPage.classList.remove('hidden');
        refreshAuditLogs();
    } else if (pageType === 'feedbackListView') {
        if (feedbackPage) feedbackPage.classList.remove('hidden');
        refreshFeedbackList();
    } else if (pageType === 'announceMgmtView') {
        if (announceMgmtPage) announceMgmtPage.classList.remove('hidden');
        cancelAnnounceEdit();
        renderAdminAnnounceList();
    }
    updateHash();
    scrollToTop();
};
window.closeIndependentPage = function() {
    const mainDashboard = document.getElementById('mainDashboardView');
    const announcePage = document.getElementById('pageAnnounceView');
    const auditPage = document.getElementById('pageAuditLogView');
    const feedbackPage = document.getElementById('pageFeedbackListView');
    const announceMgmtPage = document.getElementById('pageAnnounceMgmtView');
    if (announcePage) announcePage.classList.add('hidden');
    if (auditPage) auditPage.classList.add('hidden');
    if (feedbackPage) feedbackPage.classList.add('hidden');
    if (announceMgmtPage) announceMgmtPage.classList.add('hidden');
    if (mainDashboard) mainDashboard.classList.remove('hidden');
    currentIndependentPage = null;
    updateHash();
    scrollToTop();
};
window.switchAuthMode = function() {
    const regFields = document.getElementById('regFields');
    const authTitle = document.getElementById('authTitle');
    const authSwitchLink = document.getElementById('authSwitchLink');
    const authBtn = document.querySelector('#authWorkspace .auth-btn-primary');
    if (regFields.style.display === 'none') {
        regFields.style.display = 'block';
        authTitle.innerText = '帳號註冊';
        authSwitchLink.innerText = '已有帳號？點此登入';
        if (authBtn) authBtn.innerText = '確認註冊';
        initDropdowns(false);
    } else {
        regFields.style.display = 'none';
        authTitle.innerText = '帳號登入';
        authSwitchLink.innerText = '尚未有帳號？點此註冊';
        if (authBtn) authBtn.innerText = '確認登入';
    }
    checkAuthIdRoleHint();
};
const SB_URL = "https://tsavuxtqwfugoraomoyc.supabase.co",
    SB_KEY = "sb_publishable_ojrdIB0TeCnl8eZXbzWsdQ_2W3JB3xT",
    EMAIL_DOMAIN = "@sshs.tc.edu.tw",
    YEAR_OPTIONS = ["113", "114"],
    DEPT_OPTIONS = [
        "普通科(理工生醫群)-1",
        "普通科(理工生醫群)-2",
        "普通科(文史法商群)-3",
        "普通科(文史法商群)-4",
        "體育班-5",
        "體育班-6",
        "農經科-7",
        "園藝科-8",
        "商經科-9",
        "資處科-10"
    ],
    mapping = {
        cat: {
            "dept": { text: "部定必修", class: "bg-dept-main" },
            "dept_sports": { text: "體育專業必修", class: "bg-amber-100 text-amber-800 border border-amber-200" },
            "sch_req": { text: "校定必修", class: "bg-sch-req-main" },
            "sch_opt": { text: "校定選修", class: "bg-sch-opt-main" }
        },
        type: { 1: "一般科目", 2: "專業科目", 3: "實習科目" },
        role: { student: "學生", teacher: "教師", admin: "管理員" }
    };
let curriculums = {};
let curriculum = [], dbClient = null;
try {
    if (typeof supabase !== 'undefined' && supabase) dbClient = supabase.createClient(SB_URL, SB_KEY);
    else if (typeof window.supabase !== 'undefined' && window.supabase) dbClient = window.supabase.createClient(SB_URL, SB_KEY);
} catch (e) {}
let currentUser = null, DEPT_THRESHOLD = 0, userDBRecord = null, activeStudentDBRecord = null,
    hasLoadedInitialData = false, lastLoadedStudentId = null, adminListData = [], auditLogsData = [], userFeedbacksData = [], announcementsData = [], teacherNames = [],
    isViewingClassList = false, editingStudentId = null, confirmAction = null,
    currentYear = "113", currentDept = "普通科(理工生醫群)-1", lastUserId = null, currentLayoutMode = "subject",
    currentUncheckedCredits = [];
let realtimeGradChecksChannel = null, realtimeFeedbacksChannel = null, realtimeAuditLogsChannel = null, realtimeAnnouncementsChannel = null;
window.isWebSocketAllowed = function() {
    if (typeof WebSocket === 'undefined') return false;
    try {
        const testWs = new WebSocket('wss://tsavuxtqwfugoraomoyc.supabase.co/realtime/v1/websocket?apikey=' + SB_KEY + '&vsn=2.0.0');
        testWs.close();
        return true;
    } catch (e) {
        return false;
    }
};
window.setupRealtimeSubscriptions = function() {
    if (!dbClient) return;
    window.cleanupRealtimeSubscriptions();
    try {
        if (!window.isWebSocketAllowed()) return;
        realtimeGradChecksChannel = dbClient
            .channel('realtime_grad_checks')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'grad_checks' }, (payload) => {
                const eventType = payload.eventType;
                const newRow = payload.new;
                const oldRow = payload.old;
                if (eventType === 'INSERT') {
                    if (!adminListData.some(item => item.id === newRow.id)) adminListData.push(newRow);
                } else if (eventType === 'UPDATE') {
                    const idx = adminListData.findIndex(item => item.id === newRow.id);
                    if (idx !== -1) adminListData[idx] = newRow;
                    else adminListData.push(newRow);
                } else if (eventType === 'DELETE') {
                    adminListData = adminListData.filter(item => item.id !== oldRow.id);
                }
                if (isViewingClassList) renderAdminTable();
                const activeTargetId = editingStudentId ? (activeStudentDBRecord?.id || editingStudentId) : currentUser?.id;
                if (newRow && (newRow.id === activeTargetId || newRow.student_id === activeTargetId)) {
                    if (editingStudentId) activeStudentDBRecord = newRow;
                    else userDBRecord = newRow;
                    renderUserStatusDisplay();
                    if (!isViewingClassList && !currentIndependentPage) applyLoadedChecks(newRow.credits_json || {});
                }
            })
            .subscribe();
        realtimeFeedbacksChannel = dbClient
            .channel('realtime_user_feedbacks')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_feedbacks' }, (payload) => {
                const eventType = payload.eventType;
                const newRow = payload.new;
                const oldRow = payload.old;
                if (eventType === 'INSERT') userFeedbacksData.unshift(newRow);
                else if (eventType === 'UPDATE') {
                    const idx = userFeedbacksData.findIndex(item => item.id === newRow.id);
                    if (idx !== -1) userFeedbacksData[idx] = newRow;
                } else if (eventType === 'DELETE') {
                    userFeedbacksData = userFeedbacksData.filter(item => item.id !== oldRow.id);
                }
                if (currentIndependentPage === 'feedbackListView') renderFeedbackList();
            })
            .subscribe();
        realtimeAuditLogsChannel = dbClient
            .channel('realtime_audit_logs')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, (payload) => {
                if (payload.new) {
                    auditLogsData.unshift(payload.new);
                    if (currentIndependentPage === 'auditLogView') renderAuditLogList();
                }
            })
            .subscribe();
        realtimeAnnouncementsChannel = dbClient
            .channel('realtime_announcements')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
                fetchAnnouncements();
            })
            .subscribe();
    } catch (e) {}
};
window.cleanupRealtimeSubscriptions = function() {
    if (!dbClient) return;
    try {
        if (realtimeGradChecksChannel) dbClient.removeChannel(realtimeGradChecksChannel);
        if (realtimeFeedbacksChannel) dbClient.removeChannel(realtimeFeedbacksChannel);
        if (realtimeAuditLogsChannel) dbClient.removeChannel(realtimeAuditLogsChannel);
        if (realtimeAnnouncementsChannel) dbClient.removeChannel(realtimeAnnouncementsChannel);
    } catch (e) {}
    realtimeGradChecksChannel = null;
    realtimeFeedbacksChannel = null;
    realtimeAuditLogsChannel = null;
    realtimeAnnouncementsChannel = null;
};
window.isAnnouncementVisibleNow = function(a) {
    if (!a.is_active) return false;
    const now = new Date().getTime();
    if (a.published_at && now < new Date(a.published_at).getTime()) return false;
    if (a.start_at && now < new Date(a.start_at).getTime()) return false;
    if (a.end_at && now > new Date(a.end_at).getTime()) return false;
    return true;
};
window.formatDateTimeInput = function(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
window.sortAnnouncementsData = function() {
    announcementsData.sort((a, b) => {
        const orderA = a.sort_order !== undefined && a.sort_order !== null ? a.sort_order : 0;
        const orderB = b.sort_order !== undefined && b.sort_order !== null ? b.sort_order : 0;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
};
window.fetchAnnouncements = async function() {
    if (!dbClient) return;
    try {
        const { data, error } = await dbClient.from('announcements').select('*');
        if (!error && data) {
            announcementsData = data;
            sortAnnouncementsData();
            renderMarquee();
            renderIndependentAnnouncements();
            renderAdminAnnounceList();
        }
    } catch (e) {}
};
window.renderMarquee = function() {
    const marqueeEl = document.getElementById('marqueeContent');
    if (!marqueeEl) return;
    const marqueeItems = announcementsData.filter(a => isAnnouncementVisibleNow(a) && a.is_marquee);
    if (marqueeItems.length === 0) {
        marqueeEl.innerHTML = `<span>目前尚無跑馬燈公告。</span>`;
        return;
    }
    let html = marqueeItems.map(a => `<span class="inline-flex items-center gap-1.5"><span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold text-[10px]">${a.category || '🎓 公告'}</span><b>${a.title}</b>: ${a.content}</span>`).join('<span class="opacity-40 px-3">丨</span>');
    marqueeEl.innerHTML = html;
};
window.renderIndependentAnnouncements = function() {
    const container = document.getElementById('independentAnnounceList');
    if (!container) return;
    const activeItems = announcementsData.filter(a => isAnnouncementVisibleNow(a));
    if (activeItems.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-slate-400 font-bold">目前資料庫尚無公開有效之公告事項</div>`;
        return;
    }
    container.innerHTML = activeItems.map(a => {
        const pubDate = a.published_at || a.created_at;
        const pubStr = formatDateTime(pubDate);
        const updatedStr = a.updated_at ? formatDateTime(a.updated_at) : null;
        const isEdited = updatedStr && a.created_at && Math.abs(new Date(a.updated_at) - new Date(a.created_at)) > 2000;
        let timeHtml = `<span class="text-slate-400 font-mono">📅 發布時間: ${pubStr}</span>`;
        if (isEdited) timeHtml += `<span class="text-amber-600 font-bold font-mono ml-2"><br>✏️ 最後修改: ${updatedStr}</span>`;
        return `
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <div class="flex items-center justify-between flex-wrap gap-2">
                <span class="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-black text-xs shrink-0">${a.category || '🎓 畢業檢核'}</span>
                <span class="text-[11px] font-mono whitespace-nowrap">${timeHtml}</span>
            </div>
            <h4 class="font-black text-slate-800 text-sm md:text-base">${a.title}</h4>
            <p class="text-xs sm:text-sm text-slate-600 font-semibold leading-relaxed whitespace-pre-wrap break-words">${a.content}</p>
            <div class="text-[10px] text-slate-400 font-bold text-right pt-1 border-t border-slate-100">發布者：${a.created_by || '系統管理員'}</div>
        </div>`;
    }).join('');
};
window.moveAnnouncementOrder = async function(index, direction) {
    if (!dbClient) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= announcementsData.length) return;
    const currentItem = announcementsData[index];
    const targetItem = announcementsData[targetIndex];
    let currentOrder = currentItem.sort_order ?? index;
    let targetOrder = targetItem.sort_order ?? targetIndex;
    if (currentOrder === targetOrder) {
        announcementsData.forEach((item, idx) => { item.sort_order = idx; });
        currentOrder = index;
        targetOrder = targetIndex;
    }
    currentItem.sort_order = targetOrder;
    targetItem.sort_order = currentOrder;
    sortAnnouncementsData();
    renderAdminAnnounceList();
    renderMarquee();
    renderIndependentAnnouncements();
    try {
        updateSyncStatusIndicator('saving');
        await Promise.all([
            dbClient.from('announcements').update({ sort_order: currentItem.sort_order }).eq('id', currentItem.id),
            dbClient.from('announcements').update({ sort_order: targetItem.sort_order }).eq('id', targetItem.id)
        ]);
        updateSyncStatusIndicator('success');
        logAuditRecord("更新公告排序", currentItem.title, "系統公告", { fromOrder: currentOrder, toOrder: targetOrder });
    } catch (err) {
        updateSyncStatusIndicator('offline');
        showMsg("儲存排序失敗：" + translateError(err.message), "error");
        fetchAnnouncements();
    }
};
window.renderAdminAnnounceList = function() {
    const container = document.getElementById('adminAnnounceList');
    const countText = document.getElementById('announceCountText');
    if (countText) countText.innerText = `共 ${announcementsData.length} 筆紀錄`;
    if (!container) return;
    if (announcementsData.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs font-bold">目前資料庫尚無任何公告紀錄</div>`;
        return;
    }
    const now = new Date().getTime();
    container.innerHTML = announcementsData.map((a, idx) => {
        const pubDate = a.published_at || a.created_at;
        const pubFormatted = formatDateTime(pubDate);
        const [pubDatePart, pubTimePart] = pubFormatted.includes(' ') ? pubFormatted.split(' ') : [pubFormatted, ''];
        let statusBadge = '';
        if (!a.is_active) {
            statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded-full font-black bg-rose-100 text-rose-800 border border-rose-200 shrink-0">○ 下架</span>';
        } else if (a.published_at && new Date(a.published_at).getTime() > now) {
            statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-100 text-amber-800 border border-amber-200 shrink-0">⏳ 預約中</span>';
        } else if (a.start_at && new Date(a.start_at).getTime() > now) {
            statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded-full font-black bg-sky-100 text-sky-800 border border-sky-200 shrink-0">⏳ 未開始</span>';
        } else if (a.end_at && new Date(a.end_at).getTime() < now) {
            statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded-full font-black bg-slate-200 text-slate-700 border border-slate-300 shrink-0">⌛ 已過期</span>';
        } else {
            statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded-full font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">● 公開中</span>';
        }
        return `
            <div class="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs shadow-2xs hover:shadow-xs transition">
                <div class="flex items-center gap-3 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
                    <div class="font-mono text-slate-500 text-[11px] shrink-0 whitespace-nowrap leading-tight text-center">
                        <div>${pubDatePart}</div><div>${pubTimePart}</div>
                    </div>
                    <div class="shrink-0 flex items-center gap-1.5">
                        <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-extrabold text-[11px] whitespace-nowrap">${a.category || '大會公告'}</span>
                        ${statusBadge}
                        ${a.is_marquee ? '<span class="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-100 text-amber-800 border border-amber-200 shrink-0">📢</span>' : ''}
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="font-bold text-slate-800 truncate text-xs sm:text-sm">${a.title}</div>
                        <div class="text-[11px] text-slate-400 truncate mt-0.5">${a.content || ''}</div>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" class="btn-table-action bg-[#242938] text-white" onclick="toggleAnnounceStatus('${a.id}', ${!a.is_active})"><i class="fa-regular fa-file-lines text-xs"></i></button>
                    <button type="button" class="btn-table-action border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none" onclick="moveAnnouncementOrder(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>▲</button>
                    <button type="button" class="btn-table-action border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none" onclick="moveAnnouncementOrder(${idx}, 1)" ${idx === announcementsData.length - 1 ? 'disabled' : ''}>▼</button>
                    <button type="button" class="h-7 px-2.5 rounded-md font-extrabold text-white bg-[#f59e0b] hover:bg-[#d97706] text-xs transition" onclick="openEditAnnouncement('${a.id}')">編輯</button>
                    <button type="button" class="h-7 px-2.5 rounded-md font-extrabold text-white bg-[#dc2626] hover:bg-[#b91c1c] text-xs transition" onclick="deleteAnnouncement('${a.id}', '${a.title}')">刪除</button>
                </div>
            </div>
        `;
    }).join('');
};
window.openEditAnnouncement = function(id) {
    const item = announcementsData.find(a => String(a.id) === String(id));
    if (!item) return;
    document.getElementById('editingAnnounceId').value = item.id;
    document.getElementById('newAnnounceTitle').value = item.title || '';
    document.getElementById('newAnnounceCategory').value = item.category || '大會公告';
    document.getElementById('newAnnounceContent').value = item.content || '';
    document.getElementById('newAnnouncePublishedAt').value = formatDateTimeInput(item.published_at);
    document.getElementById('newAnnounceStartAt').value = formatDateTimeInput(item.start_at);
    document.getElementById('newAnnounceEndAt').value = formatDateTimeInput(item.end_at);
    document.getElementById('newAnnounceMarquee').checked = !!item.is_marquee;
    document.getElementById('newAnnounceActive').checked = !!item.is_active;
    document.getElementById('announceFormIcon').innerText = '✏️';
    document.getElementById('announceFormTitle').innerHTML = '正在編輯公告：<span class="text-indigo-700 font-black">' + (item.title || '') + '</span>';
    document.getElementById('submitAnnounceBtn').innerText = '儲存修改公告';
    document.getElementById('cancelAnnounceEditBtn').style.display = 'inline-block';
    document.getElementById('announceFormCard')?.classList.add('ring-4', 'ring-amber-400/80', 'shadow-lg');
};
window.cancelAnnounceEdit = function() {
    document.getElementById('editingAnnounceId').value = '';
    document.getElementById('newAnnounceTitle').value = '';
    document.getElementById('newAnnounceContent').value = '';
    document.getElementById('newAnnounceCategory').value = '大會公告';
    document.getElementById('newAnnouncePublishedAt').value = '';
    document.getElementById('newAnnounceStartAt').value = '';
    document.getElementById('newAnnounceEndAt').value = '';
    document.getElementById('newAnnounceMarquee').checked = true;
    document.getElementById('newAnnounceActive').checked = true;
    document.getElementById('announceFormIcon').innerText = '✨';
    document.getElementById('announceFormTitle').innerText = '發布新公告';
    document.getElementById('submitAnnounceBtn').innerText = '確認發布公告';
    document.getElementById('cancelAnnounceEditBtn').style.display = 'none';
    document.getElementById('announceFormCard')?.classList.remove('ring-4', 'ring-amber-400/80', 'shadow-lg');
};
window.submitNewAnnouncement = async function() {
    if (!dbClient) return;
    const editId = document.getElementById('editingAnnounceId').value;
    const title = document.getElementById('newAnnounceTitle').value.trim();
    const category = document.getElementById('newAnnounceCategory').value;
    const content = document.getElementById('newAnnounceContent').value.trim();
    const pubVal = document.getElementById('newAnnouncePublishedAt').value;
    const startVal = document.getElementById('newAnnounceStartAt').value;
    const endVal = document.getElementById('newAnnounceEndAt').value;
    const isMarquee = document.getElementById('newAnnounceMarquee').checked;
    const isActive = document.getElementById('newAnnounceActive').checked;
    if (!title || !content) { showMsg("請填寫完整公告標題與內容！", "error"); return; }
    if (startVal && endVal && new Date(startVal).getTime() >= new Date(endVal).getTime()) {
        showMsg("展示結束時間必須大於起始時間！", "error"); return;
    }
    const curRec = userDBRecord || currentUser?.user_metadata || {};
    const creatorName = curRec.full_name || '系統管理員';
    const nowIso = new Date().toISOString();
    const publishedAtIso = pubVal ? new Date(pubVal).toISOString() : nowIso;
    const startAtIso = startVal ? new Date(startVal).toISOString() : null;
    const endAtIso = endVal ? new Date(endVal).toISOString() : null;
    try {
        updateSyncStatusIndicator('saving');
        if (editId) {
            const { error } = await dbClient.from('announcements').update({
                title, category, content, published_at: publishedAtIso, start_at: startAtIso,
                end_at: endAtIso, is_marquee: isMarquee, is_active: isActive, updated_at: nowIso
            }).eq('id', editId);
            if (error) throw error;
            showMsg("公告修改成功！");
            cancelAnnounceEdit();
            await fetchAnnouncements();
            logAuditRecord("編輯系統公告", title, creatorName, { category, isMarquee, isActive });
        } else {
            let minOrder = 0;
            if (announcementsData.length > 0) {
                minOrder = Math.min(...announcementsData.map(a => (a.sort_order ?? 0))) - 1;
            }
            const payload = {
                title, category, content, published_at: publishedAtIso, start_at: startAtIso,
                end_at: endAtIso, sort_order: minOrder, is_marquee: isMarquee, is_active: isActive,
                created_by: creatorName, created_at: nowIso, updated_at: nowIso
            };
            const { error } = await dbClient.from('announcements').insert([payload]);
            if (error) throw error;
            showMsg("公告發布成功！");
            cancelAnnounceEdit();
            await fetchAnnouncements();
            logAuditRecord("發布系統公告", title, creatorName, { category, isMarquee, isActive });
        }
        updateSyncStatusIndicator('success');
    } catch (err) {
        updateSyncStatusIndicator('offline');
        showMsg("公告作業失敗：" + translateError(err.message), "error");
    }
};
window.toggleAnnounceStatus = async function(id, newStatus) {
    if (!dbClient) return;
    try {
        updateSyncStatusIndicator('saving');
        const { error } = await dbClient.from('announcements').update({ is_active: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        updateSyncStatusIndicator('success');
        showMsg(newStatus ? "公告已重新公開！" : "公告已成功下架！");
        await fetchAnnouncements();
    } catch (err) {
        updateSyncStatusIndicator('offline');
        showMsg("操作失敗：" + translateError(err.message), "error");
    }
};
window.deleteAnnouncement = function(id, title) {
    if (!dbClient) return;
    showConfirmModal(`您確定要刪除公告「${title}」嗎？`, "刪除公告", async () => {
        try {
            updateSyncStatusIndicator('saving');
            const { error } = await dbClient.from('announcements').delete().eq('id', id);
            if (error) throw error;
            updateSyncStatusIndicator('success');
            showMsg("公告已刪除！");
            toggleUIModal(false, 'confirmModal');
            await fetchAnnouncements();
        } catch (err) {
            updateSyncStatusIndicator('offline');
            showMsg("刪除失敗：" + translateError(err.message), "error");
            toggleUIModal(false, 'confirmModal');
        }
    }, "確認刪除", "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)");
};
window.buildCardContent = function(title, value, target, isTotalCard = false) {
    const percentage = (value === null || target === null) ? 0 : Math.min(100, Math.round((value / target) * 100));
    let barColor = '#d97706';
    if (value !== null && target !== null) {
        if (isTotalCard) {
            if (value >= 160) barColor = '#059669';
            else if (value >= 120) barColor = '#d97706';
            else barColor = '#dc2626';
        } else {
            barColor = (value >= target) ? '#059669' : '#d97706';
        }
    }
    return `
        <div class="card-title">${title}</div>
        <div class="flex items-baseline justify-center gap-1 text-lg xs:text-xl md:text-2xl font-black text-slate-900"><span>${value === null ? "-" : value}</span><span style="font-size: 0.85rem; color: #475569; font-weight: 700;">/ ${target === null ? "-" : target}</span></div>
        <div class="card-progress-bg"><div class="card-progress-fill" style="width: ${percentage}%; background-color: ${barColor};"></div></div>`;
};
window.getClientIP = async function() {
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 2000);
        const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
        const data = await res.json();
        return data.ip || '未知 IP';
    } catch (e) {
        return '內網/無法取得 IP';
    }
};
window.logAuditRecord = async function(actionType, targetSid, targetName, details) {
    if (!dbClient) return;
    try {
        let user = currentUser;
        if (!user && dbClient.auth) {
            const userData = await dbClient.auth.getUser();
            user = userData?.data?.user;
        }
        const ip = await getClientIP();
        const curRec = userDBRecord || user?.user_metadata || {};
        let opId = user?.id || null;
        if (opId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(opId)) opId = null;
        const payload = {
            operator_id: opId,
            operator_name: curRec.full_name || '未知使用者',
            operator_role: curRec.role || 'student',
            target_student_id: targetSid || '無',
            target_student_name: targetName || '無',
            action_type: actionType,
            details: details || {},
            ip_address: ip,
            user_agent: navigator.userAgent,
            created_at: new Date().toISOString()
        };
        const { error } = await dbClient.from('audit_logs').insert([payload]);
        if (error && error.code === '23503' && opId) {
            payload.operator_id = null;
            await dbClient.from('audit_logs').insert([payload]);
        }
    } catch (e) {}
};
window.openFeedbackModal = function() {
    document.getElementById('fbContent').value = '';
    document.getElementById('fbCategory').value = '功能建議';
    toggleUIModal(true, 'feedbackModal');
};
window.submitUserFeedback = async function() {
    if (!dbClient) { showMsg("資料庫連線異常，無法送出！", "error"); return; }
    const category = document.getElementById('fbCategory').value;
    const content = document.getElementById('fbContent').value.trim();
    if (!content) { showMsg("請輸入您的寶貴意見！", "error"); return; }
    const curRec = userDBRecord || currentUser?.user_metadata || {};
    const cleanSid = (curRec.student_id || currentUser?.email?.split('@')[0] || 'guest').toLowerCase().trim();
    const fullName = curRec.full_name || '訪客';
    const role = curRec.role || 'student';
    const payload = {
        student_id: cleanSid,
        full_name: fullName,
        role: role,
        category: category,
        content: content,
        created_at: new Date().toISOString()
    };
    try {
        updateSyncStatusIndicator('saving');
        const { error } = await dbClient.from('user_feedbacks').insert([payload]);
        if (error) throw error;
        updateSyncStatusIndicator('success');
        showMsg("感謝您的寶貴回饋！");
        toggleUIModal(false, 'feedbackModal');
        logAuditRecord("送出系統回饋", cleanSid, fullName, { category });
    } catch (err) {
        updateSyncStatusIndicator('offline');
        showMsg("送出失敗，請確認資料表已建立！", "error");
    }
};
window.refreshFeedbackList = async function() {
    if (!dbClient) return;
    const listBody = document.getElementById('feedbackListBody');
    if (listBody) listBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500 font-bold">🔄 正在載入意見回饋列表...</td></tr>`;
    try {
        const { data, error } = await dbClient.from('user_feedbacks').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        userFeedbacksData = data || [];
        renderFeedbackList();
    } catch (e) {
        if (listBody) listBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-rose-500 font-bold">⚠️ 載入失敗！</td></tr>`;
    }
};
window.renderFeedbackList = function() {
    const searchTxt = (document.getElementById('fbSearchInput')?.value || '').toLowerCase().trim();
    const catFilter = document.getElementById('fbFilterCategory')?.value || 'all';
    const roleFilter = document.getElementById('fbFilterRole')?.value || 'all';
    const listBody = document.getElementById('feedbackListBody');
    const countText = document.getElementById('fbCountText');
    if (!listBody) return;
    let filtered = [...userFeedbacksData];
    if (searchTxt) {
        filtered = filtered.filter(f => 
            (f.full_name && f.full_name.toLowerCase().includes(searchTxt)) ||
            (f.student_id && f.student_id.toLowerCase().includes(searchTxt)) ||
            (f.content && f.content.toLowerCase().includes(searchTxt))
        );
    }
    if (catFilter !== 'all') filtered = filtered.filter(f => f.category === catFilter);
    if (roleFilter !== 'all') filtered = filtered.filter(f => f.role === roleFilter);
    if (countText) countText.innerText = `共 ${filtered.length} 筆回饋`;
    listBody.innerHTML = '';
    if (filtered.length === 0) {
        listBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400 font-bold">目前資料庫尚無符合條件的意見回饋紀錄</td></tr>`;
        return;
    }
    filtered.forEach(item => {
        const timeStr = formatDateTime(item.created_at);
        const [datePart, timePart] = timeStr.includes(' ') ? timeStr.split(' ') : [timeStr, ''];
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100';
        let catBadge = "bg-slate-100 text-slate-700 border-slate-200";
        if (item.category === '功能建議') catBadge = "bg-violet-50 text-violet-700 border-violet-200";
        else if (item.category === '操作問題') catBadge = "bg-amber-50 text-amber-800 border-amber-200";
        else if (item.category === '學分資料疑義') catBadge = "bg-blue-50 text-blue-700 border-blue-200";
        tr.innerHTML = `
            <td class="p-2.5 text-slate-500 font-mono text-[11px] leading-tight text-center whitespace-nowrap">
                <div>${datePart}</div><div>${timePart}</div>
            </td>
            <td class="p-2.5 font-bold break-words leading-tight">
                <div class="text-slate-800">${item.full_name || '訪客'} <span class="text-[10px] text-slate-400 block sm:inline">(${mapping.role[item.role] || item.role})</span></div>
                <div class="text-[10px] font-mono text-slate-400 mt-0.5 break-all">${item.student_id || ''}</div>
            </td>
            <td class="p-2.5"><span class="px-2 py-0.5 rounded-full border font-extrabold text-[10px] sm:text-[11px] inline-block ${catBadge}">${item.category || '其他'}</span></td>
            <td class="p-2.5 text-slate-700 leading-relaxed font-semibold whitespace-pre-wrap break-words">${item.content || ''}</td>
            <td class="p-2.5 text-center">
                <button class="btn-mini" style="background:#ef4444; padding:0 6px; height:28px;" onclick="deleteFeedback('${item.id}', '${item.full_name}')">刪除</button>
            </td>
        `;
        listBody.appendChild(tr);
    });
};
window.deleteFeedback = function(id, name) {
    if (!dbClient) return;
    showConfirmModal(`您確定要刪除來自「${name || '使用者'}」的此筆意見回饋嗎？`, "刪除意見回饋", async () => {
        try {
            updateSyncStatusIndicator('saving');
            const { error } = await dbClient.from('user_feedbacks').delete().eq('id', id);
            if (error) throw error;
            userFeedbacksData = userFeedbacksData.filter(f => String(f.id) !== String(id));
            renderFeedbackList();
            updateSyncStatusIndicator('success');
            showMsg("已成功刪除該筆意見回饋！");
            toggleUIModal(false, 'confirmModal');
            await refreshFeedbackList();
        } catch (err) {
            updateSyncStatusIndicator('offline');
            showMsg("刪除失敗：" + translateError(err.message), "error");
            toggleUIModal(false, 'confirmModal');
        }
    }, "確認刪除", "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)");
};
window.openAuditLogModal = async function(filterStudentId = null) {
    if (!dbClient) return;
    const role = userDBRecord?.role || currentUser?.user_metadata?.role || 'student';
    if (role !== 'admin') { showMsg("僅系統管理員有權限檢視歷史異動紀錄！", "error"); return; }
    openIndependentPage('auditLogView');
    const searchInput = document.getElementById('auditSearchInput');
    if (filterStudentId && searchInput) searchInput.value = filterStudentId;
    else if (searchInput) searchInput.value = '';
    await refreshAuditLogs();
};
window.refreshAuditLogs = async function() {
    if (!dbClient) return;
    const listBody = document.getElementById('auditLogListBody');
    if (listBody) listBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500 font-bold">🔄 正在載入完整稽核日誌...</td></tr>`;
    let allLogs = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;
    try {
        while (hasMore) {
            const { data, error } = await dbClient
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .range(from, from + step - 1);
            if (error) throw error;
            if (data && data.length > 0) {
                allLogs = allLogs.concat(data);
                if (data.length < step) hasMore = false;
                else from += step;
            } else {
                hasMore = false;
            }
        }
    } catch (e) {}
    auditLogsData = allLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    renderAuditLogList();
};
window.resetAuditFilters = function() {
    document.getElementById('auditSearchInput').value = '';
    document.getElementById('auditFilterAction').value = 'all';
    document.getElementById('auditFilterOperatorRole').value = 'all';
    document.getElementById('auditStartDate').value = '';
    document.getElementById('auditEndDate').value = '';
    renderAuditLogList();
};
window.renderAuditLogList = function() {
    const searchTxt = (document.getElementById('auditSearchInput')?.value || '').toLowerCase().trim();
    const actionFilter = document.getElementById('auditFilterAction')?.value || 'all';
    const roleFilter = document.getElementById('auditFilterOperatorRole')?.value || 'all';
    const startDate = document.getElementById('auditStartDate')?.value;
    const endDate = document.getElementById('auditEndDate')?.value;
    const listBody = document.getElementById('auditLogListBody');
    const countText = document.getElementById('auditCountText');
    if (!listBody) return;
    let filtered = [...auditLogsData];
    if (searchTxt) {
        filtered = filtered.filter(l => 
            (l.operator_name && l.operator_name.toLowerCase().includes(searchTxt)) ||
            (l.target_student_name && l.target_student_name.toLowerCase().includes(searchTxt)) ||
            (l.target_student_id && l.target_student_id.toLowerCase().includes(searchTxt)) ||
            (l.action_type && l.action_type.toLowerCase().includes(searchTxt)) ||
            (l.ip_address && l.ip_address.toLowerCase().includes(searchTxt))
        );
    }
    if (actionFilter !== 'all') filtered = filtered.filter(l => l.action_type === actionFilter);
    if (roleFilter !== 'all') filtered = filtered.filter(l => l.operator_role === roleFilter);
    if (startDate) {
        const startMs = new Date(startDate + 'T00:00:00').getTime();
        filtered = filtered.filter(l => new Date(l.created_at).getTime() >= startMs);
    }
    if (endDate) {
        const endMs = new Date(endDate + 'T23:59:59').getTime();
        filtered = filtered.filter(l => new Date(l.created_at).getTime() <= endMs);
    }
    if (countText) countText.innerText = `共 ${filtered.length} 筆紀錄`;
    listBody.innerHTML = '';
    if (filtered.length === 0) {
        listBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400 font-bold">目前資料庫尚無符合條件的稽核異動紀錄</td></tr>`;
        return;
    }
    const actionConfig = {
        '使用者登入': { icon: '🔑', class: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black' },
        '使用者登出': { icon: '🚪', class: 'bg-gradient-to-r from-slate-500 to-gray-600 text-white font-black' },
        '使用者註冊': { icon: '✨', class: 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-black' },
        '變更學分紀錄': { icon: '📘', class: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black' },
        '切換版本': { icon: '🔄', class: 'bg-gradient-to-r from-sky-500 to-cyan-600 text-white font-black' },
        '批次全部及格': { icon: '✅', class: 'bg-gradient-to-r from-emerald-600 to-green-700 text-white font-black' },
        '批次學分歸零': { icon: '🧹', class: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black' },
        '單學期全選及格': { icon: '✔', class: 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-black' },
        '單學期學分歸零': { icon: '⚠️', class: 'bg-gradient-to-r from-orange-500 to-red-500 text-white font-black' },
        '更改帳號資料': { icon: '📝', class: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black' },
        '重設帳號密碼': { icon: '⚡', class: 'bg-gradient-to-r from-violet-600 to-indigo-700 text-white font-black' },
        '刪除帳號': { icon: '🗑️', class: 'bg-gradient-to-r from-rose-600 to-red-700 text-white font-black' },
        '刪除學生帳號': { icon: '🗑️', class: 'bg-gradient-to-r from-rose-600 to-red-700 text-white font-black' },
        '更新個人資料': { icon: '👤', class: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-black' },
        '送出系統回饋': { icon: '💡', class: 'bg-gradient-to-r from-fuchsia-500 to-pink-600 text-white font-black' },
        '發布系統公告': { icon: '📢', class: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black' },
        '編輯系統公告': { icon: '✏️', class: 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-black' },
        '更新公告排序': { icon: '↕️', class: 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-black' }
    };
    filtered.forEach(log => {
        const timeStr = formatDateTime(log.created_at);
        const [datePart, timePart] = timeStr.includes(' ') ? timeStr.split(' ') : [timeStr, ''];
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100';
        let diffHtml = '';
        if (log.action_type.includes('刪除')) {
            const d = log.details || {};
            diffHtml = `<div class="inline-flex flex-wrap items-center gap-2 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 font-bold text-xs shadow-xs">
                <span class="px-2 py-0.5 rounded-md bg-rose-600 text-white font-black text-[11px]">🗑️ 被刪除帳號資料</span>
                <span>姓名：<b class="text-rose-950 font-black text-sm">${d.deleted_name || log.target_student_name || '未知'}</b></span>
                <span class="text-rose-300">|</span>
                <span>帳號：<b class="font-mono text-rose-900 font-extrabold">${d.deleted_sid || log.target_student_id || '未知'}</b></span>
            </div>`;
        } else if (log.details && typeof log.details === 'object') {
            const d = log.details;
            let headerChips = [];
            if (d.old_version && d.new_version) {
                headerChips.push(`<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 font-extrabold text-[11px] shadow-xs">
                    <span class="text-slate-500">原版本: ${d.old_version}</span> <span class="text-sky-600 font-black">➔</span> <span class="text-indigo-700 font-black">新版本: ${d.new_version}</span>
                </div>`);
            }
            if (d.old_total !== undefined && d.new_total !== undefined) {
                const isIncreased = d.new_total > d.old_total;
                const totalBadgeColor = isIncreased ? 'bg-emerald-50 border-emerald-200' : (d.new_total < d.old_total ? 'bg-rose-50 border-rose-200' : 'bg-indigo-50 border-indigo-100');
                headerChips.push(`<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-extrabold text-[11px] shadow-xs ${totalBadgeColor}">
                    <span class="text-slate-500">舊學分: ${d.old_total}</span> <span class="text-slate-400 font-black">➔</span> <span class="${isIncreased ? 'text-emerald-700 font-black' : 'text-indigo-700 font-black'}">新學分: ${d.new_total}</span>
                </div>`);
            }
            if (d.semester) {
                headerChips.push(`<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 font-extrabold text-[11px]">
                    <span class="text-amber-800">📅 ${d.semester}</span>
                </div>`);
            }
            if (headerChips.length > 0) diffHtml += `<div class="flex flex-wrap gap-1.5 mb-1.5">${headerChips.join('')}</div>`;
            if (d.changed_fields && Array.isArray(d.changed_fields) && d.changed_fields.length > 0) {
                diffHtml += `<div class="flex flex-wrap gap-1.5">`;
                d.changed_fields.forEach(f => {
                    const isGain = f.newVal && f.newVal.includes('及格') && !f.newVal.includes('未及格');
                    const badgeStyle = isGain ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-900 border-rose-300';
                    diffHtml += `<div class="inline-flex items-center gap-1 border px-2 py-0.5 rounded-lg text-[11px] font-bold shadow-xs ${badgeStyle}">
                        <span>${f.field}:</span><s class="opacity-60 font-semibold">${f.oldVal}</s><span class="font-black opacity-80">➔</span><b class="font-black">${f.newVal}</b>
                    </div>`;
                });
                diffHtml += `</div>`;
            } else {
                let chipItems = [];
                for (const [k, v] of Object.entries(d)) {
                    if (!['old_total', 'new_total', 'changed_fields', 'old_version', 'new_version', 'semester', 'mode'].includes(k)) {
                        let valStr = typeof v === 'object' ? JSON.stringify(v) : v;
                        chipItems.push(`<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] bg-slate-100 text-slate-700 border-slate-200">
                            <span class="opacity-60 text-[10px] font-bold">${k}:</span><span class="font-extrabold">${valStr}</span>
                        </span>`);
                    }
                }
                if (chipItems.length > 0) diffHtml += `<div class="flex flex-wrap gap-1.5 items-center">${chipItems.join('')}</div>`;
            }
        }
        const cfg = actionConfig[log.action_type] || { icon: '📌', class: 'bg-slate-700 text-white font-bold' };
        let roleBadgeColor = "bg-slate-100 text-slate-600";
        if (log.operator_role === 'admin') roleBadgeColor = "bg-indigo-100 text-indigo-800";
        else if (log.operator_role === 'teacher') roleBadgeColor = "bg-emerald-100 text-emerald-800";
        else if (log.operator_role === 'student') roleBadgeColor = "bg-blue-100 text-blue-800";
        tr.innerHTML = `
            <td class="p-3 text-slate-500 font-mono text-[11px] leading-tight text-center whitespace-nowrap">
                <div>${datePart}</div><div>${timePart}</div>
            </td>
            <td class="p-3 font-bold">
                <div class="text-slate-800 flex items-center gap-1">
                    <span>${log.operator_name || '系統'}</span>
                    <span class="text-[9px] px-1.5 py-0.5 rounded font-black ${roleBadgeColor}">${mapping.role[log.operator_role] || log.operator_role}</span>
                </div>
                <div class="text-[10px] font-mono text-slate-400 mt-0.5">${log.ip_address || '未知 IP'}</div>
            </td>
            <td class="p-3">
                <div class="text-slate-900 font-black text-xs sm:text-sm truncate max-w-[120px]">${log.target_student_name || '-'}</div>
                <div class="text-slate-500 font-mono text-[11px] mt-0.5">${log.target_student_id || '-'}</div>
            </td>
            <td class="p-3">
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap font-black ${cfg.class}">
                    <span>${cfg.icon}</span><span>${log.action_type}</span>
                </span>
            </td>
            <td class="p-3 text-slate-700">${diffHtml}</td>
        `;
        listBody.appendChild(tr);
    });
};
window.fetchCloudCurriculums = async function() {
    if (!dbClient) return;
    try {
        const { data, error } = await dbClient.from('curriculums').select('*');
        if (!error && data && data.length > 0) {
            data.forEach(item => {
                if (item.curriculum_key && Array.isArray(item.courses)) {
                    curriculums[item.curriculum_key] = item.courses;
                }
            });
        }
    } catch (e) {}
};
window.initDropdowns = function(isAdmin = false) {
    const yearSelects = ['authEntryYear', 'dashSelectYear', 'profEntryYear', 'editUserEntryYear'];
    const deptSelects = ['authEntryDept', 'dashSelectDept', 'profEntryDept', 'editUserEntryDept'];
    yearSelects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const currentVal = el.value;
        let html = '';
        if (id === 'authEntryYear') html += '<option value="">請選擇入學年</option>';
        if (id === 'editUserEntryYear') html += '<option value="未設定">未設定</option>';
        YEAR_OPTIONS.forEach(y => { html += `<option value="${y}">${y} 學年度</option>`; });
        el.innerHTML = html;
        if (currentVal && el.querySelector(`option[value="${currentVal}"]`)) el.value = currentVal;
        else if (id === 'dashSelectYear') el.value = currentYear;
    });
    deptSelects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const currentVal = el.value;
        let html = '';
        if (id === 'authEntryDept') html += '<option value="">請選擇科別-班級</option>';
        if (id === 'editUserEntryDept') html += '<option value="未設定">未設定</option>';
        DEPT_OPTIONS.forEach(d => { html += `<option value="${d}">${d}</option>`; });
        el.innerHTML = html;
        if (currentVal && el.querySelector(`option[value="${currentVal}"]`)) el.value = currentVal;
        else if (id === 'dashSelectDept') el.value = currentDept;
    });
    const fYear = document.getElementById('ms-drop-year');
    if (fYear) {
        let h = `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded text-xs font-bold text-slate-700">
                    <input type="checkbox" value="all" class="ms-all-year text-indigo-600 focus:ring-indigo-500 rounded" onchange="handleMSAll('year', this)" checked> (全選)
                </label>`;
        YEAR_OPTIONS.forEach(y => h += `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded text-xs font-bold text-slate-700">
                    <input type="checkbox" value="${y}" class="ms-opt-year text-indigo-600 focus:ring-indigo-500 rounded" onchange="handleMSOpt('year')"> ${y} 學年度
                </label>`);
        fYear.innerHTML = h;
    }
    const fDept = document.getElementById('ms-drop-dept');
    if (fDept) {
        let h = `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded text-xs font-bold text-slate-700">
                    <input type="checkbox" value="all" class="ms-all-dept text-indigo-600 focus:ring-indigo-500 rounded" onchange="handleMSAll('dept', this)" checked> (全選)
                </label>`;
        DEPT_OPTIONS.forEach(d => h += `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded text-xs font-bold text-slate-700">
                    <input type="checkbox" value="${d}" class="ms-opt-dept text-indigo-600 focus:ring-indigo-500 rounded" onchange="handleMSOpt('dept')"> ${d}
                </label>`);
        fDept.innerHTML = h;
    }
};
window.getTrackType = function(deptName) {
    if (!deptName) return 'vocational';
    if (deptName.includes('普通科')) return 'academic';
    if (deptName.includes('體育班')) return 'sports';
    return 'vocational';
};
window.getChkId = function(name, sIdx) {
    return `chk_${name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${sIdx}`;
};
window.translateError = function(msg) {
    if (!msg) return "發生未知錯誤";
    if (msg.includes("Invalid login credentials")) return "帳號或密碼錯誤，請重新確認！";
    if (msg.includes("User already registered")) return "該帳號已經註冊過，請直接登入！";
    if (msg.includes("Password should be at least")) return "密碼長度太短！";
    return msg;
};
window.scrollToTop = function() {
    document.getElementById('scrollContainer')?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.updateHash = function() {
    if (!currentUser) return;
    if (currentIndependentPage) window.location.hash = `#page-${currentIndependentPage}`;
    else if (editingStudentId) window.location.hash = `#${activeStudentDBRecord?.student_id || editingStudentId}`;
    else if (isViewingClassList) window.location.hash = '#class-data';
    else window.location.hash = '#dashboard';
};
window.handleHashRouting = function() {
    if (!currentUser) return;
    const hash = window.location.hash;
    const role = userDBRecord?.role || currentUser?.user_metadata?.role || 'student';
    const myYear = userDBRecord?.entry_year || currentUser?.user_metadata?.entry_year || '未設定';
    const myDept = userDBRecord?.entry_dept || currentUser?.user_metadata?.entry_dept || '未設定';
    if (hash.startsWith('#page-')) {
        const pType = hash.replace('#page-', '');
        if (pType === 'announceView' || (role === 'admin' && ['auditLogView', 'feedbackListView', 'announceMgmtView'].includes(pType))) {
            openIndependentPage(pType); return;
        }
    }
    if (currentIndependentPage) closeIndependentPage();
    if (hash === '#class-data') {
        if (role === 'student' || (role === 'teacher' && (myYear === '未設定' || myDept === '未設定'))) {
            isViewingClassList = false; editingStudentId = null; window.location.hash = '#dashboard'; return;
        }
        isViewingClassList = true; editingStudentId = null;
    } else if (hash === '#dashboard' || !hash || hash === '#') {
        isViewingClassList = false; editingStudentId = null;
    } else {
        let tid = hash.replace('#', '');
        if (tid) {
            if (role === 'student' || (role === 'teacher' && (myYear === '未設定' || myDept === '未設定'))) {
                editingStudentId = null; isViewingClassList = false; window.location.hash = '#dashboard'; return;
            }
            editingStudentId = tid; isViewingClassList = false;
        }
    }
};
window.toggleUIModal = function(show, modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = show ? 'flex' : 'none';
        if (show) modal.scrollTop = 0;
    }
    if (show && modalId === 'helpModal') {
        updateHelpModalDetails();
        const helpScroll = document.getElementById('helpScrollContainer');
        if (helpScroll) helpScroll.scrollTop = 0;
    }
};
window.updateHelpModalDetails = function() {
    const curRec = editingStudentId ? activeStudentDBRecord : (userDBRecord || currentUser?.user_metadata);
    let dept = curRec?.entry_dept || currentDept;
    const track = getTrackType(dept);
    const acad = document.getElementById('helpDetailsAcademic');
    const voc = document.getElementById('helpDetailsVocational');
    const sports = document.getElementById('helpDetailsSports');
    if (acad) acad.open = (track === 'academic');
    if (voc) voc.open = (track === 'vocational');
    if (sports) sports.open = (track === 'sports');
};
window.findTutorByYearDept = async function(yr, dept) {
    if (!dbClient || yr === '未設定' || dept === '未設定') return '未設定';
    try {
        const { data } = await dbClient.from('grad_checks').select('full_name').eq('role', 'teacher').eq('entry_year', yr).eq('entry_dept', dept).maybeSingle();
        return data?.full_name || '未設定';
    } catch (e) { return '未設定'; }
};
window.determineCurriculumVersion = function(record) {
    if (!record) return { year: currentYear, dept: currentDept, locked: false };
    const role = record.role || 'student';
    const ey = record.entry_year || '未設定';
    const ed = record.entry_dept || '未設定';
    const hasSetting = (ey !== '未設定' && ed !== '未設定');
    if (role === 'student') {
        return { year: hasSetting ? ey : '113', dept: hasSetting ? ed : '普通科(理工生醫群)-1', locked: true };
    } else {
        if (hasSetting && role === 'teacher') return { year: ey, dept: ed, locked: true };
        return {
            year: record.credits_json?._view_year || sessionStorage.getItem('tempSelectedYear') || '113',
            dept: record.credits_json?._view_dept || sessionStorage.getItem('tempSelectedDept') || '普通科(理工生醫群)-1',
            locked: false
        };
    }
};
window.selectCurriculum = function(yr, dept) {
    currentYear = yr;
    currentDept = dept;
    curriculum = curriculums[`${yr}_${dept}`] || [];
    initThresholds();
    updateCurriculumSelectorVisibility();
    updateHelpModalDetails();
};
window.updateCurriculumSelectorVisibility = function() {
    const selectorArea = document.getElementById('curriculumSelectorArea');
    if (!selectorArea) return;
    const rec = editingStudentId ? activeStudentDBRecord : userDBRecord;
    const version = determineCurriculumVersion(rec);
    selectorArea.style.display = version.locked ? 'none' : 'flex';
    document.getElementById('dashSelectYear').value = currentYear;
    document.getElementById('dashSelectDept').value = currentDept;
};
window.initThresholds = function() {
    let maxDept = 0;
    curriculum.forEach(i => { if (i.cat === 'dept') maxDept += i.credits.reduce((a, b) => a + b, 0); });
    DEPT_THRESHOLD = Math.ceil(maxDept * 0.85);
};
window.calculateStats = function() {
    let total = 0, dept = 0, prof = 0, prac = 0;
    let reqEarned = 0, optEarned = 0;
    let deptGenEarned = 0, deptGenMax = 0;
    let deptSportsEarned = 0, deptSportsMax = 0;
    let sportsOptEarned = 0, sportsOptMax = 0;
    const trackType = getTrackType(currentDept);
    document.querySelectorAll(".toggle-checkbox:checked").forEach(input => {
        let v = parseInt(input.dataset.val), c = input.dataset.cat, t = parseInt(input.dataset.type);
        total += v;
        if (c === 'dept') dept += v;
        if (t == 2 || t == 3) prof += v;
        if (t == 3) prac += v;
        if (c === 'dept' || c === 'sch_req') reqEarned += v;
        if (c === 'sch_opt') optEarned += v;
        if (c === 'dept' && t === 1) deptGenEarned += v;
        if (c === 'dept_sports' || (c === 'dept' && t === 2)) deptSportsEarned += v;
        if (c === 'sch_opt') sportsOptEarned += v;
    });
    if (trackType === 'academic') {
        return { total, pass: (total >= 150 && reqEarned >= 102 && optEarned >= 40), reqEarned, optEarned, trackType };
    } else if (trackType === 'sports') {
        curriculum.forEach(item => {
            const sum = item.credits.reduce((a, b) => a + b, 0);
            if (item.cat === 'dept' && item.type === 1) deptGenMax += sum;
            else if (item.cat === 'dept_sports' || (item.cat === 'dept' && item.type === 2)) deptSportsMax += sum;
            else if (item.cat === 'sch_opt') sportsOptMax += sum;
        });
        const targetGen = Math.ceil(deptGenMax * 0.8), targetSports = Math.ceil(deptSportsMax * 0.85), targetOpt = Math.ceil(sportsOptMax * 0.7);
        return { total, pass: (total >= 150 && deptGenEarned >= targetGen && deptSportsEarned >= targetSports && sportsOptEarned >= targetOpt), deptGenEarned, targetGen, deptSportsEarned, targetSports, sportsOptEarned, targetOpt, trackType };
    } else {
        return { total, pass: (total >= 160 && dept >= DEPT_THRESHOLD && prof >= 60 && prac >= 45), dept, prof, prac, trackType };
    }
};
window.calculate = function() {
    const isNullState = curriculum.length === 0;
    const stats = isNullState ? { total: null, pass: false } : calculateStats();
    const trackType = getTrackType(currentDept);
    const resultGrid = document.querySelector(".result-grid");
    if (resultGrid) resultGrid.className = trackType === 'academic' ? "result-grid grid-cols-3" : "result-grid grid-cols-4";
    const cT = document.getElementById("cell-total"), cD = document.getElementById("cell-dept"), cF = document.getElementById("cell-prof-prac"), cP = document.getElementById("cell-prac");
    if (trackType === 'academic') {
        if (cT) cT.innerHTML = buildCardContent("總學分", stats.total, isNullState ? null : 150, true);
        if (cD) cD.innerHTML = buildCardContent("必修學分", isNullState ? null : stats.reqEarned, isNullState ? null : 102);
        if (cF) cF.innerHTML = buildCardContent("選修學分", isNullState ? null : stats.optEarned, isNullState ? null : 40);
        if (cP) { cP.style.display = 'none'; cP.innerHTML = ''; }
    } else if (trackType === 'sports') {
        if (cP) cP.style.display = 'flex';
        if (cT) cT.innerHTML = buildCardContent("總學分", stats.total, isNullState ? null : 150, true);
        if (cD) cD.innerHTML = buildCardContent("部定一般必修", isNullState ? null : stats.deptGenEarned, isNullState ? null : stats.targetGen);
        if (cF) cF.innerHTML = buildCardContent("體育專業必修", isNullState ? null : stats.deptSportsEarned, isNullState ? null : stats.targetSports);
        if (cP) cP.innerHTML = buildCardContent("選修科目", isNullState ? null : stats.sportsOptEarned, isNullState ? null : stats.targetOpt);
    } else {
        if (cP) cP.style.display = 'flex';
        let dV = isNullState ? null : 0, fV = isNullState ? null : 0, pV = isNullState ? null : 0;
        if (!isNullState) {
            document.querySelectorAll(".toggle-checkbox:checked").forEach(i => {
                let v = parseInt(i.dataset.val), c = i.dataset.cat, t = parseInt(i.dataset.type);
                if (c === 'dept') dV += v;
                if (t == 2 || t == 3) fV += v;
                if (t == 3) pV += v;
            });
        }
        if (cT) cT.innerHTML = buildCardContent("總學分", stats.total, isNullState ? null : 160, true);
        if (cD) cD.innerHTML = buildCardContent("部定必修", dV, isNullState ? null : (DEPT_THRESHOLD || 1));
        if (cF) cF.innerHTML = buildCardContent("專業與實習科目", fV, isNullState ? null : 60);
        if (cP) cP.innerHTML = buildCardContent("實習科目", pV, isNullState ? null : 45);
    }
    const st = document.getElementById("finalStatus");
    if (st) {
        const reqMinTotal = (trackType === 'vocational') ? 160 : 150;
        if (isNullState) {
            st.innerText = "課程資料建置中！";
            st.className = "status-bar bg-slate-400 text-white shadow-sm";
        } else if (stats.pass) {
            st.innerText = "符合畢業門檻，核發畢業證書。";
            st.className = "status-bar status-pass text-white";
        } else if (stats.total >= reqMinTotal) {
            st.innerText = "未符合畢業門檻，請重補修。";
            st.className = "status-bar bg-gradient-to-r from-orange-500 to-red-500 text-white";
        } else if (stats.total >= 120) {
            st.innerText = "未符合畢業門檻，核發修業證明。";
            st.className = "status-bar bg-gradient-to-r from-amber-500 to-orange-600 text-white";
        } else {
            st.innerText = "未符合畢業門檻，核發成績證明。";
            st.className = "status-bar status-fail text-white";
        }
    }
};
window.confirmSetAllStatus = function(p) {
    if (curriculum.length === 0) { showMsg("目前版本的課表尚未建置！", "error"); return; }
    const msg = p ? "您確定要將所有課程學分一次設為「及格」嗎？" : "您確定要將所有及格學分「全部歸零」嗎？";
    showConfirmModal(msg, p ? "確認全部及格" : "確認學分歸零", () => { setAllStatus(p); toggleUIModal(false, 'confirmModal'); }, p ? "確認全部及格" : "確認學分歸零", p ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)");
};
window.setAllStatus = function(p) {
    document.querySelectorAll(".toggle-checkbox").forEach(chk => { chk.checked = p; });
    calculate();
    renderTable();
    saveToCloud(true, { actionType: p ? "批次全部及格" : "批次學分歸零" });
};
window.setSemesterStatus = function(sIdx, p) {
    if (curriculum.length === 0) return;
    const semNames = ["第一學期 (一上)", "第二學期 (一下)", "第三學期 (二上)", "第四學期 (二下)", "第五學期 (三上)", "第六學期 (三下)"];
    document.querySelectorAll(`.toggle-checkbox[data-sem="${sIdx}"]`).forEach(chk => { chk.checked = p; });
    calculate();
    renderTable();
    showMsg(p ? `已將 ${semNames[sIdx]} 設為全部及格` : `已將 ${semNames[sIdx]} 學分歸零`);
    saveToCloud(true, { actionType: p ? "單學期全選及格" : "單學期學分歸零", details: { semester: semNames[sIdx] } });
};
window.initHelpModalScrollGuard = function() {
    const container = document.getElementById('helpScrollContainer');
    if (!container) return;
    container.addEventListener('scroll', () => {
        if (container.scrollHeight - container.scrollTop <= container.clientHeight + 12) unlockConfirmButton();
    });
};
window.unlockConfirmButton = function() {
    const btn = document.getElementById('btnConfirmHelp');
    if (!btn) return;
    btn.disabled = false;
    btn.className = "action-btn btn-pass-all w-full py-3.5 text-base font-extrabold rounded-xl shadow-md transition duration-150 cursor-pointer opacity-100";
    btn.style.pointerEvents = "auto";
};
window.confirmReadHelp = function() { sessionStorage.setItem('helpModalShown', 'true'); toggleUIModal(false, 'helpModal'); };
window.handleOutsideClick = function(event) {
    if (event.target.classList.contains('modal-overlay')) {
        if (!currentUser && event.target.id === 'authWorkspace') return;
        event.target.style.display = 'none';
    }
    if (!event.target.closest('[id^="ms-wrap-"]')) {
        document.querySelectorAll('[id^="ms-drop-"]').forEach(d => { d.classList.add('hidden'); d.classList.remove('flex'); });
    }
};
window.toggleMS = function(event, type) {
    event.stopPropagation();
    const drop = document.getElementById(`ms-drop-${type}`);
    const isHidden = drop.classList.contains('hidden');
    document.querySelectorAll('[id^="ms-drop-"]').forEach(d => { d.classList.add('hidden'); d.classList.remove('flex'); });
    if (isHidden) { drop.classList.remove('hidden'); drop.classList.add('flex'); }
};
window.handleMSAll = function(type, chk) {
    if (chk.checked) document.querySelectorAll(`.ms-opt-${type}`).forEach(c => c.checked = false);
    updateMSText(type);
    fetchAdminList(true);
};
window.handleMSOpt = function(type) {
    const opts = document.querySelectorAll(`.ms-opt-${type}:checked`);
    document.querySelector(`.ms-all-${type}`).checked = opts.length === 0;
    updateMSText(type);
    fetchAdminList(true);
};
window.updateMSText = function(type) {
    const opts = document.querySelectorAll(`.ms-opt-${type}:checked`);
    const textEl = document.getElementById(`ms-text-${type}`);
    const allText = { role: '所有身份', year: '所有年度', dept: '所有科別', status: '所有畢業狀態' };
    if (opts.length === 0) {
        textEl.innerText = allText[type];
        textEl.classList.remove('text-indigo-700');
    } else if (opts.length === 1) {
        textEl.innerText = opts[0].parentElement.innerText.replace('(全選)', '').trim();
        textEl.classList.add('text-indigo-700');
    } else {
        textEl.innerText = `已選擇 (${opts.length})`;
        textEl.classList.add('text-indigo-700');
    }
};
window.getMSValues = function(type) {
    const allChk = document.querySelector(`.ms-all-${type}`);
    if (allChk && allChk.checked) return ['all'];
    return Array.from(document.querySelectorAll(`.ms-opt-${type}:checked`)).map(o => o.value);
};
window.showMsg = function(txt, type = 'info') {
    const b = document.getElementById('msgBox');
    b.innerText = txt;
    b.style.background = type === 'error' ? '#ef4444' : '#10b981';
    b.style.display = 'block';
    setTimeout(() => b.style.display = 'none', 2500);
};
window.updateSyncStatusIndicator = function(status) {
    const badge = document.getElementById('syncStatusIndicator');
    if (!badge) return;
    badge.className = "sync-badge " + (status === 'offline' ? 'sync-offline' : (status === 'saving' ? 'sync-saving' : 'sync-success'));
    badge.innerHTML = `<span>${status === 'offline' ? '同步失敗，請聯繫管理員！' : (status === 'saving' ? '正在儲存...' : '同步成功')}</span>`;
};
window.showConfirmModal = function(msg, title, action, confirmBtnText, confirmBtnBg) {
    const btn = document.querySelector('#confirmModal .btn-pass-all');
    btn.style.background = confirmBtnBg || (title.includes("重設") ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "#dc3545");
    btn.innerText = confirmBtnText || (title.includes("重設") ? "確認重設" : (title.includes("刪除") ? "確認刪除" : "確認操作"));
    document.getElementById('confirmMsg').innerText = msg;
    document.getElementById('confirmModal').querySelector('.modal-header span').innerText = title;
    confirmAction = action;
    toggleUIModal(true, 'confirmModal');
};
window.triggerConfirmAction = function() { if (confirmAction) confirmAction(); };
window.directResetPasswordToSid = async function() {
    const id = document.getElementById('editUserId').value, sid = document.getElementById('editUserSid').value.trim(), name = document.getElementById('editUserName').value.trim();
    if (!sid) { showMsg("無法重設：此帳號目前沒有設定帳號！", "error"); return; }
    showConfirmModal(`您確定要將「${name}」的登入密碼立即重設為其帳號「${sid}」嗎？`, "確認重設密碼", async () => {
        try {
            updateSyncStatusIndicator('saving');
            const { error } = await dbClient.rpc('admin_reset_user_password', { target_user_id: id, new_password: sid });
            if (error) throw error;
            updateSyncStatusIndicator('success');
            showMsg(`已成功將「${name}」的密碼重置為「${sid}」！`);
            logAuditRecord("重設帳號密碼", sid, name, { method: "一鍵重設為帳號" });
            toggleUIModal(false, 'confirmModal'); toggleUIModal(false, 'adminUserModal'); fetchAdminList();
        } catch (err) { updateSyncStatusIndicator('offline'); showMsg(translateError(err.message), "error"); toggleUIModal(false, 'confirmModal'); }
    });
};
window.customResetPassword = async function() {
    const id = document.getElementById('editUserId').value, name = document.getElementById('editUserName').value.trim(), sid = document.getElementById('editUserSid').value.trim();
    const newPwd = document.getElementById('editUserCustomPassword').value.trim();
    if (!newPwd) { showMsg("請輸入自訂新密碼！", "error"); return; }
    if (newPwd.length < 6) { showMsg("密碼長度至少需 6 個字元！", "error"); return; }
    showConfirmModal(`您確定要將「${name}」的登入密碼重設為「${newPwd}」嗎？`, "確認自訂重設密碼", async () => {
        try {
            updateSyncStatusIndicator('saving');
            const { error } = await dbClient.rpc('admin_reset_user_password', { target_user_id: id, new_password: newPwd });
            if (error) throw error;
            updateSyncStatusIndicator('success');
            showMsg(`已成功將「${name}」的密碼重置！`);
            logAuditRecord("重設帳號密碼", sid, name, { method: "自訂密碼" });
            document.getElementById('editUserCustomPassword').value = '';
            toggleUIModal(false, 'confirmModal'); toggleUIModal(false, 'adminUserModal'); fetchAdminList();
        } catch (err) { updateSyncStatusIndicator('offline'); showMsg(translateError(err.message), "error"); toggleUIModal(false, 'confirmModal'); }
    });
};
window.handleAuth = async function() {
    if (!dbClient) { showMsg("無法進行登入 or 註冊！請聯絡管理員。", "error"); return; }
    const sid = document.getElementById('authID').value.trim(), pwd = document.getElementById('authPassword').value;
    if (!sid) { showMsg("請輸入帳號！", "error"); return; }
    const cleanSid = sid.split('@')[0].toLowerCase().trim(), email = `${cleanSid}${EMAIL_DOMAIN}`;
    const isReg = document.getElementById('regFields').style.display === 'block';
    try {
        updateSyncStatusIndicator('saving');
        const isTeacher = await checkIsTeacherAccount(cleanSid);
        if (isReg) {
            const name = document.getElementById('authName').value.trim();
            if (!name) throw new Error("請輸入姓名！");
            let role = isTeacher ? 'teacher' : 'student';
            let entryYear = '未設定';
            let entryDept = '未設定';
            let matchedTutor = '教師帳號免設定';
            if (isTeacher) {
                const teacherType = document.getElementById('authTeacherType')?.value;
                if (!teacherType) {
                    throw new Error("請選擇您的教師身份（導師或教師）！");
                }
                if (teacherType === 'tutor') {
                    entryYear = document.getElementById('authEntryYear').value;
                    entryDept = document.getElementById('authEntryDept').value;
                    if (!entryYear || !entryDept || entryYear.includes('請選擇') || entryDept.includes('請選擇')) {
                        throw new Error("擔任導師請務必選擇負責的入學年與科別班級！");
                    }
                }
            } else {
                entryYear = document.getElementById('authEntryYear').value;
                entryDept = document.getElementById('authEntryDept').value;
                if (!entryYear || !entryDept || entryYear.includes('請選擇') || entryDept.includes('請選擇')) {
                    throw new Error("學生註冊請務必選擇正確的入學年與科別！");
                }
                matchedTutor = await findTutorByYearDept(entryYear, entryDept);
            }
            const { data: signUpData, error } = await dbClient.auth.signUp({
                email, password: pwd, options: { 
                    data: { 
                        full_name: name, 
                        student_id: cleanSid, 
                        role: role, 
                        tutor: matchedTutor, 
                        entry_year: entryYear, 
                        entry_dept: entryDept 
                    } 
                }
            });
            if (error) throw error;
            const newUserId = signUpData?.user?.id;
            if (newUserId) {
                try {
                    await dbClient.from('grad_checks').upsert({
                        id: newUserId, 
                        student_id: cleanSid, 
                        full_name: name, 
                        entry_year: entryYear,
                        entry_dept: entryDept, 
                        role: role, 
                        tutor: matchedTutor, 
                        credits_json: {}, 
                        total_credits: 0, 
                        updated_at: new Date().toISOString()
                    });
                } catch (upsertErr) {}
            }
            updateSyncStatusIndicator('success');
            showMsg(isTeacher ? (entryYear !== '未設定' ? "導師帳號註冊成功！" : "教師帳號註冊成功！") : "學生帳號註冊成功！");
            switchAuthMode();
            document.getElementById('authID').value = cleanSid;
            logAuditRecord("使用者註冊", cleanSid, name, { role, year: entryYear, dept: entryDept });
        } else {
            if (!pwd) {
                let accountExists = false;
                try {
                    const { data } = await dbClient.from('grad_checks').select('student_id').eq('student_id', cleanSid).maybeSingle();
                    if (data) accountExists = true;
                } catch (e) {}
                if (!accountExists) {
                    updateSyncStatusIndicator('offline'); showMsg("查無此帳號資料，請先註冊！"); switchAuthMode();
                    document.getElementById('authID').value = cleanSid; return;
                } else {
                    updateSyncStatusIndicator('offline'); showMsg("請輸入密碼！", "error"); return;
                }
            }
            const { data: authResult, error } = await dbClient.auth.signInWithPassword({ email, password: pwd });
            if (error) {
                let accountExists = false;
                try {
                    const { data } = await dbClient.from('grad_checks').select('student_id').eq('student_id', cleanSid).maybeSingle();
                    if (data) accountExists = true;
                } catch (e) {}
                if (!accountExists) {
                    updateSyncStatusIndicator('offline'); showMsg("查無此帳號資料，請先註冊！"); switchAuthMode();
                    document.getElementById('authID').value = cleanSid; return;
                }
                throw error;
            }
            if (isTeacher) {
                const loggedInUserId = authResult?.user?.id;
                try { await dbClient.from('grad_checks').update({ role: 'teacher' }).eq('id', loggedInUserId); } catch (updateErr) {}
            }
            let loginDisplayName = cleanSid;
            if (authResult?.user?.user_metadata?.full_name) loginDisplayName = authResult.user.user_metadata.full_name;
            updateSyncStatusIndicator('success'); showMsg("登入成功！");
            document.getElementById('authWorkspace').style.display = 'none'; document.getElementById('appWorkspace').style.display = 'flex';
            hasLoadedInitialData = false; updateUI();
            logAuditRecord("使用者登入", cleanSid, loginDisplayName, { status: "登入成功", role: isTeacher ? 'teacher' : 'student' });
        }
    } catch (e) { updateSyncStatusIndicator('offline'); showMsg(translateError(e.message), 'error'); }
};
window.handleLogout = async function() { 
    try { 
        if (currentUser) {
            const curRec = userDBRecord || currentUser?.user_metadata || {};
            const curSid = (curRec.student_id || currentUser.email?.split('@')[0] || '未知帳號').toLowerCase().trim();
            const curName = curRec.full_name || curSid;
            await logAuditRecord("使用者登出", curSid, curName, { status: "登出成功" });
        }
        cleanupRealtimeSubscriptions();
        if (dbClient) await dbClient.auth.signOut(); 
        window.location.hash = ''; 
        window.location.reload(); 
    } catch (e) { showMsg("登出失敗", 'error'); } 
};
window.renderUserStatusDisplay = function() {
    const userStatusDisplay = document.getElementById('userStatusDisplay');
    if (!userStatusDisplay || !currentUser) return;
    const m = currentUser.user_metadata;
    const role = userDBRecord?.role || m?.role || 'student';
    const displayName = userDBRecord?.full_name || m?.full_name;
    const myYear = userDBRecord?.entry_year || m?.entry_year || '未設定';
    const myDept = userDBRecord?.entry_dept || m?.entry_dept || '未設定';
    let roleTitle = mapping.role[role] || '使用者';
    if (role === 'teacher') roleTitle = (myYear !== '未設定' && myDept !== '未設定') ? '導師' : '教師';
    const displayClass = (myYear === '未設定' || myDept === '未設定') ? ` ｜ ${roleTitle}` : ` ｜ ${myYear}年 ${myDept} ${roleTitle}`;
    userStatusDisplay.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 w-full text-xs sm:text-sm leading-tight">
            <div class="font-extrabold text-slate-100 shrink-0">您好，${displayName}${displayClass}</div>
            <div class="user-info-actions flex items-center gap-2.5 sm:gap-3 shrink-0 flex-wrap">
                <span id="syncStatusIndicator" class="sync-badge sync-success"><span>同步成功</span></span>
                <a href="javascript:void(0)" onclick="openFeedbackModal()" class="text-amber-300 hover:text-amber-200 font-extrabold transition">💡 意見回饋</a>
                <a href="javascript:void(0)" onclick="openProfile()" class="text-sky-400 hover:text-sky-300 font-extrabold transition">👤 個人資料</a>
                <a href="javascript:void(0)" onclick="handleLogout()" class="text-rose-400 hover:text-rose-300 font-extrabold transition">🚪 登出</a>
            </div>
        </div>`;
};
window.updateUI = function() {
    const mobileContainer = document.getElementById('mobileCardsContainer'), adminBackend = document.getElementById('adminBackend'),
        dashboard = document.getElementById('dashboardSection'), saveBtn = document.getElementById('saveBtn'),
        backToTrialAdminBtn = document.getElementById('backToTrialBtn'), adminEditBanner = document.getElementById('adminEditBanner'),
        layoutSwitcher = document.getElementById('layoutSwitcherArea'), unsetBox = document.getElementById('unsetNoticeBox');
    if (currentUser) {
        updateHash();
        const savedLayout = sessionStorage.getItem('tempLayoutMode');
        if (savedLayout) currentLayoutMode = savedLayout;
        if (adminEditBanner) adminEditBanner.style.display = editingStudentId ? 'block' : 'none';
        document.getElementById('statusHeader').style.display = 'block';
        const m = currentUser.user_metadata;
        const role = userDBRecord?.role || m?.role || 'student';
        const myYear = userDBRecord?.entry_year || m?.entry_year || '未設定';
        const myDept = userDBRecord?.entry_dept || m?.entry_dept || '未設定';
        const isStudentUnset = (!editingStudentId && role === 'student' && (myYear === '未設定' || myDept === '未設定'));
        if (isStudentUnset) {
            if (unsetBox) unsetBox.classList.remove('hidden');
            if (dashboard) dashboard.style.display = 'none';
            if (layoutSwitcher) layoutSwitcher.style.display = 'none';
            if (mobileContainer) { mobileContainer.style.display = 'none'; mobileContainer.innerHTML = ''; }
            document.getElementById("underConstructionBox")?.classList.add("hidden");
            if (adminBackend) adminBackend.style.display = 'none';
            renderUserStatusDisplay();
            return;
        } else {
            if (unsetBox) unsetBox.classList.add('hidden');
        }
        if (role === 'admin') {
            saveBtn.innerText = '資料管理'; saveBtn.style.display = '';
        } else if (role === 'teacher' && myYear !== '未設定' && myDept !== '未設定') {
            saveBtn.innerText = '班級資料'; saveBtn.style.display = '';
        } else {
            saveBtn.style.display = 'none';
        }
        renderUserStatusDisplay();
        if (currentIndependentPage) return;
        if (isViewingClassList) {
            dashboard.style.display = 'none';
            if (layoutSwitcher) layoutSwitcher.style.display = 'none';
            mobileContainer.style.display = 'none';
            document.getElementById("underConstructionBox")?.classList.add("hidden");
            mobileContainer.innerHTML = "";
            adminBackend.style.display = 'block';
            document.getElementById('backendTitle').innerText = (role === 'admin') ? '資料管理' : '班級資料';
            if (backToTrialAdminBtn) backToTrialAdminBtn.style.display = 'inline-block';
            document.getElementById('auditLogHeaderBtn').style.display = (role === 'admin') ? 'inline-flex' : 'none';
            document.getElementById('feedbackListHeaderBtn').style.display = (role === 'admin') ? 'inline-flex' : 'none';
            document.getElementById('announceMgmtHeaderBtn').style.display = (role === 'admin') ? 'inline-flex' : 'none';
            const msWrapRole = document.getElementById('ms-wrap-role'), msWrapYear = document.getElementById('ms-wrap-year'), msWrapDept = document.getElementById('ms-wrap-dept');
            if (msWrapYear && msWrapDept) {
                const hideFilters = (role === 'teacher' && myYear !== '未設定' && myDept !== '未設定');
                if (msWrapRole) msWrapRole.style.display = hideFilters ? 'none' : '';
                msWrapYear.style.display = hideFilters ? 'none' : '';
                msWrapDept.style.display = hideFilters ? 'none' : '';
            }
            fetchAdminList();
        } else {
            dashboard.style.display = 'block';
            if (layoutSwitcher) layoutSwitcher.style.display = 'flex';
            adminBackend.style.display = 'none';
            if (editingStudentId) {
                if (lastLoadedStudentId !== editingStudentId) loadFromCloud(editingStudentId);
                else { renderTable(); calculate(); updateCurriculumSelectorVisibility(); }
            } else {
                if (!hasLoadedInitialData || lastLoadedStudentId !== null) {
                    lastLoadedStudentId = null; loadFromCloud();
                } else { renderTable(); calculate(); updateCurriculumSelectorVisibility(); }
            }
        }
    }
};
window.saveToCloud = async function(isAuto = false, bulkActionInfo = null) {
    if (!currentUser || !dbClient || curriculum.length === 0) { updateSyncStatusIndicator('offline'); return; }
    const targetId = editingStudentId ? (activeStudentDBRecord?.id || editingStudentId) : currentUser.id;
    const curRecord = editingStudentId ? activeStudentDBRecord : (userDBRecord || currentUser?.user_metadata);
    const targetRole = curRecord?.role || 'student';
    const entryYear = curRecord?.entry_year || '未設定';
    const entryDept = curRecord?.entry_dept || '未設定';
    const targetName = curRecord?.full_name || '學生';
    const targetSid = (curRecord?.student_id || '').split('@')[0].toLowerCase().trim();
    const oldTotal = editingStudentId ? (activeStudentDBRecord?.total_credits || 0) : (userDBRecord?.total_credits || 0);
    const oldChecks = (editingStudentId ? activeStudentDBRecord : userDBRecord)?.credits_json || {};
    const oldViewYr = oldChecks['_view_year'] || entryYear;
    const oldViewDept = oldChecks['_view_dept'] || entryDept;
    updateSyncStatusIndicator('saving');
    const checks = {};
    const semNames = ["一上", "一下", "二上", "二下", "三上", "三下"];
    const changedFields = [];
    document.querySelectorAll(".toggle-checkbox").forEach(c => {
        checks[c.id] = c.checked;
        const semIdx = parseInt(c.dataset.sem || "0");
        const semStr = semNames[semIdx] || `第${semIdx + 1}學期`;
        const subName = c.dataset.name || "未知名科目";
        const credVal = c.dataset.val || "0";
        const isDefaultUnchecked = c.dataset.defaultUnchecked === 'true';
        const wasChecked = oldChecks[c.id] !== undefined ? !!oldChecks[c.id] : !isDefaultUnchecked;
        if (wasChecked !== c.checked) {
            changedFields.push({
                field: `📘 ${subName} 【${semStr}】 (${credVal}學分)`,
                oldVal: wasChecked ? '及格' : '未及格',
                newVal: c.checked ? '✔及格' : '✕未及格'
            });
        }
    });
    const version = determineCurriculumVersion(curRecord);
    const newViewYr = version.locked ? entryYear : currentYear;
    const newViewDept = version.locked ? entryDept : currentDept;
    checks['_view_year'] = newViewYr;
    checks['_view_dept'] = newViewDept;
    const isVersionChanged = targetRole !== 'student' && !version.locked && (oldViewYr !== '未設定' && newViewYr !== '未設定') && (oldViewYr !== newViewYr || oldViewDept !== newViewDept);
    const res = calculateStats();
    let matchedTutor = curRecord?.tutor || (targetRole === 'student' ? await findTutorByYearDept(entryYear, entryDept) : (targetRole === 'admin' ? '管理員免設定' : '教師帳號免設定'));
    try {
        let rpcSuccess = false;
        try {
            const { error: rpcErr } = await dbClient.rpc('admin_save_student_credits', {
                target_id: targetId, target_sid: targetSid, target_name: targetName, entry_year: entryYear,
                entry_dept: entryDept, target_role: targetRole, tutor_name: matchedTutor, credits_data: checks, total_credits_val: res.total || 0
            });
            if (!rpcErr) rpcSuccess = true;
        } catch (e) {}
        if (!rpcSuccess) {
            const payload = {
                id: targetId, student_id: targetSid, full_name: targetName, entry_year: entryYear,
                entry_dept: entryDept, role: targetRole, tutor: matchedTutor, credits_json: checks,
                total_credits: res.total || 0, updated_at: new Date().toISOString()
            };
            const { error } = await dbClient.from('grad_checks').upsert(payload);
            if (error) throw error;
        }
        updateSyncStatusIndicator('success');
        if (!isAuto) showMsg("雲端存檔成功！");
        const activeRec = editingStudentId ? (activeStudentDBRecord || (activeStudentDBRecord = {})) : (userDBRecord || (userDBRecord = {}));
        activeRec.credits_json = checks;
        activeRec.total_credits = res.total || 0;
        if (isVersionChanged) {
            await logAuditRecord("切換版本", targetSid, targetName, { old_version: `${oldViewYr}年 ${oldViewDept}`, new_version: `${newViewYr}年 ${newViewDept}` });
        }
        if (bulkActionInfo || changedFields.length > 0) {
            await logAuditRecord(bulkActionInfo ? bulkActionInfo.actionType : "變更學分紀錄", targetSid, targetName, {
                old_total: oldTotal, new_total: res.total || 0, ...(bulkActionInfo ? bulkActionInfo.details : {}), changed_fields: changedFields
            });
        }
    } catch (err) {
        updateSyncStatusIndicator('offline');
        if (!isAuto) showMsg(translateError(err.message), 'error');
    }
};
window.loadFromCloud = async function(tid = null) {
    if (!currentUser || !dbClient) return;
    updateSyncStatusIndicator('saving');
    try {
        if (tid) {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tid);
            let query = dbClient.from('grad_checks').select('*');
            query = isUuid ? query.eq('id', tid) : query.eq('student_id', tid);
            const { data, error } = await query.single();
            if (error) throw error;
            activeStudentDBRecord = data;
            lastLoadedStudentId = tid;
            const targetNameEl = document.getElementById('targetStudentName');
            if (targetNameEl) {
                const name = data.full_name || '學生';
                const sid = data.student_id ? ` (帳號: ${data.student_id})` : '';
                const classStr = (data.entry_year && data.entry_dept && data.entry_year !== '未設定' && data.entry_dept !== '未設定') ? ` ｜ ${data.entry_year}年 ${data.entry_dept}` : '';
                targetNameEl.innerHTML = `<b class="text-amber-300">${name}</b>${sid}${classStr}`;
            }
            const version = determineCurriculumVersion(data);
            selectCurriculum(version.year, version.dept);
            applyLoadedChecks(data.credits_json || {});
        } else {
            const { data, error } = await dbClient.from('grad_checks').select('*').eq('id', currentUser.id).maybeSingle();
            if (error && error.code !== 'PGRST116') throw error;
            userDBRecord = data || {
                id: currentUser.id, student_id: currentUser.user_metadata?.student_id,
                full_name: currentUser.user_metadata?.full_name, entry_year: currentUser.user_metadata?.entry_year || '未設定',
                entry_dept: currentUser.user_metadata?.entry_dept || '未設定', role: currentUser.user_metadata?.role || 'student',
                tutor: currentUser.user_metadata?.tutor || '未設定'
            };
            hasLoadedInitialData = true;
            const version = determineCurriculumVersion(userDBRecord);
            selectCurriculum(version.year, version.dept);
            applyLoadedChecks(userDBRecord.credits_json || {});
        }
        renderUserStatusDisplay();
        updateHelpModalDetails();
        updateSyncStatusIndicator('success');
    } catch (err) { updateSyncStatusIndicator('offline'); }
};
window.applyLoadedChecks = function(checks) {
    renderTable();
    document.querySelectorAll(".toggle-checkbox").forEach(c => {
        if (checks[c.id] !== undefined) c.checked = checks[c.id];
    });
    calculate();
};
window.evaluateStudentStatus = function(s) {
    const ey = (s.entry_year && s.entry_year !== '未設定') ? s.entry_year : '113';
    const ed = (s.entry_dept && s.entry_dept !== '未設定') ? s.entry_dept : '普通科(理工生醫群)-1';
    const curr = curriculums[`${ey}_${ed}`] || [];
    if (!curr || curr.length === 0) return { status: 'unknown', total: 0, statusText: '課程資料建置中！', badgeClass: 'bg-slate-100 text-slate-600' };
    const trackType = getTrackType(ed);
    const checks = s.credits_json || {};
    let total = 0, dept = 0, prof = 0, prac = 0, reqEarned = 0, optEarned = 0, deptGenEarned = 0, deptGenMax = 0, deptSportsEarned = 0, deptSportsMax = 0, sportsOptEarned = 0, sportsOptMax = 0, maxDept = 0;
    curr.forEach(item => {
        const sum = item.credits.reduce((a, b) => a + b, 0);
        if (item.cat === 'dept') maxDept += sum;
        if (item.cat === 'dept' && item.type === 1) deptGenMax += sum;
        else if (item.cat === 'dept_sports' || (item.cat === 'dept' && item.type === 2)) deptSportsMax += sum;
        else if (item.cat === 'sch_opt') sportsOptMax += sum;
        item.credits.forEach((c, sIdx) => {
            if (c > 0) {
                const id = getChkId(item.name, sIdx);
                const isChecked = checks[id] !== undefined ? checks[id] : (!item.defaultUnchecked);
                if (isChecked) {
                    total += c;
                    if (item.cat === 'dept') dept += c;
                    if (item.type === 2 || item.type === 3) prof += c;
                    if (item.type === 3) prac += c;
                    if (item.cat === 'dept' || item.cat === 'sch_req') reqEarned += c;
                    if (item.cat === 'sch_opt') optEarned += c;
                    if (item.cat === 'dept' && item.type === 1) deptGenEarned += c;
                    if (item.cat === 'dept_sports' || (item.cat === 'dept' && item.type === 2)) deptSportsEarned += c;
                    if (item.cat === 'sch_opt') sportsOptEarned += c;
                }
            }
        });
    });
    const deptThreshold = Math.ceil(maxDept * 0.85);
    let pass = false;
    if (trackType === 'academic') pass = (total >= 150 && reqEarned >= 102 && optEarned >= 40);
    else if (trackType === 'sports') pass = (total >= 150 && deptGenEarned >= Math.ceil(deptGenMax * 0.8) && deptSportsEarned >= Math.ceil(deptSportsMax * 0.85) && sportsOptEarned >= Math.ceil(sportsOptMax * 0.7));
    else pass = (total >= 160 && dept >= deptThreshold && prof >= 60 && prac >= 45);
    if (pass) return { status: 'pass', total, statusText: '🎓 符合畢業門檻', badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-300' };
    else if (total >= 120) return { status: 'completion', total, statusText: '📜 修業證明資格', badgeClass: 'bg-amber-100 text-amber-800 border border-amber-300' };
    else return { status: 'fail', total, statusText: '⚠️ 需重補修/成績證明', badgeClass: 'bg-rose-100 text-rose-800 border border-rose-300' };
};
window.renderAdminStats = function(filteredList) {
    const panel = document.getElementById('adminStatsPanel');
    if (!panel) return;
    const studentList = filteredList.filter(s => s.role === 'student');
    const totalCount = studentList.length;
    if (totalCount === 0) {
        panel.innerHTML = `<div class="col-span-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500 font-bold">目前條件下無學生可進行統計數據分析</div>`;
        return;
    }
    let passCnt = 0, compCnt = 0, failCnt = 0, totalCreditsSum = 0;
    studentList.forEach(s => {
        const st = evaluateStudentStatus(s);
        if (st.status === 'pass') passCnt++;
        else if (st.status === 'completion') compCnt++;
        else failCnt++;
        totalCreditsSum += st.total;
    });
    panel.innerHTML = `
        <div class="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-4 rounded-xl shadow-sm flex flex-col justify-between">
            <div class="flex justify-between items-center mb-1">
                <span class="text-xs font-black text-emerald-100 uppercase tracking-wider">班級畢業達成率</span>
                <span class="text-[0.7rem] bg-emerald-900/60 text-emerald-100 font-extrabold px-2 py-0.5 rounded-full">${passCnt} / ${totalCount} 人</span>
            </div>
            <div class="text-2xl font-black mb-1">${Math.round((passCnt / totalCount) * 100)}%</div>
            <div class="w-full bg-emerald-950/40 h-2 rounded-full overflow-hidden">
                <div class="bg-white h-full rounded-full" style="width: ${Math.round((passCnt / totalCount) * 100)}%"></div>
            </div>
        </div>
        <div class="bg-white border border-emerald-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
            <div class="text-xs font-black text-emerald-800 mb-1 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>🎓 畢業證書資格</div>
            <div class="text-2xl font-black text-emerald-700 mb-1">${passCnt} <span class="text-xs font-bold text-slate-500">人</span></div>
            <div class="text-[0.72rem] text-slate-500 font-semibold">已同時滿足所有畢業學分門檻</div>
        </div>
        <div class="bg-white border border-amber-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
            <div class="text-xs font-black text-amber-800 mb-1 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span>📜 修業證明資格</div>
            <div class="text-2xl font-black text-amber-700 mb-1">${compCnt} <span class="text-xs font-bold text-slate-500">人</span></div>
            <div class="text-[0.72rem] text-slate-500 font-semibold">累積滿 120 學分但未達畢業</div>
        </div>
        <div class="bg-white border border-rose-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
            <div class="text-xs font-black text-rose-800 mb-1 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-500"></span>⚠️ 需重補修 / 成績證明</div>
            <div class="text-2xl font-black text-rose-700 mb-1">${failCnt} <span class="text-xs font-bold text-slate-500">人</span></div>
            <div class="text-[0.72rem] text-slate-500 font-semibold">平均取得：<b class="text-slate-800 font-black">${(totalCreditsSum / totalCount).toFixed(1)}</b> 學分</div>
        </div>
    `;
};
window.applyFilters = function() {
    const searchText = document.getElementById('adminSearchInput').value.toLowerCase(), 
        filterRoles = getMSValues('role'), filterYears = getMSValues('year'),
        filterDepts = getMSValues('dept'), filterStatuses = getMSValues('status'),
        role = userDBRecord?.role || currentUser?.user_metadata?.role || 'student',
        myYear = userDBRecord?.entry_year || currentUser?.user_metadata?.entry_year,
        myDept = userDBRecord?.entry_dept || currentUser?.user_metadata?.entry_dept;
    let filtered = [...adminListData];
    if (role === 'teacher') {
        filtered = (myYear !== '未設定' && myDept !== '未設定') ? filtered.filter(s => s.entry_year === myYear && s.entry_dept === myDept && s.role === 'student') : filtered.filter(s => s.role === 'student');
    }
    if (searchText) filtered = filtered.filter(s => (s.full_name && s.full_name.toLowerCase().includes(searchText)) || (s.student_id && s.student_id.toLowerCase().includes(searchText)));
    if (!filterRoles.includes('all')) {
        filtered = filtered.filter(s => {
            if (filterRoles.includes('student') && s.role === 'student') return true;
            if (filterRoles.includes('admin') && s.role === 'admin') return true;
            const isTutor = (s.role === 'teacher' && s.entry_year !== '未設定' && s.entry_dept !== '未設定');
            if (filterRoles.includes('tutor') && isTutor) return true;
            if (filterRoles.includes('teacher') && s.role === 'teacher' && !isTutor) return true;
            return false;
        });
    }
    if (!filterYears.includes('all')) filtered = filtered.filter(s => filterYears.includes(s.entry_year));
    if (!filterDepts.includes('all')) filtered = filtered.filter(s => filterDepts.includes(s.entry_dept));
    if (!filterStatuses.includes('all')) {
        filtered = filtered.filter(s => {
            if (s.role !== 'student') return false;
            const st = evaluateStudentStatus(s);
            if (filterStatuses.includes('not_pass') && st.status !== 'pass') return true;
            return filterStatuses.includes(st.status);
        });
    }
    const roleOrder = { admin: 1, teacher: 2, student: 3 };
    const getDeptNumber = (dept) => {
        if (!dept || dept === '未設定') return 999;
        const match = dept.match(/-(\d+)$/);
        if (match) return parseInt(match[1], 10);
        const idx = DEPT_OPTIONS.indexOf(dept);
        return idx !== -1 ? idx + 1 : 999;
    };
    filtered.sort((a, b) => {
        const orderA = roleOrder[a.role] || 4, orderB = roleOrder[b.role] || 4;
        if (orderA !== orderB) return orderA - orderB;
        const yA = a.entry_year || '999';
        const yB = b.entry_year || '999';
        if (yA !== yB) return yA.localeCompare(yB, undefined, { numeric: true });
        const deptNumA = getDeptNumber(a.entry_dept);
        const deptNumB = getDeptNumber(b.entry_dept);
        if (deptNumA !== deptNumB) return deptNumA - deptNumB;
        return (a.student_id || '').localeCompare(b.student_id || '', undefined, { numeric: true });
    });
    return filtered;
};
window.fetchAdminList = async function(isClientOnly = false) {
    if (!dbClient) return;
    updateSyncStatusIndicator('saving');
    try {
        if (!isClientOnly) {
            const { data, error } = await dbClient.from('grad_checks').select('*');
            if (error) throw error;
            adminListData = data || [];
            teacherNames = adminListData.filter(u => u.role === 'teacher').map(u => u.full_name);
        }
        renderAdminTable();
        updateSyncStatusIndicator('success');
    } catch (err) { updateSyncStatusIndicator('offline'); }
};
window.deleteStudentData = function(id, name) {
    if (!dbClient) return;
    showConfirmModal(`您確定要刪除「${name}」嗎？此操作將清除該帳號所有資料，無法恢復！`, "刪除帳號", async () => {
        try {
            updateSyncStatusIndicator('saving');
            const studentRec = adminListData.find(s => s.id === id);
            const sid = (studentRec?.student_id || id).split('@')[0].toLowerCase().trim();
            let rpcSuccess = false;
            try {
                const { error: rpcErr } = await dbClient.rpc('admin_delete_user', { target_user_id: id });
                if (!rpcErr) rpcSuccess = true;
            } catch (e) {}
            if (!rpcSuccess) {
                await dbClient.from('grad_checks').delete().eq('id', id);
                if (sid) {
                    await dbClient.from('grad_checks').delete().eq('student_id', sid);
                    await dbClient.from('user_feedbacks').delete().eq('student_id', sid);
                    await dbClient.from('audit_logs').delete().or(`target_student_id.eq.${sid},operator_id.eq.${id}`);
                }
            }
            adminListData = adminListData.filter(s => s.id !== id && s.student_id !== sid);
            renderAdminTable();
            updateSyncStatusIndicator('success');
            showMsg(`已成功刪除「${name}」！`);
            logAuditRecord("刪除帳號", sid, name, { deleted_name: name, deleted_sid: sid });
            toggleUIModal(false, 'confirmModal');
            fetchAdminList();
        } catch (err) {
            updateSyncStatusIndicator('offline');
            showMsg(translateError(err.message), "error");
            toggleUIModal(false, 'confirmModal');
        }
    }, "確認刪除資料", "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)");
};
window.renderAdminTable = function() {
    const tableBody = document.getElementById('adminListBody'), cardsContainer = document.getElementById('adminCardsContainer');
    tableBody.innerHTML = ""; cardsContainer.innerHTML = "";
    const filtered = applyFilters();
    const countText = document.getElementById('adminTotalCountText');
    if (countText) { countText.style.display = 'inline-block'; countText.innerText = `共 ${filtered.length} 筆帳號`; }
    renderAdminStats(filtered);
    filtered.forEach((s, i) => {
        const isTutor = (s.role === 'teacher' && s.entry_year !== '未設定' && s.entry_dept !== '未設定');
        const roleClass = s.role === 'admin' ? 'badge-admin' : (isTutor ? 'badge-tutor' : (s.role === 'teacher' ? 'badge-teacher' : 'badge-student'));
        const roleDisplayName = s.role === 'admin' ? '管理員' : (isTutor ? '導師' : (mapping.role[s.role] || '使用者'));
        const classInfo = (s.entry_year === '未設定' || s.entry_dept === '未設定') ? '未設定' : `${s.entry_year}年/${s.entry_dept}`;
        const evalRes = s.role === 'student' ? evaluateStudentStatus(s) : null;
        const statusTagHtml = evalRes ? `<span class="text-[0.72rem] font-bold px-2.5 py-1 rounded-md inline-block ${evalRes.badgeClass}">${evalRes.statusText}<br><span class="opacity-80 font-semibold">(${evalRes.total}學分)</span></span>` : '<span class="text-xs text-slate-400 font-semibold">-</span>';
        const tr = document.createElement('tr');
        let btnsDesktop = '<div class="flex items-center w-full gap-1.5 flex-nowrap">';
        const studentTargetId = s.student_id || s.id;
        if (s.role === 'student') {
            btnsDesktop += `<button class="btn-mini flex-auto min-w-0 text-xs px-2 text-center font-bold" style="background:#10b981" onclick="enterAdminEditMode('${studentTargetId}','${s.full_name}')">檢視學分狀態</button>`;
        }
        btnsDesktop += `<button class="btn-mini flex-auto min-w-0 text-xs px-2 text-center font-bold" style="background:#6366f1;" onclick="openAuditLogModal('${s.student_id}')">📜 歷程</button>`;
        btnsDesktop += `<button class="btn-mini flex-auto min-w-0 text-xs px-2 text-center font-bold" style="background:#3b82f6" onclick="openAdminUserEdit(${i})">帳號設定</button>
                        <button class="btn-mini flex-auto min-w-0 text-xs px-2 text-center font-bold" style="background:#ef4444" onclick="deleteStudentData('${s.id}','${s.full_name}')">刪除</button></div>`;
        tr.innerHTML = `<td><b>${s.full_name}</b></td><td>${s.student_id || '-'}</td><td><span class="role-badge ${roleClass}">${roleDisplayName}</span></td><td>${classInfo}</td><td>${statusTagHtml}</td><td>${btnsDesktop}</td>`;
        tableBody.appendChild(tr);
        const card = document.createElement('div');
        card.className = "mobile-card p-4 flex flex-col gap-3";
        let btnsMobile = '';
        if (s.role === 'student') {
            btnsMobile += `<button class="flex-auto min-w-0 py-2 px-2 text-[11px] rounded-lg font-bold text-white bg-emerald-500" onclick="enterAdminEditMode('${studentTargetId}','${s.full_name}')">檢視學分狀態</button>`;
        }
        btnsMobile += `<button class="flex-auto min-w-0 py-2 px-2 text-[11px] rounded-lg font-bold text-white bg-indigo-600" onclick="openAuditLogModal('${s.student_id}')">📜 歷程</button>`;
        btnsMobile += `<button class="flex-auto min-w-0 py-2 px-2 text-[11px] rounded-lg font-bold text-white bg-blue-500" onclick="openAdminUserEdit(${i})">帳號設定</button>
                       <button class="flex-auto min-w-0 py-2 px-2 text-[11px] rounded-lg font-bold text-white bg-red-500" onclick="deleteStudentData('${s.id}','${s.full_name}')">刪除</button>`;
        card.innerHTML = `
            <div class="flex justify-between items-start border-b border-slate-100 pb-2">
                <div><div class="text-sm font-bold text-slate-800">${s.full_name}</div><div class="text-xs text-slate-500">帳號: ${s.student_id || '-'}</div></div>
                <span class="role-badge ${roleClass} text-xs py-1 px-2.5 rounded-full font-bold text-white">${roleDisplayName}</span>
            </div>
            <div class="text-xs text-slate-600 flex justify-between"><span>入學年 / 科別:</span><span class="font-semibold text-slate-800">${classInfo}</span></div>
            <div class="text-xs text-slate-600 flex justify-between border-t border-dashed border-slate-200 pt-2"><span>畢業門檻資格:</span><div>${statusTagHtml}</div></div>
            <div class="flex gap-1.5 mt-1">${btnsMobile}</div>
        `;
        cardsContainer.appendChild(card);
    });
};
window.enterAdminEditMode = function(id, name) {
    if (currentIndependentPage) closeIndependentPage();
    editingStudentId = id; isViewingClassList = false;
    document.getElementById('targetStudentName').innerText = `${name || '學生'} (資料讀取中...)`;
    scrollToTop(); updateUI(); loadFromCloud(id);
};
window.exitAdminEditMode = function() {
    editingStudentId = null; activeStudentDBRecord = null; lastLoadedStudentId = null; isViewingClassList = true;
    scrollToTop(); updateUI();
};
window.openAdminUserEdit = function(index) {
    const s = applyFilters()[index];
    if (!s) return;
    document.getElementById('editUserId').value = s.id;
    document.getElementById('editUserSid').value = s.student_id || '';
    document.getElementById('editUserName').value = s.full_name || '';
    document.getElementById('editUserEntryYear').value = s.entry_year || '未設定';
    document.getElementById('editUserEntryDept').value = s.entry_dept || '未設定';
    document.getElementById('editUserRole').value = s.role || 'student';
    toggleAdminTutorField(s.role || 'student', s.tutor);
    document.getElementById('editUserCustomPassword').value = '';
    toggleUIModal(true, 'adminUserModal');
};
window.toggleAdminTutorField = function(roleVal, currentTutor = '') {
    const sec = document.getElementById('editTutorSection');
    const wrapper = document.getElementById('editTutorWrapper');
    if (!sec || !wrapper) return;
    if (roleVal === 'student') {
        sec.style.display = 'block';
        let optionsHtml = `<select id="editUserTutor" class="sort-select w-full bg-white"><option value="未設定">未設定</option>`;
        teacherNames.forEach(tName => { optionsHtml += `<option value="${tName}">${tName}</option>`; });
        wrapper.innerHTML = optionsHtml + `</select>`;
        if (currentTutor) document.getElementById('editUserTutor').value = currentTutor;
    } else {
        sec.style.display = 'none'; wrapper.innerHTML = '';
    }
};
window.saveAdminUserEdit = async function() {
    if (!dbClient) return;
    const id = document.getElementById('editUserId').value;
    const sid = document.getElementById('editUserSid').value.split('@')[0].toLowerCase().trim();
    const name = document.getElementById('editUserName').value.trim();
    const year = document.getElementById('editUserEntryYear').value;
    const dept = document.getElementById('editUserEntryDept').value;
    const role = document.getElementById('editUserRole').value;
    const tutor = (role === 'student') ? (document.getElementById('editUserTutor')?.value || '未設定') : '免設定';
    if (!sid || !name) { showMsg("請填寫完整帳號與姓名", "error"); return; }
    try {
        updateSyncStatusIndicator('saving');
        const { error } = await dbClient.rpc('admin_update_user_sid', { target_user_id: id, new_sid: sid, new_name: name, new_year: year, new_dept: dept, new_role: role, new_tutor: tutor });
        if (error) throw error;
        updateSyncStatusIndicator('success');
        showMsg("帳號資料修改成功！");
        logAuditRecord("更改帳號資料", sid, name, { year, dept, role });
        toggleUIModal(false, 'adminUserModal'); fetchAdminList();
    } catch (err) {
        updateSyncStatusIndicator('offline'); showMsg(translateError(err.message), 'error');
    }
};
window.renderMobileCards = function(checkedStates) {
    const container = document.getElementById("mobileCardsContainer");
    if (!container) return;
    container.className = "mobile-cards-grid";
    container.innerHTML = "";
    const semNames = ["一上", "一下", "二上", "二下", "三上", "三下"];
    curriculum.forEach(item => {
        const catInfo = mapping.cat[item.cat] || { text: item.cat, class: "bg-slate-100 text-slate-700 border border-slate-200" };
        const card = document.createElement("div");
        card.className = "mobile-card";
        let semGridHtml = `<div class="mobile-semesters-grid">`;
        item.credits.forEach((c, sIdx) => {
            if (c > 0) {
                const id = getChkId(item.name, sIdx);
                const isChecked = checkedStates[id] !== undefined ? checkedStates[id] : (!item.defaultUnchecked);
                semGridHtml += `
                    <div class="mobile-sem-item">
                        <span class="mobile-sem-label">${semNames[sIdx]}</span>
                        <div class="mobile-score-box">
                            <input type="checkbox" id="${id}" class="toggle-checkbox" data-cat="${item.cat}" data-type="${item.type}" data-val="${c}" data-sem="${sIdx}" data-name="${item.name}" data-default-unchecked="${item.defaultUnchecked ? 'true' : 'false'}" ${isChecked ? 'checked' : ''} onchange="calculate(); saveToCloud(true);">
                            <label for="${id}" class="score-label">${c}</label>
                        </div>
                    </div>`;
            } else {
                semGridHtml += `
                    <div class="mobile-sem-item"><span class="mobile-sem-label">${semNames[sIdx]}</span>
                        <div class="mobile-score-box"><div class="score-label zero-score">-</div></div>
                    </div>`;
            }
        });
        semGridHtml += `</div>`;
        card.innerHTML = `
            <div class="flex items-start justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
                <span class="font-extrabold text-sm sm:text-base text-slate-800 break-words leading-snug">${item.name}</span>
                <div class="flex items-center gap-1.5 shrink-0 pt-0.5">
                    <span class="mobile-badge ${catInfo.class}">${catInfo.text}</span>
                    <span class="mobile-badge bg-slate-100 text-slate-600 border border-slate-200">${mapping.type[item.type] || "一般"}</span>
                </div>
            </div>
            ${semGridHtml}
        `;
        container.appendChild(card);
    });
};
window.updateSemesterProgress = function(input, sIdx) {
    const card = input.closest('.semester-card');
    if (!card) return;
    let semMax = 0, semEarned = 0;
    card.querySelectorAll('.toggle-checkbox').forEach(chk => {
        const val = parseInt(chk.dataset.val || '0');
        semMax += val;
        if (chk.checked) semEarned += val;
    });
    card.querySelector('.sem-earned-val').innerText = semEarned;
    card.querySelector('.sem-progress-bar').style.width = `${semMax > 0 ? Math.min(100, Math.round((semEarned / semMax) * 100)) : 0}%`;
};
window.renderSemesterCards = function(checkedStates) {
    const container = document.getElementById("mobileCardsContainer");
    if (!container) return;
    container.className = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 my-4";
    container.innerHTML = "";
    const semNames = ["第一學期 (一上)", "第二學期 (一下)", "第三學期 (二上)", "第四學期 (二下)", "第五學期 (三上)", "第六學期 (三下)"];
    semNames.forEach((semTitle, sIdx) => {
        let semMax = 0, semEarned = 0, itemsHtml = "";
        curriculum.forEach(item => {
            const c = item.credits[sIdx];
            if (c > 0) {
                semMax += c;
                const id = getChkId(item.name, sIdx);
                const isChecked = checkedStates[id] !== undefined ? checkedStates[id] : (!item.defaultUnchecked);
                if (isChecked) semEarned += c;
                const catInfo = mapping.cat[item.cat] || { text: item.cat, class: "bg-slate-100 text-slate-700 border border-slate-200" };
                itemsHtml += `
                    <div class="sem-item-row flex items-center justify-between p-2.5 rounded-xl transition-all gap-2 cursor-pointer select-none">
                        <input type="checkbox" id="${id}" class="toggle-checkbox sem-checkbox sr-only" data-cat="${item.cat}" data-type="${item.type}" data-val="${c}" data-sem="${sIdx}" data-name="${item.name}" data-default-unchecked="${item.defaultUnchecked ? 'true' : 'false'}" ${isChecked ? 'checked' : ''} onchange="calculate(); updateSemesterProgress(this, ${sIdx}); saveToCloud(true);">
                        <label for="${id}" class="sem-label flex items-center justify-between w-full cursor-pointer gap-2 min-w-0">
                            <div class="flex items-center gap-2.5 min-w-0 flex-1">
                                <div class="custom-check-box w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all shrink-0">
                                    <i class="fa-solid fa-check text-[10px] text-white opacity-0 transform scale-50 transition-all"></i>
                                </div>
                                <span class="sub-name text-xs sm:text-sm font-extrabold text-slate-800 break-words leading-snug">${item.name}</span>
                                <span class="credit-badge text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-200/80 text-slate-700 shrink-0">${c} 學分</span>
                            </div>
                            <div class="flex items-center gap-1 shrink-0 pt-0.5">
                                <span class="mobile-badge text-[10px] py-0.5 px-1.5 ${catInfo.class}">${catInfo.text}</span>
                            </div>
                        </label>
                    </div>`;
            }
        });
        if (semMax === 0) return;
        const card = document.createElement("div");
        card.className = "semester-card flex flex-col justify-between";
        card.innerHTML = `
            <div>
                <div class="flex items-center justify-between mb-2">
                    <h4 class="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2"><span class="w-2 h-4 bg-emerald-500 rounded-full"></span>${semTitle}</h4>
                    <div class="text-xs font-black text-slate-600">取得 <span class="sem-earned-val text-emerald-600 text-sm font-black">${semEarned}</span> / <span>${semMax}</span> 學分</div>
                </div>
                <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-3">
                    <div class="sem-progress-bar bg-emerald-500 h-full" style="width: ${Math.min(100, Math.round((semEarned / semMax) * 100))}%;"></div>
                </div>
                <div class="flex gap-2 mb-3 pt-1 border-b border-slate-100 pb-3">
                    <button type="button" class="flex-1 py-1.5 px-2 text-xs font-extrabold text-emerald-700 bg-emerald-50 rounded-lg" onclick="setSemesterStatus(${sIdx}, true)">✔ 本學期全部及格</button>
                    <button type="button" class="flex-1 py-1.5 px-2 text-xs font-extrabold text-slate-600 bg-slate-100 rounded-lg" onclick="setSemesterStatus(${sIdx}, false)">✕ 本學期學分歸零</button>
                </div>
                <div class="space-y-2">${itemsHtml}</div>
            </div>
        `;
        container.appendChild(card);
    });
};
window.renderTable = function() {
    const mobileContainer = document.getElementById("mobileCardsContainer"), constructionBox = document.getElementById("underConstructionBox");
    const role = userDBRecord?.role || currentUser?.user_metadata?.role || 'student';
    const myYear = userDBRecord?.entry_year || currentUser?.user_metadata?.entry_year || '未設定';
    const myDept = userDBRecord?.entry_dept || currentUser?.user_metadata?.entry_dept || '未設定';
    if (isViewingClassList || (!editingStudentId && role === 'student' && (myYear === '未設定' || myDept === '未設定'))) {
        if (mobileContainer) { mobileContainer.style.display = "none"; mobileContainer.innerHTML = ""; }
        constructionBox?.classList.add("hidden"); return;
    }
    const checkedStates = {};
    document.querySelectorAll(".toggle-checkbox").forEach(chk => checkedStates[chk.id] = chk.checked);
    if (curriculum.length === 0) {
        if (mobileContainer) { mobileContainer.style.display = "none"; mobileContainer.innerHTML = ""; }
        constructionBox?.classList.remove("hidden");
        document.getElementById("constYearDept").innerText = `${currentYear}年入學 ${currentDept}`;
        return;
    }
    constructionBox?.classList.add("hidden");
    if (mobileContainer) mobileContainer.style.display = "grid";
    if (currentLayoutMode === 'subject') renderMobileCards(checkedStates);
    else renderSemesterCards(checkedStates);
};
window.changeDashCurriculum = function() {
    const yr = document.getElementById('dashSelectYear').value, dept = document.getElementById('dashSelectDept').value;
    sessionStorage.setItem('tempSelectedYear', yr); sessionStorage.setItem('tempSelectedDept', dept);
    selectCurriculum(yr, dept);
    applyLoadedChecks((editingStudentId ? activeStudentDBRecord : userDBRecord)?.credits_json || {});
};
window.setLayoutMode = function(mode) {
    currentLayoutMode = mode;
    sessionStorage.setItem('tempLayoutMode', mode);
    document.getElementById('btnLayoutSubject').className = mode === 'subject' ? "flex-1 md:flex-none px-6 py-2 text-xs font-extrabold rounded-lg transition-all bg-white text-slate-800 shadow-md" : "flex-1 md:flex-none px-6 py-2 text-xs font-extrabold rounded-lg transition-all text-slate-600";
    document.getElementById('btnLayoutSemester').className = mode === 'semester' ? "flex-1 md:flex-none px-6 py-2 text-xs font-extrabold rounded-lg transition-all bg-white text-slate-800 shadow-md" : "flex-1 md:flex-none px-6 py-2 text-xs font-extrabold rounded-lg transition-all text-slate-700";
    scrollToTop(); renderTable(); calculate();
};
window.handleMainAction = function() {
    const role = userDBRecord?.role || currentUser?.user_metadata?.role || 'student';
    if (role === 'admin' || role === 'teacher') {
        if (currentIndependentPage) closeIndependentPage();
        isViewingClassList = true; editingStudentId = null;
        scrollToTop(); updateUI();
    }
};
window.handleReturnToTrial = function() {
    if (currentIndependentPage) closeIndependentPage();
    isViewingClassList = false;
    const myYear = userDBRecord?.entry_year || '113', myDept = userDBRecord?.entry_dept || '普通科(理工生醫群)-1';
    selectCurriculum(myYear, myDept);
    scrollToTop(); updateUI(); loadFromCloud();
};
window.openProfile = function() {
    if (!currentUser) return;
    const curData = userDBRecord || currentUser.user_metadata, role = curData.role || 'student';
    initDropdowns(role === 'admin');
    document.getElementById('profAccount').value = curData.student_id || '';
    document.getElementById('profName').value = curData.full_name || '';
    document.getElementById('profEntryYear').value = curData.entry_year || '未設定';
    document.getElementById('profEntryDept').value = curData.entry_dept || '未設定';
    document.getElementById('profStudentTutorArea').style.display = role === 'student' ? 'block' : 'none';
    if (role === 'student') document.getElementById('profTutor').value = curData.tutor || '未設定';
    document.getElementById('profPassword').value = '';
    toggleUIModal(true, 'profileModal');
};
window.updateProfile = async function() {
    const n = document.getElementById('profName').value, p = document.getElementById('profPassword').value, d = { data: { full_name: n } };
    if (p) d.password = p;
    try {
        const curData = userDBRecord || currentUser.user_metadata;
        updateSyncStatusIndicator('saving');
        await dbClient.auth.updateUser(d);
        updateSyncStatusIndicator('success');
        showMsg("個人資料已更新！");
        logAuditRecord("更新個人資料", curData.student_id, curData.full_name, { passwordChanged: !!p });
        toggleUIModal(false, 'profileModal');
    } catch (err) {
        updateSyncStatusIndicator('offline'); showMsg(translateError(err.message), 'error');
    }
};
window.showMissingCreditsModal = function() {
    if (curriculum.length === 0) { showMsg("目前版本的課表尚未建置！", "error"); return; }
    const semFullNames = ["第一學期 (一上)", "第二學期 (一下)", "第三學期 (二上)", "第四學期 (二下)", "第五學期 (三上)", "第六學期 (三下)"];
    currentUncheckedCredits = [];
    document.querySelectorAll(".toggle-checkbox:not(:checked)").forEach(input => {
        const name = input.dataset.name, semIdx = parseInt(input.dataset.sem), val = parseInt(input.dataset.val), cat = input.dataset.cat, type = parseInt(input.dataset.type);
        if (name) currentUncheckedCredits.push({ name, sem: semFullNames[semIdx], val, cat, type, semIdx });
    });
    const filterSel = document.getElementById("missingCreditsFilter");
    if (filterSel) {
        let optionsHtml = `<option value="all">全部學期</option>`;
        semFullNames.forEach((sem, idx) => { optionsHtml += `<option value="${idx}">${sem}</option>`; });
        filterSel.innerHTML = optionsHtml;
        filterSel.value = "all";
    }
    renderMissingCreditsFiltered();
    toggleUIModal(true, 'missingCreditsModal');
};
window.renderMissingCreditsFiltered = function() {
    const filterVal = document.getElementById("missingCreditsFilter").value;
    const listContainer = document.getElementById("missingCreditsList");
    const semFullNames = ["第一學期 (一上)", "第二學期 (一下)", "第三學期 (二上)", "第四學期 (二下)", "第五學期 (三上)", "第六學期 (三下)"];
    let filtered = [...currentUncheckedCredits];
    if (filterVal !== "all") filtered = filtered.filter(item => item.semIdx === parseInt(filterVal));
    if (filtered.length === 0) {
        listContainer.innerHTML = `<div class="text-center py-10 px-4"><div class="text-5xl mb-4">🎉</div><p class="font-black text-lg text-emerald-600">目前無任何未得學分！</p></div>`;
    } else {
        let totalCredits = filtered.reduce((sum, i) => sum + i.val, 0);
        let html = `<p class="text-xs text-slate-500 font-extrabold mb-4 bg-amber-50 border border-amber-200/60 rounded-lg p-2.5 text-amber-800">未取得科目共計 <span class="text-red-500 font-black">${filtered.length}</span> 科，累計：<span class="text-red-500 font-black">${totalCredits}</span> 學分</p>`;
        const grouped = {};
        filtered.forEach(item => { if (!grouped[item.sem]) grouped[item.sem] = []; grouped[item.sem].push(item); });
        semFullNames.forEach(sem => {
            if (grouped[sem] && grouped[sem].length > 0) {
                html += `<div class="bg-slate-50 rounded-xl p-3.5 border border-slate-200 shadow-sm mb-3">
                    <h5 class="text-xs font-black text-slate-700 border-b border-slate-200/80 pb-2 mb-2 flex justify-between"><span>📅 ${sem}</span><span class="text-red-600">未得 ${grouped[sem].reduce((sum, i) => sum + i.val, 0)} 學分</span></h5>
                    <div class="space-y-2">`;
                grouped[sem].forEach(item => {
                    html += `<div class="flex items-center justify-between text-xs py-1 px-1.5"><span class="font-bold text-slate-800">${item.name}</span><span class="font-extrabold text-red-500">${item.val} 學分</span></div>`;
                });
                html += `</div></div>`;
            }
        });
        listContainer.innerHTML = html;
    }
};
window.initBackToTop = function() {
    const sc = document.getElementById('scrollContainer');
    if (sc) {
        sc.addEventListener('scroll', () => {
            const btn = document.getElementById('backToTopBtn');
            if (!btn) return;
            if (sc.scrollTop > 300) {
                btn.classList.remove('opacity-0', 'translate-y-10', 'pointer-events-none');
                btn.classList.add('opacity-100', 'translate-y-0');
            } else {
                btn.classList.add('opacity-0', 'translate-y-10', 'pointer-events-none');
                btn.classList.remove('opacity-100', 'translate-y-0');
            }
        });
    }
};
if (dbClient) {
    dbClient.auth.onAuthStateChange((event, session) => {
        currentUser = session ? session.user : null;
        const authWorkspace = document.getElementById('authWorkspace'), appWorkspace = document.getElementById('appWorkspace');
        if (!currentUser) {
            cleanupRealtimeSubscriptions();
            authWorkspace.style.display = 'flex'; appWorkspace.style.display = 'none'; userDBRecord = null;
            hasLoadedInitialData = false; lastLoadedStudentId = null; activeStudentDBRecord = null; isViewingClassList = false;
            editingStudentId = null; lastUserId = null; sessionStorage.removeItem('helpModalShown');
            currentIndependentPage = null; window.location.hash = '';
        } else {
            authWorkspace.style.display = 'none'; appWorkspace.style.display = 'flex';
            if (lastUserId !== currentUser.id) { hasLoadedInitialData = false; userDBRecord = null; lastUserId = currentUser.id; }
            handleHashRouting();
            setupRealtimeSubscriptions();
            fetchAnnouncements();
            updateUI();
        }
    });
} else {
    setTimeout(() => {
        document.getElementById('authWorkspace').style.display = 'flex';
        document.getElementById('appWorkspace').style.display = 'none';
    }, 100);
}
window.addEventListener('hashchange', () => {
    if (currentUser) {
        handleHashRouting();
        updateUI();
    }
});
initDropdowns(false);
fetchCloudCurriculums().then(() => {
    selectCurriculum(currentYear, currentDept);
    renderTable();
    calculate();
});
fetchAnnouncements();
initHelpModalScrollGuard();
initBackToTop();
