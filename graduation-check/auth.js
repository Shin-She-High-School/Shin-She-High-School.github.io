window.checkIsTeacherAccount = async function(cleanSid) {
	if (!cleanSid) return false;
	const lowerSid = cleanSid.toLowerCase().trim();
	const cached = teacherCache.get(lowerSid);
	if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
		return cached.isTeacher;
	}
	const client = ensureDbClient();
	if (!client) return false;
	try {
		const { data, error } = await client
			.from('teacher_whitelist')
			.select('teacher_id')
			.ilike('teacher_id', lowerSid)
			.maybeSingle();
		const isTeacher = !!(!error && data);
		teacherCache.set(lowerSid, { isTeacher, timestamp: Date.now() });
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
		const isReg = document.getElementById('regFields')?.style.display === 'block';
		const hintEl = document.getElementById('authRoleHint');
		const regTeacherRoleGroup = document.getElementById('regTeacherRoleGroup');
		const regYearGroup = document.getElementById('regYearGroup');
		const regDeptGroup = document.getElementById('regDeptGroup');

		if (!isReg) {
			if (hintEl) hintEl.textContent = '';
			return;
		}

		const sidInput = document.getElementById('authID')?.value.trim();
		if (!sidInput) {
			if (hintEl) hintEl.textContent = '';
			if (regTeacherRoleGroup) regTeacherRoleGroup.style.display = 'none';
			if (regYearGroup) regYearGroup.style.display = 'block';
			if (regDeptGroup) regDeptGroup.style.display = 'block';
			return;
		}
		const cleanSid = sidInput.split('@')[0].toLowerCase().trim();
		const isTeacher = await checkIsTeacherAccount(cleanSid);
		const currentCleanSid = document.getElementById('authID')?.value.trim().split('@')[0].toLowerCase().trim();
		if (currentCleanSid !== cleanSid) return;
		if (isTeacher) {
			if (hintEl) hintEl.textContent = '👨‍🏫 教師帳號';
			if (regTeacherRoleGroup) regTeacherRoleGroup.style.display = 'block';
			handleTeacherTypeChange();
		} else {
			if (hintEl) hintEl.textContent = '';
			if (regTeacherRoleGroup) regTeacherRoleGroup.style.display = 'none';
			if (regYearGroup) regYearGroup.style.display = 'block';
			if (regDeptGroup) regDeptGroup.style.display = 'block';
		}
	}, 200);
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

window.handleAuth = async function() {
	const client = ensureDbClient();
	if (!client) { showMsg("無法進行登入 or 註冊！請聯絡管理員。", "error"); return; }
	const sid = document.getElementById('authID').value.trim(), pwd = document.getElementById('authPassword').value;
	if (!sid) { showMsg("請輸入帳號！", "error"); return; }
	const cleanSid = sid.split('@')[0].toLowerCase().trim(), email = `${cleanSid}${EMAIL_DOMAIN}`;
	const isReg = document.getElementById('regFields').style.display === 'block';

	if (isReg) {
		if (!pwd || pwd.length < 6) {
			showMsg("密碼強度不足：長度至少需 6 個字元！", "error");
			return;
		}
	}

	try {
		updateSyncStatusIndicator('saving');
		if (isReg) {
			const isTeacher = await checkIsTeacherAccount(cleanSid);
			const name = document.getElementById('authName').value.trim();
			if (!name) throw new Error("請輸入姓名！");
			let role = isTeacher ? 'teacher' : 'student';
			let entryYear = '未設定';
			let entryDept = '未設定';
			let matchedTutor = '教師帳號免設定';
			if (isTeacher) {
				const teacherType = document.getElementById('authTeacherType')?.value;
				if (!teacherType) {
					throw new Error("請選擇您的教師身份（專任教師或導師）！");
				}
				if (teacherType === 'tutor') {
					entryYear = document.getElementById('authEntryYear').value;
					entryDept = document.getElementById('authEntryDept').value;
					if (!entryYear || !entryDept || entryYear.includes('請選擇') || entryDept.includes('請選擇')) {
						throw new Error("擔任導師請務必選擇負責的入學年與科別班級！");
					}
				} else {
					entryYear = '未設定';
					entryDept = '未設定';
				}
			} else {
				entryYear = document.getElementById('authEntryYear').value;
				entryDept = document.getElementById('authEntryDept').value;
				if (!entryYear || !entryDept || entryYear.includes('請選擇') || entryDept.includes('請選擇')) {
					throw new Error("學生註冊請務必選擇正確的入學年與科別！");
				}
				matchedTutor = await findTutorByYearDept(entryYear, entryDept);
			}
			const { data: signUpData, error } = await client.auth.signUp({
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
					await client.from('grad_checks').upsert({
						id: newUserId, 
						student_id: cleanSid, 
						full_name: name, 
						entry_year: entryYear,
						entry_dept: entryDept, 
						role: role, 
						tutor: matchedTutor, 
						credits_json: {}, 
						total_credits: 0, 
						must_change_password: false,
						updated_at: new Date().toISOString()
					});
				} catch (upsertErr) {}
			}
			updateSyncStatusIndicator('success');
			let successMsg = "學生帳號註冊成功！";
			if (role === 'teacher') successMsg = (entryYear !== '未設定' ? "導師帳號註冊成功！" : "教師帳號註冊成功！");
			showMsg(successMsg);
			switchAuthMode();
			document.getElementById('authID').value = cleanSid;
			logAuditRecord("使用者註冊", cleanSid, name, { role, year: entryYear, dept: entryDept });
		} else {
			if (!pwd) {
				let accountExists = false;
				try {
					const { data } = await client.from('grad_checks').select('student_id').eq('student_id', cleanSid).maybeSingle();
					if (data) accountExists = true;
				} catch (e) {}
				if (!accountExists) {
					updateSyncStatusIndicator('offline'); showMsg("查無此帳號資料，請先註冊！"); switchAuthMode();
					document.getElementById('authID').value = cleanSid; return;
				} else {
					updateSyncStatusIndicator('offline'); showMsg("請輸入密碼！", "error"); return;
				}
			}
			const { data: authResult, error } = await client.auth.signInWithPassword({ email, password: pwd });
			if (error) {
				let accountExists = false;
				try {
					const { data } = await client.from('grad_checks').select('student_id').eq('student_id', cleanSid).maybeSingle();
					if (data) accountExists = true;
				} catch (e) {}
				if (!accountExists) {
					updateSyncStatusIndicator('offline'); showMsg("查無此帳號資料，請先註冊！"); switchAuthMode();
					document.getElementById('authID').value = cleanSid; return;
				}
				throw error;
			}
			let loginDisplayName = cleanSid;
			if (authResult?.user?.user_metadata?.full_name) loginDisplayName = authResult.user.user_metadata.full_name;
			updateSyncStatusIndicator('success'); showMsg("登入成功！");
			document.getElementById('authWorkspace').style.display = 'none'; document.getElementById('appWorkspace').style.display = 'flex';
			hasLoadedInitialData = false; updateUI();
			logAuditRecord("使用者登入", cleanSid, loginDisplayName, { status: "登入成功" });
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
		window.clearAppRuntimeState();
		const client = ensureDbClient();
		if (client) await client.auth.signOut(); 
		window.location.hash = ''; 
		window.location.reload(); 
	} catch (e) { showMsg("登出失敗", 'error'); } 
};

window.openProfile = function() {
	if (!currentUser) return;
	const curData = userDBRecord || currentUser.user_metadata, role = curData.role || 'student';
	initDropdowns(role === 'admin');
	document.getElementById('profAccount').value = curData.student_id || '';
	document.getElementById('profName').value = curData.full_name || '';
	document.getElementById('profEntryYear').value = curData.entry_year || '未設定';
	const isCounselorDept = String(curData.entry_dept || '').startsWith('[');
	document.getElementById('profEntryDept').value = isCounselorDept ? '未設定' : (curData.entry_dept || '未設定');
	document.getElementById('profStudentTutorArea').style.display = role === 'student' ? 'block' : 'none';
	if (role === 'student') document.getElementById('profTutor').value = curData.tutor || '未設定';
	document.getElementById('profPassword').value = '';
	toggleUIModal(true, 'profileModal');
};

window.updateProfile = async function() {
	const n = document.getElementById('profName').value, p = document.getElementById('profPassword').value, d = { data: { full_name: n } };
	if (p) {
		if (p.length < 6) {
			showMsg("密碼長度至少需 6 個字元！", "error");
			return;
		}
		d.password = p;
	}
	const client = ensureDbClient();
	if (!client) return;
	try {
		const curData = userDBRecord || currentUser.user_metadata;
		updateSyncStatusIndicator('saving');
		await client.auth.updateUser(d);
		updateSyncStatusIndicator('success');
		showMsg("個人資料已更新！");
		logAuditRecord("更新個人資料", curData.student_id, curData.full_name, { passwordChanged: !!p });
		toggleUIModal(false, 'profileModal');
	} catch (err) {
		updateSyncStatusIndicator('offline'); showMsg(translateError(err.message), 'error');
	}
};

window.submitForceChangePassword = async function() {
	const client = ensureDbClient();
	if (!client || !currentUser) return;

	const newPwd = document.getElementById('forceNewPassword')?.value.trim();
	const confirmPwd = document.getElementById('forceConfirmPassword')?.value.trim();

	if (!newPwd || !confirmPwd) {
		showMsg("請填寫新密碼與確認密碼！", "error");
		return;
	}
	if (newPwd.length < 6) {
		showMsg("密碼長度需至少 6 碼！", "error");
		return;
	}
	if (newPwd !== confirmPwd) {
		showMsg("兩次輸入的密碼不相符！", "error");
		return;
	}

	try {
		updateSyncStatusIndicator('saving');

		const { error: authErr } = await client.auth.updateUser({ password: newPwd });
		if (authErr) throw authErr;

		const { error: dbErr } = await client.from('grad_checks').update({
			must_change_password: false,
			updated_at: new Date().toISOString()
		}).eq('id', currentUser.id);
		if (dbErr) throw dbErr;

		if (userDBRecord) {
			userDBRecord.must_change_password = false;
		}

		updateSyncStatusIndicator('success');
		showMsg("密碼修改成功！已解除鎖定。");
		toggleUIModal(false, 'forceChangePasswordModal');

		document.getElementById('forceNewPassword').value = '';
		document.getElementById('forceConfirmPassword').value = '';

		const curRec = userDBRecord || currentUser?.user_metadata || {};
		logAuditRecord("強制首次更改密碼", curRec.student_id, curRec.full_name, { status: "修改成功" });

	} catch (err) {
		updateSyncStatusIndicator('offline');
		showMsg("密碼修改失敗：" + translateError(err.message), "error");
	}
};