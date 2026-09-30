let allRestaurants = [];
let showOnlyOpen = false; // 是否只顯示營業中

document.addEventListener('DOMContentLoaded', () => {
    fetch('restaurants.json')
        .then(response => {
            if (!response.ok) throw new Error('Network response failure');
            return response.json();
        })
        .then(data => {
            allRestaurants = data;
            renderRestaurants(allRestaurants);
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

// ⏰ 判斷目前是否營業中的核心邏輯
function isOpenNow(hoursStr) {
    if (!hoursStr || hoursStr === "24小時營業") return true;
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 格式化解析 "11:00 - 20:30" 或 "11:00-20:30"
    const times = hoursStr.split('-').map(t => t.trim());
    if (times.length !== 2) return true; // 若格式無法解析預設顯示

    const parseMinutes = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + (m || 0);
    };

    const startMinutes = parseMinutes(times[0]);
    let endMinutes = parseMinutes(times[1]);

    // 跨夜處理（例如 17:00 - 02:00）
    if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
        if (currentMinutes < startMinutes) {
            return (currentMinutes + 24 * 60) <= endMinutes;
        }
    }

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

// 渲染餐廳卡片列表 (含即時營業狀態)
function renderRestaurants(list) {
    const container = document.getElementById('restaurant-list');
    const countDisplay = document.getElementById('restaurant-count');
    if (!container) return;

    // 是否套用「只看營業中」過濾
    let displayList = list;
    if (showOnlyOpen) {
        displayList = list.filter(item => isOpenNow(item.hours));
    }

    if (countDisplay) {
        countDisplay.textContent = `共找到 ${displayList.length} 家淡江美食`;
    }

    if (!displayList || displayList.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <p class="fs-5 text-muted">😢 找不到符合條件的淡江美食（可能目前時間已打烊），試試切換區域或關閉「只看營業中」！</p>
            </div>`;
        return;
    }

    container.innerHTML = displayList.map(item => {
        const rating = item.rating || "4.0";
        const reviewCount = item.reviewCount || 0;
        const address = item.address || '淡江大學周邊';
        const hours = item.hours || '11:00 - 20:30';
        const openStatus = isOpenNow(hours);
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

// 🟢 切換「只看營業中」按鈕
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
        renderRestaurants(allRestaurants);
    });
}

// 🎲 隨機抽獎
function setupRandomPicker() {
    const startBtn = document.getElementById('start-roll-btn');
    const slotDisplay = document.getElementById('slot-machine');
    const resultCard = document.getElementById('random-result-card');

    if (!startBtn) return;

    startBtn.addEventListener('click', () => {
        if (!allRestaurants || allRestaurants.length === 0) return;

        startBtn.disabled = true;
        resultCard.classList.add('d-none');
        slotDisplay.classList.remove('d-none');

        let counter = 0;
        const speed = 50;
        const totalRolls = 20;

        const interval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * allRestaurants.length);
            slotDisplay.textContent = allRestaurants[randomIndex].name;
            counter++;

            if (counter >= totalRolls) {
                clearInterval(interval);
                
                const winner = allRestaurants[Math.floor(Math.random() * allRestaurants.length)];
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

// 路段按鈕篩選
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

            const selectedRoad = e.target.dataset.road;

            if (!selectedRoad || selectedRoad === '全部') {
                renderRestaurants(allRestaurants);
            } else {
                const filtered = allRestaurants.filter(item => {
                    const roadStr = (item.road || '').toLowerCase();
                    const addrStr = (item.address || '').toLowerCase();

                    if (selectedRoad === '學府路') {
                        return addrStr.includes('學府路') || roadStr.includes('學府路');
                    }
                    if (selectedRoad === '大學城') {
                        return roadStr.includes('大學城') || addrStr.includes('大學城') || addrStr.includes('學府路') || addrStr.includes('182巷');
                    }
                    return roadStr.includes(selectedRoad) || addrStr.includes(selectedRoad);
                });
                renderRestaurants(filtered);
            }
        });
    });
}

// 美食種類篩選
function setupCategoryButtons() {
    const catBtns = document.querySelectorAll('.category-btn');
    if (!catBtns.length) return;

    catBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            catBtns.forEach(b => b.classList.remove('active', 'btn-dark'));
            e.target.classList.add('active', 'btn-dark');

            const cat = e.target.dataset.category;
            if (cat === '全部') {
                renderRestaurants(allRestaurants);
            } else {
                const filtered = allRestaurants.filter(item => {
                    const categoryMatch = (item.category || '').includes(cat);
                    const nameMatch = (item.name || '').includes(cat);
                    const introMatch = (item.intro || '').includes(cat);
                    return categoryMatch || nameMatch || introMatch;
                });
                renderRestaurants(filtered);
            }
        });
    });
}

// 搜尋框即時過濾
function setupSearchInput() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (!query) {
            renderRestaurants(allRestaurants);
            return;
        }

        const filtered = allRestaurants.filter(item => {
            const nameMatch = (item.name || '').toLowerCase().includes(query);
            const addressMatch = (item.address || '').toLowerCase().includes(query);
            const categoryMatch = (item.category || '').toLowerCase().includes(query);
            const roadMatch = (item.road || '').toLowerCase().includes(query);
            return nameMatch || addressMatch || categoryMatch || roadMatch;
        });

        renderRestaurants(filtered);
    });
}

// 量身訂做進階篩選
function setupSmartFilter() {
    const applyBtn = document.getElementById('apply-filter-btn');
    if (!applyBtn) return;

    applyBtn.addEventListener('click', () => {
        const road = document.getElementById('filter-road')?.value || 'ALL';
        const category = document.getElementById('filter-category')?.value || 'ALL';
        const minRating = parseFloat(document.getElementById('filter-rating')?.value || '0');

        const filtered = allRestaurants.filter(item => {
            let roadMatch = true;
            if (road !== 'ALL') {
                const addr = item.address || '';
                const r = item.road || '';
                if (road === '學府路') {
                    roadMatch = addr.includes('學府路') || r.includes('學府路');
                } else if (road === '大學城') {
                    roadMatch = r.includes('大學城') || addr.includes('學府路') || addr.includes('182巷');
                } else {
                    roadMatch = r.includes(road) || addr.includes(road);
                }
            }

            let catMatch = true;
            if (category !== 'ALL') {
                catMatch = (item.category || '').includes(category) || (item.name || '').includes(category);
            }

            const ratingVal = parseFloat(item.rating || '0');
            const ratingMatch = ratingVal >= minRating;

            return roadMatch && catMatch && ratingMatch;
        });

        renderRestaurants(filtered);
    });
}