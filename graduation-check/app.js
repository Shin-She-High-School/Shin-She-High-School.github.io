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
		return `
		<div class="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
			<div class="flex items-center justify-between flex-wrap gap-2">
				<span class="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-black text-xs shrink-0">${escapeHtml(a.category || '🎓 畢業檢核')}</span>
				<span class="text-[11px] font-mono text-slate-400">📅 發布時間: ${escapeHtml(pubStr)}</span>
			</div>
			<h4 class="font-black text-slate-800 text-sm md:text-base">${escapeHtml(a.title)}</h4>
			<p class="text-xs sm:text-sm text-slate-600 font-semibold leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(a.content)}</p>
			<div class="text-[10px] text-slate-400 font-bold text-right pt-1 border-t border-slate-100">發布者：${escapeHtml(a.created_by || '系統管理員')}</div>
		</div>`;
	}).join('');
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
		logAuditRecord("更新公告排序", currentItem.title, "系統公告", { fromOrder: currentOrder, toOrder: targetOrder });
	} catch (err) {
		updateSyncStatusIndicator('offline');
		showMsg("儲存排序失敗：" + translateError(err.message), "error");
		fetchAnnouncements();
	}
};

window.openEditAnnouncement = function(id) {
	const item = announcementsData.find(a => String(a.id) === String(id));
	if (!item) return;
	document.getElementById('editingAnnounceId').value = item.id;
	document.getElementById('newAnnounceTitle').value = item.title || '';
	const titleCnt = document.getElementById('announceTitleCount');
	if (titleCnt) titleCnt.innerText = `${(item.title || '').length}/80`;
	document.getElementById('newAnnounceCategory').value = item.category || '大會公告';
	document.getElementById('newAnnounceContent').value = item.content || '';
	document.getElementById('newAnnouncePublishedAt').value = formatDateTimeInput(item.published_at);
	document.getElementById('newAnnounceStartAt').value = formatDateTimeInput(item.start_at);
	document.getElementById('newAnnounceEndAt').value = formatDateTimeInput(item.end_at);
	document.getElementById('newAnnounceMarquee').checked = !!item.is_marquee;
	document.getElementById('newAnnounceActive').checked = !!item.is_active;

	document.getElementById('announceFormIcon').innerText = '✏️';
	document.getElementById('announceFormTitle').innerHTML = '編輯中：<span class="text-amber-600 font-black truncate max-w-[180px] inline-block align-bottom">' + escapeHtml(item.title || '') + '</span>';
	const submitBtn = document.getElementById('submitAnnounceBtn');
	submitBtn.innerText = '儲存修改內容';
	submitBtn.className = "w-full py-3 rounded-xl font-extrabold text-white text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md transition-all";
	document.getElementById('cancelAnnounceEditBtn').style.display = 'inline-block';

	const formCard = document.getElementById('announceFormCard');
	if (formCard) {
		formCard.classList.add('ring-4', 'ring-amber-400/80', 'shadow-md');
		const scrollBox = document.getElementById('scrollContainer');
		if (scrollBox) scrollBox.scrollTo({ top: formCard.offsetTop - 16, behavior: 'smooth' });
	}
};

window.cancelAnnounceEdit = function() {
	document.getElementById('editingAnnounceId').value = '';
	document.getElementById('newAnnounceTitle').value = '';
	const titleCnt = document.getElementById('announceTitleCount');
	if (titleCnt) titleCnt.innerText = '0/80';
	document.getElementById('newAnnounceContent').value = '';
	document.getElementById('newAnnounceCategory').value = '大會公告';
	document.getElementById('newAnnouncePublishedAt').value = '';
	document.getElementById('newAnnounceStartAt').value = '';
	document.getElementById('newAnnounceEndAt').value = '';
	document.getElementById('newAnnounceMarquee').checked = true;
	document.getElementById('newAnnounceActive').checked = true;

	document.getElementById('announceFormIcon').innerText = '✨';
	document.getElementById('announceFormTitle').innerText = '發布新公告';
	const submitBtn = document.getElementById('submitAnnounceBtn');
	submitBtn.innerText = '確認發布公告';
	submitBtn.className = "w-full py-3 rounded-xl font-extrabold text-white text-xs sm:text-sm bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-md transition-all";
	document.getElementById('cancelAnnounceEditBtn').style.display = 'none';
	document.getElementById('announceFormCard')?.classList.remove('ring-4', 'ring-amber-400/80', 'shadow-md');
};

window.renderAdminAnnounceList = function() {
	const container = document.getElementById('adminAnnounceList');
	const countText = document.getElementById('announceCountText');
	const metricContainer = document.getElementById('announceMetricBoxes');
	const searchTxt = (document.getElementById('announceSearchInput')?.value || '').toLowerCase().trim();
	const statusFilter = document.getElementById('announceStatusFilter')?.value || 'all';
	if (!container) return;
	const now = Date.now();
	let activeCount = 0, scheduledCount = 0, expiredCount = 0, inactiveCount = 0;

	announcementsData.forEach(a => {
		const isInactive = !a.is_active;
		const isScheduled = (a.published_at && new Date(a.published_at).getTime() > now) || (a.start_at && new Date(a.start_at).getTime() > now);
		const isExpired = a.end_at && new Date(a.end_at).getTime() < now;
		if (isInactive) inactiveCount++;
		else if (isExpired) expiredCount++;
		else if (isScheduled) scheduledCount++;
		else activeCount++;
	});

	if (metricContainer) {
		metricContainer.innerHTML = `
			<div class="bg-white border border-emerald-200 rounded-xl p-2.5 text-center shadow-2xs"><div class="text-[10px] font-bold text-emerald-800">公開中</div><div class="text-base font-black text-emerald-600 mt-0.5">${activeCount}</div></div>
			<div class="bg-white border border-sky-200 rounded-xl p-2.5 text-center shadow-2xs"><div class="text-[10px] font-bold text-sky-800">排程預約</div><div class="text-base font-black text-sky-600 mt-0.5">${scheduledCount}</div></div>
			<div class="bg-white border border-slate-200 rounded-xl p-2.5 text-center shadow-2xs"><div class="text-[10px] font-bold text-slate-600">已過期</div><div class="text-base font-black text-slate-600 mt-0.5">${expiredCount}</div></div>
			<div class="bg-white border border-rose-200 rounded-xl p-2.5 text-center shadow-2xs"><div class="text-[10px] font-bold text-rose-800">手動下架</div><div class="text-base font-black text-rose-600 mt-0.5">${inactiveCount}</div></div>
		`;
	}

	let filtered = [...announcementsData];
	if (searchTxt) {
		filtered = filtered.filter(a => (a.title && a.title.toLowerCase().includes(searchTxt)) || (a.content && a.content.toLowerCase().includes(searchTxt)) || (a.category && a.category.toLowerCase().includes(searchTxt)));
	}
	if (statusFilter !== 'all') {
		filtered = filtered.filter(a => {
			const isInactive = !a.is_active;
			const isScheduled = (a.published_at && new Date(a.published_at).getTime() > now) || (a.start_at && new Date(a.start_at).getTime() > now);
			const isExpired = a.end_at && new Date(a.end_at).getTime() < now;
			const isActiveNow = a.is_active && !isScheduled && !isExpired;
			if (statusFilter === 'active') return isActiveNow;
			if (statusFilter === 'scheduled') return !isInactive && isScheduled;
			if (statusFilter === 'expired') return !isInactive && isExpired;
			if (statusFilter === 'inactive') return isInactive;
			return true;
		});
	}
	if (countText) countText.innerText = `共 ${filtered.length} 筆`;
	if (filtered.length === 0) {
		container.innerHTML = `<div class="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400 font-bold space-y-2"><div class="text-3xl">📭</div><div class="text-xs">查無符合條件之系統公告事項</div></div>`;
		return;
	}

	container.innerHTML = filtered.map((a, idx) => {
		const pubDate = a.published_at || a.created_at;
		const pubFormatted = formatDateTime(pubDate);
		const [pubDatePart, pubTimePart] = pubFormatted.includes(' ') ? pubFormatted.split(' ') : [pubFormatted, ''];
		let statusBadge = !a.is_active ? '<span class="text-[10px] px-2 py-0.5 rounded-md font-black bg-rose-50 text-rose-700 border border-rose-200 shrink-0">○ 已下架</span>' : ((a.published_at && new Date(a.published_at).getTime() > now) ? '<span class="text-[10px] px-2 py-0.5 rounded-md font-black bg-amber-50 text-amber-700 border border-amber-200 shrink-0">⏳ 預約中</span>' : (a.start_at && new Date(a.start_at).getTime() > now ? '<span class="text-[10px] px-2 py-0.5 rounded-md font-black bg-sky-50 text-sky-700 border border-sky-200 shrink-0">⏳ 未開始</span>' : (a.end_at && new Date(a.end_at).getTime() < now ? '<span class="text-[10px] px-2 py-0.5 rounded-md font-black bg-slate-100 text-slate-600 border border-slate-300 shrink-0">⌛ 已過期</span>' : '<span class="text-[10px] px-2 py-0.5 rounded-md font-black bg-emerald-50 text-emerald-700 border border-emerald-300 shrink-0">● 公開中</span>')));
		let categoryColor = (a.category === '重要提醒') ? 'bg-rose-50 text-rose-800 border-rose-200' : ((a.category === '教務通知') ? 'bg-blue-50 text-blue-800 border-blue-200' : ((a.category === '系統維護') ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200'));

		return `
			<div class="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition space-y-3">
				<div class="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
					<div class="flex items-start gap-3 min-w-0 flex-1">
						<div class="font-mono text-slate-500 text-[11px] leading-tight text-center bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl shrink-0">
							<div class="font-black text-slate-800">${escapeHtml(pubDatePart)}</div>
							<div class="text-[10px] opacity-60 font-semibold mt-0.5">${escapeHtml(pubTimePart)}</div>
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-1.5 flex-wrap mb-1">
								<span class="px-2 py-0.5 rounded-md font-extrabold text-[10px] border ${categoryColor}">${escapeHtml(a.category || '大會公告')}</span>
								${statusBadge}
								${a.is_marquee ? '<span class="text-[10px] px-2 py-0.5 rounded-md font-black bg-amber-50 text-amber-700 border border-amber-200">📢 跑馬燈</span>' : ''}
							</div>
							<h4 class="font-black text-slate-900 text-sm sm:text-base break-words">${escapeHtml(a.title)}</h4>
						</div>
					</div>
					<div class="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
						<button type="button" class="btn-table-action ${a.is_active ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-400 hover:bg-slate-500'} text-white" onclick="toggleAnnounceStatus('${escapeHtml(a.id)}', ${!a.is_active})" title="${a.is_active ? '點擊手動下架' : '點擊重新公開'}"><i class="fa-solid ${a.is_active ? 'fa-eye' : 'fa-eye-slash'} text-xs"></i></button>
						<button type="button" class="btn-table-action border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none" onclick="moveAnnouncementOrder(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="上移">▲</button>
						<button type="button" class="btn-table-action border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none" onclick="moveAnnouncementOrder(${idx}, 1)" ${idx === filtered.length - 1 ? 'disabled' : ''} title="下移">▼</button>
						<button type="button" class="h-7 px-2.5 rounded-lg font-black text-white bg-amber-500 hover:bg-amber-600 text-xs transition" onclick="openEditAnnouncement('${escapeHtml(a.id)}')">編輯</button>
						<button type="button" class="h-7 px-2.5 rounded-lg font-black text-white bg-rose-600 hover:bg-rose-700 text-xs transition" onclick="deleteAnnouncement('${escapeHtml(a.id)}', '${escapeHtml(a.title)}')">刪除</button>
					</div>
				</div>
				<div class="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 font-semibold leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(a.content || '')}</div>
			</div>
		`;
	}).join('');
};

window.submitNewAnnouncement = async function() {
	const client = ensureDbClient();
	if (!client) return;
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
			const { error } = await client.from('announcements').update({
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
				minOrder = announcementsData.reduce((min, a) => {
					const order = Number.isFinite(a.sort_order) ? a.sort_order : 0;
					return order < min ? order : min;
				}, 0) - 1;
			}
			const payload = {
				title, category, content, published_at: publishedAtIso, start_at: startAtIso,
				end_at: endAtIso, sort_order: minOrder, is_marquee: isMarquee, is_active: isActive,
				created_by: creatorName, created_at: nowIso, updated_at: nowIso
			};
			const { error } = await client.from('announcements').insert([payload]);
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
	const client = ensureDbClient();
	if (!client) return;
	try {
		updateSyncStatusIndicator('saving');
		const { error } = await client.from('announcements').update({ is_active: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
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
	const client = ensureDbClient();
	if (!client) return;
	showConfirmModal(`您確定要刪除公告「${title}」嗎？`, "刪除公告", async () => {
		try {
			updateSyncStatusIndicator('saving');
			const { error } = await client.from('announcements').delete().eq('id', id);
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
	const client = ensureDbClient();
	if (!client) return;
	try {
		let user = currentUser;
		if (!user && client.auth) {
			const userData = await client.auth.getUser();
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
		const { error } = await client.from('audit_logs').insert([payload]);
		if (error && error.code === '23503' && opId) {
			payload.operator_id = null;
			await client.from('audit_logs').insert([payload]);
		}
	} catch (e) {}
};

window.openFeedbackModal = function() {
	document.getElementById('fbContent').value = '';
	document.getElementById('fbCategory').value = '功能建議';
	toggleUIModal(true, 'feedbackModal');
};

window.submitUserFeedback = async function() {
	const client = ensureDbClient();
	if (!client) { showMsg("資料庫連線異常，無法送出！", "error"); return; }
	const category = document.getElementById('fbCategory').value;
	const content = document.getElementById('fbContent').value.trim();
	if (!content) { showMsg("請輸入您的寶貴意見！", "error"); return; }
	const curRec = userDBRecord || currentUser?.user_metadata || {};
	const cleanSid = (curRec.student_id || currentUser?.email?.split('@')[0] || 'guest').toLowerCase().trim();
	const fullName = curRec.full_name || '訪客';
	const role = curRec.role || 'student';
	const payload = { student_id: cleanSid, full_name: fullName, role: role, category: category, content: content, created_at: new Date().toISOString() };
	try {
		updateSyncStatusIndicator('saving');
		const { error } = await client.from('user_feedbacks').insert([payload]);
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
	const client = ensureDbClient();
	if (!client) return;
	const listBody = document.getElementById('feedbackListBody');
	if (listBody) listBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500 font-bold">🔄 正在載入意見回饋列表...</td></tr>`;
	try {
		const { data, error } = await client.from('user_feedbacks').select('*').order('created_at', { ascending: false });
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
		filtered = filtered.filter(f => (f.full_name && f.full_name.toLowerCase().includes(searchTxt)) || (f.student_id && f.student_id.toLowerCase().includes(searchTxt)) || (f.content && f.content.toLowerCase().includes(searchTxt)));
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
			<td class="p-2.5 text-slate-500 font-mono text-[11px] leading-tight text-center whitespace-nowrap"><div>${escapeHtml(datePart)}</div><div>${escapeHtml(timePart)}</div></td>
			<td class="p-2.5 font-bold break-words leading-tight"><div class="text-slate-800">${escapeHtml(item.full_name || '訪客')} <span class="text-[10px] text-slate-400 block sm:inline">(${escapeHtml(mapping.role[item.role] || item.role)})</span></div><div class="text-[10px] font-mono text-slate-400 mt-0.5 break-all">${escapeHtml(item.student_id || '')}</div></td>
			<td class="p-2.5"><span class="px-2 py-0.5 rounded-full border font-extrabold text-[10px] sm:text-[11px] inline-block ${catBadge}">${escapeHtml(item.category || '其他')}</span></td>
			<td class="p-2.5 text-slate-700 leading-relaxed font-semibold whitespace-pre-wrap break-words">${escapeHtml(item.content || '')}</td>
			<td class="p-2.5 text-center"><button class="btn-mini" style="background:#ef4444; padding:0 6px; height:28px;" onclick="deleteFeedback('${escapeHtml(item.id)}', '${escapeHtml(item.full_name)}')">刪除</button></td>
		`;
		listBody.appendChild(tr);
	});
};

window.deleteFeedback = function(id, name) {
	const client = ensureDbClient();
	if (!client) return;
	showConfirmModal(`您確定要刪除來自「${name || '使用者'}」的此筆意見回饋嗎？`, "刪除意見回饋", async () => {
		try {
			updateSyncStatusIndicator('saving');
			const { error } = await client.from('user_feedbacks').delete().eq('id', id);
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
	const client = ensureDbClient();
	if (!client) return;
	const role = userDBRecord?.role || currentUser?.user_metadata?.role || 'student';
	if (role !== 'admin') { showMsg("僅系統管理員有權限檢視歷史異動紀錄！", "error"); return; }
	openIndependentPage('auditLogView');
	const searchInput = document.getElementById('auditSearchInput');
	if (filterStudentId && searchInput) searchInput.value = filterStudentId;
	else if (searchInput) searchInput.value = '';
	await refreshAuditLogs();
};

window.refreshAuditLogs = async function() {
	const client = ensureDbClient();
	if (!client) return;
	const listBody = document.getElementById('auditLogListBody');
	if (listBody) listBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500 font-bold">🔄 正在載入完整稽核日誌...</td></tr>`;
	let allLogs = [], from = 0;
	const step = 1000;
	let hasMore = true;
	try {
		while (hasMore) {
			const { data, error } = await client.from('audit_logs').select('*').order('created_at', { ascending: false }).range(from, from + step - 1);
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
	const sInput = document.getElementById('auditSearchInput');
	if (sInput) sInput.value = '';
	const allActionChk = document.querySelector('.ms-all-audit-action');
	if (allActionChk) allActionChk.checked = true;
	document.querySelectorAll('.ms-opt-audit-action').forEach(c => c.checked = false);
	updateMSText('audit-action');
	const rFilter = document.getElementById('auditFilterOperatorRole');
	if (rFilter) rFilter.value = 'all';
	const sDate = document.getElementById('auditStartDate');
	if (sDate) sDate.value = '';
	const eDate = document.getElementById('auditEndDate');
	if (eDate) eDate.value = '';
	renderAuditLogList();
};

window.renderAuditLogList = function() {
	const searchTxt = (document.getElementById('auditSearchInput')?.value || '').toLowerCase().trim();
	const filterActions = getMSValues('audit-action');
	const roleFilter = document.getElementById('auditFilterOperatorRole')?.value || 'all';
	const startDate = document.getElementById('auditStartDate')?.value;
	const endDate = document.getElementById('auditEndDate')?.value;
	const listBody = document.getElementById('auditLogListBody');
	const countText = document.getElementById('auditCountText');
	if (!listBody) return;
	let filtered = [...auditLogsData];

	if (searchTxt) {
		filtered = filtered.filter(l => (l.operator_name && l.operator_name.toLowerCase().includes(searchTxt)) || (l.target_student_name && l.target_student_name.toLowerCase().includes(searchTxt)) || (l.target_student_id && l.target_student_id.toLowerCase().includes(searchTxt)) || (l.action_type && l.action_type.toLowerCase().includes(searchTxt)) || (l.ip_address && l.ip_address.toLowerCase().includes(searchTxt)));
	}
	if (filterActions.length > 0 && !filterActions.includes('all')) {
		filtered = filtered.filter(l => filterActions.includes(l.action_type));
	}
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
	const detailKeyLabels = { role: '身份', year: '入學年', dept: '科別班級', status: '狀態', category: '回饋類別', method: '重設方式', passwordChanged: '密碼變更', fromOrder: '原始順序', toOrder: '新順序', isMarquee: '跑馬燈同步', isActive: '公開狀態', counselorClassesCount: '授權班級數' };
	const formatDetailValue = (key, val) => {
		if (key === 'role') return mapping.role[val] || val;
		if (key === 'year') return val === '未設定' ? '未設定' : `${val} 學年度`;
		if (key === 'passwordChanged') return val ? '是 (已覆寫)' : '否 (未更改)';
		if (typeof val === 'boolean') return val ? '是' : '否';
		return val;
	};

	filtered.forEach(log => {
		const timeStr = formatDateTime(log.created_at);
		const [datePart, timePart] = timeStr.includes(' ') ? timeStr.split(' ') : [timeStr, ''];
		const tr = document.createElement('tr');
		tr.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100';
		let diffHtml = '';
		if (log.action_type.includes('刪除')) {
			const d = log.details || {};
			diffHtml = `<div class="inline-flex flex-wrap items-center gap-2 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 font-bold text-xs shadow-xs"><span class="px-2 py-0.5 rounded-md bg-rose-600 text-white font-black text-[11px]">🗑️ 被刪除帳號資料</span><span>姓名：<b class="text-rose-950 font-black text-sm">${escapeHtml(d.deleted_name || log.target_student_name || '未知')}</b></span><span class="text-rose-300">|</span><span>帳號：<b class="font-mono text-rose-900 font-extrabold">${escapeHtml(d.deleted_sid || log.target_student_id || '未知')}</b></span></div>`;
		} else if (log.details && typeof log.details === 'object') {
			const d = log.details;
			let headerChips = [];
			if (d.old_version && d.new_version) {
				headerChips.push(`<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 font-extrabold text-[11px] shadow-xs"><span class="text-slate-500">原版本: ${escapeHtml(d.old_version)}</span> <span class="text-sky-600 font-black">➔</span> <span class="text-indigo-700 font-black">新版本: ${escapeHtml(d.new_version)}</span></div>`);
			}
			if (d.old_total !== undefined && d.new_total !== undefined) {
				const isIncreased = d.new_total > d.old_total;
				const totalBadgeColor = isIncreased ? 'bg-emerald-50 border-emerald-200' : (d.new_total < d.old_total ? 'bg-rose-50 border-rose-200' : 'bg-indigo-50 border-indigo-100');
				headerChips.push(`<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-extrabold text-[11px] shadow-xs ${totalBadgeColor}"><span class="text-slate-500">舊學分: ${escapeHtml(d.old_total)}</span> <span class="text-slate-400 font-black">➔</span> <span class="${isIncreased ? 'text-emerald-700 font-black' : 'text-indigo-700 font-black'}">新學分: ${escapeHtml(d.new_total)}</span></div>`);
			}
			if (d.semester) {
				headerChips.push(`<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 font-extrabold text-[11px]"><span class="text-amber-800">📅 ${escapeHtml(d.semester)}</span></div>`);
			}
			if (headerChips.length > 0) diffHtml += `<div class="flex flex-wrap gap-1.5 mb-1.5">${headerChips.join('')}</div>`;
			if (d.changed_fields && Array.isArray(d.changed_fields) && d.changed_fields.length > 0) {
				diffHtml += `<div class="flex flex-wrap gap-1.5">`;
				d.changed_fields.forEach(f => {
					const isGain = f.newVal && f.newVal.includes('及格') && !f.newVal.includes('未及格');
					const badgeStyle = isGain ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-900 border-rose-300';
					diffHtml += `<div class="inline-flex items-center gap-1 border px-2 py-0.5 rounded-lg text-[11px] font-bold shadow-xs ${badgeStyle}"><span>${escapeHtml(f.field)}:</span><s class="opacity-60 font-semibold">${escapeHtml(f.oldVal)}</s><span class="font-black opacity-80">➔</span><b class="font-black">${escapeHtml(f.newVal)}</b></div>`;
				});
				diffHtml += `</div>`;
			} else {
				if (log.action_type === '使用者登入') {
					diffHtml = `<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold text-xs shadow-xs"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span>登入成功</span></div>`;
				} else if (log.action_type === '使用者登出') {
					diffHtml = `<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 font-extrabold text-xs shadow-xs"><span class="w-2 h-2 rounded-full bg-slate-400"></span><span>安全登出</span></div>`;
				} else if (log.action_type === '使用者註冊') {
					let r = '🎓 學生';
					if (d.role === 'counselor') r = '💜 輔導教師';
					else if (d.role === 'teacher') r = (d.year && d.year !== '未設定') ? '👨‍🏫 導師' : '👨‍🏫 教師';
					const y = d.year && d.year !== '未設定' ? `${d.year} 學年度` : '未指定學年';
					const dept = d.dept && d.dept !== '未設定' ? d.dept : (d.role === 'counselor' ? '輔導室(指定班級權限)' : '一般專任(未設定班級)');
					diffHtml = `<div class="inline-flex flex-wrap items-center gap-2 p-1.5 px-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-950 font-bold text-xs shadow-xs"><span class="px-2 py-0.5 rounded-md bg-teal-700 text-white font-black text-[11px]">${r}</span><span class="text-teal-800 font-extrabold">${escapeHtml(y)}</span><span class="text-teal-300">丨</span><span class="text-teal-900 font-black">${escapeHtml(dept)}</span></div>`;
				} else {
					const metaKeys = Object.keys(d).filter(k => !['old_total', 'new_total', 'changed_fields', 'old_version', 'new_version', 'semester', 'mode'].includes(k));
					if (metaKeys.length > 0) {
						diffHtml += `<div class="audit-details-card">`;
						metaKeys.forEach(k => {
							const labelText = detailKeyLabels[k] || k;
							const rawVal = d[k];
							const formattedVal = formatDetailValue(k, typeof rawVal === 'object' ? JSON.stringify(rawVal) : rawVal);
							const isUnset = (formattedVal === '未設定');
							diffHtml += `<div class="audit-field-pill"><span class="audit-field-label">${escapeHtml(labelText)}:</span><span class="audit-field-val ${isUnset ? 'is-unset' : ''}">${escapeHtml(formattedVal)}</span></div>`;
						});
						diffHtml += `</div>`;
					}
				}
			}
		}
		const cfg = actionConfig[log.action_type] || { icon: '📌', class: 'bg-slate-700 text-white font-bold' };
		let roleBadgeColor = "bg-slate-100 text-slate-600";
		if (log.operator_role === 'admin') roleBadgeColor = "bg-indigo-100 text-indigo-800";
		else if (log.operator_role === 'counselor') roleBadgeColor = "bg-purple-100 text-purple-800";
		else if (log.operator_role === 'teacher') roleBadgeColor = "bg-emerald-100 text-emerald-800";
		else if (log.operator_role === 'student') roleBadgeColor = "bg-blue-100 text-blue-800";
		tr.innerHTML = `
			<td class="p-3 text-slate-500 font-mono text-[11px] leading-tight text-center whitespace-nowrap"><div>${escapeHtml(datePart)}</div><div>${escapeHtml(timePart)}</div></td>
			<td class="p-3 font-bold"><div class="text-slate-800 flex items-center gap-1"><span>${escapeHtml(log.operator_name || '系統')}</span><span class="text-[9px] px-1.5 py-0.5 rounded font-black ${roleBadgeColor}">${escapeHtml(mapping.role[log.operator_role] || log.operator_role)}</span></div><div class="text-[10px] font-mono text-slate-400 mt-0.5">${escapeHtml(log.ip_address || '未知 IP')}</div></td>
			<td class="p-3"><div class="text-slate-900 font-black text-xs sm:text-sm truncate max-w-[120px]">${escapeHtml(log.target_student_name || '-')}</div><div class="text-slate-500 font-mono text-[11px] mt-0.5">${escapeHtml(log.target_student_id || '-')}</div></td>
			<td class="p-3"><span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap font-black ${cfg.class}"><span>${cfg.icon}</span><span>${escapeHtml(log.action_type)}</span></span></td>
			<td class="p-3 text-slate-700">${diffHtml}</td>
		`;
		listBody.appendChild(tr);
	});
};

window.confirmSetAllStatus = function(p) {
	if (curriculum.length === 0) { showMsg("目前版本的課表尚未建置！", "error"); return; }
	const role = userDBRecord?.role || currentUser?.user_metadata?.role || 'student';
	if ((role === 'teacher' || role === 'counselor') && editingStudentId) {
		if (activeStudentDBRecord && !isUserAuthorizedForStudent(activeStudentDBRecord)) {
			showMsg("超出管理權限：您未被授權管理該學生學分！", "error");
			return;
		}
	}
	const msg = p ? "您確定要將所有課程學分一次設為「及格」嗎？" : "您確定要將所有及格學分「全部歸零」嗎？";
	showConfirmModal(msg, p ? "確認全部及格" : "確認學分歸零", () => { setAllStatus(p); toggleUIModal(false, 'confirmModal'); }, p ? "確認全部及格" : "確認學分歸零", p ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)");
};

window.setAllStatus = function(p) {
	document.querySelectorAll(".toggle-checkbox").forEach(chk => { chk.checked = p; });
	calculate();
	renderTable();
	debouncedSaveToCloud({ actionType: p ? "批次全部及格" : "批次學分歸零" });
};

window.setSemesterStatus = function(sIdx, p) {
	if (curriculum.length === 0) return;
	const role = userDBRecord?.role || currentUser?.user_metadata?.role || 'student';
	if ((role === 'teacher' || role === 'counselor') && editingStudentId) {
		if (activeStudentDBRecord && !isUserAuthorizedForStudent(activeStudentDBRecord)) {
			showMsg("超出管理權限：您未被授權管理該學生學分！", "error");
			return;
		}
	}
	const semNames = ["第一學期 (一上)", "第二學期 (一下)", "第三學期 (二上)", "第四學期 (二下)", "第五學期 (三上)", "第六學期 (三下)"];
	document.querySelectorAll(`.toggle-checkbox[data-sem="${sIdx}"]`).forEach(chk => { chk.checked = p; });
	calculate();
	renderTable();
	showMsg(p ? `已將 ${semNames[sIdx]} 設為全部及格` : `已將 ${semNames[sIdx]} 學分歸零`);
	debouncedSaveToCloud({ actionType: p ? "單學期全選及格" : "單學期學分歸零", details: { semester: semNames[sIdx] } });
};

window.debouncedSaveToCloud = function(bulkActionInfo = null) {
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
	if (bulkActionInfo) pendingBulkActionInfo = bulkActionInfo;
	clearTimeout(autoSaveDebounceTimer);
	autoSaveDebounceTimer = setTimeout(() => {
		const actionToSend = pendingBulkActionInfo;
		pendingBulkActionInfo = null;
		executeDeferredSave(actionToSend);
	}, 1500);
};

async function executeDeferredSave(bulkActionInfo = null) {
	const client = ensureDbClient();
	if (!currentUser || !client || curriculum.length === 0) {
		updateSyncStatusIndicator('offline');
		saveBaselineChecks = null;
		saveBaselineTotal = null;
		isDirty = false;
		return;
	}
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
			changedFields.push({ field: `📘 ${subName} 【${semStr}】 (${credVal}學分)`, oldVal: wasChecked ? '及格' : '未及格', newVal: c.checked ? '✔及格' : '✕未及格' });
		}
	});

	const version = determineCurriculumVersion(curRecord);
	const newViewYr = version.locked ? entryYear : currentYear;
	const newViewDept = version.locked ? entryDept : currentDept;
	checks['_view_year'] = newViewYr;
	checks['_view_dept'] = newViewDept;

	const res = calculateStats();
	let matchedTutor = curRecord?.tutor || (targetRole === 'student' ? await findTutorByYearDept(entryYear, entryDept) : (targetRole === 'admin' ? '管理員免設定' : (targetRole === 'counselor' ? '輔導教師免設定' : '教師帳號免設定')));

	try {
		let rpcSuccess = false;
		try {
			const { error: rpcErr } = await client.rpc('admin_save_student_credits', {
				target_id: targetId, target_sid: targetSid, target_name: targetName, entry_year: entryYear,
				entry_dept: entryDept, target_role: targetRole, tutor_name: matchedTutor, credits_data: checks, total_credits_val: res.total || 0
			});
			if (!rpcErr) rpcSuccess = true;
			else throw rpcErr;
		} catch (e) {
			if (e.message && e.message.includes('權限不足')) throw e;
		}

		if (!rpcSuccess) {
			const payload = {
				id: targetId, student_id: targetSid, full_name: targetName, entry_year: entryYear,
				entry_dept: entryDept, role: targetRole, tutor: matchedTutor, credits_json: checks,
				total_credits: res.total || 0, updated_at: new Date().toISOString()
			};
			const { error } = await client.from('grad_checks').upsert(payload);
			if (error) throw error;
		}

		isDirty = false;
		autoSaveDebounceTimer = null;
		updateSyncStatusIndicator('success');
		const activeRec = editingStudentId ? (activeStudentDBRecord || (activeStudentDBRecord = {})) : (userDBRecord || (userDBRecord = {}));
		activeRec.credits_json = checks;
		activeRec.total_credits = res.total || 0;
		if (bulkActionInfo || changedFields.length > 0) {
			await logAuditRecord(bulkActionInfo ? bulkActionInfo.actionType : "變更學分紀錄", targetSid, targetName, { old_total: oldTotal, new_total: res.total || 0, ...(bulkActionInfo ? bulkActionInfo.details : {}), changed_fields: changedFields });
		}
	} catch (err) {
		isDirty = false;
		autoSaveDebounceTimer = null;
		updateSyncStatusIndicator('offline');
		showMsg("學分資料儲存失敗：" + translateError(err.message), "error");
	}
}

window.loadFromCloud = async function(tid = null) {
	const client = ensureDbClient();
	if (!currentUser || !client) return;
	updateSyncStatusIndicator('saving');
	try {
		if (tid) {
			const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tid);
			let query = client.from('grad_checks').select('*');
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
				targetNameEl.innerHTML = `<b class="text-amber-300">${escapeHtml(name)}</b>${escapeHtml(sid)}${escapeHtml(classStr)}`;
			}
			const version = determineCurriculumVersion(data);
			selectCurriculum(version.year, version.dept);
			applyLoadedChecks(data.credits_json || {});
		} else {
			const { data, error } = await client.from('grad_checks').select('*').eq('id', currentUser.id).maybeSingle();
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

window.enterAdminEditMode = function(id, name) {
	if (currentIndependentPage) closeIndependentPage();
	editingStudentId = id; isViewingClassList = false;
	const targetEl = document.getElementById('targetStudentName');
	if (targetEl) targetEl.innerText = `${name || '學生'} (資料讀取中...)`;
	scrollToTop(); updateUI(); loadFromCloud(id);
};

window.exitAdminEditMode = function() {
	editingStudentId = null; activeStudentDBRecord = null; lastLoadedStudentId = null; isViewingClassList = true;
	scrollToTop(); updateUI();
};

window.handleMainAction = function() {
	const role = userDBRecord?.role || currentUser?.user_metadata?.role || 'student';
	if (role === 'admin' || role === 'teacher' || role === 'counselor') {
		if (currentIndependentPage) closeIndependentPage();
		isViewingClassList = true; editingStudentId = null;
		scrollToTop(); updateUI();
	}
};

window.handleReturnToTrial = function() {
	if (currentIndependentPage) closeIndependentPage();
	isViewingClassList = false;
	const version = determineCurriculumVersion(userDBRecord);
	selectCurriculum(version.year, version.dept);
	scrollToTop(); updateUI(); loadFromCloud();
};

window.showMissingCreditsModal = function() {
	if (curriculum.length === 0) { showMsg("目前版本的課表尚未建置！", "error"); return; }
	const semFullNames = ["第一學期 (一上)", "第二學期 (一下)", "第三學期 (二上)", "第四學期 (二下)", "第五學期 (三上)", "第六學期 (三下)"];
	currentUncheckedCredits = [];
	document.querySelectorAll(".toggle-checkbox:not(:checked)").forEach(input => {
		const name = input.dataset.name, semIdx = parseInt(input.dataset.sem), val = parseInt(input.dataset.val), cat = input.dataset.cat, type = parseInt(input.dataset.type);
		if (name) currentUncheckedCredits.push({ id: input.id, name, sem: semFullNames[semIdx], val, cat, type, semIdx });
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

window.toggleSingleCreditFromMissingModal = function(chkId) {
	const role = userDBRecord?.role || currentUser?.user_metadata?.role || 'student';
	if ((role === 'teacher' || role === 'counselor') && editingStudentId) {
		if (activeStudentDBRecord && !isUserAuthorizedForStudent(activeStudentDBRecord)) {
			showMsg("超出管理權限：您未被授權修改該學生學分！", "error");
			return;
		}
	}
	const targetChk = document.getElementById(chkId);
	if (!targetChk) return;
	targetChk.checked = true;
	targetChk.dispatchEvent(new Event('change'));
	showMsg(`已將「${targetChk.dataset.name || '該科目'}」標記為修習及格！`);
	showMissingCreditsModal();
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
				html += `<div class="bg-slate-50 rounded-xl p-3.5 border border-slate-200 shadow-sm mb-3"><h5 class="text-xs font-black text-slate-700 border-b border-slate-200/80 pb-2 mb-2 flex justify-between"><span>📅 ${escapeHtml(sem)}</span><span class="text-red-600">未得 ${grouped[sem].reduce((sum, i) => sum + i.val, 0)} 學分</span></h5><div class="space-y-2">`;
				grouped[sem].forEach(item => {
					html += `<div class="flex items-center justify-between text-xs py-1.5 px-2 bg-white rounded-lg border border-slate-200/80 hover:border-slate-300 transition"><span class="font-bold text-slate-800 truncate mr-2">${escapeHtml(item.name)}</span><div class="flex items-center gap-2 shrink-0"><span class="font-extrabold text-red-500">${item.val} 學分</span><button type="button" class="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black text-[11px] border border-emerald-300 transition" onclick="toggleSingleCreditFromMissingModal('${escapeHtml(item.id)}')">標記及格</button></div></div>`;
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
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', startApplication);
} else {
	startApplication();
}