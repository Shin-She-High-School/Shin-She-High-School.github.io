const SB_URL = "https://tsavuxtqwfugoraomoyc.supabase.co";
const SB_KEY = "sb_publishable_ojrdIB0TeCnl8eZXbzWsdQ_2W3JB3xT";
const EMAIL_DOMAIN = "@sshs.tc.edu.tw";

const mapping = {
	cat: {
		"dept": { text: "部定必修", class: "bg-dept-main" },
		"dept_sports": { text: "體育專業必修", class: "bg-amber-100 text-amber-800 border border-amber-200" },
		"sch_req": { text: "校定必修", class: "bg-sch-req-main" },
		"sch_opt": { text: "校定選修", class: "bg-sch-opt-main" }
	},
	type: { 1: "一般科目", 2: "專業科目", 3: "實習科目" },
	role: { student: "學生", teacher: "教師", counselor: "輔導教師", admin: "管理員" }
};

const ANNOUNCE_CATEGORIES = [
	{ value: "大會公告", label: "🎓 大會公告" },
	{ value: "教務通知", label: "📋 教務通知" },
	{ value: "系統維護", label: "🛠️ 系統維護" },
	{ value: "重要提醒", label: "⚠️ 重要提醒" }
];

const ANNOUNCE_STATUS_FILTERS = [
	{ value: "all", label: "全部狀態" },
	{ value: "active", label: "● 公開中" },
	{ value: "scheduled", label: "⏳ 預約中 / 未到期" },
	{ value: "expired", label: "⌛ 已過期" },
	{ value: "inactive", label: "○ 已手動下架" }
];

const AUDIT_ACTION_OPTIONS = [
	{ group: "📘 學分與課綱類", items: ["變更學分紀錄", "切換版本", "批次全部及格", "批次學分歸零", "單學期全選及格", "單學期學分歸零"] },
	{ group: "📝 帳號與個人資料", items: ["更改帳號資料", "重設帳號密碼", "更新個人資料", "送出系統回饋"] },
	{ group: "📢 系統公告", items: ["發布系統公告", "編輯系統公告", "更新公告排序"] },
	{ group: "🔑 系統登入與安全", items: ["使用者登入", "使用者登出", "使用者註冊"] },
	{ group: "⚠️ 刪除與警示", items: ["刪除帳號", "刪除學生帳號"] }
];

let dbClient = null;
window.ensureDbClient = function() {
	if (dbClient) return dbClient;
	try {
		if (typeof supabase !== 'undefined' && supabase && supabase.createClient) {
			dbClient = supabase.createClient(SB_URL, SB_KEY);
		} else if (typeof window.supabase !== 'undefined' && window.supabase && window.supabase.createClient) {
			dbClient = window.supabase.createClient(SB_URL, SB_KEY);
		}
	} catch (e) {
		dbClient = null;
	}
	return dbClient;
};

let currentUser = null;
let userDBRecord = null;
let activeStudentDBRecord = null;
let editingStudentId = null;
let isViewingClassList = false;
let currentIndependentPage = null;

let adminListData = [];
let auditLogsData = [];
let userFeedbacksData = [];
let announcementsData = [];
let teacherNames = [];
let currentUncheckedCredits = [];

let currentYear = "113";
let currentDept = "普通科(理工生醫群)-1";
let currentLayoutMode = "subject";
let DEPT_THRESHOLD = 0;

let autoSaveDebounceTimer = null;
let saveBaselineChecks = null;
let saveBaselineTotal = null;
let pendingBulkActionInfo = null;
let isDirty = false;
let confirmAction = null;
let lastUserId = null;
let hasLoadedInitialData = false;
let lastLoadedStudentId = null;

const teacherCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

window.escapeHtml = function(str) {
	if (str === null || str === undefined) return '';
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
};

window.translateError = function(msg) {
	if (!msg) return "發生未知錯誤";
	if (msg.includes("Invalid login credentials")) return "帳號或密碼錯誤，請重新確認！";
	if (msg.includes("User already registered")) return "該帳號已經註冊過，請直接登入！";
	if (msg.includes("Password should be at least")) return "密碼長度太短！";
	return msg;
};

window.formatDateTime = function(isoStr) {
	if (!isoStr) return '-';
	const d = new Date(isoStr);
	if (isNaN(d.getTime())) return '-';
	const pad = (n) => String(n).padStart(2, '0');
	return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

window.formatDateTimeInput = function(isoStr) {
	if (!isoStr) return '';
	const d = new Date(isoStr);
	if (isNaN(d.getTime())) return '';
	const pad = (n) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

window.showMsg = function(txt, type = 'info') {
	const b = document.getElementById('msgBox');
	if (!b) return;
	b.innerText = txt;
	b.style.background = type === 'error' ? '#ef4444' : '#10b981';
	b.style.display = 'block';
	setTimeout(() => { b.style.display = 'none'; }, 2500);
};

window.updateSyncStatusIndicator = function(status) {
	const badge = document.getElementById('syncStatusIndicator');
	if (!badge) return;
	badge.className = "sync-badge " + (status === 'offline' ? 'sync-offline' : (status === 'saving' ? 'sync-saving' : (status === 'dirty' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'sync-success')));
	const label = status === 'offline' ? '同步失敗，請聯繫管理員！' : (status === 'saving' ? '正在儲存...' : (status === 'dirty' ? '● 變更未儲存...' : '同步成功'));
	badge.innerHTML = `<span>${label}</span>`;
};

window.scrollToTop = function() {
	document.getElementById('scrollContainer')?.scrollTo({ top: 0, behavior: 'smooth' });
	window.scrollTo({ top: 0, behavior: 'smooth' });
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

window.showConfirmModal = function(msg, title, action, confirmBtnText, confirmBtnBg) {
	const btn = document.querySelector('#confirmModal .btn-pass-all');
	if (btn) {
		btn.style.background = confirmBtnBg || (title.includes("重設") ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "#dc3545");
		btn.innerText = confirmBtnText || (title.includes("重設") ? "確認重設" : (title.includes("刪除") ? "確認刪除" : "確認操作"));
	}
	const msgEl = document.getElementById('confirmMsg');
	if (msgEl) msgEl.innerText = msg;
	const titleEl = document.querySelector('#confirmModal .modal-header span');
	if (titleEl) titleEl.innerText = title;
	confirmAction = action;
	toggleUIModal(true, 'confirmModal');
};

window.triggerConfirmAction = function() {
	if (confirmAction) confirmAction();
};

window.handleOutsideClick = function(event) {
	if (event.target.classList.contains('modal-overlay')) {
		if (!currentUser && event.target.id === 'authWorkspace') return;
		event.target.style.display = 'none';
	}
	if (!event.target.closest('[id^="ms-wrap-"]')) {
		document.querySelectorAll('[id^="ms-drop-"]').forEach(d => {
			d.classList.add('hidden');
			d.classList.remove('flex');
		});
	}
};

window.toggleMS = function(event, type) {
	event.stopPropagation();
	const drop = document.getElementById(`ms-drop-${type}`);
	if (!drop) return;
	const isHidden = drop.classList.contains('hidden');
	document.querySelectorAll('[id^="ms-drop-"]').forEach(d => {
		d.classList.add('hidden');
		d.classList.remove('flex');
	});
	if (isHidden) {
		drop.classList.remove('hidden');
		drop.classList.add('flex');
	}
};

window.handleMSAll = function(type, chk) {
	if (chk.checked) {
		document.querySelectorAll(`.ms-opt-${type}`).forEach(c => { c.checked = false; });
	}
	updateMSText(type);
	if (type === 'audit-action') renderAuditLogList();
	else fetchAdminList(true);
};

window.handleMSOpt = function(type) {
	const opts = document.querySelectorAll(`.ms-opt-${type}:checked`);
	const allBox = document.querySelector(`.ms-all-${type}`);
	if (allBox) allBox.checked = (opts.length === 0);
	updateMSText(type);
	if (type === 'audit-action') renderAuditLogList();
	else fetchAdminList(true);
};

window.updateMSText = function(type) {
	const opts = document.querySelectorAll(`.ms-opt-${type}:checked`);
	const textEl = document.getElementById(`ms-text-${type}`);
	if (!textEl) return;
	const allText = { role: '所有身份', year: '所有年度', dept: '所有科別', status: '所有畢業狀態', 'audit-action': '所有異動項目' };
	if (opts.length === 0) {
		textEl.innerText = allText[type] || '所有項目';
		textEl.classList.remove('text-indigo-700');
	} else if (opts.length === 1) {
		textEl.innerText = opts[0].parentElement.innerText.replace('(全選)', '').replace('(全選所有異動項目)', '').trim();
		textEl.classList.add('text-indigo-700');
	} else {
		textEl.innerText = `已選擇 (${opts.length})`;
		textEl.classList.add('text-indigo-700');
	}
};

window.getMSValues = function(type) {
	const allChk = document.querySelector(`.ms-all-${type}`);
	if (allChk && allChk.checked) return ['all'];
	const checkedOpts = Array.from(document.querySelectorAll(`.ms-opt-${type}:checked`)).map(o => o.value);
	return checkedOpts.length === 0 ? ['all'] : checkedOpts;
};

window.getUserCounselorClasses = function(record) {
	if (!record) return [];
	let allowedClasses = [];
	try {
		let cj = record.credits_json;
		if (typeof cj === 'string') {
			try { cj = JSON.parse(cj); } catch (e) { cj = {}; }
		}
		if (cj && Array.isArray(cj._counselor_classes)) {
			allowedClasses = cj._counselor_classes;
		} else if (record.entry_dept && typeof record.entry_dept === 'string' && record.entry_dept.startsWith('[')) {
			allowedClasses = JSON.parse(record.entry_dept);
		}
	} catch (e) {
		allowedClasses = [];
	}
	return Array.isArray(allowedClasses) ? allowedClasses : [];
};

window.clearAppRuntimeState = function() {
	teacherCache.clear();
	adminListData = [];
	auditLogsData = [];
	userFeedbacksData = [];
	announcementsData = [];
	teacherNames = [];
	currentUncheckedCredits = [];
	userDBRecord = null;
	activeStudentDBRecord = null;
	hasLoadedInitialData = false;
	lastLoadedStudentId = null;
	isViewingClassList = false;
	editingStudentId = null;
	lastUserId = null;
	pendingBulkActionInfo = null;
	saveBaselineChecks = null;
	saveBaselineTotal = null;
	isDirty = false;
	if (autoSaveDebounceTimer) {
		clearTimeout(autoSaveDebounceTimer);
		autoSaveDebounceTimer = null;
	}
};

window.addEventListener('beforeunload', function(e) {
	if (isDirty || autoSaveDebounceTimer !== null) {
		e.preventDefault();
		e.returnValue = '';
	}
});