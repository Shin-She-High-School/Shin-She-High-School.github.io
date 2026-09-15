let adminCurrentPage = 1;
const adminPageSize = 25;
let filteredAdminList = [];

window.fetchAdminList = async function(isSilent = false) {
	const client = ensureDbClient();
	if (!client) return;
	try {
		if (!isSilent) updateSyncStatusIndicator('saving');
		const { data, error } = await client
			.from('grad_checks')
			.select('*')
			.order('student_id', { ascending: true });

		if (error) throw error;

		if (data) {
			adminListData = data;
			applyAdminFilters();
			renderAdminStats();
			if (!isSilent) updateSyncStatusIndicator('success');
		}
	} catch (err) {
		if (!isSilent) {
			updateSyncStatusIndicator('offline');
			showMsg("載入管理清單失敗：" + translateError(err.message), "error");
		}
	}
};

window.applyAdminFilters = function() {
	const search = (document.getElementById('adminSearchInput')?.value || '').trim().toLowerCase();
	const selectedRoles = getMSValues('role');
	const selectedYears = getMSValues('year');
	const selectedDepts = getMSValues('dept');
	const selectedStatuses = getMSValues('status');

	const myRole = userDBRecord?.role || currentUser?.user_metadata?.role || 'student';
	const myYear = userDBRecord?.entry_year || currentUser?.user_metadata?.entry_year || '未設定';
	const myDept = userDBRecord?.entry_dept || currentUser?.user_metadata?.entry_dept || '未設定';

	filteredAdminList = adminListData.filter(item => {
		if (myRole === 'teacher' && myYear !== '未設定' && myDept !== '未設定') {
			if (item.role !== 'student') return false;
			if (String(item.entry_year).trim() !== String(myYear).trim()) return false;
			if (String(item.entry_dept).trim() !== String(myDept).trim()) return false;
		} else if (myRole === 'counselor') {
			if (item.role !== 'student') return false;
			const allowedClasses = getUserCounselorClasses(userDBRecord);
			const studentKey = `${item.entry_year}_${item.entry_dept}`;
			if (!allowedClasses.includes(studentKey)) return false;
		}

		if (search) {
			const sid = (item.student_id || '').toLowerCase();
			const name = (item.full_name || '').toLowerCase();
			if (!sid.includes(search) && !name.includes(search)) return false;
		}

		if (!selectedRoles.includes('all')) {
			let r = item.role || 'student';
			if (r === 'teacher') {
				const isTutor = (item.entry_year && item.entry_dept && item.entry_year !== '未設定' && item.entry_dept !== '未設定');
				r = isTutor ? 'tutor' : 'teacher';
			}
			if (!selectedRoles.includes(r)) return false;
		}

		if (!selectedYears.includes('all')) {
			if (!selectedYears.includes(String(item.entry_year))) return false;
		}

		if (!selectedDepts.includes('all')) {
			if (!selectedDepts.includes(String(item.entry_dept))) return false;
		}

		if (!selectedStatuses.includes('all')) {
			if (item.role !== 'student') return false;
			const st = evaluateStudentStatus(item);
			if (selectedStatuses.includes('pass') && st.status !== 'pass') return false;
			if (selectedStatuses.includes('not_pass') && st.status === 'pass') return false;
			if (selectedStatuses.includes('completion') && st.status !== 'completion') return false;
			if (selectedStatuses.includes('fail') && st.status !== 'fail') return false;
		}

		return true;
	});

	const cntEl = document.getElementById('adminTotalCountText');
	if (cntEl) {
		cntEl.style.display = 'inline-block';
		cntEl.innerText = `共 ${filteredAdminList.length} 筆帳號`;
	}

	renderAdminTable();
};

window.renderAdminStats = function() {
	const panel = document.getElementById('adminStatsPanel');
	if (!panel) return;
	const students = filteredAdminList.filter(u => u.role === 'student');
	let passCount = 0, completionCount = 0, failCount = 0;
	students.forEach(s => {
		const st = evaluateStudentStatus(s);
		if (st.status === 'pass') passCount++;
		else if (st.status === 'completion') completionCount++;
		else failCount++;
	});

	panel.innerHTML = `
		<div class="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
			<div class="text-[11px] font-bold text-indigo-700">學生總人數</div>
			<div class="text-xl font-black text-indigo-900 mt-0.5">${students.length} 人</div>
		</div>
		<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
			<div class="text-[11px] font-bold text-emerald-700">符合畢業資格</div>
			<div class="text-xl font-black text-emerald-900 mt-0.5">${passCount} 人</div>
		</div>
		<div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
			<div class="text-[11px] font-bold text-amber-700">符合修業證明</div>
			<div class="text-xl font-black text-amber-900 mt-0.5">${completionCount} 人</div>
		</div>
		<div class="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
			<div class="text-[11px] font-bold text-rose-700">未達標 / 成績證明</div>
			<div class="text-xl font-black text-rose-900 mt-0.5">${failCount} 人</div>
		</div>
	`;
};

window.renderAdminTable = function() {
	const tbody = document.getElementById('adminListBody');
	const cardsContainer = document.getElementById('adminCardsContainer');
	if (!tbody) return;

	tbody.innerHTML = '';
	if (cardsContainer) cardsContainer.innerHTML = '';

	if (filteredAdminList.length === 0) {
		const emptyRow = `<tr><td colspan="6" class="text-center py-8 text-slate-400 font-bold">查無符合條件的帳號資料</td></tr>`;
		tbody.innerHTML = emptyRow;
		if (cardsContainer) cardsContainer.innerHTML = `<div class="text-center py-8 text-slate-400 font-bold">查無符合條件的帳號資料</div>`;
		return;
	}

	filteredAdminList.forEach(item => {
		const role = item.role || 'student';
		let roleBadge = '<span class="role-badge badge-student">學生</span>';
		if (role === 'admin') roleBadge = '<span class="role-badge badge-admin">管理員</span>';
		else if (role === 'counselor') roleBadge = '<span class="role-badge badge-counselor">輔導教師</span>';
		else if (role === 'teacher') {
			const isTutor = (item.entry_year && item.entry_dept && item.entry_year !== '未設定' && item.entry_dept !== '未設定');
			roleBadge = isTutor ? '<span class="role-badge badge-tutor">導師</span>' : '<span class="role-badge badge-teacher">教師</span>';
		}

		let statusBadge = '-';
		if (role === 'student') {
			const st = evaluateStudentStatus(item);
			statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-black ${st.badgeClass}">${st.statusText} (${item.total_credits || 0}學分)</span>`;
		}

		let classInfo = `${item.entry_year || '未設定'} / ${item.entry_dept || '未設定'}`;
		if (role === 'counselor') {
			const allowedCount = getUserCounselorClasses(item).length;
			classInfo = `<span class="text-violet-700 font-bold">已授權 ${allowedCount} 個班級</span>`;
		}

		let editTrialBtn = '';
		if (role === 'student') {
			editTrialBtn = `
				<button type="button" class="btn-mini btn-cloud" onclick="startAdminEditStudent('${item.id}')" title="代為檢核學分">
					試算
				</button>
			`;
		}

		let counselorScopeBtn = '';
		if (role === 'counselor') {
			const allowedCount = getUserCounselorClasses(item).length;
			counselorScopeBtn = `
				<button type="button" class="btn-mini" style="background: linear-gradient(135deg, #8b5cf6, #6d28d9);" onclick="openCounselorScopeModal('${item.id}')" title="設定負責檢核班級">
					🔑 授權班級 (${allowedCount})
				</button>
			`;
		}

		const actionsHtml = `
			<div class="flex items-center gap-1.5 flex-wrap">
				${editTrialBtn}
				${counselorScopeBtn}
				<button type="button" class="btn-mini btn-admin" onclick="openAdminUserEdit('${item.id}')">
					編輯
				</button>
				<button type="button" class="btn-mini bg-rose-600 hover:bg-rose-700" onclick="confirmDeleteUser('${item.id}')">
					刪除
				</button>
			</div>
		`;

		const tr = document.createElement('tr');
		tr.innerHTML = `
			<td><span class="font-extrabold text-slate-800">${escapeHtml(item.full_name || '無')}</span></td>
			<td><span class="font-mono text-xs font-bold text-slate-600">${escapeHtml(item.student_id || '-')}</span></td>
			<td>${roleBadge}</td>
			<td><span class="text-xs font-semibold text-slate-700">${classInfo}</span></td>
			<td>${statusBadge}</td>
			<td>${actionsHtml}</td>
		`;
		tbody.appendChild(tr);

		if (cardsContainer) {
			const card = document.createElement('div');
			card.className = "bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2.5";
			card.innerHTML = `
				<div class="flex items-center justify-between border-b border-slate-100 pb-2">
					<div class="flex items-center gap-2">
						<span class="font-black text-slate-800 text-sm">${escapeHtml(item.full_name || '無')}</span>
						${roleBadge}
					</div>
					<span class="font-mono text-xs text-slate-500 font-bold">${escapeHtml(item.student_id || '-')}</span>
				</div>
				<div class="text-xs text-slate-600 flex justify-between items-center">
					<span>所屬/負責班級:</span>
					<span class="font-bold text-slate-800">${classInfo}</span>
				</div>
				<div class="text-xs text-slate-600 flex justify-between items-center">
					<span>畢業資格判定:</span>
					<div>${statusBadge}</div>
				</div>
				<div class="pt-2 border-t border-slate-100 flex justify-end">
					${actionsHtml}
				</div>
			`;
			cardsContainer.appendChild(card);
		}
	});
};

window.openCounselorScopeModal = function(userId) {
	const user = adminListData.find(u => u.id === userId);
	if (!user) return;

	document.getElementById('counselorTargetUserId').value = user.id;
	const allowed = getUserCounselorClasses(user);

	let html = '';
	CurriculumService.years.forEach(yr => {
		html += `
			<div class="p-2.5 bg-white border border-slate-200 rounded-xl mb-2.5">
				<div class="flex justify-between items-center pb-1 mb-1.5 border-b border-slate-100">
					<span class="font-black text-xs text-slate-800">${yr} 學年度 (${yr === '113' ? '高三' : (yr === '114' ? '高二' : '高一')})</span>
					<button type="button" class="text-[11px] font-bold text-violet-600 hover:underline" onclick="toggleYearCounselorClasses('${yr}', true)">本學年全選</button>
				</div>
				<div class="grid grid-cols-2 gap-1.5">
		`;

		CurriculumService.departments.forEach(dept => {
			const key = `${yr}_${dept}`;
			const checked = allowed.includes(key) ? 'checked' : '';
			html += `
				<label class="text-xs flex items-center gap-1.5 cursor-pointer p-1 rounded hover:bg-slate-50">
					<input type="checkbox" value="${key}" data-year="${yr}" class="counselor-modal-chk text-violet-600 focus:ring-violet-500 rounded" ${checked} onchange="updateCounselorModalCount()">
					<span class="truncate font-semibold text-slate-700">${dept}</span>
				</label>
			`;
		});

		html += `</div></div>`;
	});

	document.getElementById('counselorClassChecklist').innerHTML = html;
	updateCounselorModalCount();
	toggleUIModal(true, 'counselorScopeModal');
};

window.updateCounselorModalCount = function() {
	const count = document.querySelectorAll('.counselor-modal-chk:checked').length;
	const badge = document.getElementById('counselorModalCountBadge');
	if (badge) badge.innerText = `已選取 ${count} 班`;
};

window.toggleAllCounselorClasses = function(isSelectAll) {
	document.querySelectorAll('.counselor-modal-chk').forEach(chk => {
		chk.checked = isSelectAll;
	});
	updateCounselorModalCount();
};

window.toggleYearCounselorClasses = function(yr, isSelectAll) {
	document.querySelectorAll(`.counselor-modal-chk[data-year="${yr}"]`).forEach(chk => {
		chk.checked = isSelectAll;
	});
	updateCounselorModalCount();
};

window.saveCounselorScopeSettings = async function() {
	const client = ensureDbClient();
	const uid = document.getElementById('counselorTargetUserId').value;
	const user = adminListData.find(u => u.id === uid);
	if (!client || !user) return;

	const selected = Array.from(document.querySelectorAll('.counselor-modal-chk:checked')).map(c => c.value);

	try {
		updateSyncStatusIndicator('saving');
		const cj = (user.credits_json && typeof user.credits_json === 'object') ? JSON.parse(JSON.stringify(user.credits_json)) : {};
		cj._counselor_classes = selected;

		const payload = {
			entry_dept: JSON.stringify(selected),
			credits_json: cj,
			updated_at: new Date().toISOString()
		};

		const { error } = await client.from('grad_checks').update(payload).eq('id', uid);
		if (error) throw error;

		user.entry_dept = payload.entry_dept;
		user.credits_json = cj;

		updateSyncStatusIndicator('success');
		showMsg(`已成功更新 ${user.full_name} 輔導教師授權（共 ${selected.length} 班）`);
		toggleUIModal(false, 'counselorScopeModal');

		AuditService.logRecord(
			"更新輔導教師授權",
			user.student_id,
			user.full_name,
			{ authorized_count: selected.length, classes: selected }
		);

		renderAdminTable();
	} catch (err) {
		updateSyncStatusIndicator('offline');
		showMsg("更新授權失敗：" + translateError(err.message), "error");
	}
};

window.openAdminUserEdit = function(userId) {
	const user = adminListData.find(u => u.id === userId);
	if (!user) return;

	document.getElementById('editUserId').value = user.id;
	document.getElementById('editUserSid').value = user.student_id || '';
	document.getElementById('editUserName').value = user.full_name || '';
	document.getElementById('editUserRole').value = user.role || 'student';
	document.getElementById('editUserCustomPassword').value = '';

	initDropdowns(true);

	const ySel = document.getElementById('editUserEntryYear');
	const dSel = document.getElementById('editUserEntryDept');
	if (ySel) ySel.value = user.entry_year || '未設定';
	if (dSel) dSel.value = String(user.entry_dept).startsWith('[') ? '未設定' : (user.entry_dept || '未設定');

	toggleAdminUserRoleFields(user.role || 'student');
	toggleUIModal(true, 'adminUserModal');
};

window.toggleAdminUserRoleFields = function(role) {
	const standardGroup = document.getElementById('editUserStandardClassGroup');
	const tutorSec = document.getElementById('editTutorSection');
	if (standardGroup) standardGroup.style.display = (role === 'admin' || role === 'counselor') ? 'none' : 'block';
	if (tutorSec) tutorSec.style.display = (role === 'student') ? 'block' : 'none';
};

window.saveAdminUserEdit = async function() {
	const client = ensureDbClient();
	if (!client) return;

	const uid = document.getElementById('editUserId').value;
	const sid = document.getElementById('editUserSid').value.trim();
	const name = document.getElementById('editUserName').value.trim();
	const role = document.getElementById('editUserRole').value;
	let year = document.getElementById('editUserEntryYear')?.value || '未設定';
	let dept = document.getElementById('editUserEntryDept')?.value || '未設定';

	const user = adminListData.find(u => u.id === uid);
	if (!user) return;

	if (role === 'admin') {
		year = '未設定';
		dept = '未設定';
	} else if (role === 'counselor') {
		year = '未設定';
		dept = user.entry_dept || '[]';
	}

	try {
		updateSyncStatusIndicator('saving');
		const payload = {
			student_id: sid,
			full_name: name,
			role: role,
			entry_year: year,
			entry_dept: dept,
			updated_at: new Date().toISOString()
		};

		const { error } = await client.from('grad_checks').update(payload).eq('id', uid);
		if (error) throw error;

		user.student_id = sid;
		user.full_name = name;
		user.role = role;
		user.entry_year = year;
		user.entry_dept = dept;

		updateSyncStatusIndicator('success');
		showMsg("帳號資料修改成功！");
		toggleUIModal(false, 'adminUserModal');

		AuditService.logRecord("更改帳號資料", sid, name, { updated_role: role, year, dept });
		renderAdminTable();
	} catch (err) {
		updateSyncStatusIndicator('offline');
		showMsg("儲存帳號失敗：" + translateError(err.message), "error");
	}
};

window.directResetPasswordToSid = function() {
	const sid = document.getElementById('editUserSid').value.trim();
	if (!sid) {
		showMsg("無有效帳號可供重設", "error");
		return;
	}
	showConfirmModal(`確定要將密碼重設為預設帳號【${sid}】嗎？`, "重設密碼確認", async () => {
		toggleUIModal(false, 'confirmModal');
		executePasswordReset(sid);
	}, "確認重設", "linear-gradient(135deg, #6366f1, #4f46e5)");
};

window.customResetPassword = function() {
	const pwd = document.getElementById('editUserCustomPassword').value.trim();
	if (!pwd || pwd.length < 6) {
		showMsg("密碼長度至少需 6 個字元以上", "error");
		return;
	}
	showConfirmModal(`確定要將密碼設定為輸入的新密碼嗎？`, "自訂密碼確認", async () => {
		toggleUIModal(false, 'confirmModal');
		executePasswordReset(pwd);
	}, "確認重設", "linear-gradient(135deg, #6366f1, #4f46e5)");
};

async function executePasswordReset(newPwd) {
	const client = ensureDbClient();
	if (!client) return;
	const uid = document.getElementById('editUserId').value;
	const user = adminListData.find(u => u.id === uid);
	if (!user) return;

	try {
		updateSyncStatusIndicator('saving');
		const { error } = await client.auth.admin.updateUserById(uid, { password: newPwd });
		if (error) throw error;

		updateSyncStatusIndicator('success');
		showMsg(`密碼已成功更新！`);
		AuditService.logRecord("重設帳號密碼", user.student_id, user.full_name, { reset_to_sid: newPwd === user.student_id });
	} catch (err) {
		updateSyncStatusIndicator('offline');
		showMsg("密碼重設失敗：" + translateError(err.message), "error");
	}
}

window.confirmDeleteUser = function(userId) {
	const user = adminListData.find(u => u.id === userId);
	if (!user) return;

	showConfirmModal(`確定要永久刪除【${user.full_name} (${user.student_id})】的所有資料嗎？此操作不可逆！`, "刪除帳號確認", async () => {
		toggleUIModal(false, 'confirmModal');
		const client = ensureDbClient();
		if (!client) return;

		try {
			updateSyncStatusIndicator('saving');
			const { error } = await client.from('grad_checks').delete().eq('id', userId);
			if (error) throw error;

			adminListData = adminListData.filter(u => u.id !== userId);
			applyAdminFilters();
			updateSyncStatusIndicator('success');
			showMsg("帳號已成功刪除");
			AuditService.logRecord("刪除帳號", user.student_id, user.full_name, {});
		} catch (err) {
			updateSyncStatusIndicator('offline');
			showMsg("刪除帳號失敗：" + translateError(err.message), "error");
		}
	}, "確認刪除", "#dc2626");
};

window.startAdminEditStudent = function(userId) {
	const student = adminListData.find(u => u.id === userId);
	if (!student) return;

	editingStudentId = student.student_id || student.id;
	activeStudentDBRecord = student;
	isViewingClassList = false;

	const targetNameEl = document.getElementById('targetStudentName');
	if (targetNameEl) targetNameEl.innerText = `${student.full_name} (${student.student_id})`;

	updateUI();
	scrollToTop();
};

window.exitAdminEditMode = function() {
	editingStudentId = null;
	activeStudentDBRecord = null;
	isViewingClassList = true;
	updateUI();
};

window.handleReturnToTrial = function() {
	isViewingClassList = false;
	editingStudentId = null;
	updateUI();
};

window.handleMainAction = function() {
	isViewingClassList = true;
	editingStudentId = null;
	updateUI();
};