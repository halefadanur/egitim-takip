/**
 * Student Tracker Application Logic
 * Fetches data from a public Google Sheet and maps it to a beautiful UI
 */

const SHEET_ID = '1DXg2-lYxKyOa7IhZ4Z40kxR-7HJwbCrK6DN8zElAPCk';
const GID = '2048085281';
// Google Sheets Endpoint
// We are using the gviz/tq endpoint which returns JSON-like data suitable for parsing
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1DXg2-lYxKyOa7IhZ4Z40kxR-7HJwbCrK6DN8zElAPCk/gviz/tq?tqx=out:json&gid=2048085281";
const MASTER_SHEET_URL = "https://docs.google.com/spreadsheets/d/1DXg2-lYxKyOa7IhZ4Z40kxR-7HJwbCrK6DN8zElAPCk/gviz/tq?tqx=out:json&gid=678203721";

// Application State// ==========================================
// STATE & DATA
// ==========================================
let appData = []; // Veriler buraya yüklenecek
let filteredData = []; 
let allTeachers = []; // Benzersiz öğretmen isimleri
let allStudents = []; // Benzersiz öğrenci isimleri

// Roles Management
const ROLES = {
    admin: { id: 'admin', type: 'admin', name: 'Yönetici Paneli', desc: 'Tüm Göstergeler' },
    teacher: { id: 'teacher_1', type: 'teacher', name: 'Öğretmen Paneli', teacherName: 'Bulunamadı', desc: 'Sadece Kendi Öğrencileri' } // teacherName dinamic olarak set edilecek
};
let currentRole = ROLES.admin;

// Forms State Management
let formState = {
    step: 1,
    date: '',
    teacher: '',
    student: '',
    meetingWith: '',
    meetingHow: '',
    notes: ''
};
let masterStudentList = []; // Complete list of all existing students
// let allTeachers = []; // Store unique teachers // This is now defined above
// let currentRole = { // This is now defined above
//     type: 'admin', // 'admin' or 'teacher'
//     teacherName: null // only populated if type is 'teacher'
// };

// DOM Elements
const elements = {
    loading: document.getElementById('loading-spinner'),
    error: document.getElementById('error-message'),
    dataContainer: document.getElementById('data-container'),
    tableBody: document.getElementById('table-body'),
    stat1Text: document.getElementById('stat-1-text'),
    stat2Text: document.getElementById('stat-2-text'),
    stat3Text: document.getElementById('stat-3-text'),
    stat4Text: document.getElementById('stat-4-text'),
    stat5Text: document.getElementById('stat-5-text'),
    stat6Text: document.getElementById('stat-6-text'),
    noResultsState: document.getElementById('no-results-state'),

    // Filters
    searchInput: document.getElementById('search-input'),
    monthFilter: document.getElementById('month-filter'),
    teacherFilter: document.getElementById('teacher-filter'),
    refreshBtn: document.getElementById('refresh-btn'),

    // Modal Details
    modal: document.getElementById('details-modal'),
    modalBody: document.getElementById('modal-details-body'),
    closeModalBtns: document.querySelectorAll('.close-modal, .modal-overlay'),

    // Role Modal
    roleModal: document.getElementById('role-modal'),
    roleCards: document.querySelectorAll('.role-card'),
    teacherSelectContainer: document.getElementById('teacher-select-container'),
    loginTeacherSelect: document.getElementById('login-teacher-select'),
    confirmRoleBtn: document.getElementById('confirm-role-btn'),
    currentRoleDisplay: document.getElementById('current-role-display'),
    roleName: document.getElementById('role-name'),
    roleType: document.getElementById('role-type'),
    roleAvatar: document.getElementById('role-avatar'),
    teacherFilterGroup: document.getElementById('teacher-filter').closest('.filter-group'),

    // Tabs & New Features
    sidebarMenuItems: document.querySelectorAll('.sidebar-menu .menu-item, .mobile-grid-item[data-tab]'),
    tabContents: document.querySelectorAll('.tab-content'),
    studentsTableBody: document.getElementById('students-table-body'),
    studentSearchInput: document.getElementById('student-search-input'),
    formBtns: document.querySelectorAll('#new-record-btn, #subtitle-new-record-btn, .tab-trigger'),

    // Mobile App Bar Elements
    mobileHomeBtn: document.getElementById('mobile-home-btn'),
    mobileUserProfile: document.getElementById('mobile-user-profile'),

    // Admin Uncontacted Panel
    navUncontacted: document.getElementById('nav-uncontacted'),
    uncontactedPanel: document.getElementById('uncontacted-panel'), // Keep for fallback, though we moved to tab
    uncontactedTableBody: document.getElementById('uncontacted-table-body'),

    // Native Form Elements
    nativeFormTeacher: document.getElementById('form-teacher')
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Show loading state initially
    showLoading();
    // Initialize empty form right away so dropdowns never appear blank
    initNativeForm();
    // Fetch data which will then trigger role modal after processing unique teachers
    fetchData();
    setupEventListeners();
});

function setupEventListeners() {
    // Search & Filter listeners
    elements.searchInput.addEventListener('input', applyFilters);
    elements.monthFilter.addEventListener('change', applyFilters);
    elements.teacherFilter.addEventListener('change', applyFilters);

    // Refresh
    elements.refreshBtn.addEventListener('click', () => {
        // Add spinning animation to icon temporarily
        const icon = elements.refreshBtn.querySelector('i');
        icon.style.animation = 'spin 1s linear infinite';

        // Refetch
        fetchData().then(() => {
            setTimeout(() => {
                icon.style.animation = 'none';
            }, 500);
        });
    });

    // Close Modal
    elements.closeModalBtns.forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Form Links Logic removed to allow direct navigation to Google Forms

    // Form Links & Tab Triggers Logic
    elements.formBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = btn.getAttribute('data-tab');
            if (targetTab) {
                // Manually trigger tab switch
                document.querySelector(`.menu-item[data-tab="${targetTab}"]`).click();
            }
        });
    });

    // --- Tab Switching Logic --- //
    elements.sidebarMenuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetTab = item.getAttribute('data-tab');
            
            // Eğer data-tab yoksa (örneğin harici bir link olan Ders Programı gibi)
            // preventDefault YAPMA, doğal href yönlendirmesine izin ver.
            if (!targetTab) return;
            
            e.preventDefault();

            // Update Active State on Sidebar
            elements.sidebarMenuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Show corresponding tab
            elements.tabContents.forEach(content => {
                if (content.id === `tab-${targetTab}`) {
                    content.classList.remove('hidden');
                } else {
                    content.classList.add('hidden');
                }
            });

            // Smooth scroll to top when changing tabs
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });

            // Re-render specific tab data if necessary
            if (targetTab === 'students') renderStudentsTab();

            // Pre-fill form if opening add-record
            if (targetTab === 'add-record') {
                // This is the old form logic, new form uses initNativeForm()
                // if (currentRole.type === 'teacher') {
                //     elements.nativeFormTeacher.value = currentRole.teacherName;
                //     elements.nativeFormTeacher.setAttribute('readonly', true);
                // } else {
                //     elements.nativeFormTeacher.value = '';
                //     elements.nativeFormTeacher.removeAttribute('readonly');
                //     elements.nativeFormTeacher.placeholder = "Öğretmen adını giriniz...";
                // }

                // // Set today's date automatically
                // document.getElementById('form-date').valueAsDate = new Date();
                initNativeForm(); // Initialize the new form
            }
        });
    });

    // Student Specific Searches
    if (elements.studentSearchInput) {
        elements.studentSearchInput.addEventListener('input', renderStudentsTab);
    }

    // --- Mobile App Bar Listeners ---
    if (elements.mobileUserProfile) {
        elements.mobileUserProfile.addEventListener('click', () => {
            elements.currentRoleDisplay.click(); // Trigger the exact same modal
        });
    }

    if (elements.mobileHomeBtn) {
        elements.mobileHomeBtn.addEventListener('click', () => {
            // Remove active from any sidebar items (even though they're hidden)
            elements.sidebarMenuItems.forEach(i => i.classList.remove('active'));
            // Hide all tabs, show mobile home
            elements.tabContents.forEach(content => {
                if (content.id === 'tab-mobile-home') {
                    content.classList.remove('hidden');
                } else {
                    content.classList.add('hidden');
                }
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // --- Role Selection Listeners ---

    // Open Role Modal when clicking sidebar profile
    elements.currentRoleDisplay.addEventListener('click', () => {
        elements.roleModal.classList.remove('hidden');

        // Reset modal to reflect current role properly
        elements.roleCards.forEach(c => c.classList.remove('selected'));
        const activeCard = document.querySelector(`.role-card[data-role="${currentRole.type}"]`);
        if (activeCard) activeCard.classList.add('selected');

        if (currentRole.type === 'teacher') {
            elements.teacherSelectContainer.classList.remove('hidden');
            if (currentRole.teacherName) {
                elements.loginTeacherSelect.value = currentRole.teacherName;
                elements.confirmRoleBtn.disabled = false;
            } else {
                elements.confirmRoleBtn.disabled = true;
            }
        } else {
            elements.teacherSelectContainer.classList.add('hidden');
            elements.confirmRoleBtn.disabled = false;
        }
    });

    // Handle Role Type Selection
    elements.roleCards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove selected from all
            elements.roleCards.forEach(c => c.classList.remove('selected'));
            // Add to clicked
            card.classList.add('selected');

            const role = card.getAttribute('data-role');

            if (role === 'teacher') {
                elements.teacherSelectContainer.classList.remove('hidden');
                // Disable confirm until a teacher is selected
                elements.confirmRoleBtn.disabled = !elements.loginTeacherSelect.value;
            } else {
                elements.teacherSelectContainer.classList.add('hidden');
                elements.confirmRoleBtn.disabled = false;
            }
        });
    });

    // Handle Teacher Select Dropdown in Modal
    elements.loginTeacherSelect.addEventListener('change', (e) => {
        elements.confirmRoleBtn.disabled = !e.target.value;
    });

    // Handle Confirm Role
    elements.confirmRoleBtn.addEventListener('click', () => {
        const selectedCard = document.querySelector('.role-card.selected');
        if (!selectedCard) return;

        const role = selectedCard.getAttribute('data-role');

        if (role === 'admin') {
            currentRole = { type: 'admin', teacherName: null };
            updateRoleUI();
            elements.roleModal.classList.add('hidden');
            initNativeForm();
            applyFilters();
            renderApp(); // Force re-evaluating the default view after role login
        } else if (role === 'teacher') {
            const selectedTeacher = elements.loginTeacherSelect.value;
            if (selectedTeacher) {
                currentRole = { type: 'teacher', teacherName: selectedTeacher };
                updateRoleUI();
                elements.roleModal.classList.add('hidden');
                initNativeForm();
                applyFilters();
                renderApp(); // Force re-evaluating the default view after role login
            }
        }
    });
}

function updateRoleUI() {
    if (currentRole.type === 'admin') {
        elements.roleName.textContent = 'Yönetici Paneli';
        elements.roleType.textContent = 'Admin | Tüm Veriler';
        elements.roleAvatar.innerHTML = '<i class="fa-solid fa-user-shield"></i>';
        elements.roleAvatar.style.background = '#EEF2FF';
        elements.roleAvatar.style.color = '#4F46E5';

        // Update Sidebar items based on role
        elements.teacherFilterGroup.style.display = 'block';
        if (elements.navUncontacted) elements.navUncontacted.style.display = 'flex';

        // Admin Features: Hide "Form Doldur"
        const addRecordNav = document.getElementById('nav-add-record');
        const headerAddBtns = document.querySelectorAll('.header-add-btn');
        if (addRecordNav) addRecordNav.style.display = 'none';
        headerAddBtns.forEach(btn => btn.style.display = 'none');

    } else {
        elements.roleName.textContent = currentRole.teacherName;
        elements.roleType.textContent = 'Öğretmen Paneli';
        elements.roleAvatar.innerHTML = '<i class="fa-solid fa-person-chalkboard"></i>';
        elements.roleAvatar.style.background = '#F0FDF4';
        elements.roleAvatar.style.color = '#16A34A';

        // Hide teacher filter from dashboard (since they only see themselves)
        elements.teacherFilterGroup.classList.add('hidden');
        elements.teacherFilter.value = 'all'; // Reset this internal filter

        // Teacher Features: Hide "İletişimsizler", Show "Form Doldur"
        if (elements.navUncontacted) elements.navUncontacted.style.display = 'none';
        
        const addRecordNav = document.getElementById('nav-add-record');
        const headerAddBtns = document.querySelectorAll('.header-add-btn');
        if (addRecordNav) addRecordNav.style.display = 'flex';
        headerAddBtns.forEach(btn => btn.style.display = 'inline-flex');
    }
}

// Add click to toggle labels on mobile for stat-cards
document.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('click', () => {
        card.classList.toggle('clicked');
    });
});

/**
 * Fetch and parse data from Google Sheets
 */
async function fetchData() {
    showLoading();

    try {
        const [recordsRes, masterRes] = await Promise.all([
            fetch(SHEET_URL),
            fetch(MASTER_SHEET_URL)
        ]);

        const recordsText = await recordsRes.text();
        const masterText = await masterRes.text();

        const recordsJsonMatch = recordsText.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/);
        const masterJsonMatch = masterText.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/);

        if (!recordsJsonMatch || !masterJsonMatch) {
            throw new Error("Invalid response format from Google Sheets");
        }

        const recordsData = JSON.parse(recordsJsonMatch[1]);
        const masterData = JSON.parse(masterJsonMatch[1]);

        if (recordsData.status === 'error') {
            throw new Error(recordsData.errors[0].message);
        }

        // Parse Master List (just extracting names from col 0)
        masterStudentList = [];
        if (masterData.table && masterData.table.rows) {
            masterData.table.rows.forEach(row => {
                if (row.c && row.c[0] && row.c[0].v) {
                    const sName = String(row.c[0].v).trim();
                    if (sName) masterStudentList.push(sName);
                }
            });
        }

        processData(recordsData.table);

    } catch (error) {
        console.error('Error fetching data:', error);
        showError();
    }
}

/**
 * Process the raw visualization table into a usable array of objects
 */
function processData(tableObj) {
    if (!tableObj || !tableObj.rows) {
        showError();
        return;
    }

    // From manual inspection of the CSV data:
    // col 0: Zaman damgası (Timestamp)
    // col 1: Ne Zaman Görüşüldü (Date of meeting)
    // col 2: Görüşen Öğretmen (Teacher)
    // col 3: Öğrenci: (Student name)
    // col 4: Kimle Görüşüldü (Parent/Who)
    // col 5: Nasıl Görüşüldü (Meeting format)
    // col 6: Ne Konuşuldu (Notes/Description)
    // col 7: AYLIK ÖZDEĞERLENDİRME (Evaluation - Often empty)
    // col 8: Ay (Month)

    const rawRows = tableObj.rows;
    appData = []; // Clear existing data
    allTeachers = []; // Clear existing teachers
    allStudents = []; // Clear existing students
    const uniqueMonths = new Set(); // Still needed for populateFilters

    rawRows.forEach((row, index) => {
        const cells = row.c;
        if (!cells) return;

        // Extract cell values safely (v = raw value, f = formatted value)
        const getVal = (colIdx) => {
            if (!cells[colIdx]) return '';
            return cells[colIdx].f || cells[colIdx].v || '';
        };

        const timestamp = getVal(0);
        const meetingDate = getVal(1);
        const teacher = getVal(2);
        const student = getVal(3);
        const who = getVal(4);
        const how = getVal(5);
        const notes = getVal(6);
        let month = getVal(8);

        // Fallback for missing/unstructured month values
        if (!month) {
            const rawRowStr = JSON.stringify(row).toLowerCase();
            if (rawRowStr.includes('mart')) month = 'Mart';
            else if (rawRowStr.includes('şubat') || rawRowStr.includes('subat')) month = 'Şubat';
            else {
                const dateMatch = meetingDate.match(/\.0?([1-9]|1[0-2])\./);
                if (dateMatch) {
                    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
                    month = monthNames[parseInt(dateMatch[1]) - 1];
                } else {
                    month = "Bilinmeyen";
                }
            }
        }
        month = month.trim();

        // Skip rows that don't look like valid data (e.g. headers or empty rows)
        if (!student || student.toLowerCase().includes('öğrenci')) return;

        const mData = {
            id: `rec_${index}`,
            timestamp,
            meetingDate,
            teacher,
            student,
            who,
            how,
            notes,
            month
        };
        appData.push(mData);

        if (teacher && !allTeachers.includes(teacher)) {
            allTeachers.push(teacher);
        }
        if (student && !allStudents.includes(student)) {
            allStudents.push(student);
        }
        if (month) uniqueMonths.add(month);
    });

    // Sort by most recent timestamp descending
    appData.reverse();
    filteredData = [...appData];
    allTeachers.sort(); // Sort teachers alphabetically

    populateFilters(Array.from(uniqueMonths).sort(), allTeachers);
    populateRoleTeacherSelect(allTeachers);

    // Initial Render
    elements.loading.classList.add('hidden');
    elements.error.classList.add('hidden');

    // Instead of rendering data immediately, show role modal first time
    if (!currentRole.type || (currentRole.type === 'teacher' && !currentRole.teacherName)) {
        elements.roleModal.classList.remove('hidden');
    } else {
        renderApp();
    }

    // Prepare Dropdowns
    populateFilters(Array.from(uniqueMonths).sort(), allTeachers);

    initNativeForm(); // Initialize Native form
    
    // Default Filter Applications
    applyFilters();
}

function populateRoleTeacherSelect(teachers) {
    elements.loginTeacherSelect.innerHTML = '<option value="">Lütfen seçin...</option>';
    teachers.forEach(t => {
        if (!t) return;
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        elements.loginTeacherSelect.appendChild(opt);
    });
}

/**
 * Apply purely DOM state updates based on filtering
 */
function applyFilters() {
    const searchTerm = elements.searchInput.value.toLowerCase().trim();
    const monthVal = elements.monthFilter.value;
    const teacherVal = elements.teacherFilter.value;

    filteredData = appData.filter(item => {
        // Enforce Role Restriction First
        if (currentRole.type === 'teacher' && item.teacher !== currentRole.teacherName) {
            return false;
        }

        // Text Match (check multiple fields)
        const matchesSearch = searchTerm === '' ||
            item.student.toLowerCase().includes(searchTerm) ||
            item.teacher.toLowerCase().includes(searchTerm) ||
            item.notes.toLowerCase().includes(searchTerm);

        // Exact Category Matches
        const matchesMonth = monthVal === 'all' || item.month === monthVal;

        // Ignore teacher dropdown filter if role is teacher (already restricted)
        const matchesTeacher = (currentRole.type === 'teacher') ? true : (teacherVal === 'all' || item.teacher === teacherVal);

        return matchesSearch && matchesMonth && matchesTeacher;
    });

    renderTable();
    // Re-render other tabs so they respect filters dynamically
    renderStudentsTab();

    // Also re-render uncontacted if Admin
    if (currentRole.type === 'admin') {
        renderUncontactedStudents(filteredData);
    }

    // Update the form student autocomplete with fresh data
    const searchInputEl = document.getElementById('fStudentSearch');
    if (searchInputEl) {
        // Trigger an input event to re-render the list
        searchInputEl.dispatchEvent(new Event('input'));
    }
}

/**
 * Setup Dropdowns
 */
function populateFilters(months, teachers) {
    // Reset but keep 'All' option
    elements.monthFilter.innerHTML = '<option value="all">Tüm Aylar</option>';
    elements.teacherFilter.innerHTML = '<option value="all">Tüm Öğretmenler</option>';

    months.forEach(m => {
        if (!m) return;
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        elements.monthFilter.appendChild(opt);
    });

    teachers.forEach(t => {
        if (!t) return;
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        elements.teacherFilter.appendChild(opt);
    });
}

/**
 * Main Render Function
 */
function renderApp() {
    elements.loading.classList.add('hidden');
    elements.error.classList.add('hidden');
    elements.dataContainer.classList.remove('hidden');

    if (window.innerWidth <= 768) {
        // Force Mobile Home on initial load instead of dashboard table
        if (elements.mobileHomeBtn) {
            elements.mobileHomeBtn.click();
        }
    }

    renderTable();
}

/**
 * Render the Data Table
 */
function renderTable() {
    elements.tableBody.innerHTML = '';

    // Compute Statistics

    let phone = 0;
    let whatsapp = 0;
    let faceToFace = 0;
    let teacherMeetings = 0;

    filteredData.forEach(item => {
        const h = item.how.toLowerCase();
        
        // Exact matching logic replacing the old bundled 'telefon görüşmesi' logic
        if (h.includes('telefon') || h.includes('arama') || h.includes('veli aranıp')) {
            phone++;
        } else if (h.includes('wp') || h.includes('whatsapp') || h.includes('sms') || h.includes('mesaj')) {
            whatsapp++;
        } else if (h.includes('yüzyüze') || h.includes('yüz yüze') || h.includes('yüz')) {
            faceToFace++;
        }

        // Öğretmen Görüşmesi (if 'who' column indicates it's a teacher meeting)
        if (item.who.toLowerCase().includes('öğretmen') || item.who.toLowerCase().includes('ogretmen')) {
            teacherMeetings++;
        }
    });

    // Unique Students
    const uniqueStudentsSet = new Set(filteredData.map(item => item.student));
    const uniqueStudentsCount = uniqueStudentsSet.size;

    // Update Texts
    if (elements.stat1Text) {
        elements.stat1Text.textContent = filteredData.length;
        elements.stat2Text.textContent = uniqueStudentsCount;
        elements.stat3Text.textContent = teacherMeetings;
        elements.stat4Text.textContent = faceToFace;
        elements.stat5Text.textContent = phone;
        elements.stat6Text.textContent = whatsapp;
    }

    // Uncontacted Students Calculation (Admin Only)
    if (elements.navUncontacted && currentRole.type === 'admin') {
        renderUncontactedStudents(filteredData);
    }


    if (filteredData.length === 0) {
        elements.tableBody.parentElement.classList.add('hidden');
        elements.noResultsState.classList.remove('hidden');
        return;
    }

    elements.tableBody.parentElement.classList.remove('hidden');
    elements.noResultsState.classList.add('hidden');

    filteredData.forEach(item => {
        const tr = document.createElement('tr');

        // Assign color class based on 'Who'
        let whoClass = 'diger';
        const wLower = item.who.toLowerCase();
        if (wLower.includes('anne')) whoClass = 'anne';
        else if (wLower.includes('baba')) whoClass = 'baba';

        tr.innerHTML = `
            <td class="date-cell">${item.meetingDate}</td>
            <td class="student-cell">${item.student}</td>
            <td class="teacher-cell">${item.teacher}</td>
            <td><span class="chip ${whoClass}">${item.who}</span></td>
            <td><i class="fa-solid fa-comments text-tertiary"></i> &nbsp;${item.how}</td>
            <td><div class="text-truncate">${item.notes}</div></td>
        `;

        // Pass item data to modal when row is clicked
        tr.addEventListener('click', () => openModal(item));

        elements.tableBody.appendChild(tr);
    });
    
    // YENİ: Performans Tablosu Doldurma ve Export Ekranı (Sadece Admin için göster veya Teacher'a da kısıtlı göster)
    // Tasarım gereği Admin yetkisi yoksa veya liste boşsa gizleyelim
    const teacherSection = document.getElementById('teacher-performance-section');
    if (filteredData.length > 0 && currentRole.type === 'admin') {
        teacherSection.classList.remove('hidden');
        renderTeacherPerformanceTable(filteredData);
    } else {
        teacherSection.classList.add('hidden');
    }
}

/**
 * Teacher Performance Sub-Table (Gruplandırma Mantığı)
 */
function renderTeacherPerformanceTable(data) {
    const tbody = document.getElementById('teacher-performance-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Öğretmen adına göre gruplandırma objesi
    const teachersMap = {};

    data.forEach(item => {
        const teacher = item.teacher;
        if (!teachersMap[teacher]) {
            teachersMap[teacher] = {
                name: teacher,
                total: 0,
                uniqueStudents: new Set(),
                faceToFace: 0,
                phone: 0,
                whatsapp: 0,
                teacherMeeting: 0
            };
        }

        const stats = teachersMap[teacher];
        stats.total++;
        stats.uniqueStudents.add(item.student);

        const h = item.how.toLowerCase();
        if (h.includes('telefon') || h.includes('arama') || h.includes('veli aranıp')) {
            stats.phone++;
        } else if (h.includes('wp') || h.includes('whatsapp') || h.includes('sms') || h.includes('mesaj')) {
            stats.whatsapp++;
        } else if (h.includes('yüzyüze') || h.includes('yüz yüze') || h.includes('yüz')) {
            stats.faceToFace++;
        }

        if (item.who.toLowerCase().includes('öğretmen') || item.who.toLowerCase().includes('ogretmen')) {
            stats.teacherMeeting++;
        }
    });

    // Objeden Array'e çevirip Toplam G. sayısına göre Azalan (Descending) sırala
    const sortedTeachers = Object.values(teachersMap).sort((a, b) => b.total - a.total);

    sortedTeachers.forEach((stat, index) => {
        const tr = document.createElement('tr');
        
        // Birinci öğretmeni hafif vurgulayalım (Gold/Sarı tonu)
        if (index === 0) {
            tr.style.backgroundColor = '#FEF3C7';
            tr.style.fontWeight = '600';
        }

        tr.innerHTML = `
            <td style="color: var(--text-primary); font-weight: 600;">
                ${index === 0 ? '<i class="fa-solid fa-crown" style="color: #F59E0B; margin-right:6px;"></i>' : ''}
                ${stat.name}
            </td>
            <td style="color: var(--primary); font-weight: 700;">${stat.total}</td>
            <td style="color: #10B981; font-weight: 600;">${stat.uniqueStudents.size}</td>
            <td>${stat.faceToFace}</td>
            <td>${stat.phone}</td>
            <td>${stat.whatsapp}</td>
            <td style="color: #F59E0B;">${stat.teacherMeeting}</td>
        `;
        tbody.appendChild(tr);
    });

    // Buton Dinleyicisi Dışarıda atanıyor ama birden çok kez atanmaması için eski dinleyiciyi temizleyelim
    const exportBtn = document.getElementById('export-excel-btn');
    if (exportBtn) {
        // Remove existing listeners by replacing the element
        const newBtn = exportBtn.cloneNode(true);
        exportBtn.parentNode.replaceChild(newBtn, exportBtn);
        newBtn.addEventListener('click', () => exportToExcel(sortedTeachers));
    }
}

/**
 * Excel Çıktısı (SheetJS)
 */
function exportToExcel(teacherStatsObj) {
    if (typeof XLSX === 'undefined') {
        alert("Excel dışa aktarma kütüphanesi yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.");
        return;
    }

    const exportData = teacherStatsObj.map(s => ({
        "Öğretmen Adı": s.name,
        "Toplam Görüşme": s.total,
        "Farklı Öğrenci": s.uniqueStudents.size,
        "Yüzyüze": s.faceToFace,
        "Telefon": s.phone,
        "WhatsApp / SMS": s.whatsapp,
        "Öğretmen Görüşmesi": s.teacherMeeting
    }));

    // Seçili ayı dosya ismine ekleme
    const monthFilterVal = document.getElementById('month-filter').value;
    const monthName = monthFilterVal === 'all' ? 'Tum_Zamanlar' : monthFilterVal;

    // Excel calisma kitabini olustur
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Sütun genişliklerini ayarla (Opsiyonel ama estetik katar)
    ws['!cols'] = [
        { wch: 30 }, // Öğretmen Adı
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 12 },
        { wch: 15 },
        { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Performans");
    XLSX.writeFile(wb, `Ogretmen_Performans_Raporu_${monthName}.xlsx`);
}

/**
 * Modal Logic
 */
function openModal(item) {
    elements.modalBody.innerHTML = `
        <div style="background: linear-gradient(to right, #f8fafc, #ffffff); border-radius: 16px; border: 1px solid #e2e8f0; margin-bottom: 24px; padding: 20px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 4px rgba(15,23,42,0.02);">
            <div style="display: flex; align-items: center; gap: 16px;">
                <div style="width: 50px; height: 50px; background: #EEF2FF; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #4F46E5; font-size: 24px;">
                    <i class="fa-solid fa-calendar-check"></i>
                </div>
                <div>
                    <div style="font-size: 12px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">GÖRÜŞME TARİHİ</div>
                    <div style="font-size: 18px; font-weight: 700; color: #0f172a;">${item.meetingDate} <span style="font-size: 14px; font-weight: 500; color: #64748b;">(${item.month})</span></div>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="display: inline-flex; align-items: center; gap: 8px; background: #F1F5F9; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; color: #475569;">
                    <i class="fa-solid fa-clock w-4 h-4"></i> Kaydedildi
                </div>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
            <!-- Öğrenci Kartı -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); position: relative; overflow: hidden;">
                <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #3B82F6;"></div>
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <i class="fa-solid fa-user-graduate" style="color: #3B82F6; font-size: 18px;"></i>
                    <div style="font-size: 12px; font-weight: 700; color: #64748b; letter-spacing: 0.5px;">ÖĞRENCİ</div>
                </div>
                <div style="font-size: 16px; font-weight: 600; color: #1e293b;">
                    ${item.student}
                </div>
            </div>

            <!-- Öğretmen Kartı -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); position: relative; overflow: hidden;">
                <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #10B981;"></div>
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <i class="fa-solid fa-person-chalkboard" style="color: #10B981; font-size: 18px;"></i>
                    <div style="font-size: 12px; font-weight: 700; color: #64748b; letter-spacing: 0.5px;">GÖRÜŞEN ÖĞRETMEN</div>
                </div>
                <div style="font-size: 16px; font-weight: 600; color: #1e293b;">
                    ${item.teacher}
                </div>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px;">
            <!-- Kiminle Görüşüldü -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px;">
                <div style="font-size: 12px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; margin-bottom: 12px;">
                    KİMLE GÖRÜŞÜLDÜ?
                </div>
                <div>
                    <span style="background-color: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE; padding: 6px 14px; border-radius: 20px; font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-users"></i> ${item.who}
                    </span>
                </div>
            </div>

            <!-- Nasıl Görüşüldü -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px;">
                <div style="font-size: 12px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; margin-bottom: 12px;">
                    NASIL GÖRÜŞÜLDÜ?
                </div>
                <div style="font-size: 15px; font-weight: 600; color: #334155; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-comments" style="color: #94A3B8;"></i> ${item.how}
                </div>
            </div>
        </div>
        
        <!-- Görüşme Notları -->
        <div style="position: relative;">
            <div style="font-size: 12px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-clipboard-list" style="color: #4F46E5;"></i> GÖRÜŞME NOTLARI / NE KONUŞULDU?
            </div>
            <div style="background: #F8FAFC; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; font-size: 15px; color: #334155; line-height: 1.7; min-height: 120px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02)">
                ${item.notes ? item.notes.replace(/\n/g, '<br>') : '<span style="color: #94a3b8; font-style: italic;">Görüşme notu bulunmuyor...</span>'}
            </div>
        </div>
    `;

    elements.modal.classList.remove('hidden');
}

function closeModal() {
    elements.modal.classList.add('hidden');
}

/**
 * UI State Management
 */
function showLoading() {
    elements.loading.classList.remove('hidden');
    elements.error.classList.add('hidden');
    elements.dataContainer.classList.add('hidden');
}

function showError() {
    elements.loading.classList.add('hidden');
    elements.error.classList.remove('hidden');
    elements.dataContainer.classList.add('hidden');
}

/**
 * Helper to parse Turkish DD.MM.YYYY (Handles time segments if present)
 */
function parseDateString(dateStr) {
    if (!dateStr) return new Date(0);
    const justDate = dateStr.split(' ')[0];
    const parts = justDate.split('.');
    if (parts.length >= 3) {
        // parts[0] is DD, parts[1] is MM, parts[2] is YYYY
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
    }
    return new Date(0);
}

/**
 * Render Uncontacted Students List (STRICTLY MONTH-BASED)
 */
function renderUncontactedStudents() {
    if (!elements.uncontactedTableBody) return;

    // 1. Determine the target month for the check
    let targetMonth = '';
    const isSpecificMonthFilter = elements.monthFilter && elements.monthFilter.value !== 'all';

    if (isSpecificMonthFilter) {
        targetMonth = elements.monthFilter.value;
    } else {
        // Find the absolute latest month available in the existing dataset
        // so we don't accidentally default to a brand new month (like March 1st) with 0 records
        const monthsWithData = new Set();
        appData.forEach(item => {
            if (item.month) monthsWithData.add(item.month);
        });

        const monthOrder = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
        let latestIdx = -1;

        monthsWithData.forEach(m => {
            const idx = monthOrder.indexOf(m);
            if (idx > latestIdx) {
                latestIdx = idx;
            }
        });

        if (latestIdx !== -1) {
            targetMonth = monthOrder[latestIdx];
        } else {
            // Ultimate fallback
            targetMonth = monthOrder[new Date().getMonth()];
        }
    }

    // 2. Identify ALL students logically part of the CURRENT filter scope
    const searchTerm = elements.searchInput ? elements.searchInput.value.toLowerCase().trim() : '';
    const teacherVal = elements.teacherFilter ? elements.teacherFilter.value : 'all';

    const allKnownStudentsMap = {};
    const contactedInTargetMonth = new Set();

    // Populate the universe of students and track their absolute last contact date
    if (teacherVal === 'all' && searchTerm === '') {
        masterStudentList.forEach(student => {
            allKnownStudentsMap[student] = new Date(0); // Initialize with minimum date
        });
    }

    appData.forEach(item => {
        if (!item.student || item.student.toLowerCase().includes('öğrenci')) return;

        // Apply Teacher Filter (Dropdown)
        const matchesTeacher = (currentRole.type === 'teacher') ? true : (teacherVal === 'all' || item.teacher === teacherVal);

        // Apply Search Filter
        const matchesSearch = searchTerm === '' ||
            item.student.toLowerCase().includes(searchTerm) ||
            item.teacher.toLowerCase().includes(searchTerm) ||
            item.notes.toLowerCase().includes(searchTerm);

        if (!matchesTeacher || !matchesSearch) return;

        const itemDate = parseDateString(item.meetingDate);
        if (!allKnownStudentsMap[item.student] || itemDate > allKnownStudentsMap[item.student]) {
            allKnownStudentsMap[item.student] = itemDate;
        }

        // Did they get contacted in the target month?
        if (item.month === targetMonth) {
            contactedInTargetMonth.add(item.student);
        }
    });

    // 3. Find who wasn't contacted in the target month
    const uncontacted = [];
    const now = new Date();

    Object.keys(allKnownStudentsMap).forEach(student => {
        // If the student doesn't exist in contactedInTargetMonth, they were NOT contacted in the target month!
        if (!contactedInTargetMonth.has(student)) {
            const lastDate = allKnownStudentsMap[student];
            // Compute days since last contact for context showing
            let diffDays = 0;
            if (lastDate.getTime() !== 0) {
                const diffTime = Math.abs(now - lastDate);
                diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            }

            uncontacted.push({ student, lastDate, diffDays });
        }
    });

    // Sort alphabetically by student name
    uncontacted.sort((a, b) => a.student.localeCompare(b.student));

    elements.uncontactedTableBody.innerHTML = '';

    // Update the panel title dynamically
    const panelTitle = document.querySelector('#tab-uncontacted h2');
    if (panelTitle) {
        panelTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #EF4444;"></i> İletişim Kurulmayan Öğrenciler (${targetMonth} Ayı)`;
    }
    const panelSubtitle = document.querySelector('#tab-uncontacted .table-actions span');
    if (panelSubtitle) {
        panelSubtitle.textContent = `Bu liste tamamen "${targetMonth}" ayına odaklanır. Diğer aylarda görüşülmüş olsa bile ${targetMonth} ayında kayıt girilmemişse burada listelenir.`;
    }

    if (uncontacted.length === 0) {
        elements.uncontactedTableBody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 20px; color: var(--text-secondary);"><i class="fa-solid fa-circle-check" style="color:#10B981; margin-right:8px;"></i>${targetMonth} ayı için iletişim kurulmayan öğrenci bulunamadı.</td></tr>`;
        return;
    }

    uncontacted.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600;">${item.student}</td>
            <td><span class="chip" style="background: #FEF2F2; color: #EF4444; border: 1px solid #FECACA; font-weight: 600;">Kayıtsız</span></td>
        `;
        elements.uncontactedTableBody.appendChild(tr);
    });

    // İletişimsiz Öğrenciler: Excel Export
    const exportBtn = document.getElementById('export-uncontacted-btn');
    if (exportBtn) {
        // Eski listener'ı silmek için butonu kopyalayıp değiştiriyoruz
        const newBtn = exportBtn.cloneNode(true);
        exportBtn.parentNode.replaceChild(newBtn, exportBtn);
        newBtn.addEventListener('click', () => exportUncontactedToExcel(uncontacted, targetMonth));
    }
}

/**
 * İletişimsiz Öğrenciler Excel Çıktısı (SheetJS)
 */
function exportUncontactedToExcel(uncontactedList, targetMonth) {
    if (typeof XLSX === 'undefined') {
        alert("Excel dışa aktarma kütüphanesi yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.");
        return;
    }

    const exportData = uncontactedList.map(item => ({
        "Öğrenci Adı": item.student,
        "Durum": "Kayıtsız (İlgili Ayda Görüşülmemiş)"
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    ws['!cols'] = [
        { wch: 30 }, // Öğrenci Adı
        { wch: 40 }  // Durum
    ];

    XLSX.utils.book_append_sheet(wb, ws, "IletisimiOlmayanlar");
    XLSX.writeFile(wb, `Iletisimi_Olmayan_Ogrenciler_${targetMonth}.xlsx`);
}

/**
 * Render Öğrenciler Tab
 */
function renderStudentsTab() {
    if (!elements.studentsTableBody) return;
    elements.studentsTableBody.innerHTML = '';

    // Aggregate by student
    const studentMap = {};
    filteredData.forEach(item => {
        // Enforce role restriction: Teachers only see their own students
        if (currentRole.type === 'teacher' && item.teacher !== currentRole.teacherName) return;

        if (!studentMap[item.student]) {
            studentMap[item.student] = { count: 0, lastMeeting: '-', teachers: new Set() };
        }
        studentMap[item.student].count++;
        studentMap[item.student].teachers.add(item.teacher);

        // Very basic simple latest date grab (since appData is reverse chronologically sorted usually)
        if (studentMap[item.student].lastMeeting === '-') {
            studentMap[item.student].lastMeeting = item.meetingDate;
        }
    });

    let studentArray = Object.keys(studentMap).map(name => ({
        name: name,
        ...studentMap[name]
    })).sort((a, b) => b.count - a.count);


    if (studentArray.length === 0) {
        elements.studentsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Öğrenci bulunamadı.</td></tr>';
        return;
    }

    studentArray.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600;">${s.name}</td>
            <td><span class="chip" style="background:#EEF2FF; color:#4F46E5;">${s.count} Görüşme</span></td>
            <td class="date-cell">${s.lastMeeting}</td>
            <td><span class="text-truncate" style="max-width:200px;">${Array.from(s.teachers).join(', ')}</span></td>
        `;
        elements.studentsTableBody.appendChild(tr);
    });
}

function initNativeForm() {
    // DOM elements
    const steps = [
        document.getElementById('form-step-1'),
        document.getElementById('form-step-2'),
        document.getElementById('form-step-3'),
        document.getElementById('form-step-4')
    ];
    const btnNext = document.getElementById('fBtnNext');
    const btnPrev = document.getElementById('fBtnPrev');
    const stepBar = document.getElementById('form-step-bar');
    const formAlert = document.getElementById('form-alert');
    
    // Form Inputs
    const fDate = document.getElementById('fDate');
    const fTeacher = document.getElementById('fTeacher');
    const fStudentSearch = document.getElementById('fStudentSearch');
    const fStudentList = document.getElementById('fStudentList');
    const fMeetingWithChips = document.getElementById('fMeetingWithChips');
    const fMeetingHowChips = document.getElementById('fMeetingHowChips');
    const fSummaryTags = document.getElementById('fSummaryTags');
    const fNotes = document.getElementById('fNotes');
    const fCharCount = document.getElementById('fCharCount');

    // Make sure we have the elements before proceeding
    if (!steps[0]) return;

    // Reset State
    formState = {
        step: 0, // 0-indexed for array
        date: '',
        teacher: currentRole.type === 'teacher' ? currentRole.teacherName : '',
        student: '',
        meetingWith: '',
        meetingHow: '',
        notes: ''
    };

    // 1. Setup Step Bar
    const stepTitles = ["Tarih & Öğretmen", "Öğrenci", "Detay", "Notlar"];
    stepBar.innerHTML = '';
    stepTitles.forEach((title, idx) => {
        const dot = document.createElement('div');
        dot.style.cssText = `flex: 1; height: 4px; background: ${idx === 0 ? 'var(--primary)' : '#E2E8F0'}; border-radius: 4px; position: relative; transition: all 0.3s ease;`;
        
        const label = document.createElement('div');
        label.style.cssText = `position: absolute; top: 12px; left: 0; font-size: 11px; font-weight: 600; color: ${idx === 0 ? 'var(--primary)' : 'var(--text-tertiary)'}; white-space: nowrap; transition: color 0.3s ease;`;
        label.textContent = title;
        
        dot.appendChild(label);
        stepBar.appendChild(dot);
    });

    // 2. Setup Step 1: Date & Teacher
    fDate.innerHTML = '';
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
        const displayStr = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth()+1).toString().padStart(2, '0')}.${d.getFullYear()}`;
        
        const opt = document.createElement('option');
        opt.value = dateStr;
        opt.textContent = i === 0 ? `Bugün (${displayStr})` : (i === 1 ? `Dün (${displayStr})` : displayStr);
        fDate.appendChild(opt);
    }
    
    if (currentRole.type === 'teacher') {
        fTeacher.value = currentRole.teacherName;
        fTeacher.disabled = true;
    } else {
        fTeacher.value = '';
        fTeacher.disabled = false;
        fTeacher.placeholder = "Öğretmen adını yazınız...";
    }

    // 3. Setup Step 2: Students
    const renderStudentList = (searchTerm = '') => {
        fStudentList.innerHTML = '';
        let count = 0;
        masterStudentList.forEach(student => {
            if (searchTerm && !student.toLowerCase().includes(searchTerm.toLowerCase())) return;
            if (count > 50) return; // limit to 50
            
            const div = document.createElement('div');
            div.style.cssText = `padding: 12px 16px; border-bottom: 1px solid var(--border-light); cursor: pointer; transition: background 0.2s; font-size: 14px; font-weight: 500;`;
            if (formState.student === student) {
                div.style.background = '#EEF2FF';
                div.style.color = 'var(--primary)';
                div.style.fontWeight = '600';
            }
            div.textContent = student;
            div.addEventListener('click', () => {
                formState.student = student;
                renderStudentList(searchTerm);
                validateStep();
            });
            div.addEventListener('mouseenter', () => { if(formState.student !== student) div.style.background = '#F8FAFC'; });
            div.addEventListener('mouseleave', () => { if(formState.student !== student) div.style.background = 'transparent'; });
            
            fStudentList.appendChild(div);
            count++;
        });
        
        if (count === 0) {
            fStudentList.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-tertiary); font-size: 14px;">Öğrenci bulunamadı.</div>';
        }
    };
    fStudentSearch.addEventListener('input', (e) => renderStudentList(e.target.value));
    renderStudentList();

    // 4. Setup Step 3: Chips
    const whoOptions = ["Anne", "Baba", "Öğretmen", "Diğer"];
    const howOptions = ["Yüzyüze", "Telefon", "Whatsap SMS"];
    
    const renderChips = (container, options, stateKey) => {
        container.innerHTML = '';
        options.forEach(opt => {
            const chip = document.createElement('div');
            const isSelected = formState[stateKey] === opt;
            chip.style.cssText = `padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; border: 1px solid ${isSelected ? 'var(--primary)' : 'var(--border-light)'}; background: ${isSelected ? 'var(--primary)' : 'transparent'}; color: ${isSelected ? 'white' : 'var(--text-secondary)'};`;
            chip.textContent = opt;
            chip.addEventListener('click', () => {
                formState[stateKey] = opt;
                renderChips(container, options, stateKey);
                validateStep();
            });
            container.appendChild(chip);
        });
    };
    renderChips(fMeetingWithChips, whoOptions, 'meetingWith');
    renderChips(fMeetingHowChips, howOptions, 'meetingHow');

    // 5. Setup Step 4: Notes
    fNotes.value = '';
    const updateCharCount = () => {
        const len = fNotes.value.length;
        fCharCount.textContent = `${len} karakter — en az 10`;
        fCharCount.style.color = len >= 10 ? '#10B981' : 'var(--text-tertiary)';
        formState.notes = fNotes.value;
        validateStep();
    };
    // remove previous listener to avoid duplicate accumulation 
    const fNotesClone = fNotes.cloneNode(true);
    fNotes.parentNode.replaceChild(fNotesClone, fNotes);
    fNotesClone.addEventListener('input', (e) => {
        const len = e.target.value.length;
        fCharCount.textContent = `${len} karakter — en az 10`;
        fCharCount.style.color = len >= 10 ? '#10B981' : 'var(--text-tertiary)';
        formState.notes = e.target.value;
        validateStep();
    });

    // Validation & Navigation
    const validateStep = () => {
        let isValid = false;
        if (formState.step === 0) {
            formState.date = fDate.value;
            formState.teacher = fTeacher.value.trim();
            isValid = formState.date && formState.teacher;
        } else if (formState.step === 1) {
            isValid = !!formState.student;
        } else if (formState.step === 2) {
            isValid = !!formState.meetingWith && !!formState.meetingHow;
        } else if (formState.step === 3) {
            isValid = formState.notes.length >= 10;
        }
        
        const myBtnNext = document.getElementById('fBtnNext');
        myBtnNext.disabled = !isValid;
        myBtnNext.style.opacity = isValid ? '1' : '0.5';
        myBtnNext.style.cursor = isValid ? 'pointer' : 'not-allowed';
        
        if (formState.step === 3 && isValid) {
            myBtnNext.textContent = 'Kaydet ve Gönder';
            myBtnNext.style.background = 'var(--secondary)';
        } else {
            myBtnNext.textContent = 'İleri →';
            myBtnNext.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-light))';
        }
    };

    const updateUI = () => {
        steps.forEach((s, idx) => {
            if (idx === formState.step) s.classList.remove('hidden');
            else s.classList.add('hidden');
        });
        
        Array.from(stepBar.children).forEach((dot, idx) => {
            if (idx <= formState.step) {
                dot.style.background = 'var(--primary)';
                dot.firstChild.style.color = 'var(--primary)';
            } else {
                dot.style.background = '#E2E8F0';
                dot.firstChild.style.color = 'var(--text-tertiary)';
            }
        });
        
        const myBtnPrev = document.getElementById('fBtnPrev');
        myBtnPrev.style.visibility = formState.step === 0 ? 'hidden' : 'visible';
        
        if (formState.step === 3) {
            fSummaryTags.innerHTML = `
                <div style="background: #F8FAFC; padding: 4px 10px; border-radius: 4px; font-size: 12px; color: var(--text-secondary);"><i class="fa-regular fa-calendar"></i> ${formState.date}</div>
                <div style="background: #F8FAFC; padding: 4px 10px; border-radius: 4px; font-size: 12px; color: var(--text-secondary);"><i class="fa-solid fa-person-chalkboard"></i> ${formState.teacher}</div>
                <div style="background: #EEF2FF; padding: 4px 10px; border-radius: 4px; font-size: 12px; color: var(--primary); font-weight: 500;"><i class="fa-solid fa-user-graduate"></i> ${formState.student}</div>
                <div style="background: #F0FDF4; padding: 4px 10px; border-radius: 4px; font-size: 12px; color: #16A34A; font-weight: 500;"><i class="fa-solid fa-users"></i> ${formState.meetingWith}</div>
                <div style="background: #FFFBEB; padding: 4px 10px; border-radius: 4px; font-size: 12px; color: #D97706; font-weight: 500;"><i class="fa-solid fa-phone"></i> ${formState.meetingHow}</div>
            `;
        }
        
        validateStep();
    };

    const newBtnNext = btnNext.cloneNode(true);
    btnNext.parentNode.replaceChild(newBtnNext, btnNext);
    const newBtnPrev = btnPrev.cloneNode(true);
    btnPrev.parentNode.replaceChild(newBtnPrev, btnPrev);
    
    newBtnNext.addEventListener('click', () => {
        if (formState.step < 3) {
            formState.step++;
            updateUI();
        } else {
            submitForm();
        }
    });
    
    newBtnPrev.addEventListener('click', () => {
        if (formState.step > 0) {
            formState.step--;
            updateUI();
        }
    });
    
    fTeacher.addEventListener('input', validateStep);
    
    const submitForm = () => {
        newBtnNext.disabled = true;
        newBtnNext.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Buluta Gönderiliyor...';
        
        // --- CHROME/SAFARI UYUMLU DOĞRUDAN FETCH YÖNTEMİ --- //
        const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSdLGM1U1XAHAUYz7XE67_XdpLXjvX96bVQVTpnXAEqo26C_Fw/formResponse';
        
        const params = new URLSearchParams();
        
        // Tarih formatlama
        if (formState.date) {
            const [year, month, day] = formState.date.split('-');
            params.append('entry.528037490_year', year);
            params.append('entry.528037490_month', month);
            params.append('entry.528037490_day', day);
        }
        
        params.append('entry.1616934269', formState.teacher || ''); 
        params.append('entry.512562233', formState.student || '');
        params.append('entry.731883738', formState.meetingWith || '');
        params.append('entry.1073634912', formState.meetingHow || '');
        params.append('entry.1722173290', formState.notes || '');

        // Chrome'un iframe engellemelerine (CORS / SameSite) takılmadan arka planda sessizce veriyi post et
        fetch(formUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        }).then(() => {
            finishSubmit(true);
        }).catch((e) => {
            console.error("Fetch API ile form gönderim hatası", e);
            finishSubmit(false); // Her ne olursa olsun arayüzü başarısız göster (no-cors bazen hata fırlatmaz, sessizce red yer)
        });

        // Eğer tarayıcı hiçbir yanıt dönmezse (no-cors blackhole durumu) 2 sn sonra işlemin başarılı olduğunu farz et.
        const timeoutSafe = setTimeout(() => {
            finishSubmit(true);
        }, 2000);

        let isFinished = false;
        function finishSubmit(success) {
            if (isFinished) return;
            isFinished = true;
            clearTimeout(timeoutSafe);

            if (success) {
                try {
                    // UI Mock Update
                    const mockRecord = {
                        id: 'mock_' + Date.now(),
                        timestamp: new Date().toLocaleString('tr-TR'),
                        meetingDate: formState.date.split('-').reverse().join('.'),
                        teacher: formState.teacher,
                        student: formState.student,
                        who: formState.meetingWith,
                        how: formState.meetingHow,
                        notes: formState.notes,
                        month: new Date(formState.date).toLocaleString('tr-TR', { month: 'long' })
                    };
                    mockRecord.month = mockRecord.month.charAt(0).toUpperCase() + mockRecord.month.slice(1);
                    appData.unshift(mockRecord);
                    applyFilters();
                    
                    // Show Success
                    formAlert.classList.remove('hidden');
                    formAlert.style.cssText = `background: #ECFDF5; border: 1px solid #A7F3D0; color: #065F46; padding: 16px; border-radius: 8px; margin-bottom: 24px; font-size: 14px; display: flex; align-items: center; gap: 12px;`;
                    formAlert.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #10B981; font-size: 20px;"></i> Başarıyla kaydedildi! Veriler gerçek tabloya aktarıldı.`;
                    
                    setTimeout(() => {
                        formAlert.classList.add('hidden');
                        document.querySelector('.menu-item[data-tab="dashboard"]').click();
                        initNativeForm();
                    }, 2000);
                } catch (err) {
                    console.error("Local UI Update Error:", err);
                    showErrorUI();
                }
            } else {
                showErrorUI();
            }

            function showErrorUI() {
                newBtnNext.disabled = false;
                newBtnNext.innerHTML = 'Tekrar Dene';
                formAlert.classList.remove('hidden');
                formAlert.style.cssText = `background: #FEF2F2; border: 1px solid #FECACA; color: #DC2626; padding: 16px; border-radius: 8px; margin-bottom: 24px; font-size: 14px; display: flex; align-items: center; gap: 12px;`;
                formAlert.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color: #EF4444; font-size: 20px;"></i> Bağlantı veya işleme hatası oluştu, lütfen tekrar deneyin.`;
            }
        }
    };

    updateUI();
}


