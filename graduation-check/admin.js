let currentScopeCounselorId = null;

window.getDeptBadgeInfo = function(deptName) {
	if (deptName.includes('普通科')) return { tag: '普通科', class: 'bg-blue-50 text-blue-700 border-blue-200' };
	if (deptName.includes('體育班')) return { tag: '體育班', class: 'bg-amber-50 text-amber-800 border-amber-200' };
	if (deptName.includes('農經科') || deptName.includes('園藝科')) return { tag: '農業群', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
	return { tag: '商管群', class: 'bg-purple-50 text-purple-700 border-purple-200' };
};

window.openCounselorScopePage = function(targetCounselorId) {
	currentScopeCounselorId = targetCounselorId;
	openIndependentPage('counselorScopeView');
	renderCounselorScopePage();
};

window.jumpToScopePageFromModal = function() {
	const id = document.getElementById('editUserId').value;
	toggleUIModal(false, 'adminUserModal');
	openCounselorScopePage(id);
};

window.renderCounselorScopePage = function() {
	const sel = document.getElementById('scopePageCounselorSelect');
	const counselors = adminListData.filter(u => u.role === 'counselor');
	if (sel) {
		sel.innerHTML = counselors.map(c => `<option value="${c.id}" ${c.id === currentScopeCounselorId ? 'selected' : ''}>${escapeHtml(c.full_name)} (${escapeHtml(c.student_id)})</option>`).join('');
		if (!currentScopeCounselorId && counselors.length > 0) {
			currentScopeCounselorId = counselors[0].id;
			sel.value = currentScopeCounselorId;
		}
	}
	const targetCounselor = adminListData.find(u => u.id === currentScopeCounselorId);
	const assignedClasses = getUserCounselorClasses(targetCounselor);
	const selectedSet = new Set(assignedClasses);
	const grid = document.getElementById('scopePageClassCardsGrid');
	if (!grid) return;
	const yearLabels = { "113": "高三 (113學年度)", "114": "高二 (114學年度)" };
	let html = '';
	CurriculumService.years.forEach(y => {
		let itemsHtml = '';
		CurriculumService.departments.forEach(d => {
			const key = `${y}_${d}`;
			const isChecked = selectedSet.has(key);
			const badge = getDeptBadgeInfo(d);
			const activeClass = isChecked ? 'border-indigo-400 bg-indigo-50/50 ring-1 ring-indigo-300' : 'border-slate-200 bg-white hover:border-slate-300';
			itemsHtml += `
				<label class="counselor-scope-item flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition select-none ${activeClass}">
					<div class="flex items-center gap-2 min-w-0 flex-1 mr-1">
						<input type="checkbox" value="${key}" data-year="${y}" class="scope-page-chk rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" ${isChecked ? 'checked' : ''} onchange="handleScopePageItemChange(this)">
						<span class="text-xs font-bold text-slate-800 truncate">${escapeHtml(d)}</span>
					</div>
					<span class="text-[10px] font-black px-1.5 py-0.5 rounded border shrink-0 ${badge.class}">${badge.tag}</span>
				</label>
			`;
		});
		html += `
			<div class="bg-slate-100/70 p-3 rounded-2xl border border-slate-200">
				<div class="flex items-center justify-between mb-2.5">
					<span class="text-xs font-black text-slate-800 flex items-center gap-1.5">
						<span class="w-2 h-2 rounded-full bg-indigo-600"></span>
						${yearLabels[y] || `${y} 學年度`}
					</span>
					<div class="flex gap-2 text-xs font-bold">
						<button type="button" class="text-indigo-600 hover:underline" onclick="toggleScopePageYearClasses('${y}', true)">整年全選</button>
						<span class="text-slate-300">|</span>
						<button type="button" class="text-slate-500 hover:underline" onclick="toggleScopePageYearClasses('${y}', false)">整年清空</button>
					</div>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
					${itemsHtml}
				</div>
			</div>
		`;
	});
	grid.innerHTML = html;
	updateScopePageCounter();
};

window.changeCounselorInScopePage = function() {
	currentScopeCounselorId = document.getElementById('scopePageCounselorSelect').value;
	renderCounselorScopePage();
};

window.handleScopePageItemChange = function(inputEl) {
	const parent = inputEl.closest('.counselor-scope-item');
	if (parent) {
		if (inputEl.checked) {
			parent.classList.add('border-indigo-400', 'bg-indigo-50/50', 'ring-1', 'ring-indigo-300');
			parent.classList.remove('border-slate-200', 'bg-white');
		} else {
			parent.classList.remove('border-indigo-400', 'bg-indigo-50/50', 'ring-1', 'ring-indigo-300');
			parent.classList.add('border-slate-200', 'bg-white');
		}
	}
	updateScopePageCounter();
};

window.updateScopePageCounter = function() {
	const count = document.querySelectorAll('.scope-page-chk:checked').length;
	const badge = document.getElementById('scopePageCountBadge');
	if (badge) {
		badge.innerText = `已選取 ${count} / 20 班`;
		badge.className = (count === 20) ? "text-xs font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300" : (count === 0 ? "text-xs font-black px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-300" : "text-xs font-black px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200");
	}
};

window.toggleAllCounselorClassesInScopePage = function(checkAll) {
	document.querySelectorAll('.scope-page-chk').forEach(c => {
		c.checked = checkAll;
		handleScopePageItemChange(c);
	});
};

window.toggleScopePageYearClasses = function(yr, checkAll) {
	document.querySelectorAll(`.scope-page-chk[data-year="${yr}"]`).forEach(c => {
		c.checked = checkAll;
		handleScopePageItemChange(c);
	});
};

window.saveCounselorScopePage = async function() {
	const client = ensureDbClient();
	if (!client || !currentScopeCounselorId) return;
	const selected = Array.from(document.querySelectorAll('.scope-page-chk:checked')).map(c => c.value);
	try {
		updateSyncStatusIndicator('saving');
		const targetRecord = adminListData.find(item => item.id === currentScopeCounselorId);
		let currentJson = targetRecord?.credits_json || {};
		if (typeof currentJson === 'string') {
			try { currentJson = JSON.parse(currentJson); } catch (e) { currentJson = {}; }
		}
		currentJson._counselor_classes = selected;
		const { error } = await client.from('grad_checks').update({
			credits_json: currentJson,
			entry_dept: JSON.stringify(selected),
			updated_at: new Date().toISOString()
		}).eq('id', currentScopeCounselorId);
		if (error) throw error;
		if (targetRecord) {
			targetRecord.credits_json = currentJson;
			targetRecord.entry_dept = JSON.stringify(selected);
		}
		if (userDBRecord && userDBRecord.id === currentScopeCounselorId) {
			userDBRecord.credits_json = currentJson;
			userDBRecord.entry_dept = JSON.stringify(selected);
			renderUserStatusDisplay();
		}
		updateSyncStatusIndicator('success');
		showMsg(`已成功更新授權班級 (共 ${selected.length} 班)！`);
		logAuditRecord("更改帳號資料", targetRecord?.student_id || '', targetRecord?.full_name || '', { role: 'counselor', counselorClassesCount: selected.length });
		fetchAdminList(true);
	} catch (err) {
		updateSyncStatusIndicator('offline');
		showMsg(translateError(err.message), 'error');
	}
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
	const searchEl = document.getElementById('adminSearchInput');
	const searchText = (searchEl ? searchEl.value : '').toLowerCase().trim();
	const filterRoles = getMSValues('role');
	const filterYears = getMSValues('year');
	const filterDepts = getMSValues('dept');
	const filterStatuses = getMSValues('status');
	const role = userDBRecord?.role || currentUser?.user_metadata?.role || 'student';
	const myYear = userDBRecord?.entry_year || currentUser?.user_metadata?.entry_year || '未設定';
	const myDept = userDBRecord?.entry_dept || currentUser?.user_metadata?.entry_dept || '未設定';
	let filtered = [...adminListData];

	if (role === 'teacher' && myYear !== '未設定' && myDept !== '未設定') {
		filtered = filtered.filter(s => String(s.entry_year).trim() === String(myYear).trim() && String(s.entry_dept).trim() === String(myDept).trim() && s.role === 'student');
	} else if (role === 'counselor') {
		const allowedClasses = getUserCounselorClasses(userDBRecord);
		filtered = filtered.filter(s => {
			if (s.role !== 'student') return false;
			if (allowedClasses.length === 0) return false;
			const studentKey = `${s.entry_year}_${s.entry_dept}`;
			return allowedClasses.includes(studentKey);
		});
	} else if (role === 'teacher') {
		filtered = filtered.filter(s => s.role === 'student');
	}

	if (searchText) {
		filtered = filtered.filter(s => (s.full_name && String(s.full_name).toLowerCase().includes(searchText)) || (s.student_id && String(s.student_id).toLowerCase().includes(searchText)));
	}
	if (filterRoles.length > 0 && !filterRoles.includes('all')) {
		filtered = filtered.filter(s => {
			if (filterRoles.includes('student') && s.role === 'student') return true;
			if (filterRoles.includes('admin') && s.role === 'admin') return true;
			if (filterRoles.includes('counselor') && s.role === 'counselor') return true;
			const isTutor = (s.role === 'teacher' && s.entry_year !== '未設定' && s.entry_dept !== '未設定');
			if (filterRoles.includes('tutor') && isTutor) return true;
			if (filterRoles.includes('teacher') && s.role === 'teacher' && !isTutor) return true;
			return false;
		});
	}
	if (filterYears.length > 0 && !filterYears.includes('all')) {
		filtered = filtered.filter(s => filterYears.includes(String(s.entry_year).trim()));
	}
	if (filterDepts.length > 0 && !filterDepts.includes('all')) {
		filtered = filtered.filter(s => filterDepts.includes(String(s.entry_dept).trim()));
	}
	if (filterStatuses.length > 0 && !filterStatuses.includes('all')) {
		filtered = filtered.filter(s => {
			if (s.role !== 'student') return false;
			const st = evaluateStudentStatus(s);
			if (filterStatuses.includes('not_pass') && st.status !== 'pass') return true;
			return filterStatuses.includes(st.status);
		});
	}
	const roleOrder = { admin: 1, counselor: 2, teacher: 3, student: 4 };
	const getDeptNumber = (dept) => {
		if (!dept || dept === '未設定') return 999;
		const match = String(dept).match(/-(\d+)$/);
		if (match) return parseInt(match[1], 10);
		const idx = CurriculumService.departments.indexOf(dept);
		return idx !== -1 ? idx + 1 : 999;
	};
	filtered.sort((a, b) => {
		const orderA = roleOrder[a.role] || 5, orderB = roleOrder[b.role] || 5;
		if (orderA !== orderB) return orderA - orderB;
		const yA = a.entry_year || '999';
		const yB = b.entry_year || '999';
		if (yA !== yB) return String(yA).localeCompare(String(yB), undefined, { numeric: true });
		const deptNumA = getDeptNumber(a.entry_dept);
		const deptNumB = getDeptNumber(b.entry_dept);
		if (deptNumA !== deptNumB) return deptNumA - deptNumB;
		return (a.student_id || '').localeCompare(b.student_id || '', undefined, { numeric: true });
	});
	return filtered;
};

window.fetchAdminList = async function(isClientOnly = false) {
	const client = ensureDbClient();
	if (!client) return;
	updateSyncStatusIndicator('saving');
	try {
		if (!isClientOnly) {
			const { data, error } = await client.from('grad_checks').select('*');
			if (error) throw error;
			adminListData = data || [];
			teacherNames = adminListData.filter(u => u.role === 'teacher' || u.role === 'counselor').map(u => u.full_name);
		}
		renderAdminTable();
		updateSyncStatusIndicator('success');
	} catch (err) { updateSyncStatusIndicator('offline'); }
};

window.renderAdminTable = function() {
	const tableBody = document.getElementById('adminListBody'), cardsContainer = document.getElementById('adminCardsContainer');
	if (!tableBody || !cardsContainer) return;
	tableBody.innerHTML = ""; cardsContainer.innerHTML = "";
	const filtered = applyFilters();
	const countText = document.getElementById('adminTotalCountText');
	if (countText) { countText.style.display = 'inline-block'; countText.innerText = `共 ${filtered.length} 筆帳號`; }
	renderAdminStats(filtered);
	const curRole = userDBRecord?.role || currentUser?.user_metadata?.role || 'student';
	const canModifyAccount = (curRole === 'admin');

	filtered.forEach((s, i) => {
		const isTutor = (s.role === 'teacher' && s.entry_year !== '未設定' && s.entry_dept !== '未設定');
		let roleClass = 'badge-student';
		if (s.role === 'admin') roleClass = 'badge-admin';
		else if (s.role === 'counselor') roleClass = 'badge-counselor';
		else if (isTutor) roleClass = 'badge-tutor';
		else if (s.role === 'teacher') roleClass = 'badge-teacher';
		let roleDisplayName = mapping.role[s.role] || '使用者';
		if (isTutor) roleDisplayName = '導師';

		const classInfo = (s.entry_year === '未設定' || s.entry_dept === '未設定' || String(s.entry_dept).startsWith('[')) ? '未設定' : `${s.entry_year}年/${s.entry_dept}`;
		const evalRes = s.role === 'student' ? evaluateStudentStatus(s) : null;
		const statusTagHtml = evalRes ? `<span class="text-[0.72rem] font-bold px-2.5 py-1 rounded-md inline-block ${evalRes.badgeClass}">${escapeHtml(evalRes.statusText)}<br><span class="opacity-80 font-semibold">(${evalRes.total}學分)</span></span>` : '<span class="text-xs text-slate-400 font-semibold">-</span>';
		const tr = document.createElement('tr');
		let btnsDesktop = '<div class="flex items-center w-full gap-1.5 flex-nowrap">';
		const studentTargetId = s.student_id || s.id;
		if (s.role === 'student') {
			btnsDesktop += `<button class="btn-mini flex-auto min-w-0 text-xs px-2 text-center font-bold" style="background:#10b981" onclick="enterAdminEditMode('${escapeHtml(studentTargetId)}','${escapeHtml(s.full_name)}')">檢視/修改學分</button>`;
		}
		if (s.role === 'counselor' && canModifyAccount) {
			btnsDesktop += `<button class="btn-mini flex-auto min-w-0 text-xs px-2 text-center font-bold bg-indigo-600 hover:bg-indigo-700" onclick="openCounselorScopePage('${escapeHtml(s.id)}')">🎯 授權班級</button>`;
		}
		if (canModifyAccount) {
			btnsDesktop += `<button class="btn-mini flex-auto min-w-0 text-xs px-2 text-center font-bold" style="background:#6366f1;" onclick="openAuditLogModal('${escapeHtml(s.student_id)}')">📜 歷程</button>`;
			btnsDesktop += `<button class="btn-mini flex-auto min-w-0 text-xs px-2 text-center font-bold" style="background:#3b82f6" onclick="openAdminUserEdit(${i})">帳號設定</button>
							<button class="btn-mini flex-auto min-w-0 text-xs px-2 text-center font-bold" style="background:#ef4444" onclick="deleteStudentData('${escapeHtml(s.id)}','${escapeHtml(s.full_name)}')">刪除</button>`;
		}
		btnsDesktop += '</div>';

		tr.innerHTML = `<td><b>${escapeHtml(s.full_name)}</b></td><td>${escapeHtml(s.student_id || '-')}</td><td><span class="role-badge ${roleClass}">${escapeHtml(roleDisplayName)}</span></td><td>${escapeHtml(classInfo)}</td><td>${statusTagHtml}</td><td>${btnsDesktop}</td>`;
		tableBody.appendChild(tr);

		const card = document.createElement('div');
		card.className = "mobile-card p-4 flex flex-col gap-3";
		let btnsMobile = '';
		if (s.role === 'student') {
			btnsMobile += `<button class="flex-auto min-w-0 py-2 px-2 text-[11px] rounded-lg font-bold text-white bg-emerald-500" onclick="enterAdminEditMode('${escapeHtml(studentTargetId)}','${escapeHtml(s.full_name)}')">檢視/修改學分</button>`;
		}
		if (s.role === 'counselor' && canModifyAccount) {
			btnsMobile += `<button class="flex-auto min-w-0 py-2 px-2 text-[11px] rounded-lg font-bold text-white bg-indigo-600" onclick="openCounselorScopePage('${escapeHtml(s.id)}')">🎯 授權班級</button>`;
		}
		if (canModifyAccount) {
			btnsMobile += `<button class="flex-auto min-w-0 py-2 px-2 text-[11px] rounded-lg font-bold text-white bg-indigo-600" onclick="openAuditLogModal('${escapeHtml(s.student_id)}')">📜 歷程</button>`;
			btnsMobile += `<button class="flex-auto min-w-0 py-2 px-2 text-[11px] rounded-lg font-bold text-white bg-blue-500" onclick="openAdminUserEdit(${i})">帳號設定</button>
						   <button class="flex-auto min-w-0 py-2 px-2 text-[11px] rounded-lg font-bold text-white bg-red-500" onclick="deleteStudentData('${escapeHtml(s.id)}','${escapeHtml(s.full_name)}')">刪除</button>`;
		}
		card.innerHTML = `
			<div class="flex justify-between items-start border-b border-slate-100 pb-2">
				<div><div class="text-sm font-bold text-slate-800">${escapeHtml(s.full_name)}</div><div class="text-xs text-slate-500">帳號: ${escapeHtml(s.student_id || '-')}</div></div>
				<span class="role-badge ${roleClass} text-xs py-1 px-2.5 rounded-full font-bold text-white">${escapeHtml(roleDisplayName)}</span>
			</div>
			<div class="text-xs text-slate-600 flex justify-between"><span>入學年 / 科別:</span><span class="font-semibold text-slate-800">${escapeHtml(classInfo)}</span></div>
			<div class="text-xs text-slate-600 flex justify-between border-t border-dashed border-slate-200 pt-2"><span>畢業門檻資格:</span><div>${statusTagHtml}</div></div>
			<div class="flex gap-1.5 mt-1">${btnsMobile}</div>
		`;
		cardsContainer.appendChild(card);
	});
};

window.deleteStudentData = function(id, name) {
	const client = ensureDbClient();
	if (!client) return;
	showConfirmModal(`您確定要刪除「${name}」嗎？此操作將清除該帳號所有資料，無法恢復！`, "刪除帳號", async () => {
		try {
			updateSyncStatusIndicator('saving');
			const studentRec = adminListData.find(s => s.id === id);
			const sid = (studentRec?.student_id || id).split('@')[0].toLowerCase().trim();
			let rpcSuccess = false;
			try {
				const { error: rpcErr } = await client.rpc('admin_delete_user', { target_user_id: id });
				if (!rpcErr) rpcSuccess = true;
			} catch (e) {}
			if (!rpcSuccess) {
				await client.from('grad_checks').delete().eq('id', id);
				if (sid) {
					await client.from('grad_checks').delete().eq('student_id', sid);
					await client.from('user_feedbacks').delete().eq('student_id', sid);
					await client.from('audit_logs').delete().or(`target_student_id.eq.${sid},operator_id.eq.${id}`);
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

window.toggleAdminUserRoleFields = function(roleVal, preSelectedClasses = []) {
	const standardGroup = document.getElementById('editUserStandardClassGroup');
	const counselorScopeJumpBox = document.getElementById('editCounselorScopeJumpBox');
	const yrLabel = document.getElementById('editUserEntryYearLabel');
	const deptLabel = document.getElementById('editUserEntryDeptLabel');

	if (roleVal === 'counselor') {
		if (standardGroup) standardGroup.style.display = 'none';
		if (counselorScopeJumpBox) {
			counselorScopeJumpBox.style.display = 'block';
			const badge = document.getElementById('modalCounselorScopeBadge');
			if (badge) badge.innerText = `已授權 ${preSelectedClasses.length} 班`;
		}
	} else {
		if (standardGroup) standardGroup.style.display = 'block';
		if (counselorScopeJumpBox) counselorScopeJumpBox.style.display = 'none';
		if (roleVal === 'student') {
			if (yrLabel) yrLabel.innerText = "入學年 (高三113、高二114、高一115)";
			if (deptLabel) deptLabel.innerText = "科別-班級 (數字代表目前班級)";
		} else {
			if (yrLabel) yrLabel.innerText = "負責班級入學年 (導師需設定)";
			if (deptLabel) deptLabel.innerText = "負責科別-班級 (導師需設定)";
		}
	}
	toggleAdminTutorField(roleVal);
};

window.openAdminUserEdit = function(index) {
	const s = applyFilters()[index];
	if (!s) return;
	document.getElementById('editUserId').value = s.id;
	document.getElementById('editUserSid').value = s.student_id || '';
	document.getElementById('editUserName').value = s.full_name || '';
	document.getElementById('editUserEntryYear').value = s.entry_year || '未設定';
	document.getElementById('editUserEntryDept').value = String(s.entry_dept).startsWith('[') ? '未設定' : (s.entry_dept || '未設定');
	
	const roleSelect = document.getElementById('editUserRole');
	if (roleSelect && !roleSelect.querySelector('option[value="counselor"]')) {
		const opt = document.createElement('option');
		opt.value = 'counselor';
		opt.textContent = '輔導教師';
		roleSelect.appendChild(opt);
	}
	roleSelect.value = s.role || 'student';
	const assignedClasses = getUserCounselorClasses(s);
	toggleAdminUserRoleFields(s.role || 'student', assignedClasses);
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
		teacherNames.forEach(tName => { optionsHtml += `<option value="${escapeHtml(tName)}">${escapeHtml(tName)}</option>`; });
		wrapper.innerHTML = optionsHtml + `</select>`;
		if (currentTutor) document.getElementById('editUserTutor').value = currentTutor;
	} else {
		sec.style.display = 'none'; wrapper.innerHTML = '';
	}
};

window.saveAdminUserEdit = async function() {
	const client = ensureDbClient();
	if (!client) return;
	const id = document.getElementById('editUserId').value;
	const sid = document.getElementById('editUserSid').value.split('@')[0].toLowerCase().trim();
	const name = document.getElementById('editUserName').value.trim();
	const role = document.getElementById('editUserRole').value;

	let year = document.getElementById('editUserEntryYear').value;
	let dept = document.getElementById('editUserEntryDept').value;
	let tutor = (role === 'student') ? (document.getElementById('editUserTutor')?.value || '未設定') : '免設定';

	if (!sid || !name) { showMsg("請填寫完整帳號與姓名", "error"); return; }
	const targetRecord = adminListData.find(item => item.id === id);

	if (role === 'counselor') {
		year = '未設定';
		const existingClasses = getUserCounselorClasses(targetRecord);
		dept = JSON.stringify(existingClasses);
	}

	try {
		updateSyncStatusIndicator('saving');
		const { error } = await client.rpc('admin_update_user_sid', {
			target_user_id: id,
			new_sid: sid,
			new_name: name,
			new_year: year,
			new_dept: dept,
			new_role: role,
			new_tutor: tutor
		});
		if (error) throw error;
		updateSyncStatusIndicator('success');
		showMsg("帳號資料修改成功！");
		logAuditRecord("更改帳號資料", sid, name, { year, dept, role });
		toggleUIModal(false, 'adminUserModal');
		fetchAdminList();
	} catch (err) {
		updateSyncStatusIndicator('offline');
		showMsg(translateError(err.message), 'error');
	}
};

window.directResetPasswordToSid = async function() {
	const client = ensureDbClient();
	if (!client) return;
	const id = document.getElementById('editUserId').value, sid = document.getElementById('editUserSid').value.trim(), name = document.getElementById('editUserName').value.trim();
	if (!sid) { showMsg("無法重設：此帳號目前沒有設定帳號！", "error"); return; }
	if (sid.length < 6) {
		showMsg(`無法直接重設：帳號「${sid}」長度小於 6 碼，不符系統密碼規定，請改用左側「自訂新密碼」！`, "error");
		return;
	}
	showConfirmModal(`您確定要將「${name}」的登入密碼立即重設為其帳號「${sid}」嗎？`, "確認重設密碼", async () => {
		try {
			updateSyncStatusIndicator('saving');
			const { error } = await client.rpc('admin_reset_user_password', { target_user_id: id, new_password: sid });
			if (error) throw error;
			updateSyncStatusIndicator('success');
			showMsg(`已成功將「${name}」的密碼重置為「${sid}」！`);
			logAuditRecord("重設帳號密碼", sid, name, { method: "一鍵重設為帳號" });
			toggleUIModal(false, 'confirmModal'); toggleUIModal(false, 'adminUserModal'); fetchAdminList();
		} catch (err) { updateSyncStatusIndicator('offline'); showMsg(translateError(err.message), "error"); toggleUIModal(false, 'confirmModal'); }
	});
};

window.customResetPassword = async function() {
	const client = ensureDbClient();
	if (!client) return;
	const id = document.getElementById('editUserId').value, name = document.getElementById('editUserName').value.trim(), sid = document.getElementById('editUserSid').value.trim();
	const newPwd = document.getElementById('editUserCustomPassword').value.trim();
	if (!newPwd) { showMsg("請輸入自訂新密碼！", "error"); return; }
	if (newPwd.length < 6) { showMsg("密碼長度至少需 6 個字元！", "error"); return; }
	showConfirmModal(`您確定要將「${name}」的登入密碼重設為「${newPwd}」嗎？`, "確認自訂重設密碼", async () => {
		try {
			updateSyncStatusIndicator('saving');
			const { error } = await client.rpc('admin_reset_user_password', { target_user_id: id, new_password: newPwd });
			if (error) throw error;
			updateSyncStatusIndicator('success');
			showMsg(`已成功將「${name}」的密碼重置！`);
			logAuditRecord("重設帳號密碼", sid, name, { method: "自訂密碼" });
			document.getElementById('editUserCustomPassword').value = '';
			toggleUIModal(false, 'confirmModal'); toggleUIModal(false, 'adminUserModal'); fetchAdminList();
		} catch (err) { updateSyncStatusIndicator('offline'); showMsg(translateError(err.message), "error"); toggleUIModal(false, 'confirmModal'); }
	});
};

window.initAuditActionMultiSelect = function() {
	const oldSelect = document.getElementById('auditFilterAction');
	if (!oldSelect || document.getElementById('ms-wrap-audit-action')) return;

	const wrap = document.createElement('div');
	wrap.id = 'ms-wrap-audit-action';
	wrap.className = 'relative flex-1 min-w-[130px]';
	wrap.innerHTML = `
		<div class="sort-select flex justify-between items-center cursor-pointer bg-white h-full text-xs" onclick="toggleMS(event, 'audit-action')">
			<span class="truncate pr-2 font-bold text-slate-700" id="ms-text-audit-action">所有異動項目</span>
			<span class="text-[10px] text-slate-400">▼</span>
		</div>
		<div id="ms-drop-audit-action" class="absolute z-50 w-[180%] sm:w-[150%] md:w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg hidden max-h-60 overflow-y-auto custom-scrollbar p-1.5 flex-col gap-0.5">
			<label class="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded text-xs font-bold text-slate-700">
				<input type="checkbox" value="all" class="ms-all-audit-action text-indigo-600 focus:ring-indigo-500 rounded" onchange="handleMSAll('audit-action', this)" checked> (全選所有異動項目)
			</label>
		</div>
	`;

	const drop = wrap.querySelector('#ms-drop-audit-action');
	AUDIT_ACTION_OPTIONS.forEach(g => {
		const groupHeader = document.createElement('div');
		groupHeader.className = 'text-[10px] font-black text-slate-400 px-1.5 pt-1.5 pb-0.5';
		groupHeader.innerText = g.group;
		drop.appendChild(groupHeader);
		g.items.forEach(act => {
			const label = document.createElement('label');
			label.className = 'flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded text-xs font-bold text-slate-700';
			label.innerHTML = `
				<input type="checkbox" value="${act}" class="ms-opt-audit-action text-indigo-600 focus:ring-indigo-500 rounded" onchange="handleMSOpt('audit-action')">
				<span>${act}</span>
			`;
			drop.appendChild(label);
		});
	});

	oldSelect.parentNode.replaceChild(wrap, oldSelect);
};