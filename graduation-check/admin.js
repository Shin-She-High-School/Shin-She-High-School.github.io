window.getDeptBadgeInfo = function(deptName) {
	if (deptName.includes('普通科')) return { tag: '普通科', class: 'bg-blue-50 text-blue-700 border-blue-200' };
	if (deptName.includes('體育班')) return { tag: '體育班', class: 'bg-amber-50 text-amber-800 border-amber-200' };
	if (deptName.includes('農經科') || deptName.includes('園藝科')) return { tag: '農業群', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
	return { tag: '商管群', class: 'bg-purple-50 text-purple-700 border-purple-200' };
};

window.renderCounselorClassCheckboxes = function(selectedClassKeys = [], containerId = 'counselorScopeModalChecklist') {
	let container = document.getElementById(containerId);
	if (!container) return;

	const selectedSet = new Set(selectedClassKeys);
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
				<label class="counselor-checkbox-card flex items-center justify-between p-2 rounded-xl border cursor-pointer transition select-none ${activeClass}">
					<div class="flex items-center gap-2 min-w-0 flex-1 mr-1">
						<input type="checkbox" value="${key}" data-year="${y}" class="counselor-class-item rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5" ${isChecked ? 'checked' : ''} onchange="handleCounselorItemCheckboxChange(this)">
						<span class="text-xs font-bold text-slate-800 truncate">${escapeHtml(d)}</span>
					</div>
					<span class="text-[10px] font-black px-1.5 py-0.5 rounded border shrink-0 ${badge.class}">${badge.tag}</span>
				</label>
			`;
		});

		html += `
			<div class="bg-slate-100/70 p-2.5 rounded-xl border border-slate-200/80 mb-2.5">
				<div class="flex items-center justify-between mb-2">
					<span class="text-xs font-black text-slate-700 flex items-center gap-1.5">
						<span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
						${yearLabels[y] || `${y} 學年度`}
					</span>
					<div class="flex gap-1.5 text-[10px] font-bold">
						<button type="button" class="text-indigo-600 hover:underline cursor-pointer" onclick="toggleYearCounselorClasses('${y}', true)">本年全選</button>
						<span class="text-slate-300">|</span>
						<button type="button" class="text-slate-500 hover:underline cursor-pointer" onclick="toggleYearCounselorClasses('${y}', false)">本年清空</button>
					</div>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
					${itemsHtml}
				</div>
			</div>
		`;
	});

	container.innerHTML = html;
	updateCounselorSelectedCounter();
};

window.updateCounselorSelectedCounter = function() {
	const checkedCount = document.querySelectorAll('.counselor-class-item:checked').length;
	const badge = document.getElementById('counselorScopeCountBadge');
	if (badge) {
		badge.innerText = `已選取 ${checkedCount} / 20 班`;
		if (checkedCount === 20) {
			badge.className = "text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300";
		} else if (checkedCount === 0) {
			badge.className = "text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-300";
		} else {
			badge.className = "text-[11px] font-black px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200";
		}
	}
};

window.handleCounselorItemCheckboxChange = function(inputEl) {
	const labelCard = inputEl.closest('.counselor-checkbox-card');
	if (labelCard) {
		if (inputEl.checked) {
			labelCard.classList.add('border-indigo-400', 'bg-indigo-50/50', 'ring-1', 'ring-indigo-300');
			labelCard.classList.remove('border-slate-200', 'bg-white');
		} else {
			labelCard.classList.remove('border-indigo-400', 'bg-indigo-50/50', 'ring-1', 'ring-indigo-300');
			labelCard.classList.add('border-slate-200', 'bg-white');
		}
	}
	updateCounselorSelectedCounter();
};

window.toggleAllCounselorClasses = function(checkAll) {
	document.querySelectorAll('.counselor-class-item').forEach(chk => {
		chk.checked = checkAll;
		handleCounselorItemCheckboxChange(chk);
	});
};

window.toggleYearCounselorClasses = function(yearStr, checkAll) {
	document.querySelectorAll(`.counselor-class-item[data-year="${yearStr}"]`).forEach(chk => {
		chk.checked = checkAll;
		handleCounselorItemCheckboxChange(chk);
	});
};

window.getCounselorSelectedClasses = function() {
	const selected = [];
	document.querySelectorAll('.counselor-class-item:checked').forEach(chk => {
		selected.push(chk.value);
	});
	return selected;
};

window.openCounselorScopeModal = function(index) {
	const s = applyFilters()[index];
	if (!s) return;
	document.getElementById('counselorScopeUserId').value = s.id;
	document.getElementById('counselorScopeUserName').innerText = `${s.full_name} (${s.student_id || '-'})`;
	const assignedClasses = getUserCounselorClasses(s);
	renderCounselorClassCheckboxes(assignedClasses, 'counselorScopeModalChecklist');
	toggleUIModal(true, 'counselorScopeModal');
};

window.saveCounselorScopeModal = async function() {
	const client = ensureDbClient();
	if (!client) return;
	const id = document.getElementById('counselorScopeUserId').value;
	const targetRecord = adminListData.find(item => item.id === id);
	if (!targetRecord) return;

	const counselorClasses = getCounselorSelectedClasses();

	try {
		updateSyncStatusIndicator('saving');
		let currentJson = targetRecord.credits_json || {};
		if (typeof currentJson === 'string') {
			try { currentJson = JSON.parse(currentJson); } catch (e) { currentJson = {}; }
		}
		currentJson._counselor_classes = counselorClasses;

		const payload = {
			entry_dept: JSON.stringify(counselorClasses),
			credits_json: currentJson,
			updated_at: new Date().toISOString()
		};

		const { error } = await client.from('grad_checks').update(payload).eq('id', id);
		if (error) throw error;

		targetRecord.credits_json = currentJson;
		targetRecord.entry_dept = JSON.stringify(counselorClasses);

		if (userDBRecord && userDBRecord.id === id) {
			userDBRecord.credits_json = currentJson;
			userDBRecord.entry_dept = JSON.stringify(counselorClasses);
		}

		updateSyncStatusIndicator('success');
		showMsg(`已成功更新「${targetRecord.full_name}」負責授權班級（共 ${counselorClasses.length} 班）！`);
		logAuditRecord("更新輔導教師授權", targetRecord.student_id, targetRecord.full_name, { counselorClassesCount: counselorClasses.length, classes: counselorClasses });
		toggleUIModal(false, 'counselorScopeModal');
		renderAdminTable();
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

		let classInfo = (s.entry_year === '未設定' || s.entry_dept === '未設定' || String(s.entry_dept).startsWith('[')) ? '未設定' : `${s.entry_year}年/${s.entry_dept}`;
		if (s.role === 'counselor') {
			const allowedCount = getUserCounselorClasses(s).length;
			classInfo = `已授權 ${allowedCount} 班`;
		}

		const evalRes = s.role === 'student' ? evaluateStudentStatus(s) : null;
		const statusTagHtml = evalRes ? `<span class="text-[0.72rem] font-bold px-2.5 py-1 rounded-md inline-block ${evalRes.badgeClass}">${escapeHtml(evalRes.statusText)}<br><span class="opacity-80 font-semibold">(${evalRes.total}學分)</span></span>` : '<span class="text-xs text-slate-400 font-semibold">-</span>';
		const tr = document.createElement('tr');
		let btnsDesktop = '<div class="flex items-center w-full gap-1.5 flex-nowrap">';
		const studentTargetId = s.student_id || s.id;
		if (s.role === 'student') {
			btnsDesktop += `<button class="btn-mini flex-auto min-w-0 text-xs px-2 text-center font-bold" style="background:#10b981" onclick="enterAdminEditMode('${escapeHtml(studentTargetId)}','${escapeHtml(s.full_name)}')">檢視/修改學分</button>`;
		}
		if (canModifyAccount) {
			if (s.role === 'counselor') {
				const allowedCount = getUserCounselorClasses(s).length;
				btnsDesktop += `<button class="btn-mini flex-auto min-w-0 text-xs px-2 text-center font-bold" style="background:#8b5cf6;" onclick="openCounselorScopeModal(${i})">🔑 授權班級 (${allowedCount})</button>`;
			}
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
		if (canModifyAccount) {
			if (s.role === 'counselor') {
				const allowedCount = getUserCounselorClasses(s).length;
				btnsMobile += `<button class="flex-auto min-w-0 py-2 px-2 text-[11px] rounded-lg font-bold text-white bg-violet-600" onclick="openCounselorScopeModal(${i})">🔑 授權班級 (${allowedCount})</button>`;
			}
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
			<div class="flex gap-1.5 mt-1 flex-wrap">${btnsMobile}</div>
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

window.toggleAdminUserRoleFields = function(roleVal) {
	const standardGroup = document.getElementById('editUserStandardClassGroup');
	const yrLabel = document.getElementById('editUserEntryYearLabel');
	const deptLabel = document.getElementById('editUserEntryDeptLabel');

	if (roleVal === 'counselor') {
		if (standardGroup) standardGroup.style.display = 'none';
	} else {
		if (standardGroup) standardGroup.style.display = 'block';
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
	toggleAdminUserRoleFields(s.role || 'student');
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

	const targetRecord = adminListData.find(item => item.id === id);

	let year = document.getElementById('editUserEntryYear').value;
	let dept = document.getElementById('editUserEntryDept').value;
	let tutor = (role === 'student') ? (document.getElementById('editUserTutor')?.value || '未設定') : '免設定';

	if (!sid || !name) { showMsg("請填寫完整帳號與姓名", "error"); return; }

	if (role === 'counselor') {
		year = '未設定';
		dept = targetRecord?.entry_dept || '[]';
		if (!String(dept).startsWith('[')) dept = '[]';
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
	showConfirmModal(`您確定要將「${name}」的登入密碼立即重設為其帳號「${sid}」嗎？（使用者首次登入時將被強制要求設定新密碼）`, "確認重設密碼", async () => {
		try {
			updateSyncStatusIndicator('saving');
			const { error } = await client.rpc('admin_reset_user_password', { target_user_id: id, new_password: sid });
			if (error) throw error;
			
			await client.from('grad_checks').update({ must_change_password: true, updated_at: new Date().toISOString() }).eq('id', id);
			const rec = adminListData.find(s => s.id === id);
			if (rec) rec.must_change_password = true;

			updateSyncStatusIndicator('success');
			showMsg(`已成功將「${name}」的密碼重置為「${sid}」！`);
			logAuditRecord("重設帳號密碼", sid, name, { method: "一鍵重設為帳號", must_change_password: true });
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
	showConfirmModal(`您確定要將「${name}」的登入密碼重設為「${newPwd}」嗎？（使用者首次登入時將被強制要求設定新密碼）`, "確認自訂重設密碼", async () => {
		try {
			updateSyncStatusIndicator('saving');
			const { error } = await client.rpc('admin_reset_user_password', { target_user_id: id, new_password: newPwd });
			if (error) throw error;
			
			await client.from('grad_checks').update({ must_change_password: true, updated_at: new Date().toISOString() }).eq('id', id);
			const rec = adminListData.find(s => s.id === id);
			if (rec) rec.must_change_password = true;

			updateSyncStatusIndicator('success');
			showMsg(`已成功將「${name}」的密碼重置！`);
			logAuditRecord("重設帳號密碼", sid, name, { method: "自訂密碼", must_change_password: true });
			document.getElementById('editUserCustomPassword').value = '';
			toggleUIModal(false, 'confirmModal'); toggleUIModal(false, 'adminUserModal'); fetchAdminList();
		} catch (err) { updateSyncStatusIndicator('offline'); showMsg(translateError(err.message), "error"); toggleUIModal(false, 'confirmModal'); }
	});
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

window.toggleAuditLogExpand = function(event, expandId) {
	if (event) {
		event.preventDefault();
		event.stopPropagation();
	}
	const el = document.getElementById(expandId);
	const btn = document.getElementById(`btn-${expandId}`);
	if (!el) return;
	const isHidden = el.classList.contains('hidden');
	if (isHidden) {
		el.classList.remove('hidden');
		if (btn) btn.innerText = "▲ (點擊收合)";
	} else {
		el.classList.add('hidden');
		if (btn) btn.innerText = "▼ (點擊展開)";
	}
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
		'使用者登入': { icon: '🔑', class: 'bg-emerald-600 text-white font-bold' },
		'使用者登出': { icon: '🚪', class: 'bg-slate-600 text-white font-bold' },
		'使用者註冊': { icon: '✨', class: 'bg-teal-600 text-white font-bold' },
		'變更學分紀錄': { icon: '📘', class: 'bg-blue-600 text-white font-bold' },
		'切換版本': { icon: '🔄', class: 'bg-sky-600 text-white font-bold' },
		'切換版面配置': { icon: '📌', class: 'bg-slate-700 text-white font-bold' },
		'批次全部及格': { icon: '✅', class: 'bg-emerald-600 text-white font-bold' },
		'批次學分歸零': { icon: '🧹', class: 'bg-amber-600 text-white font-bold' },
		'單學期全選及格': { icon: '✔', class: 'bg-teal-600 text-white font-bold' },
		'單學期學分歸零': { icon: '⚠️', class: 'bg-orange-600 text-white font-bold' },
		'更改帳號資料': { icon: '📝', class: 'bg-indigo-600 text-white font-bold' },
		'重設帳號密碼': { icon: '⚡', class: 'bg-violet-600 text-white font-bold' },
		'強制首次更改密碼': { icon: '🔒', class: 'bg-amber-600 text-white font-bold' },
		'刪除帳號': { icon: '🗑️', class: 'bg-rose-600 text-white font-bold' },
		'刪除學生帳號': { icon: '🗑️', class: 'bg-rose-600 text-white font-bold' },
		'更新個人資料': { icon: '👤', class: 'bg-purple-600 text-white font-bold' },
		'更新輔導教師授權': { icon: '🔑', class: 'bg-violet-600 text-white font-bold' },
		'送出系統回饋': { icon: '💡', class: 'bg-pink-600 text-white font-bold' },
		'發布系統公告': { icon: '📢', class: 'bg-amber-600 text-white font-bold' },
		'編輯系統公告': { icon: '✏️', class: 'bg-blue-600 text-white font-bold' },
		'更新公告排序': { icon: '↕️', class: 'bg-indigo-600 text-white font-bold' }
	};

	const detailKeyLabels = { 
		role: '身份', year: '入學年', dept: '科別班級', status: '狀態', 
		category: '回饋類別', method: '重設方式', passwordChanged: '密碼變更', 
		fromOrder: '原始順序', toOrder: '新順序', isMarquee: '跑馬燈', 
		isActive: '公開狀態', counselorClassesCount: '授權班級數', layout_mode: '版面模式' 
	};

	filtered.forEach((log, logIdx) => {
		const timeStr = formatDateTime(log.created_at);
		const [datePart, timePart] = timeStr.includes(' ') ? timeStr.split(' ') : [timeStr, ''];
		const tr = document.createElement('tr');
		tr.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100';
		let diffHtml = '';

		if (log.action_type.includes('刪除')) {
			const d = log.details || {};
			diffHtml = `<div class="inline-flex items-center gap-2 p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold"><span class="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px]">已刪除</span><span>姓名：${escapeHtml(d.deleted_name || log.target_student_name || '未知')}</span><span>帳號：${escapeHtml(d.deleted_sid || log.target_student_id || '未知')}</span></div>`;
		} else if (log.action_type === '切換版面配置') {
			const mode = log.details?.layout_mode || '版面配置變更';
			diffHtml = `<span class="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">切換版面：<b>${escapeHtml(mode)}</b></span>`;
		} else if (log.details && typeof log.details === 'object') {
			const d = log.details;
			let headerChips = [];

			if (d.old_version && d.new_version) {
				headerChips.push(`<div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-50 border border-sky-200 text-xs font-bold text-slate-700"><span>原版本: <b>${escapeHtml(d.old_version)}</b></span><span class="text-sky-600 font-black">➔</span><span class="text-indigo-700">新版本: <b>${escapeHtml(d.new_version)}</b></span></div>`);
			}

			if (log.action_type !== '切換版本' && d.old_total !== undefined && d.new_total !== undefined) {
				const isIncreased = d.new_total > d.old_total;
				const totalBadgeColor = isIncreased ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : (d.new_total < d.old_total ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-700');
				headerChips.push(`<div class="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold ${totalBadgeColor}"><span>舊學分: ${escapeHtml(d.old_total)}</span><span class="opacity-60">➔</span><span>新學分: <b>${escapeHtml(d.new_total)}</b></span></div>`);
			}

			if (d.semester) {
				headerChips.push(`<div class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">📅 ${escapeHtml(d.semester)}</div>`);
			}

			if (headerChips.length > 0) diffHtml += `<div class="flex flex-wrap gap-1.5 mb-1.5">${headerChips.join('')}</div>`;

			if (d.changed_fields && Array.isArray(d.changed_fields) && d.changed_fields.length > 0) {
				const expandId = `audit-expand-${logIdx}`;
				diffHtml += `
					<button type="button" id="btn-${expandId}" class="text-xs font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-2 py-0.5 rounded transition cursor-pointer" onclick="toggleAuditLogExpand(event, '${expandId}')">▼ (點擊展開)</button>
					<div id="${expandId}" class="hidden w-full flex flex-wrap gap-1.5 mt-1.5 pt-1.5 border-t border-dashed border-slate-200">
				`;
				d.changed_fields.forEach(f => {
					const isGain = f.newVal && f.newVal.includes('及格') && !f.newVal.includes('未及格');
					const badgeStyle = isGain ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-900 border-rose-300';
					diffHtml += `<div class="inline-flex items-center gap-1 border px-2 py-0.5 rounded text-[11px] font-bold ${badgeStyle}"><span>${escapeHtml(f.field)}:</span><s class="opacity-50 font-normal">${escapeHtml(f.oldVal)}</s><span>➔</span><b>${escapeHtml(f.newVal)}</b></div>`;
				});
				diffHtml += `</div>`;
			} else {
				const metaKeys = Object.keys(d).filter(k => !['old_total', 'new_total', 'changed_fields', 'old_version', 'new_version', 'semester', 'mode', 'layout_mode'].includes(k));
				if (metaKeys.length > 0) {
					diffHtml += `<div class="flex flex-wrap gap-1.5 items-center">`;
					metaKeys.forEach(k => {
						const labelText = detailKeyLabels[k] || k;
						let rawVal = d[k];

						const isClassArray = (k === 'dept' || k === 'classes') && (Array.isArray(rawVal) || (typeof rawVal === 'string' && rawVal.startsWith('[')));
						if (isClassArray) {
							let parsedClasses = [];
							try {
								parsedClasses = Array.isArray(rawVal) ? rawVal : JSON.parse(rawVal);
							} catch (e) { parsedClasses = []; }

							const expandClassId = `audit-classes-${logIdx}`;
							diffHtml += `
								<div class="inline-flex items-center gap-1 border border-violet-200 bg-violet-50 text-violet-900 px-2 py-0.5 rounded text-xs font-bold">
									<span>授權班級名冊：</span>
									<button type="button" id="btn-${expandClassId}" class="text-violet-700 underline font-extrabold hover:text-violet-900 cursor-pointer" onclick="toggleAuditLogExpand(event, '${expandClassId}')">▼ (點擊展開)</button>
								</div>
								<div id="${expandClassId}" class="hidden w-full p-2 bg-slate-50 border border-slate-200 rounded-lg mt-1 text-xs text-slate-700 leading-relaxed font-semibold break-words">
									${parsedClasses.map(c => `<span class="inline-block px-1.5 py-0.5 bg-white border border-slate-200 rounded mr-1 mb-1">${escapeHtml(c)}</span>`).join('')}
								</div>
							`;
						} else {
							let valStr = typeof rawVal === 'boolean' ? (rawVal ? '是' : '否') : String(rawVal || '未設定');
							diffHtml += `<span class="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700"><b>${escapeHtml(labelText)}</b>: ${escapeHtml(valStr)}</span>`;
						}
					});
					diffHtml += `</div>`;
				}
			}
		}

		const cfg = actionConfig[log.action_type] || { icon: '📌', class: 'bg-slate-700 text-white font-bold' };
		tr.innerHTML = `
			<td class="p-2.5 text-slate-500 font-mono text-[11px] leading-tight text-center whitespace-nowrap"><div>${escapeHtml(datePart)}</div><div>${escapeHtml(timePart)}</div></td>
			<td class="p-2.5 font-bold text-xs"><div class="text-slate-800">${escapeHtml(log.operator_name || '系統')} <span class="text-[10px] text-slate-400">(${escapeHtml(mapping.role[log.operator_role] || log.operator_role)})</span></div><div class="text-[10px] font-mono text-slate-400 mt-0.5">${escapeHtml(log.ip_address || '未知 IP')}</div></td>
			<td class="p-2.5 text-xs"><div class="text-slate-900 font-bold truncate max-w-[120px]">${escapeHtml(log.target_student_name || '-')}</div><div class="text-slate-500 font-mono text-[10px] mt-0.5">${escapeHtml(log.target_student_id || '-')}</div></td>
			<td class="p-2.5"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs whitespace-nowrap ${cfg.class}"><span>${cfg.icon}</span><span>${escapeHtml(log.action_type)}</span></span></td>
			<td class="p-2.5 text-slate-700 text-xs">${diffHtml}</td>
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
				tutor: currentUser.user_metadata?.tutor || '未設定',
				must_change_password: false
			};
			hasLoadedInitialData = true;
			const version = determineCurriculumVersion(userDBRecord);
			selectCurriculum(version.year, version.dept);
			applyLoadedChecks(userDBRecord.credits_json || {});

			if (userDBRecord?.must_change_password) {
				toggleUIModal(true, 'forceChangePasswordModal');
			}
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
	updateUI(); loadFromCloud(id);
};

window.exitAdminEditMode = function() {
	editingStudentId = null; activeStudentDBRecord = null; lastLoadedStudentId = null; isViewingClassList = true;
	updateUI();
};

window.handleMainAction = function() {
	const role = userDBRecord?.role || currentUser?.user_metadata?.role || 'student';
	if (role === 'admin' || role === 'teacher' || role === 'counselor') {
		if (currentIndependentPage) closeIndependentPage();
		isViewingClassList = true; editingStudentId = null;
		updateUI();
	}
};

window.handleReturnToTrial = function() {
	if (currentIndependentPage) closeIndependentPage();
	isViewingClassList = false;
	const version = determineCurriculumVersion(userDBRecord);
	selectCurriculum(version.year, version.dept);
	updateUI(); loadFromCloud();
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
	const myYear = userDBRecord?.entry_year || currentUser?.user_metadata?.entry_year || '未設定';
	const myDept = userDBRecord?.entry_dept || currentUser?.user_metadata?.entry_dept || '未設定';

	if (role === 'teacher' && myYear !== '未設定' && myDept !== '未設定' && editingStudentId) {
		if (activeStudentDBRecord && (activeStudentDBRecord.entry_year !== myYear || activeStudentDBRecord.entry_dept !== myDept)) {
			showMsg("班級導師僅能修改所屬班級學生學分！", "error");
			return;
		}
	}

	if (role === 'counselor' && editingStudentId) {
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