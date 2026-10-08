let allRestaurants = [];
let displayedRestaurants = [];
let showOnlyOpen = false;

// 🎯 全域紀錄目前的條件狀態，實現「多條件疊加過濾」
let currentRoad = '全部';
let currentCategory = '全部';

document.addEventListener('DOMContentLoaded', () => {
    fetch('restaurants.json')
        .then(response => {
            if (!response.ok) throw new Error('Network response failure');
            return response.json();
        })
        .then(data => {
            // 🎲 每次開啟/重新整理網頁時隨機洗牌
            allRestaurants = shuffleArray(data);
            displayedRestaurants = [...allRestaurants];

            renderRestaurants();
            setupCategoryButtons();
            setupRoadButtons();
            setupSearchInput();
            setupSmartFilter();
            setupRandomPicker();
            setupOpenStatusToggle();
        })
        .catch(error => {
            console.error('無法載入 restaurants.json:', error);
            const container = document.getElementById('restaurant-list');
            if (container) {
                container.innerHTML = `
                    <div class="col-12 text-center py-5">
                        <div class="alert alert-warning d-inline-block px-4">
                            ⚠️ 載入店家資料失敗，請確認 restaurants.json 檔案是否存在。
                        </div>
                    </div>`;
            }
        });
});

// 陣列隨機洗牌
function shuffleArray(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ⏰ 判斷目前是否營業中
function isOpenNow(item) {
    if (!item) return false;

    const hoursStr = (item.hours || "").toLowerCase();
    const nameStr = (item.name || "").toLowerCase();
    
    if (hoursStr.includes("24小時") || hoursStr.includes("24 hrs") || hoursStr.includes("全天營業") || nameStr.includes("7-11") || nameStr.includes("全家")) {
        return true;
    }
    if (hoursStr.includes("休息") || hoursStr.includes("公休")) {
        return false;
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (item.periods && Array.isArray(item.periods) && item.periods.length > 0) {
        for (let period of item.periods) {
            if (!period.open) continue;

            const openDay = period.open.day;
            const openHour = period.open.hour || 0;
            const openMinute = period.open.minute || 0;
            const openTimeMin = openHour * 60 + openMinute;

            if (!period.close) {
                if (openDay === currentDay || openHour === 0) return true;
                continue;
            }

            const closeDay = period.close.day;
            const closeHour = period.close.hour || 0;
            const closeMinute = period.close.minute || 0;
            let closeTimeMin = closeHour * 60 + closeMinute;

            if (openDay === currentDay && closeDay === currentDay) {
                if (currentMinutes >= openTimeMin && currentMinutes <= closeTimeMin) {
                    return true;
                }
            } else if (openDay === currentDay) {
                closeTimeMin += 24 * 60;
                if (currentMinutes >= openTimeMin && currentMinutes <= closeTimeMin) {
                    return true;
                }
            } else if (closeDay === currentDay) {
                if (currentMinutes <= closeTimeMin) {
                    return true;
                }
            }
        }
        return false;
    }

    const ranges = hoursStr.split(',');
    for (let range of ranges) {
        const times = range.split('-').map(t => t.trim());
        if (times.length !== 2) continue;

        const parseMinutes = (tStr) => {
            const m = tStr.match(/(\d{1,2}):(\d{2})/);
            if (!m) return -1;
            return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        };

        const startM = parseMinutes(times[0]);
        let endM = parseMinutes(times[1]);
        if (startM === -1 || endM === -1) continue;

        if (endM < startM) endM += 24 * 60;

        if (currentMinutes >= startM && currentMinutes <= endM) {
            return true;
        }
    }

    return false;
}

// 🌙 精確判斷宵夜
function isLateNightFood(item) {
    if (item.category && item.category.includes("宵夜")) return true;
    const hoursStr = item.hours || "";
    if (hoursStr.includes("24小時")) return true;

    if (item.periods && item.periods.length > 0) {
        for (let period of item.periods) {
            if (period.close) {
                const closeHour = period.close.hour;
                if (closeHour >= 22 || closeHour <= 5) return true;
            }
        }
    }

    const nightRegex = /(2[2-9]|0[0-5]):\d{2}/;
    return nightRegex.test(hoursStr);
}

// 🎯 核心組合過濾器：同時考量【路段】+【種類】+【只看營業中】+【搜尋關鍵字】
function applyCombinedFilter() {
    const searchInput = document.getElementById('search-input');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    displayedRestaurants = allRestaurants.filter(item => {
        // 1. 路段條件比對
        let roadMatch = true;
        if (currentRoad !== '全部') {
            const roadStr = (item.road || '').toLowerCase();
            const addrStr = (item.address || '').toLowerCase();
            if (currentRoad === '學府路') {
                roadMatch = addrStr.includes('學府路') || roadStr.includes('學府路');
            } else if (currentRoad === '大學城') {
                roadMatch = roadStr.includes('大學城') || addrStr.includes('大學城') || addrStr.includes('學府路') || addrStr.includes('182巷');
            } else {
                roadMatch = roadStr.includes(currentRoad.toLowerCase()) || addrStr.includes(currentRoad.toLowerCase());
            }
        }

        // 2. 種類條件比對
        let catMatch = true;
        if (currentCategory !== '全部') {
            if (currentCategory === '宵夜') {
                catMatch = isLateNightFood(item);
            } else {
                const catStr = (item.category || '').toLowerCase();
                const nameStr = (item.name || '').toLowerCase();
                const introStr = (item.intro || '').toLowerCase();
                const targetCat = currentCategory.toLowerCase();
                catMatch = catStr.includes(targetCat) || nameStr.includes(targetCat) || introStr.includes(targetCat);
            }
        }

        // 3. 搜尋欄文字比對
        let searchMatch = true;
        if (query) {
            const nameStr = (item.name || '').toLowerCase();
            const addrStr = (item.address || '').toLowerCase();
            const catStr = (item.category || '').toLowerCase();
            const roadStr = (item.road || '').toLowerCase();
            searchMatch = nameStr.includes(query) || addrStr.includes(query) || catStr.includes(query) || roadStr.includes(query);
        }

        return roadMatch && catMatch && searchMatch;
    });

    renderRestaurants();
}

// 渲染畫面
function renderRestaurants() {
    const container = document.getElementById('restaurant-list');
    const countDisplay = document.getElementById('restaurant-count');
    if (!container) return;

    let list = displayedRestaurants;
    if (showOnlyOpen) {
        list = displayedRestaurants.filter(item => isOpenNow(item));
    }

    if (countDisplay) {
        countDisplay.textContent = `共找到 ${list.length} 家淡江美食`;
    }

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <p class="fs-5 text-muted">😢 找不到符合條件的店家（例如目前組合無營業店家），試試切換條件或關閉「只看營業中」！</p>
            </div>`;
        return;
    }

    container.innerHTML = list.map(item => {
        const rating = item.rating || "4.0";
        const reviewCount = item.reviewCount || 0;
        const address = item.address || '淡江大學周邊';
        const hours = item.hours || '11:00 - 20:30';
        const openStatus = isOpenNow(item);
        const googleMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ' ' + address)}`;

        return `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card h-100 shadow-sm border-0 rounded-3 hover-card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge bg-primary fs-6 px-2 py-1">${item.road || '周邊商圈'}</span>
                            <span class="text-warning fw-bold">★ ${rating} <small class="text-muted">(${reviewCount})</small></span>
                        </div>
                        <h5 class="card-title fw-bold text-dark mb-2">${item.name}</h5>
                        <div class="mb-2 d-flex align-items-center gap-1 flex-wrap">
                            <span class="badge ${openStatus ? 'bg-success' : 'bg-secondary'} px-2 py-1">
                                ${openStatus ? '🟢 營業中' : '🔴 休息中'}
                            </span>
                            <span class="badge bg-light text-dark border">${item.category || '美食'}</span>
                            ${item.isPopular ? '<span class="badge bg-danger">🔥 超人氣</span>' : ''}
                        </div>
                        <p class="card-text text-secondary fs-7 mb-1">${item.intro || '淡江學生熱門用餐選擇'}</p>
                        <p class="text-muted small mb-1">🕒 營業時間：${hours}</p>
                        <p class="text-muted small mb-0">📍 ${address}</p>
                    </div>
                    <div class="card-footer bg-white border-0 pt-0 pb-3">
                        <a href="${googleMapUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-primary btn-sm w-100 rounded-pill fw-bold">
                            🗺️ 在 Google 地圖開啟
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 設定路段按鈕點擊
function setupRoadButtons() {
    const roadBtns = document.querySelectorAll('.road-btn');
    if (!roadBtns.length) return;

    roadBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            roadBtns.forEach(b => {
                b.classList.remove('active', 'btn-primary');
                b.classList.add('btn-outline-primary');
            });
            e.target.classList.remove('btn-outline-primary');
            e.target.classList.add('active', 'btn-primary');

            currentRoad = e.target.dataset.road || '全部';
            applyCombinedFilter();
        });
    });
}

// 設定食物種類按鈕點擊
function setupCategoryButtons() {
    const catBtns = document.querySelectorAll('.category-btn');
    if (!catBtns.length) return;

    catBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            catBtns.forEach(b => b.classList.remove('active', 'btn-dark'));
            e.target.classList.add('active', 'btn-dark');

            currentCategory = e.target.dataset.category || '全部';
            applyCombinedFilter();
        });
    });
}

// 切換「只看營業中」
function setupOpenStatusToggle() {
    const toggleBtn = document.getElementById('open-only-btn');
    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
        showOnlyOpen = !showOnlyOpen;
        if (showOnlyOpen) {
            toggleBtn.classList.remove('btn-outline-success');
            toggleBtn.classList.add('btn-success', 'active');
            toggleBtn.textContent = '🟢 已篩選：只看營業中';
        } else {
            toggleBtn.classList.remove('btn-success', 'active');
            toggleBtn.classList.add('btn-outline-success');
            toggleBtn.textContent = '🟢 只看營業中';
        }
        renderRestaurants();
    });
}

// 搜尋框即時監聽
function setupSearchInput() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
        applyCombinedFilter();
    });
}

// 🎲 隨機抽獎系統
function setupRandomPicker() {
    const startBtn = document.getElementById('start-roll-btn');
    const slotDisplay = document.getElementById('slot-machine');
    const resultCard = document.getElementById('random-result-card');
    const roadSelect = document.getElementById('random-road-select');

    if (!startBtn) return;

    startBtn.addEventListener('click', () => {
        const selectedRoad = roadSelect ? roadSelect.value : 'ALL';
        
        let candidateList = allRestaurants;
        if (selectedRoad !== 'ALL') {
            candidateList = allRestaurants.filter(item => {
                const addr = item.address || '';
                const r = item.road || '';
                if (selectedRoad === '學府路') return addr.includes('學府路') || r.includes('學府路');
                if (selectedRoad === '大學城') return r.includes('大學城') || addr.includes('學府路') || addr.includes('182巷');
                return r.includes(selectedRoad) || addr.includes(selectedRoad);
            });
        }

        candidateList = candidateList.filter(item => isOpenNow(item));

        if (candidateList.length === 0) {
            alert('⚠️ 該區域目前沒有正在營業中的店家，請試試選擇其他區域！');
            return;
        }

        startBtn.disabled = true;
        resultCard.classList.add('d-none');
        slotDisplay.classList.remove('d-none');

        let counter = 0;
        const speed = 50;
        const totalRolls = 20;

        const interval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * candidateList.length);
            slotDisplay.textContent = candidateList[randomIndex].name;
            counter++;

            if (counter >= totalRolls) {
                clearInterval(interval);
                
                const winner = candidateList[Math.floor(Math.random() * candidateList.length)];
                slotDisplay.classList.add('d-none');
                resultCard.classList.remove('d-none');

                const rating = winner.rating || "4.0";
                const address = winner.address || '淡江大學周邊';
                const googleMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(winner.name + ' ' + address)}`;

                resultCard.innerHTML = `
                    <div class="card border-2 border-danger shadow-sm rounded-4 p-3 text-start">
                        <div class="text-center mb-2">
                            <span class="badge bg-danger fs-6 mb-1">🎉 命運決定是你了！</span>
                            <h3 class="fw-bold text-dark mt-1">${winner.name}</h3>
                        </div>
                        <p class="mb-1"><strong>📍 位置：</strong>${winner.road}（${address}）</p>
                        <p class="mb-1"><strong>🕒 狀態：</strong><span class="badge bg-success">🟢 目前營業中</span> (${winner.hours})</p>
                        <p class="mb-1"><strong>⭐ 評分：</strong>${rating} ★</p>
                        <p class="text-secondary small mb-3">${winner.intro}</p>
                        <a href="${googleMapUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-danger w-100 rounded-pill fw-bold">
                            🗺️ 立刻出發！開啟地圖導航
                        </a>
                    </div>
                `;

                startBtn.disabled = false;
                startBtn.textContent = '🔄 再抽一次！';
            }
        }, speed);
    });
}

// 進階篩選器
function setupSmartFilter() {
    const applyBtn = document.getElementById('apply-filter-btn');
    if (!applyBtn) return;

    applyBtn.addEventListener('click', () => {
        const road = document.getElementById('filter-road')?.value || 'ALL';
        const category = document.getElementById('filter-category')?.value || 'ALL';
        const minRating = parseFloat(document.getElementById('filter-rating')?.value || '0');

        displayedRestaurants = allRestaurants.filter(item => {
            let roadMatch = true;
            if (road !== 'ALL') {
                const addr = item.address || '';
                const r = item.road || '';
                if (road === '學府路') roadMatch = addr.includes('學府路') || r.includes('學府路');
                else if (road === '大學城') roadMatch = r.includes('大學城') || addr.includes('學府路') || addr.includes('182巷');
                else roadMatch = r.includes(road) || addr.includes(road);
            }

            let catMatch = true;
            if (category !== 'ALL') {
                if (category === '宵夜') catMatch = isLateNightFood(item);
                else catMatch = (item.category || '').includes(category) || (item.name || '').includes(category);
            }

            const ratingVal = parseFloat(item.rating || '0');
            const ratingMatch = ratingVal >= minRating;

            return roadMatch && catMatch && ratingMatch;
        });

        renderRestaurants();
    });
}