const CurriculumService = {
	years: ["113", "114"],
	departments: [
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
	data: {},
	getAllClassKeys() {
		const keys = [];
		this.years.forEach(y => {
			this.departments.forEach(d => {
				keys.push(`${y}_${d}`);
			});
		});
		return keys;
	},
	setCurriculums(records) {
		if (!Array.isArray(records)) return;
		records.forEach(item => {
			let parsedCourses = item.courses;
			if (typeof parsedCourses === 'string') {
				try { parsedCourses = JSON.parse(parsedCourses); } catch (e) { parsedCourses = []; }
			}
			if (item.curriculum_key && Array.isArray(parsedCourses)) {
				this.data[item.curriculum_key] = parsedCourses;
			}
		});
	},
	getCurriculum(year, dept) {
		return this.data[`${year}_${dept}`] || [];
	},
	getTrackType(deptName) {
		if (!deptName) return 'vocational';
		if (deptName.includes('普通科')) return 'academic';
		if (deptName.includes('體育班')) return 'sports';
		return 'vocational';
	}
};

let curriculum = [];

window.getTrackType = function(deptName) {
	return CurriculumService.getTrackType(deptName);
};

window.getChkId = function(name, sIdx) {
	return `chk_${name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${sIdx}`;
};

window.showCourseNote = function(event, noteText) {
	if (event) {
		event.preventDefault();
		event.stopPropagation();
	}
	if (typeof showMsg === 'function') {
		showMsg(`📌 備註：${noteText}`, 'info');
	} else {
		alert(`📌 科目備註：\n${noteText}`);
	}
};

window.fetchCloudCurriculums = async function() {
	const client = ensureDbClient();
	if (!client) return;
	try {
		const { data, error } = await client.from('curriculums').select('*');
		if (!error && data && data.length > 0) {
			CurriculumService.setCurriculums(data);
		}
	} catch (e) {}
};

window.initThresholds = function() {
	let maxDept = 0;
	curriculum.forEach(i => {
		if (i.cat === 'dept') maxDept += i.credits.reduce((a, b) => a + b, 0);
	});
	DEPT_THRESHOLD = Math.ceil(maxDept * 0.85);
};

window.determineCurriculumVersion = function(record) {
	if (!record) return { year: currentYear, dept: currentDept, locked: false };
	const role = record.role || 'student';
	const ey = record.entry_year || '未設定';
	const ed = record.entry_dept || '未設定';
	const hasSetting = (ey !== '未設定' && ed !== '未設定' && !ey.includes('_') && !ed.includes('_') && !String(ed).startsWith('['));
	if (role === 'student') {
		return { year: hasSetting ? ey : '113', dept: hasSetting ? ed : '普通科(理工生醫群)-1', locked: true };
	} else {
		if (hasSetting && role === 'teacher') return { year: ey, dept: ed, locked: true };
		let vYear = record.credits_json?._view_year || sessionStorage.getItem('tempSelectedYear') || '113';
		let vDept = record.credits_json?._view_dept || sessionStorage.getItem('tempSelectedDept') || '普通科(理工生醫群)-1';
		if (String(vDept).startsWith('[') || !CurriculumService.departments.includes(vDept)) {
			vDept = '普通科(理工生醫群)-1';
		}
		if (!CurriculumService.years.includes(vYear)) {
			vYear = '113';
		}
		return { year: vYear, dept: vDept, locked: false };
	}
};

window.selectCurriculum = function(yr, dept) {
	if (!CurriculumService.years.includes(String(yr))) {
		yr = '113';
	}
	if (typeof dept !== 'string' || String(dept).startsWith('[') || !CurriculumService.departments.includes(dept)) {
		dept = '普通科(理工生醫群)-1';
	}
	currentYear = yr;
	currentDept = dept;
	curriculum = CurriculumService.getCurriculum(yr, dept);
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
	const ySelect = document.getElementById('dashSelectYear');
	const dSelect = document.getElementById('dashSelectDept');
	if (ySelect) ySelect.value = currentYear;
	if (dSelect) dSelect.value = currentDept;
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
		<div class="card-title">${escapeHtml(title)}</div>
		<div class="flex items-baseline justify-center gap-1 text-lg xs:text-xl md:text-2xl font-black text-slate-900"><span>${value === null ? "-" : value}</span><span style="font-size: 0.85rem; color: #475569; font-weight: 700;">/ ${target === null ? "-" : target}</span></div>
		<div class="card-progress-bg"><div class="card-progress-fill" style="width: ${percentage}%; background-color: ${barColor};"></div></div>`;
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
						<span class="mobile-sem-label">${escapeHtml(semNames[sIdx])}</span>
						<div class="mobile-score-box">
							<input type="checkbox" id="${escapeHtml(id)}" class="toggle-checkbox" data-cat="${escapeHtml(item.cat)}" data-type="${escapeHtml(item.type)}" data-val="${c}" data-sem="${sIdx}" data-name="${escapeHtml(item.name)}" data-default-unchecked="${item.defaultUnchecked ? 'true' : 'false'}" ${isChecked ? 'checked' : ''} onchange="calculate(); debouncedSaveToCloud();">
							<label for="${escapeHtml(id)}" class="score-label">${c}</label>
						</div>
					</div>`;
			} else {
				semGridHtml += `
					<div class="mobile-sem-item"><span class="mobile-sem-label">${escapeHtml(semNames[sIdx])}</span>
						<div class="mobile-score-box"><div class="score-label zero-score">-</div></div>
					</div>`;
			}
		});
		semGridHtml += `</div>`;

		const hasNote = Boolean(item.note && String(item.note).trim().length > 0);
		const noteTagHtml = hasNote ? `
			<button type="button" class="btn-course-note" title="${escapeHtml(item.note)}" onclick="showCourseNote(event, '${escapeHtml(item.note)}')">
				<span>📌</span><span>備註</span>
			</button>
		` : '';

		card.innerHTML = `
			<div class="flex items-start justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
				<div class="flex items-center flex-wrap gap-1.5 min-w-0 flex-1">
					<span class="font-extrabold text-sm sm:text-base text-slate-800 break-words leading-snug">${escapeHtml(item.name)}</span>
					${noteTagHtml}
				</div>
				<div class="flex items-center gap-1.5 shrink-0 pt-0.5">
					<span class="mobile-badge ${catInfo.class}">${escapeHtml(catInfo.text)}</span>
					<span class="mobile-badge bg-slate-100 text-slate-600 border border-slate-200">${escapeHtml(mapping.type[item.type] || "一般")}</span>
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
	const earnedEl = card.querySelector('.sem-earned-val');
	if (earnedEl) earnedEl.innerText = semEarned;
	const barEl = card.querySelector('.sem-progress-bar');
	if (barEl) barEl.style.width = `${semMax > 0 ? Math.min(100, Math.round((semEarned / semMax) * 100)) : 0}%`;
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
				
				const hasNote = Boolean(item.note && String(item.note).trim().length > 0);
				const noteTagHtml = hasNote ? `
					<button type="button" class="btn-course-note" title="${escapeHtml(item.note)}" onclick="showCourseNote(event, '${escapeHtml(item.note)}')">
						<span>📌</span><span>備註</span>
					</button>
				` : '';

				itemsHtml += `
					<div class="sem-item-row flex items-center justify-between p-2.5 rounded-xl transition-all gap-2 cursor-pointer select-none">
						<input type="checkbox" id="${escapeHtml(id)}" class="toggle-checkbox sem-checkbox sr-only" data-cat="${escapeHtml(item.cat)}" data-type="${escapeHtml(item.type)}" data-val="${c}" data-sem="${sIdx}" data-name="${escapeHtml(item.name)}" data-default-unchecked="${item.defaultUnchecked ? 'true' : 'false'}" ${isChecked ? 'checked' : ''} onchange="calculate(); updateSemesterProgress(this, ${sIdx}); debouncedSaveToCloud();">
						<label for="${escapeHtml(id)}" class="sem-label flex items-center justify-between w-full cursor-pointer gap-2 min-w-0">
							<div class="flex items-center gap-2.5 min-w-0 flex-1">
								<div class="custom-check-box w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all shrink-0">
									<i class="fa-solid fa-check text-[10px] text-white opacity-0 transform scale-50 transition-all"></i>
								</div>
								<div class="flex items-center flex-wrap gap-1.5 min-w-0 flex-1">
									<span class="sub-name text-xs sm:text-sm font-extrabold text-slate-800 break-words leading-snug">${escapeHtml(item.name)}</span>
									<span class="credit-badge text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-200/80 text-slate-700 shrink-0">${c} 學分</span>
									${noteTagHtml}
								</div>
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
					<h4 class="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2"><span class="w-2 h-4 bg-emerald-500 rounded-full"></span>${escapeHtml(semTitle)}</h4>
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
		constructionBox?.classList.add("hidden");
		return;
	}
	const checkedStates = {};
	document.querySelectorAll(".toggle-checkbox").forEach(chk => checkedStates[chk.id] = chk.checked);
	if (curriculum.length === 0) {
		if (mobileContainer) { mobileContainer.style.display = "none"; mobileContainer.innerHTML = ""; }
		constructionBox?.classList.remove("hidden");
		const cleanYear = CurriculumService.years.includes(String(currentYear)) ? currentYear : '113';
		const cleanDept = CurriculumService.departments.includes(String(currentDept)) ? currentDept : '普通科(理工生醫群)-1';
		const cEl = document.getElementById("constYearDept");
		if (cEl) cEl.innerText = `${cleanYear}年入學 ${cleanDept}`;
		return;
	}
	constructionBox?.classList.add("hidden");
	if (mobileContainer) mobileContainer.style.display = "grid";
	if (currentLayoutMode === 'subject') renderMobileCards(checkedStates);
	else renderSemesterCards(checkedStates);
};

window.changeDashCurriculum = function() {
	const yr = document.getElementById('dashSelectYear').value, dept = document.getElementById('dashSelectDept').value;
	sessionStorage.setItem('tempSelectedYear', yr);
	sessionStorage.setItem('tempSelectedDept', dept);
	selectCurriculum(yr, dept);
	applyLoadedChecks((editingStudentId ? activeStudentDBRecord : userDBRecord)?.credits_json || {});
};

window.setLayoutMode = function(mode) {
	currentLayoutMode = mode;
	sessionStorage.setItem('tempLayoutMode', mode);
	const btnSub = document.getElementById('btnLayoutSubject');
	const btnSem = document.getElementById('btnLayoutSemester');
	if (btnSub) btnSub.className = mode === 'subject' ? "flex-1 md:flex-none px-6 py-2 text-xs font-extrabold rounded-lg transition-all bg-white text-slate-800 shadow-md" : "flex-1 md:flex-none px-6 py-2 text-xs font-extrabold rounded-lg transition-all text-slate-600";
	if (btnSem) btnSem.className = mode === 'semester' ? "flex-1 md:flex-none px-6 py-2 text-xs font-extrabold rounded-lg transition-all bg-white text-slate-800 shadow-md" : "flex-1 md:flex-none px-6 py-2 text-xs font-extrabold rounded-lg transition-all text-slate-700";
	scrollToTop();
	renderTable();
	calculate();
};

window.evaluateStudentStatus = function(s) {
	const ey = (s.entry_year && s.entry_year !== '未設定') ? s.entry_year : '113';
	const ed = (s.entry_dept && s.entry_dept !== '未設定' && !String(s.entry_dept).startsWith('[')) ? s.entry_dept : '普通科(理工生醫群)-1';
	const curr = CurriculumService.getCurriculum(ey, ed);
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
