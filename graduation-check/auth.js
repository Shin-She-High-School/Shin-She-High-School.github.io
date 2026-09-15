let isRegisterMode = false;

window.switchAuthMode = function() {
	isRegisterMode = !isRegisterMode;
	const titleEl = document.getElementById('authTitle');
	const regFields = document.getElementById('regFields');
	const btn = document.querySelector('.auth-btn-primary');
	const link = document.getElementById('authSwitchLink');
	const hint = document.getElementById('authRoleHint');

	if (isRegisterMode) {
		if (titleEl) titleEl.innerText = "註冊帳號";
		if (regFields) regFields.style.display = "block";
		if (btn) btn.innerText = "確認註冊";
		if (link) link.innerText = "已有帳號？點此登入";
		checkAuthIdRoleHint();
	} else {
		if (titleEl) titleEl.innerText = "帳號登入";
		if (regFields) regFields.style.display = "none";
		if (btn) btn.innerText = "確認登入";
		if (link) link.innerText = "尚未有帳號？點此註冊";
		if (hint) hint.innerText = "";
	}
};

window.checkAuthIdRoleHint = function() {
	if (!isRegisterMode) return;
	const rawId = (document.getElementById('authID')?.value || '').trim().toLowerCase();
	const hintEl = document.getElementById('authRoleHint');
	const teacherRoleGroup = document.getElementById('regTeacherRoleGroup');
	const yearGroup = document.getElementById('regYearGroup');
	const deptGroup = document.getElementById('regDeptGroup');

	if (!hintEl) return;

	if (!rawId) {
		hintEl.innerText = "";
		if (teacherRoleGroup) teacherRoleGroup.style.display = "none";
		if (yearGroup) yearGroup.style.display = "block";
		if (deptGroup) deptGroup.style.display = "block";
		return;
	}

	if (rawId.startsWith('t')) {
		hintEl.innerText = "識別身分：教職員";
		hintEl.className = "text-xs font-black text-indigo-600";
		if (teacherRoleGroup) teacherRoleGroup.style.display = "block";
		handleTeacherTypeChange();
	} else if (rawId.startsWith('c')) {
		hintEl.innerText = "識別身分：輔導教師";
		hintEl.className = "text-xs font-black text-violet-600";
		if (teacherRoleGroup) teacherRoleGroup.style.display = "none";
		if (yearGroup) yearGroup.style.display = "none";
		if (deptGroup) deptGroup.style.display = "none";
	} else if (rawId.startsWith('a')) {
		hintEl.innerText = "識別身分：管理員";
		hintEl.className = "text-xs font-black text-slate-800";
		if (teacherRoleGroup) teacherRoleGroup.style.display = "none";
		if (yearGroup) yearGroup.style.display = "none";
		if (deptGroup) deptGroup.style.display = "none";
	} else {
		hintEl.innerText = "識別身分：學生";
		hintEl.className = "text-xs font-black text-emerald-600";
		if (teacherRoleGroup) teacherRoleGroup.style.display = "none";
		if (yearGroup) yearGroup.style.display = "block";
		if (deptGroup) deptGroup.style.display = "block";
	}
};

window.handleTeacherTypeChange = function() {
	const tType = document.getElementById('authTeacherType')?.value;
	const yearGroup = document.getElementById('regYearGroup');
	const deptGroup = document.getElementById('regDeptGroup');

	if (tType === 'tutor') {
		if (yearGroup) yearGroup.style.display = "block";
		if (deptGroup) deptGroup.style.display = "block";
	} else {
		if (yearGroup) yearGroup.style.display = "none";
		if (deptGroup) deptGroup.style.display = "none";
	}
};

window.handleAuth = async function() {
	const client = ensureDbClient();
	if (!client) {
		showMsg("資料庫連線初始化失敗", "error");
		return;
	}

	const rawId = (document.getElementById('authID')?.value || '').trim().toLowerCase();
	const pwd = document.getElementById('authPassword')?.value || '';

	if (!rawId || !pwd) {
		showMsg("請填寫完整帳號與密碼！", "error");
		return;
	}

	const email = `${rawId}${EMAIL_DOMAIN}`;

	if (!isRegisterMode) {
		try {
			updateSyncStatusIndicator('saving');
			const { data, error } = await client.auth.signInWithPassword({ email, password: pwd });
			if (error) throw error;

			updateSyncStatusIndicator('success');
			showMsg("登入成功！");
			AuditService.logRecord("使用者登入", rawId, data?.user?.user_metadata?.full_name || rawId, {});
		} catch (err) {
			updateSyncStatusIndicator('offline');
			showMsg(translateError(err.message), "error");
		}
	} else {
		const name = (document.getElementById('authName')?.value || '').trim();
		if (!name) {
			showMsg("請填寫姓名！", "error");
			return;
		}

		let role = 'student';
		let year = '未設定';
		let dept = '未設定';

		if (rawId.startsWith('t')) {
			const tType = document.getElementById('authTeacherType')?.value;
			if (!tType) {
				showMsg("請選擇教師身份（導師／科任教師）！", "error");
				return;
			}
			role = 'teacher';
			if (tType === 'tutor') {
				year = document.getElementById('authEntryYear')?.value || '';
				dept = document.getElementById('authEntryDept')?.value || '';
				if (!year || !dept) {
					showMsg("導師請選擇負責入學年與班級！", "error");
					return;
				}
			}
		} else if (rawId.startsWith('c')) {
			role = 'counselor';
			dept = '[]';
		} else if (rawId.startsWith('a')) {
			role = 'admin';
		} else {
			role = 'student';
			year = document.getElementById('authEntryYear')?.value || '';
			dept = document.getElementById('authEntryDept')?.value || '';
			if (!year || !dept) {
				showMsg("學生請完整填寫入學年與科別班級！", "error");
				return;
			}
		}

		try {
			updateSyncStatusIndicator('saving');
			const meta = {
				full_name: name,
				student_id: rawId,
				role: role,
				entry_year: year,
				entry_dept: dept
			};

			const { data, error } = await client.auth.signUp({
				email,
				password: pwd,
				options: { data: meta }
			});

			if (error) throw error;

			const uid = data?.user?.id;
			if (uid) {
				const tutorName = (role === 'student') ? await findTutorByYearDept(year, dept) : (role === 'admin' ? '管理員免設定' : (role === 'counselor' ? '輔導教師免設定' : '教師免設定'));
				
				const initialCredits = {
					_view_year: year !== '未設定' ? year : '113',
					_view_dept: dept !== '未設定' && !dept.startsWith('[') ? dept : '普通科(理工生醫群)-1',
					_layout_mode: 'semester'
				};

				await client.from('grad_checks').upsert({
					id: uid,
					student_id: rawId,
					full_name: name,
					entry_year: year,
					entry_dept: dept,
					role: role,
					tutor: tutorName,
					credits_json: initialCredits,
					total_credits: 0,
					updated_at: new Date().toISOString()
				}, { onConflict: 'student_id' });
			}

			updateSyncStatusIndicator('success');
			showMsg("註冊成功，正在進入系統...");
			AuditService.logRecord("使用者註冊", rawId, name, { role, year, dept });
		} catch (err) {
			updateSyncStatusIndicator('offline');
			showMsg("註冊失敗：" + translateError(err.message), "error");
		}
	}
};

window.handleLogout = async function() {
	const client = ensureDbClient();
	if (currentUser) {
		AuditService.logRecord("使用者登出", userDBRecord?.student_id || currentUser.id, userDBRecord?.full_name || '使用者', {});
	}
	cleanupRealtimeSubscriptions();
	clearAppRuntimeState();
	if (client) {
		await client.auth.signOut();
	}
	window.location.hash = '';
	window.location.reload();
};

window.openProfile = function() {
	const cur = userDBRecord || currentUser?.user_metadata || {};
	document.getElementById('profAccount').value = cur.student_id || (currentUser?.email || '').split('@')[0];
	document.getElementById('profName').value = cur.full_name || '';
	
	initDropdowns(false);
	
	const yEl = document.getElementById('profEntryYear');
	const dEl = document.getElementById('profEntryDept');
	if (yEl) yEl.value = cur.entry_year || '未設定';
	if (dEl) dEl.value = String(cur.entry_dept).startsWith('[') ? '未設定' : (cur.entry_dept || '未設定');
	
	const tutorBox = document.getElementById('profStudentTutorArea');
	const tEl = document.getElementById('profTutor');
	if (cur.role === 'student') {
		if (tutorBox) tutorBox.style.display = 'block';
		if (tEl) tEl.value = cur.tutor || '系統自動對應中';
	} else {
		if (tutorBox) tutorBox.style.display = 'none';
	}

	document.getElementById('profPassword').value = '';
	toggleUIModal(true, 'profileModal');
};

window.updateProfile = async function() {
	const client = ensureDbClient();
	if (!client || !currentUser) return;

	const newPwd = document.getElementById('profPassword')?.value.trim();
	if (!newPwd) {
		toggleUIModal(false, 'profileModal');
		showMsg("未修改任何資料");
		return;
	}

	if (newPwd.length < 6) {
		showMsg("密碼長度至少需 6 個字元以上", "error");
		return;
	}

	try {
		updateSyncStatusIndicator('saving');
		const { error } = await client.auth.updateUser({ password: newPwd });
		if (error) throw error;

		updateSyncStatusIndicator('success');
		showMsg("密碼修改成功！");
		toggleUIModal(false, 'profileModal');
		AuditService.logRecord("更新個人資料", userDBRecord?.student_id || currentUser.id, userDBRecord?.full_name || '', { updated_field: "密碼" });
	} catch (err) {
		updateSyncStatusIndicator('offline');
		showMsg("更新失敗：" + translateError(err.message), "error");
	}
};