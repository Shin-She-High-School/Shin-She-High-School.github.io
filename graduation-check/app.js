window.isWebSocketAllowed = function() {
	return typeof WebSocket !== 'undefined';
};

let realtimeGradChecksChannel = null;
let realtimeFeedbacksChannel = null;
let realtimeAuditLogsChannel = null;
let realtimeAnnouncementsChannel = null;

window.setupRealtimeSubscriptions = function() {
	const client = ensureDbClient();
	if (!client) return;
	cleanupRealtimeSubscriptions();
	try {
		if (!isWebSocketAllowed()) return;
		realtimeGradChecksChannel = client
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

		realtimeFeedbacksChannel = client
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

		realtimeAuditLogsChannel = client
			.channel('realtime_audit_logs')
			.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, (payload) => {
				if (payload.new) {
					auditLogsData.unshift(payload.new);
					if (currentIndependentPage === 'auditLogView') renderAuditLogList();
				}
			})
			.subscribe();

		realtimeAnnouncementsChannel = client
			.channel('realtime_announcements')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
				fetchAnnouncements();
			})
			.subscribe();
	} catch (e) {}
};

window.cleanupRealtimeSubscriptions = function() {
	const client = ensureDbClient();
	if (!client) return;
	try {
		if (realtimeGradChecksChannel) client.removeChannel(realtimeGradChecksChannel);
		if (realtimeFeedbacksChannel) client.removeChannel(realtimeFeedbacksChannel);
		if (realtimeAuditLogsChannel) client.removeChannel(realtimeAuditLogsChannel);
		if (realtimeAnnouncementsChannel) client.removeChannel(realtimeAnnouncementsChannel);
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

window.fetchAnnouncements = async function() {
	const client = ensureDbClient();
	if (!client) return;
	try {
		const { data, error } = await client.from('announcements').select('*');
		if (!error && data) {
			announcementsData = data;
			announcementsData.sort((a, b) => {
				const orderA = a.sort_order ?? 0;
				const orderB = b.sort_order ?? 0;
				if (orderA !== orderB) return orderA - orderB;
				return new Date(b.created_at || 0) - new Date(a.created_at || 0);
			});
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
	let html = marqueeItems.map(a => `<span class="inline-flex items-center gap-1.5"><span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold text-[10px]">${escapeHtml(a.category || '🎓 公告')}</span><b>${escapeHtml(a.title)}</b>: ${escapeHtml(a.content)}</span>`).join('<span class="opacity-40 px-3">丨</span>');
	marqueeEl.innerHTML = html;
};

window.moveAnnouncementOrder = async function(index, direction) {
	const client = ensureDbClient();
	if (!client) return;
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
	announcementsData.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
	renderAdminAnnounceList();
	renderMarquee();
	renderIndependentAnnouncements();
	try {
		updateSyncStatusIndicator('saving');
		await Promise.all([
			client.from('announcements').update({ sort_order: currentItem.sort_order }).eq('id', currentItem.id),
			client.from('announcements').update({ sort_order: targetItem.sort_order }).eq('id', targetItem.id)
		]);
		updateSyncStatusIndicator('success');
		AuditService.logRecord("更新公告排序", currentItem.title, "系統公告", { fromOrder: currentOrder, toOrder: targetOrder });
	} catch (err) {
		updateSyncStatusIndicator('offline');
		showMsg("儲存排序失敗：" + translateError(err.message), "error");
		fetchAnnouncements();
	}
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
	
	let displayClass = ` ｜ ${roleTitle}`;
	if (role === 'teacher' && myYear !== '未設定' && myDept !== '未設定') {
		displayClass = ` ｜ ${myYear}年 ${myDept} 導師`;
	} else if (role === 'counselor') {
		const allowedClasses = getUserCounselorClasses(userDBRecord);
		displayClass = ` ｜ 輔導教師 (已授權 ${allowedClasses.length} 班)`;
	} else if (role === 'student' && myYear !== '未設定' && myDept !== '未設定') {
		displayClass = ` ｜ ${myYear}年 ${myDept} 學生`;
	}

	userStatusDisplay.innerHTML = `
		<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 w-full text-xs sm:text-sm leading-tight">
			<div class="font-extrabold text-slate-100 shrink-0">您好，${escapeHtml(displayName)}${escapeHtml(displayClass)}</div>
			<div class="user-info-actions flex items-center gap-2.5 sm:gap-3 shrink-0 flex-wrap">
				<span id="syncStatusIndicator" class="sync-badge sync-success"><span>同步成功</span></span>
				<a href="javascript:void(0)" onclick="openFeedbackModal()" class="text-amber-300 hover:text-amber-200 font-extrabold transition">💡 意見回饋</a>
				<a href="javascript:void(0)" onclick="openProfile()" class="text-sky-400 hover:text-sky-300 font-extrabold transition">👤 個人資料</a>
				<a href="javascript:void(0)" onclick="handleLogout()" class="text-rose-400 hover:text-rose-300 font-extrabold transition">🚪 登出</a>
			</div>
		</div>`;
};

window.applyLoadedChecks = function(checks) {
	if (!checks) checks = {};
	const savedLayout = checks._layout_mode || sessionStorage.getItem('tempLayoutMode') || 'semester';
	currentLayoutMode = savedLayout;

	renderTable();

	document.querySelectorAll(".toggle-checkbox").forEach(c => {
		if (checks[c.id] !== undefined) {
			c.checked = Boolean(checks[c.id]);
		} else {
			c.checked = !(c.dataset.defaultUnchecked === 'true');
		}
	});

	if (currentLayoutMode === 'semester') {
		for (let s = 0; s < 6; s++) {
			const dummyInput = document.querySelector(`.toggle-checkbox[data-sem="${s}"]`);
			if (dummyInput) updateSemesterProgress(dummyInput, s);
		}
	}

	calculate();
};

window.loadFromCloud = async function(targetStudentId = null) {
	const client = ensureDbClient();
	if (!client || !currentUser) return;
	try {
		updateSyncStatusIndicator('saving');
		let query = client.from('grad_checks').select('*');
		
		if (targetStudentId) {
			query = query.or(`id.eq.${targetStudentId},student_id.eq.${targetStudentId}`).maybeSingle();
		} else {
			query = query.eq('id', currentUser.id).maybeSingle();
		}

		const { data, error } = await query;
		if (error && error.code !== 'PGRST116') throw error;

		if (targetStudentId) {
			activeStudentDBRecord = data || null;
			lastLoadedStudentId = targetStudentId;
		} else {
			userDBRecord = data || null;
			hasLoadedInitialData = true;
			lastLoadedStudentId = null;
		}

		const currentRec = targetStudentId ? activeStudentDBRecord : userDBRecord;
		const version = determineCurriculumVersion(currentRec);
		selectCurriculum(version.year, version.dept);

		let checksData = currentRec?.credits_json;
		if (typeof checksData === 'string') {
			try { checksData = JSON.parse(checksData); } catch (e) { checksData = {}; }
		}

		applyLoadedChecks(checksData || {});
		updateSyncStatusIndicator('success');
	} catch (err) {
		updateSyncStatusIndicator('offline');
		showMsg("載入學分紀錄失敗：" + translateError(err.message), "error");
	}
};

window.updateUI = function() {
	const mobileContainer = document.getElementById('mobileCardsContainer'), adminBackend = document.getElementById('adminBackend'),
		dashboard = document.getElementById('dashboardSection'), saveBtn = document.getElementById('saveBtn'),
		backToTrialAdminBtn = document.getElementById('backToTrialBtn'), adminEditBanner = document.getElementById('adminEditBanner'),
		layoutSwitcher = document.getElementById('layoutSwitcherArea'), unsetBox = document.getElementById('unsetNoticeBox');
	if (currentUser) {
		updateHash();
		const savedLayout = sessionStorage.getItem('tempLayoutMode') || userDBRecord?.credits_json?._layout_mode;
		currentLayoutMode = savedLayout ? savedLayout : "semester";

		const btnSub = document.getElementById('btnLayoutSubject');
		const btnSem = document.getElementById('btnLayoutSemester');
		if (btnSub) btnSub.className = currentLayoutMode === 'subject' ? "flex-1 md:flex-none px-6 py-2 text-xs font-bold rounded-lg transition-all bg-white text-slate-800 shadow" : "flex-1 md:flex-none px-6 py-2 text-xs font-bold rounded-lg transition-all text-slate-600";
		if (btnSem) btnSem.className = currentLayoutMode === 'semester' ? "flex-1 md:flex-none px-6 py-2 text-xs font-bold rounded-lg transition-all bg-white text-slate-800 shadow" : "flex-1 md:flex-none px-6 py-2 text-xs font-bold rounded-lg transition-all text-slate-600";

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
		} else if (role === 'counselor') {
			saveBtn.innerText = '輔導學生名冊'; saveBtn.style.display = '';
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
			let bTitle = '班級資料';
			if (role === 'admin') bTitle = '資料管理';
			else if (role === 'counselor') bTitle = '輔導學生名冊與學分檢核';
			document.getElementById('backendTitle').innerText = bTitle;
			if (backToTrialAdminBtn) backToTrialAdminBtn.style.display = 'inline-block';
			document.getElementById('auditLogHeaderBtn').style.display = (role === 'admin') ? 'inline-flex' : 'none';
			document.getElementById('feedbackListHeaderBtn').style.display = (role === 'admin') ? 'inline-flex' : 'none';
			document.getElementById('announceMgmtHeaderBtn').style.display = (role === 'admin') ? 'inline-flex' : 'none';
			const msWrapRole = document.getElementById('ms-wrap-role'), msWrapYear = document.getElementById('ms-wrap-year'), msWrapDept = document.getElementById('ms-wrap-dept');
			if (msWrapRole) {
				msWrapRole.style.display = (role === 'admin') ? '' : 'none';
			}
			if (msWrapYear && msWrapDept) {
				const hideClassFilters = (role === 'teacher' && myYear !== '未設定' && myDept !== '未設定');
				msWrapYear.style.display = hideClassFilters ? 'none' : '';
				msWrapDept.style.display = hideClassFilters ? 'none' : '';
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

window.updateHelpModalDetails = function() {
	const curRec = editingStudentId ? activeStudentDBRecord : (userDBRecord || currentUser?.user_metadata);
	let dept = curRec?.entry_dept;
	if (!dept || dept === '未設定' || String(dept).startsWith('[')) {
		dept = currentDept;
	}
	const track = getTrackType(dept);
	const acad = document.getElementById('helpDetailsAcademic');
	const voc = document.getElementById('helpDetailsVocational');
	const sports = document.getElementById('helpDetailsSports');
	if (acad) acad.open = (track === 'academic');
	if (voc) voc.open = (track === 'vocational');
	if (sports) sports.open = (track === 'sports');
};

window.findTutorByYearDept = async function(yr, dept) {
	const client = ensureDbClient();
	if (!client || yr === '未設定' || dept === '未設定') return '未設定';
	try {
		const { data } = await client.from('grad_checks').select('full_name').eq('role', 'teacher').eq('entry_year', yr).eq('entry_dept', dept).maybeSingle();
		return data?.full_name || '未設定';
	} catch (e) { return '未設定'; }
};

window.isUserAuthorizedForStudent = function(studentRec) {
	if (!studentRec) return false;
	const role = userDBRecord?.role || currentUser?.user_metadata?.role || 'student';
	if (role === 'admin') return true;
	const myYear = userDBRecord?.entry_year || currentUser?.user_metadata?.entry_year || '未設定';
	const myDept = userDBRecord?.entry_dept || currentUser?.user_metadata?.entry_dept || '未設定';

	if (role === 'teacher') {
		if (myYear === '未設定' || myDept === '未設定') return false;
		return String(studentRec.entry_year).trim() === String(myYear).trim() && 
		       String(studentRec.entry_dept).trim() === String(myDept).trim();
	}

	if (role === 'counselor') {
		const allowedClasses = getUserCounselorClasses(userDBRecord);
		if (allowedClasses.length === 0) return false;
		const studentClassKey = `${studentRec.entry_year}_${studentRec.entry_dept}`;
		return allowedClasses.includes(studentClassKey);
	}

	return false;
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
		if (id === 'editUserEntryYear') {
			html += '<option value="未設定">未設定</option>';
		}
		CurriculumService.years.forEach(y => { html += `<option value="${y}">${y} 學年度</option>`; });
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
		if (id === 'editUserEntryDept') {
			html += '<option value="未設定">未設定</option>';
		}
		CurriculumService.departments.forEach(d => { html += `<option value="${d}">${d}</option>`; });
		el.innerHTML = html;
		if (currentVal && el.querySelector(`option[value="${currentVal}"]`)) el.value = currentVal;
		else if (id === 'dashSelectDept') el.value = currentDept;
	});
	const fRole = document.getElementById('ms-drop-role');
	if (fRole) {
		fRole.innerHTML = `
			<label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded text-xs font-bold text-slate-700">
				<input type="checkbox" value="all" class="ms-all-role text-indigo-600 focus:ring-indigo-500 rounded" onchange="handleMSAll('role', this)" checked> (全選)
			</label>
			<label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded text-xs font-bold text-slate-700">
				<input type="checkbox" value="student" class="ms-opt-role text-indigo-600 focus:ring-indigo-500 rounded" onchange="handleMSOpt('role')"> 🎓 學生
			</label>
			<label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded text-xs font-bold text-slate-700">
				<input type="checkbox" value="tutor" class="ms-opt-role text-indigo-600 focus:ring-indigo-500 rounded" onchange="handleMSOpt('role')"> 👨‍🏫 導師
			</label>
			<label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded text-xs font-bold text-slate-700">
				<input type="checkbox" value="teacher" class="ms-opt-role text-indigo-600 focus:ring-indigo-500 rounded" onchange="handleMSOpt('role')"> 👩‍🏫 教師
			</label>
			<label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded text-xs font-bold text-slate-700">
				<input type="checkbox" value="counselor" class="ms-opt-role text-indigo-600 focus:ring-indigo-500 rounded" onchange="handleMSOpt('role')"> 💜 輔導教師
			</label>
			<label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded text-xs font-bold text-slate-700">
				<input type="checkbox" value="admin" class="ms-opt-role text-indigo-600 focus:ring-indigo-500 rounded" onchange="handleMSOpt('role')"> 👑 管理員
			</label>
		`;
	}
	const fYear = document.getElementById('ms-drop-year');
	if (fYear) {
		let h = `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded text-xs font-bold text-slate-700">
					<input type="checkbox" value="all" class="ms-all-year text-indigo-600 focus:ring-indigo-500 rounded" onchange="handleMSAll('year', this)" checked> (全選)
				</label>`;
		CurriculumService.years.forEach(y => h += `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded text-xs font-bold text-slate-700">
					<input type="checkbox" value="${y}" class="ms-opt-year text-indigo-600 focus:ring-indigo-500 rounded" onchange="handleMSOpt('year')"> ${y} 學年度
				</label>`);
		fYear.innerHTML = h;
	}
	const fDept = document.getElementById('ms-drop-dept');
	if (fDept) {
		let h = `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded text-xs font-bold text-slate-700">
					<input type="checkbox" value="all" class="ms-all-dept text-indigo-600 focus:ring-indigo-500 rounded" onchange="handleMSAll('dept', this)" checked> (全選)
				</label>`;
		CurriculumService.departments.forEach(d => h += `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded text-xs font-bold text-slate-700">
					<input type="checkbox" value="${d}" class="ms-opt-dept text-indigo-600 focus:ring-indigo-500 rounded" onchange="handleMSOpt('dept')"> ${d}
				</label>`);
		fDept.innerHTML = h;
	}

	const newCatSelect = document.getElementById('newAnnounceCategory');
	if (newCatSelect) {
		newCatSelect.innerHTML = ANNOUNCE_CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('');
	}

	const filterStatusSelect = document.getElementById('announceStatusFilter');
	if (filterStatusSelect) {
		filterStatusSelect.innerHTML = ANNOUNCE_STATUS_FILTERS.map(s => `<option value="${s.value}">${s.label}</option>`).join('');
	}
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
	if (hash.startsWith('#page-')) {
		const pType = hash.replace('#page-', '');
		if (pType === 'announceView' || (role === 'admin' && ['auditLogView', 'feedbackListView', 'announceMgmtView'].includes(pType))) {
			openIndependentPage(pType); return;
		}
	}
	if (currentIndependentPage) closeIndependentPage();
	if (hash === '#class-data') {
		if (role === 'student') {
			isViewingClassList = false; editingStudentId = null; window.location.hash = '#dashboard'; return;
		}
		isViewingClassList = true; editingStudentId = null;
	} else if (hash === '#dashboard' || !hash || hash === '#') {
		isViewingClassList = false; editingStudentId = null;
	} else {
		let tid = hash.replace('#', '');
		if (tid) {
			if (role === 'student') {
				editingStudentId = null; isViewingClassList = false; window.location.hash = '#dashboard'; return;
			}
			editingStudentId = tid; isViewingClassList = false;
		}
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

window.confirmReadHelp = function() {
	sessionStorage.setItem('helpModalShown', 'true');
	toggleUIModal(false, 'helpModal');
};

window.initCopyrightYear = function() {
	const currentYear = new Date().getFullYear();
	document.querySelectorAll('.copyright-year').forEach(el => {
		el.textContent = currentYear;
	});
};

const ModalService = {
	initAccessibility() {
		window.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' || e.keyCode === 27) {
				this.closeTopmostModal();
			}
		});
	},
	closeTopmostModal() {
		const openModals = Array.from(document.querySelectorAll('.modal-overlay'))
			.filter(m => m.style.display === 'flex');
		if (openModals.length > 0) {
			const topModal = openModals[openModals.length - 1];
			topModal.style.display = 'none';
		}
	}
};

const AuditService = {
	cachedClientIP: null,
	fetchIPWithTimeout(url, parser, timeoutMs = 2000) {
		return new Promise((resolve, reject) => {
			const controller = new AbortController();
			const timer = setTimeout(() => {
				controller.abort();
				reject(new Error('timeout'));
			}, timeoutMs);

			fetch(url, { signal: controller.signal })
				.then(res => {
					clearTimeout(timer);
					if (!res.ok) throw new Error('status not ok');
					return parser(res);
				})
				.then(ip => {
					if (ip && typeof ip === 'string' && ip.trim().length > 0) resolve(ip.trim());
					else reject(new Error('invalid ip'));
				})
				.catch(err => {
					clearTimeout(timer);
					reject(err);
				});
		});
	},
	getWebRTCLocalIP() {
		return new Promise((resolve) => {
			const RTCPeer = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
			if (!RTCPeer) {
				resolve(null);
				return;
			}
			try {
				const pc = new RTCPeer({ iceServers: [] });
				pc.createDataChannel('');
				pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(() => {});
				const timer = setTimeout(() => {
					pc.close();
					resolve(null);
				}, 1000);

				pc.onicecandidate = (ice) => {
					if (!ice || !ice.candidate || !ice.candidate.candidate) return;
					const cand = ice.candidate.candidate;
					const ipMatch = cand.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
					if (ipMatch) {
						clearTimeout(timer);
						pc.close();
						resolve(`內網:${ipMatch[1]}`);
					}
				};
			} catch (e) {
				resolve(null);
			}
		});
	},
	async getClientIP() {
		if (this.cachedClientIP) return this.cachedClientIP;
		const endpoints = [
			this.fetchIPWithTimeout('https://api64.ipify.org?format=json', r => r.json().then(d => d.ip)),
			this.fetchIPWithTimeout('https://api.ipify.org?format=json', r => r.json().then(d => d.ip)),
			this.fetchIPWithTimeout('https://cloudflare.com/cdn-cgi/trace', r => r.text().then(t => {
				const m = t.match(/ip=([^\n]+)/);
				return m ? m[1] : null;
			}))
		];
		try {
			this.cachedClientIP = await Promise.any(endpoints);
			return this.cachedClientIP;
		} catch (e) {
			const localIP = await this.getWebRTCLocalIP();
			if (localIP) {
				this.cachedClientIP = localIP;
				return this.cachedClientIP;
			}
			this.cachedClientIP = '校內網/代理伺服器';
			return this.cachedClientIP;
		}
	},
	async logRecord(actionType, targetSid, targetName, details) {
		const client = ensureDbClient();
		if (!client) return;
		try {
			let user = currentUser;
			if (!user && client.auth) {
				const userData = await client.auth.getUser();
				user = userData?.data?.user;
			}
			const ip = await this.getClientIP();
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
			const { error } = await client.from('audit_logs').insert([payload]);
			if (error && error.code === '23503' && opId) {
				payload.operator_id = null;
				await client.from('audit_logs').insert([payload]);
			}
		} catch (e) {}
	}
};

window.getClientIP = () => AuditService.getClientIP();
window.logAuditRecord = (a, s, n, d) => AuditService.logRecord(a, s, n, d);

const SaveService = {
	activeSaveAbortController: null,
	saveSequenceId: 0,
	markDirty(actionType = "變更學分紀錄", extraDetails = {}) {
		const role = userDBRecord?.role || currentUser?.user_metadata?.role || 'student';
		if (editingStudentId && (role === 'teacher' || role === 'counselor')) {
			if (activeStudentDBRecord && !isUserAuthorizedForStudent(activeStudentDBRecord)) {
				showMsg("超出管理權限：您未被授權修改該學生之學分！", "error");
				return;
			}
		}
		isDirty = true;
		updateSyncStatusIndicator('dirty');

		if (!saveBaselineChecks) {
			const curRecord = editingStudentId ? activeStudentDBRecord : userDBRecord;
			saveBaselineChecks = JSON.parse(JSON.stringify(curRecord?.credits_json || {}));
			saveBaselineTotal = curRecord?.total_credits !== undefined ? curRecord.total_credits : 0;
		}

		if (actionType) {
			pendingBulkActionInfo = { actionType, details: extraDetails };
		}

		clearTimeout(autoSaveDebounceTimer);
		autoSaveDebounceTimer = setTimeout(() => {
			const actionToSend = pendingBulkActionInfo;
			pendingBulkActionInfo = null;
			this.executeSave(actionToSend);
		}, 1200);
	},
	async executeSave(bulkActionInfo = null) {
		const client = ensureDbClient();
		if (!currentUser || !client) {
			updateSyncStatusIndicator('offline');
			saveBaselineChecks = null;
			saveBaselineTotal = null;
			isDirty = false;
			return;
		}

		if (this.activeSaveAbortController) {
			this.activeSaveAbortController.abort();
		}
		this.activeSaveAbortController = new AbortController();
		const currentExecutionSeq = ++this.saveSequenceId;

		updateSyncStatusIndicator('saving');
		const targetId = editingStudentId ? (activeStudentDBRecord?.id || editingStudentId) : currentUser.id;
		const curRecord = editingStudentId ? activeStudentDBRecord : (userDBRecord || currentUser?.user_metadata);
		const targetRole = curRecord?.role || 'student';
		const entryYear = curRecord?.entry_year || '未設定';
		const entryDept = curRecord?.entry_dept || '未設定';
		const targetName = curRecord?.full_name || '學生';
		const targetSid = (curRecord?.student_id || '').split('@')[0].toLowerCase().trim();
		const oldTotal = saveBaselineTotal !== null ? saveBaselineTotal : (curRecord?.total_credits || 0);
		const oldChecks = saveBaselineChecks !== null ? saveBaselineChecks : (curRecord?.credits_json || {});
		saveBaselineChecks = null;
		saveBaselineTotal = null;

		const checks = (curRecord && curRecord.credits_json) ? JSON.parse(JSON.stringify(curRecord.credits_json)) : {};
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
		checks['_layout_mode'] = currentLayoutMode;

		const res = calculateStats();
		let matchedTutor = curRecord?.tutor || (targetRole === 'student' ? await findTutorByYearDept(entryYear, entryDept) : (targetRole === 'admin' ? '管理員免設定' : (targetRole === 'counselor' ? '輔導教師免設定' : '教師帳號免設定')));

		try {
			const payload = {
				student_id: targetSid,
				full_name: targetName,
				entry_year: entryYear,
				entry_dept: entryDept,
				role: targetRole,
				tutor: matchedTutor,
				credits_json: checks,
				total_credits: res.total || 0,
				updated_at: new Date().toISOString()
			};

			if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
				payload.id = targetId;
			}

			const { error: upsertErr } = await client.from('grad_checks').upsert(payload, { onConflict: 'student_id' });
			if (upsertErr) throw upsertErr;

			if (currentExecutionSeq !== this.saveSequenceId) return;

			isDirty = false;
			autoSaveDebounceTimer = null;
			updateSyncStatusIndicator('success');
			const activeRec = editingStudentId ? (activeStudentDBRecord || (activeStudentDBRecord = {})) : (userDBRecord || (userDBRecord = {}));
			activeRec.credits_json = checks;
			activeRec.total_credits = res.total || 0;

			const hasAction = Boolean(bulkActionInfo);
			const hasCreditDiff = changedFields.length > 0;
			if (hasAction || hasCreditDiff) {
				const actionTitle = hasAction ? bulkActionInfo.actionType : "變更學分紀錄";
				const detailsPayload = {
					old_total: oldTotal,
					new_total: res.total || 0,
					...(hasAction ? bulkActionInfo.details : {}),
					changed_fields: changedFields
				};
				await AuditService.logRecord(actionTitle, targetSid, targetName, detailsPayload);
			}
		} catch (err) {
			const isAbort = err.name === 'AbortError' || String(err.message || '').toLowerCase().includes('abort') || String(err || '').toLowerCase().includes('abort');
			if (isAbort) return;

			isDirty = false;
			autoSaveDebounceTimer = null;
			updateSyncStatusIndicator('offline');
			showMsg("學分資料儲存失敗：" + translateError(err.message), "error");
		} finally {
			if (currentExecutionSeq === this.saveSequenceId) {
				this.activeSaveAbortController = null;
			}
		}
	}
};

window.markDirtyAndTriggerSave = (a, d) => SaveService.markDirty(a, d);
window.debouncedSaveToCloud = (b) => SaveService.markDirty(b?.actionType || "變更學分紀錄", b?.details || {});

function startApplication() {
	const client = ensureDbClient();
	if (client) {
		client.auth.onAuthStateChange(async (event, session) => {
			currentUser = session ? session.user : null;
			const authWorkspace = document.getElementById('authWorkspace');
			const appWorkspace = document.getElementById('appWorkspace');
			if (!currentUser) {
				cleanupRealtimeSubscriptions();
				window.clearAppRuntimeState();
				if (authWorkspace) authWorkspace.style.display = 'flex';
				if (appWorkspace) appWorkspace.style.display = 'none';
				sessionStorage.removeItem('helpModalShown');
				currentIndependentPage = null;
				window.location.hash = '';
			} else {
				if (authWorkspace) authWorkspace.style.display = 'none';
				if (appWorkspace) appWorkspace.style.display = 'flex';
				if (lastUserId !== currentUser.id) { 
					hasLoadedInitialData = false; 
					userDBRecord = null; 
					lastUserId = currentUser.id; 
				}
				getClientIP();
				await loadFromCloud();
				handleHashRouting();
				setupRealtimeSubscriptions();
				fetchAnnouncements();
				updateUI();
			}
		});
	} else {
		setTimeout(() => {
			const authWorkspace = document.getElementById('authWorkspace');
			const appWorkspace = document.getElementById('appWorkspace');
			if (authWorkspace) authWorkspace.style.display = 'flex';
			if (appWorkspace) appWorkspace.style.display = 'none';
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
	initCopyrightYear();
	ModalService.initAccessibility();
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', startApplication);
} else {
	startApplication();
}